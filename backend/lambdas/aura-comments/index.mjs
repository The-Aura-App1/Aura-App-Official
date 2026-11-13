import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, BatchGetCommand,
  UpdateCommand, ScanCommand, TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { cleanText, hasVisibleText } from './text.mjs';
import { canSeeAccount, isFollowing } from './privacy.mjs';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const COMMENTS_TABLE = 'aura-comments';
const LIKES_TABLE    = 'aura-likes';
const MAX_REPLIES_SHOWN = 100;   // per top-level comment

// Site moderators (the aura_app account). Keep in sync across aura-users,
// aura-posts and aura-comments. IDs come from the verified Cognito token, so
// nobody else can act as a moderator.
const ADMIN_IDS = new Set(['74081408-8031-706d-70d9-e1fa81428cb1']);
const POSTS_TABLE    = 'aura-posts';
const USERS_TABLE    = 'aura-users';
const GROUPS_TABLE   = 'aura-groups';
const MEMBERS_TABLE  = 'aura-group-members';

// Instagram-style limit for global posts
// Reddit-style limit for group posts
const CHAR_LIMIT_GLOBAL = 2200;
const CHAR_LIMIT_GROUP  = 10000;

// ─── Rate limits ──────────────────────────────────────────────
// Fixed-window counters in aura-rate-limits (partition key limitKey, TTL on
// expiresAt). Fails open: if the table is missing or unreachable, requests are
// allowed and the limiter rests for a minute, so it can never take the API down.
const RATE_TABLE = 'aura-rate-limits';
let rateLimitsOffUntil = 0;

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// Returns a 429 response once `who` has made `limit` requests in this window
async function rateLimited(who, bucket, limit, windowSeconds) {
  if (Date.now() < rateLimitsOffUntil) return null;
  const now    = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / windowSeconds);
  try {
    await dynamo.send(new UpdateCommand({
      TableName:                 RATE_TABLE,
      Key:                       { limitKey: `${who}#${bucket}#${windowSeconds}#${window}` },
      UpdateExpression:          'SET expiresAt = :exp ADD #count :one',
      ConditionExpression:       'attribute_not_exists(#count) OR #count < :limit',
      ExpressionAttributeNames:  { '#count': 'count' },
      ExpressionAttributeValues: { ':one': 1, ':limit': limit, ':exp': (window + 1) * windowSeconds + 60 },
    }));
    return null;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      const retryAfter = (window + 1) * windowSeconds - now;
      return response(429, { error: 'Too many requests. Please slow down and try again shortly.' },
        { 'Retry-After': String(retryAfter) });
    }
    console.warn(`Rate limiter unavailable (${err.name}); allowing requests for a minute.`);
    rateLimitsOffUntil = Date.now() + 60_000;
    return null;
  }
}

// Runs several limits in order and returns the first 429, if any
async function firstLimit(...checks) {
  for (const [who, bucket, limit, windowSeconds] of checks) {
    const limited = await rateLimited(who, bucket, limit, windowSeconds);
    if (limited) return limited;
  }
  return null;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Comment text is stored through cleanText (text.mjs): Unicode-normalized,
// without invisible characters or the direction-override marks that can make
// text display as something other than what it says, line endings unified and
// long runs of blank lines shortened. It's still plain text; the app never
// renders it as HTML.

// Request bodies must be JSON objects; anything else is a 400, not a crash
function parseBody(raw) {
  if (raw === undefined || raw === null || raw === '') return {};
  try {
    const body = JSON.parse(raw);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function decodeSegment(value) {
  try { return decodeURIComponent(value ?? ''); } catch { return null; }
}

// What anyone may see of a comment. Only listed fields go out, so internal
// ones (who reported it, report counts, aura breakdowns) never leak. The
// like count goes to the comment's own author only; canDelete is true for the
// author and site moderators.
//
// `author` is the author's current profile when known, so a comment always
// shows the name and picture they have now. (Names copied onto old comments
// could otherwise point at whoever later takes a freed-up username.)
function publicComment(comment, viewerId, likedIds, author = null) {
  const isAuthor = !!viewerId && comment.authorId === viewerId;
  return {
    commentId:       comment.commentId,
    postId:          comment.postId,
    authorId:        comment.authorId,
    authorUsername:  author?.username ?? comment.authorUsername,
    authorDisplay:   author?.displayName ?? comment.authorDisplay,
    authorPicKey:    author?.profilePicKey ?? '',
    text:            comment.text,
    parentCommentId: comment.parentCommentId ?? null,
    auraScore:       comment.auraScore ?? 0,
    createdAt:       comment.createdAt,
    likedByMe:       likedIds.has(comment.commentId),
    canDelete:       isAuthor || ADMIN_IDS.has(viewerId),
    ...(isAuthor && { likeCount: comment.likeCount ?? 0 }),
  };
}

// Current public profile details for each author, by userId
async function authorsOf(comments) {
  const ids = [...new Set(comments.map(c => c.authorId).filter(Boolean))];
  const authors = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    let request = {
      [USERS_TABLE]: {
        Keys: ids.slice(i, i + 100).map(userId => ({ userId })),
        ProjectionExpression: 'userId, username, displayName, profilePicKey',
      },
    };
    while (request && Object.keys(request).length) {
      const result = await dynamo.send(new BatchGetCommand({ RequestItems: request }));
      for (const user of result.Responses?.[USERS_TABLE] ?? []) authors.set(user.userId, user);
      request = result.UnprocessedKeys;
    }
  }
  return authors;
}

// The comment ids, out of `comments`, that the viewer has liked
async function likedByViewer(comments, viewerId) {
  const liked = new Set();
  if (!viewerId || !comments.length) return liked;
  const keys = comments.map(c => ({ userId: viewerId, postId: `comment#${c.commentId}` }));
  for (let i = 0; i < keys.length; i += 100) {
    let request = { [LIKES_TABLE]: { Keys: keys.slice(i, i + 100), ProjectionExpression: 'targetId' } };
    while (request && Object.keys(request).length) {
      const result = await dynamo.send(new BatchGetCommand({ RequestItems: request }));
      for (const like of result.Responses?.[LIKES_TABLE] ?? []) liked.add(like.targetId);
      request = result.UnprocessedKeys;
    }
  }
  return liked;
}

// Same rules as aura-posts: open groups are readable by anyone logged in
// (except banned users), other groups by members only; only members comment
async function groupAccess(groupId, viewerId) {
  const groupResult = await dynamo.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { groupId } }));
  const group = groupResult.Item?.status === 'active' ? groupResult.Item : null;
  if (!group) return { canSee: false, isMember: false };
  const member = viewerId
    ? (await dynamo.send(new GetCommand({ TableName: MEMBERS_TABLE, Key: { groupId, userId: viewerId } }))).Item
    : null;
  const isMember = member?.status === 'active';
  return { isMember, canSee: isMember || (group.joinType === 'open' && member?.status !== 'banned') };
}

// ─── Create comment ───────────────────────────────────────────
async function createComment(userId, postId, body) {
  const { parentCommentId } = body;
  if (typeof body.text !== 'string') return response(400, { error: 'Comment text is required.' });
  const text = cleanText(body.text);
  if (!text || !hasVisibleText(text)) return response(400, { error: 'Comment text is required.' });

  // Get post to check visibility settings and type
  const postResult = await dynamo.send(new GetCommand({
    TableName: POSTS_TABLE,
    Key: { postId },
  }));

  if (!postResult.Item || postResult.Item.status !== 'active') {
    return response(404, { error: 'Post not found.' });
  }

  const post     = postResult.Item;
  const isGroup  = !!post.groupId;
  const charLimit = isGroup ? CHAR_LIMIT_GROUP : CHAR_LIMIT_GLOBAL;

  if (isGroup) {
    const access = await groupAccess(post.groupId, userId);
    if (!access.canSee) return response(404, { error: 'Post not found.' });
    if (!access.isMember) return response(403, { error: 'Only group members can comment here.' });
  } else if (!(await canSeeAccount(dynamo, userId, post.authorId, ADMIN_IDS.has(userId)))) {
    return response(404, { error: 'Post not found.' });
  }

  if (text.length > charLimit) {
    return response(400, {
      error: `Comment must be under ${charLimit} characters.`,
    });
  }

  // Followers-only posts: the author and approved followers may comment.
  // Any other stored value also fails closed rather than letting anyone in.
  const visibility = post.commentVisibility ?? 'anyone';
  if (!isGroup && visibility !== 'anyone' && post.authorId !== userId
      && !(visibility === 'followers' && await isFollowing(dynamo, userId, post.authorId))) {
    return response(403, { error: 'Only followers can comment on this post.' });
  }

  // Get commenter info
  const userResult = await dynamo.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));

  if (!userResult.Item) return response(404, { error: 'User not found.' });
  if (userResult.Item.isBanned) return response(403, { error: 'Account banned.' });

  const user = userResult.Item;

  // If reply, verify parent comment exists and belongs to this post
  if (parentCommentId !== undefined && parentCommentId !== null && typeof parentCommentId !== 'string') {
    return response(400, { error: 'Invalid parentCommentId.' });
  }
  if (parentCommentId) {
    const parentResult = await dynamo.send(new GetCommand({
      TableName: COMMENTS_TABLE,
      Key: { commentId: parentCommentId },
    }));
    if (!parentResult.Item || parentResult.Item.postId !== postId || parentResult.Item.status !== 'active') {
      return response(404, { error: 'Parent comment not found.' });
    }
    // Only one level deep — cannot reply to a reply
    if (parentResult.Item.parentCommentId) {
      return response(400, { error: 'Cannot reply to a reply.' });
    }
  }

  const commentId = generateId();
  const now       = new Date().toISOString();

  const comment = {
    commentId,
    postId,
    authorId:        userId,
    authorUsername:  user.username,
    authorDisplay:   user.displayName,
    text,
    parentCommentId: parentCommentId ?? null,
    auraScore:       0,
    auraReceived:    0,
    auraTaken:       0,
    status:          'active',
    createdAt:       now,
  };

  // Write comment + increment post comment count
  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: COMMENTS_TABLE,
          Item:      comment,
        },
      },
      {
        Update: {
          TableName:                 POSTS_TABLE,
          Key:                       { postId },
          UpdateExpression:          'ADD commentCount :one',
          ExpressionAttributeValues: { ':one': 1 },
        },
      },
    ],
  }));

  return response(201, { ...publicComment(comment, userId, new Set(), user), replies: [] });
}

// ─── Get comments for a post ──────────────────────────────────
async function getComments(postId, viewerId, limit = 50) {
  const postResult = await dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId } }));
  const post = postResult.Item;
  if (!post || post.status !== 'active') return response(404, { error: 'Post not found.' });
  if (post.groupId && !(await groupAccess(post.groupId, viewerId)).canSee) {
    return response(404, { error: 'Post not found.' });
  }
  if (!post.groupId && !(await canSeeAccount(dynamo, viewerId, post.authorId, ADMIN_IDS.has(viewerId)))) {
    return response(404, { error: 'Post not found.' });
  }

  // Scan every page: a single page stops at 1 MB, before the filter is applied
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new ScanCommand({
      TableName:        COMMENTS_TABLE,
      FilterExpression: 'postId = :pid AND #status = :active',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':pid': postId, ':active': 'active' },
      ExclusiveStartKey,
    }));
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  // The top `limit` comments by aura (then newest), each with its replies
  // oldest first. Replies to a removed comment go with it.
  const topLevel = items
    .filter(c => !c.parentCommentId)
    .sort((a, b) => ((b.auraScore ?? 0) - (a.auraScore ?? 0)) || (Date.parse(b.createdAt) - Date.parse(a.createdAt)))
    .slice(0, limit);
  const repliesByParent = new Map(topLevel.map(c => [c.commentId, []]));
  for (const reply of items) {
    repliesByParent.get(reply.parentCommentId)?.push(reply);
  }
  for (const replies of repliesByParent.values()) {
    replies.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    replies.splice(MAX_REPLIES_SHOWN);
  }

  const shown = [...topLevel, ...[...repliesByParent.values()].flat()];
  const [liked, authors] = await Promise.all([likedByViewer(shown, viewerId), authorsOf(shown)]);
  const view = c => publicComment(c, viewerId, liked, authors.get(c.authorId));
  const threaded = topLevel.map(comment => ({
    ...view(comment),
    replies: repliesByParent.get(comment.commentId).map(view),
  }));

  return response(200, { comments: threaded, total: items.length });
}

// ─── Delete comment ───────────────────────────────────────────
async function deleteComment(commentId, userId) {
  const result = await dynamo.send(new GetCommand({
    TableName: COMMENTS_TABLE,
    Key: { commentId },
  }));

  if (!result.Item) return response(404, { error: 'Comment not found.' });

  // Authors can delete their own comments; site moderators can remove any
  if (result.Item.authorId !== userId && !ADMIN_IDS.has(userId)) {
    return response(403, { error: 'Not your comment.' });
  }

  if (result.Item.status !== 'active') return response(200, { message: 'Comment deleted.' });

  // Remove the comment and lower the post's count together, once
  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName:                 COMMENTS_TABLE,
            Key:                       { commentId },
            UpdateExpression:          'SET #status = :removed',
            ConditionExpression:       '#status = :active',
            ExpressionAttributeNames:  { '#status': 'status' },
            ExpressionAttributeValues: { ':removed': 'removed', ':active': 'active' },
          },
        },
        {
          Update: {
            TableName:                 POSTS_TABLE,
            Key:                       { postId: result.Item.postId },
            UpdateExpression:          'ADD commentCount :neg',
            ConditionExpression:       'attribute_exists(postId)',
            ExpressionAttributeValues: { ':neg': -1 },
          },
        },
      ],
    }));
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
  }

  return response(200, { message: 'Comment deleted.' });
}

// ─── Report comment ───────────────────────────────────────────
async function reportComment(commentId, userId, reason) {
  const result = await dynamo.send(new GetCommand({
    TableName: COMMENTS_TABLE,
    Key: { commentId },
  }));

  if (!result.Item || result.Item.status !== 'active') return response(404, { error: 'Comment not found.' });
  if (result.Item.authorId === userId) return response(400, { error: 'You cannot report your own comment.' });

  // Each person can report a comment once, so it takes 5 different people to hide it
  let updated;
  try {
    updated = await dynamo.send(new UpdateCommand({
      TableName:                 COMMENTS_TABLE,
      Key:                       { commentId },
      UpdateExpression:          'ADD reportCount :one, reportedBy :me',
      ConditionExpression:       'attribute_not_exists(reportedBy) OR NOT contains(reportedBy, :uid)',
      ExpressionAttributeValues: { ':one': 1, ':me': new Set([userId]), ':uid': userId },
      ReturnValues:              'ALL_NEW',
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    return response(200, { message: 'Comment reported.' });
  }

  // Auto-remove at 5 reports
  if ((updated.Attributes?.reportCount ?? 0) >= 5) {
    await dynamo.send(new UpdateCommand({
      TableName:                 COMMENTS_TABLE,
      Key:                       { commentId },
      UpdateExpression:          'SET #status = :pending',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':pending': 'pending_review' },
    }));
  }

  return response(200, { message: 'Comment reported.' });
}

// ─── Main handler ─────────────────────────────────────────────
export const handler = async (event) => {
  const method   = event.requestContext?.http?.method ?? event.httpMethod;
  const path     = event.requestContext?.http?.path   ?? event.path;
  const userId   = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const segments = path.split('/').filter(Boolean);

  // Logged-out requests are limited per IP address
  const who      = userId ?? `ip:${event.requestContext?.http?.sourceIp ?? 'unknown'}`;

  try {
    const limited = await firstLimit([who, 'api', userId ? 120 : 60, 60]);
    if (limited) return limited;

    const body = parseBody(event.body);
    if (!body && method === 'POST') return response(400, { error: 'The request body must be a JSON object.' });
    // Ids in the path arrive URL-encoded
    for (let i = 1; i < segments.length; i++) {
      const decoded = decodeSegment(segments[i]);
      if (decoded === null) return response(404, { error: 'Route not found.' });
      segments[i] = decoded;
    }

    // GET /posts/{id}/comments
    if (method === 'GET' && segments[0] === 'posts' && segments[2] === 'comments') {
      const requested = parseInt(event.queryStringParameters?.limit ?? '50', 10);
      const limit     = Math.min(Math.max(requested || 50, 1), 200);
      return await getComments(segments[1], userId, limit);
    }

    // POST /posts/{id}/comments
    if (method === 'POST' && segments[0] === 'posts' && segments[2] === 'comments') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'comment', 10, 60], [userId, 'comment', 100, 3600]);
      if (actionLimited) return actionLimited;
      return await createComment(userId, segments[1], body);
    }

    // DELETE /comments/{id}
    if (method === 'DELETE' && segments[0] === 'comments' && segments.length === 2) {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await deleteComment(segments[1], userId);
    }

    // POST /comments/{id}/report
    if (method === 'POST' && segments[0] === 'comments' && segments[2] === 'report') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'report', 10, 3600]);
      if (actionLimited) return actionLimited;
      return await reportComment(segments[1], userId, body.reason);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error.' });
  }
};
