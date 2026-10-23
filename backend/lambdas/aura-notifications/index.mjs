import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand,
  UpdateCommand, ScanCommand, TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const NOTIFICATIONS_TABLE = 'aura-notifications';

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

// ─── Create notification ──────────────────────────────────────
async function createNotification(userId, type, data) {
  const notificationId = generateId();
  const now            = new Date().toISOString();

  const notification = {
    userId,          // who receives it
    notificationId,
    type,
    data,            // flexible payload depending on type
    read:     false,
    createdAt: now,
  };

  await dynamo.send(new PutCommand({
    TableName: NOTIFICATIONS_TABLE,
    Item:      notification,
  }));

  return notification;
}

// ─── Get notifications for user ───────────────────────────────
async function getNotifications(userId, limit = 30) {
  const result = await dynamo.send(new ScanCommand({
    TableName:        NOTIFICATIONS_TABLE,
    FilterExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));

  const notifications = (result.Items ?? [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);

  const unreadCount = notifications.filter(n => !n.read).length;

  return response(200, { notifications, unreadCount });
}

// ─── Mark notification as read ────────────────────────────────
async function markRead(userId, notificationId) {
  await dynamo.send(new UpdateCommand({
    TableName:                 NOTIFICATIONS_TABLE,
    Key:                       { userId, notificationId },
    UpdateExpression:          'SET #read = :true',
    ExpressionAttributeNames:  { '#read': 'read' },
    ExpressionAttributeValues: { ':true': true },
  }));

  return response(200, { message: 'Marked as read.' });
}

// ─── Mark all notifications as read ──────────────────────────
async function markAllRead(userId) {
  const result = await dynamo.send(new ScanCommand({
    TableName:        NOTIFICATIONS_TABLE,
    FilterExpression: 'userId = :uid AND #read = :false',
    ExpressionAttributeNames:  { '#read': 'read' },
    ExpressionAttributeValues: { ':uid': userId, ':false': false },
  }));

  const unread = result.Items ?? [];

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
  await dynamo.send(new UpdateCommand({
    TableName:                 NOTIFICATIONS_TABLE,
    Key:                       { userId, notificationId },
    UpdateExpression:          'SET #status = :deleted',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':deleted': 'deleted' },
  }));

  return response(200, { message: 'Notification deleted.' });
}

// ─── Send notification (internal — called by other Lambdas) ───
async function sendNotification(body) {
  const { userId, type, data } = body;
  if (!userId || !type) {
    return response(400, { error: 'userId and type are required.' });
  }

  // Don't notify yourself
  if (data?.fromUserId === userId) {
    return response(200, { message: 'Self-notification skipped.' });
  }

  const notification = await createNotification(userId, type, data);
  return response(201, notification);
}

// ─── Main handler ─────────────────────────────────────────────
export const handler = async (event) => {
  const method   = event.requestContext?.http?.method ?? event.httpMethod;
  const path     = event.requestContext?.http?.path   ?? event.path;
  const userId   = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const segments = path.split('/').filter(Boolean);

  try {
    const body = JSON.parse(event.body ?? '{}');

    // GET /notifications — get my notifications
    if (method === 'GET' && path === '/notifications') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const limit = parseInt(event.queryStringParameters?.limit ?? '30');
      return await getNotifications(userId, limit);
    }

    // POST /notifications/send — internal use, send a notification
    if (method === 'POST' && path === '/notifications/send') {
      return await sendNotification(body);
    }

    // PUT /notifications/{id}/read — mark one as read
    if (method === 'PUT' && segments[0] === 'notifications' && segments[2] === 'read') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await markRead(userId, segments[1]);
    }

    // PUT /notifications/read-all — mark all as read
    if (method === 'PUT' && path === '/notifications/read-all') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await markAllRead(userId);
    }

    // DELETE /notifications/{id} — delete notification
    if (method === 'DELETE' && segments[0] === 'notifications' && segments.length === 2) {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await deleteNotification(userId, segments[1]);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error.' });
  }
};