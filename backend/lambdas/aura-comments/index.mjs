import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand,
  UpdateCommand, ScanCommand, TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const COMMENTS_TABLE = 'aura-comments';

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
  const { text, parentCommentId } = body;

  if (typeof text !== 'string' || !text.trim()) {
    return response(400, { error: 'Comment text is required.' });
  }

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
  }

  if (text.length > charLimit) {
    return response(400, {
      error: `Comment must be under ${charLimit} characters.`,
    });
  }

  // Check comment visibility setting on post
  // postCommentVisibility: 'anyone' | 'followers'
  if (post.commentVisibility === 'followers') {
    // TODO: check if userId follows post.authorId
    // For now allow — follower check added when follow system is built
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
    if (!parentResult.Item || parentResult.Item.postId !== postId) {
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
    text:            text.trim(),
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

  return response(201, comment);
}

// ─── Get comments for a post ──────────────────────────────────
async function getComments(postId, viewerId, limit = 50) {
  const postResult = await dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId } }));
  const post = postResult.Item;
  if (!post || post.status !== 'active') return response(404, { error: 'Post not found.' });
  if (post.groupId && !(await groupAccess(post.groupId, viewerId)).canSee) {
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

  // Like counts are private to each comment's author, and this route is public
  for (const comment of items) delete comment.likeCount;

  const comments = items
    .sort((a, b) => {
      // Sort by aura score first, then recency
      const auraDiff = b.auraScore - a.auraScore;
      if (auraDiff !== 0) return auraDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, limit);

  // Separate top-level comments and replies
  const topLevel = comments.filter(c => !c.parentCommentId);
  const replies   = comments.filter(c => !!c.parentCommentId);

  // Attach replies to their parent
  const threaded = topLevel.map(comment => ({
    ...comment,
    replies: replies
      .filter(r => r.parentCommentId === comment.commentId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
  }));

  return response(200, { comments: threaded });
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

    const body = JSON.parse(event.body ?? '{}');

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
