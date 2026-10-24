import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand,
  UpdateCommand, ScanCommand, TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const COMMENTS_TABLE = 'aura-comments';
const POSTS_TABLE    = 'aura-posts';
const USERS_TABLE    = 'aura-users';

// Instagram-style limit for global posts
// Reddit-style limit for group posts
const CHAR_LIMIT_GLOBAL = 2200;
const CHAR_LIMIT_GROUP  = 10000;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Create comment ───────────────────────────────────────────
async function createComment(userId, postId, body) {
  const { text, parentCommentId } = body;

  if (!text?.trim()) {
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
async function getComments(postId, limit = 50) {
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

  // Only author can delete their own comment
  if (result.Item.authorId !== userId) {
    return response(403, { error: 'Not your comment.' });
  }

  await dynamo.send(new UpdateCommand({
    TableName:                 COMMENTS_TABLE,
    Key:                       { commentId },
    UpdateExpression:          'SET #status = :removed',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':removed': 'removed' },
  }));

  // Decrement post comment count
  await dynamo.send(new UpdateCommand({
    TableName:                 POSTS_TABLE,
    Key:                       { postId: result.Item.postId },
    UpdateExpression:          'ADD commentCount :neg',
    ExpressionAttributeValues: { ':neg': -1 },
  }));

  return response(200, { message: 'Comment deleted.' });
}

// ─── Report comment ───────────────────────────────────────────
async function reportComment(commentId, userId, reason) {
  const result = await dynamo.send(new GetCommand({
    TableName: COMMENTS_TABLE,
    Key: { commentId },
  }));

  if (!result.Item) return response(404, { error: 'Comment not found.' });

  await dynamo.send(new UpdateCommand({
    TableName:                 COMMENTS_TABLE,
    Key:                       { commentId },
    UpdateExpression:          'ADD reportCount :one',
    ExpressionAttributeValues: { ':one': 1 },
  }));

  // Auto-remove at 5 reports
  if ((result.Item.reportCount ?? 0) + 1 >= 5) {
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

  try {
    const body = JSON.parse(event.body ?? '{}');

    // GET /posts/{id}/comments
    if (method === 'GET' && segments[0] === 'posts' && segments[2] === 'comments') {
      const limit = parseInt(event.queryStringParameters?.limit ?? '50');
      return await getComments(segments[1], limit);
    }

    // POST /posts/{id}/comments
    if (method === 'POST' && segments[0] === 'posts' && segments[2] === 'comments') {
      if (!userId) return response(401, { error: 'Unauthorized' });
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
      return await reportComment(segments[1], userId, body.reason);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error.' });
  }
};
