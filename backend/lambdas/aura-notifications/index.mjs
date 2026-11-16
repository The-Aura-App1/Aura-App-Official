import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const NOTIFICATIONS_TABLE = 'aura-notifications';
const MAX_LIMIT           = 100;

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

// ─── Notification types ───────────────────────────────────────
// aura_given      — someone gave aura to your post/comment
// aura_taken      — someone took aura from your post/comment
// comment         — someone commented on your post
// reply           — someone replied to your comment
// follow          — someone followed you
// group_join      — someone joined your group
// group_request   — someone requested to join your group
// group_approved  — your join request was approved
// mention         — someone mentioned you in a comment
// cashout_ready   — creator has reached cashout threshold
//
// Notifications are written by the backend directly. There is deliberately no
// public route for creating them, so nobody can send fake ones to other users.

// The user's notifications, newest first. notificationId starts with the
// creation time in milliseconds, so it sorts by age within the user's partition.
async function queryNotifications(userId, extra = {}) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName:                 NOTIFICATIONS_TABLE,
      KeyConditionExpression:    'userId = :uid',
      ScanIndexForward:          false,
      ExclusiveStartKey,
      ...extra,
      ExpressionAttributeValues: { ':uid': userId, ...extra.ExpressionAttributeValues },
    }));
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// ─── Get notifications for user ───────────────────────────────
async function getNotifications(userId, limit = 30) {
  const all = await queryNotifications(userId, {
    FilterExpression:          'attribute_not_exists(#status) OR #status <> :deleted',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':deleted': 'deleted' },
  });

  // The newest `limit`, plus every starred one however old (starring keeps it to come back to)
  const sorted = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const newest = sorted.slice(0, limit);
  const kept = new Set(newest.map(n => n.notificationId));
  const notifications = [...newest, ...sorted.filter(n => n.starred && !kept.has(n.notificationId))];

  const unreadCount = notifications.filter(n => !n.read).length;

  return response(200, { notifications, unreadCount });
}

// ─── Mark one notification read or unread, star or unstar it ───
// The condition stops these updates from creating empty notifications
async function setFlag(userId, notificationId, field, value) {
  try {
    await dynamo.send(new UpdateCommand({
      TableName:                 NOTIFICATIONS_TABLE,
      Key:                       { userId, notificationId },
      UpdateExpression:          'SET #f = :v',
      ConditionExpression:       'attribute_exists(notificationId)',
      ExpressionAttributeNames:  { '#f': field },
      ExpressionAttributeValues: { ':v': value },
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    return response(404, { error: 'Notification not found.' });
  }
  return null;
}

// PUT /notifications/{id}/read { read?: boolean } (no body: read)
async function markRead(userId, notificationId, body) {
  const read = body?.read === undefined ? true : body.read;
  if (typeof read !== 'boolean') return response(400, { error: 'read must be true or false.' });
  const failed = await setFlag(userId, notificationId, 'read', read);
  return failed ?? response(200, { message: read ? 'Marked as read.' : 'Marked as unread.', read });
}

// PUT /notifications/{id}/star { starred: boolean }: starred ones are kept to come back to
async function markStarred(userId, notificationId, body) {
  if (typeof body?.starred !== 'boolean') return response(400, { error: 'starred must be true or false.' });
  const failed = await setFlag(userId, notificationId, 'starred', body.starred);
  return failed ?? response(200, { message: body.starred ? 'Starred.' : 'Unstarred.', starred: body.starred });
}

// ─── Mark all notifications as read ──────────────────────────
async function markAllRead(userId) {
  const unread = await queryNotifications(userId, {
    FilterExpression:          '#read = :false',
    ExpressionAttributeNames:  { '#read': 'read' },
    ExpressionAttributeValues: { ':false': false },
  });

  // Update all unread in parallel
  await Promise.all(unread.map(n =>
    dynamo.send(new UpdateCommand({
      TableName:                 NOTIFICATIONS_TABLE,
      Key:                       { userId, notificationId: n.notificationId },
      UpdateExpression:          'SET #read = :true',
      ExpressionAttributeNames:  { '#read': 'read' },
      ExpressionAttributeValues: { ':true': true },
    }))
  ));

  return response(200, { message: `Marked ${unread.length} notifications as read.` });
}

// ─── Delete notification ──────────────────────────────────────
async function deleteNotification(userId, notificationId) {
  try {
    await dynamo.send(new UpdateCommand({
      TableName:                 NOTIFICATIONS_TABLE,
      Key:                       { userId, notificationId },
      UpdateExpression:          'SET #status = :deleted',
      ConditionExpression:       'attribute_exists(notificationId)',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':deleted': 'deleted' },
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    return response(404, { error: 'Notification not found.' });
  }

  return response(200, { message: 'Notification deleted.' });
}

// Ids arrive URL-encoded (they contain '#'); a bad escape is just an unknown id
function decodeId(value) {
  try { return decodeURIComponent(value); } catch { return ''; }
}
function parseBody(raw) {
  if (!raw) return {};
  try { const b = JSON.parse(raw); return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; } catch { return {}; }
}

// ─── Main handler ─────────────────────────────────────────────
export const handler = async (event) => {
  const method   = event.requestContext?.http?.method ?? event.httpMethod;
  const path     = event.requestContext?.http?.path   ?? event.path;
  const userId   = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const segments = path.split('/').filter(Boolean);

  try {
    if (!userId) return response(401, { error: 'Unauthorized' });

    const limited = await rateLimited(userId, 'notifications', 60, 60);
    if (limited) return limited;

    // GET /notifications — get my notifications
    if (method === 'GET' && path === '/notifications') {
      const requested = parseInt(event.queryStringParameters?.limit ?? '30', 10);
      const limit     = Math.min(Math.max(requested || 30, 1), MAX_LIMIT);
      return await getNotifications(userId, limit);
    }

    // PUT /notifications/read-all — mark all as read
    if (method === 'PUT' && path === '/notifications/read-all') {
      return await markAllRead(userId);
    }

    // PUT /notifications/{id}/read { read? } — mark one read (or unread)
    if (method === 'PUT' && segments[0] === 'notifications' && segments.length === 3 && segments[2] === 'read') {
      return await markRead(userId, decodeId(segments[1]), parseBody(event.body));
    }

    // PUT /notifications/{id}/star { starred } — star or unstar one
    if (method === 'PUT' && segments[0] === 'notifications' && segments.length === 3 && segments[2] === 'star') {
      return await markStarred(userId, decodeId(segments[1]), parseBody(event.body));
    }

    // DELETE /notifications/{id} — delete notification
    if (method === 'DELETE' && segments[0] === 'notifications' && segments.length === 2) {
      return await deleteNotification(userId, decodeId(segments[1]));
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error.' });
  }
};
