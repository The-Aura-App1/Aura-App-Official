// Following. Lives in aura-users; index.mjs hands every /follows request to
// handleFollows. Every route needs a signed-in user (API route ANY
// /follows/{proxy+} with the cognito-auth authorizer).
//
// Table aura-follows, partition key `userId` (string), sort key `edge` (string).
// Each follow is two items, always written together in one transaction:
//   { userId: follower, edge: 'OUT#<followee>', otherId, status, createdAt }
//   { userId: followee, edge: 'IN#<follower>',  otherId, status, createdAt }
// status is 'active', or 'pending' while a private account hasn't approved it.
// followerCount / followingCount on the user records count active follows only.
//
// Routes:
//   GET    /follows/user/{username}             relationship + counts
//   POST   /follows/user/{username}             follow (or request, for private accounts)
//   DELETE /follows/user/{username}             unfollow or cancel a request
//   GET    /follows/user/{username}/followers   list (private accounts: followers only)
//   GET    /follows/user/{username}/following   list (same rule)
//   GET    /follows/requests                    my pending requests
//   POST   /follows/requests/{userId}/approve
//   POST   /follows/requests/{userId}/decline
//   DELETE /follows/followers/{userId}          remove one of my followers
//
// The other Lambdas check follows with privacy.mjs (read only).

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, BatchGetCommand, TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomBytes } from 'node:crypto';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

export const FOLLOWS_TABLE = 'aura-follows';
const USERS_TABLE          = 'aura-users';
const NOTIFICATIONS_TABLE  = 'aura-notifications';

const LIST_PAGE      = 50;
const MAX_FOLLOWING  = 5000;   // active follows plus open requests
const USER_ID_RE     = /^[A-Za-z0-9-]{1,64}$/;

const out = id => `OUT#${id}`;
const inn = id => `IN#${id}`;

async function getEdge(userId, edge) {
  const result = await db.send(new GetCommand({ TableName: FOLLOWS_TABLE, Key: { userId, edge } }));
  return result.Item ?? null;
}

async function getUserById(userId) {
  if (!USER_ID_RE.test(userId ?? '')) return null;
  const result = await db.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
  return result.Item ?? null;
}

const count = value => Math.max(0, Number(value) || 0);

// Updates both users' counters by `delta` (+1 or -1) inside a transaction
function counterUpdates(followerId, followeeId, delta) {
  return [
    [followerId, 'followingCount'],
    [followeeId, 'followerCount'],
  ].map(([userId, field]) => ({
    Update: {
      TableName:                 USERS_TABLE,
      Key:                       { userId },
      UpdateExpression:          `SET #f = if_not_exists(#f, :zero) + :d`,
      ConditionExpression:       'attribute_exists(userId)',
      ExpressionAttributeNames:  { '#f': field },
      ExpressionAttributeValues: { ':zero': 0, ':d': delta },
    },
  }));
}

// Both edge items must still be in the state we read, or nothing changes
function edgeCondition(status) {
  return {
    ConditionExpression:       '#s = :s',
    ExpressionAttributeNames:  { '#s': 'status' },
    ExpressionAttributeValues: { ':s': status },
  };
}

// Runs a follow transaction; a conflicting change at the same moment is a 409
async function transact(items, response) {
  try {
    await db.send(new TransactWriteCommand({ TransactItems: items }));
    return null;
  } catch (err) {
    if (err.name === 'TransactionCanceledException' || err.name === 'ConditionalCheckFailedException') {
      return response(409, { error: 'That changed just now. Refresh and try again.' });
    }
    throw err;
  }
}

// Best effort: a notification that fails to save never undoes the follow
async function notify(recipient, type, prefKey, actor, data = {}) {
  if (recipient.notificationPrefs?.[prefKey] === false) return;
  const now = Date.now();
  try {
    await db.send(new PutCommand({
      TableName: NOTIFICATIONS_TABLE,
      Item: {
        userId:         recipient.userId,
        notificationId: `${now}#${randomBytes(6).toString('hex')}`,
        type,
        data:           { fromUserId: actor.userId, fromUsername: actor.username, ...data },
        read:           false,
        createdAt:      new Date(now).toISOString(),
      },
    }));
  } catch (err) {
    console.warn(`Notification not saved (${err.name}).`);
  }
}

// What the viewer's relationship with `target` is
async function relationship(viewerId, target) {
  if (viewerId === target.userId) {
    return { status: 'self', followsYou: false, canSeePosts: true };
  }
  const [mine, theirs] = await Promise.all([
    getEdge(viewerId, out(target.userId)),
    getEdge(target.userId, out(viewerId)),
  ]);
  const status = mine?.status ?? 'none';
  return {
    status,
    followsYou:  theirs?.status === 'active',
    canSeePosts: !target.isPrivate || status === 'active',
  };
}

function summary(target, rel) {
  return {
    userId:         target.userId,
    isPrivate:      !!target.isPrivate,
    followerCount:  count(target.followerCount),
    followingCount: count(target.followingCount),
    ...rel,
  };
}

async function follow(viewer, target, response) {
  if (viewer.isBanned) return response(403, { error: 'Account banned.' });
  if (viewer.userId === target.userId) return response(400, { error: "You can't follow yourself." });

  const existing = await getEdge(viewer.userId, out(target.userId));
  if (existing) return response(200, summary(target, await relationship(viewer.userId, target)));

  // Open requests count too, so nobody can queue up endless requests
  const outgoing = await db.send(new QueryCommand({
    TableName:                 FOLLOWS_TABLE,
    KeyConditionExpression:    'userId = :u AND begins_with(edge, :p)',
    ExpressionAttributeValues: { ':u': viewer.userId, ':p': 'OUT#' },
    Select:                    'COUNT',
    Limit:                     MAX_FOLLOWING,
  }));
  if ((outgoing.Count ?? 0) >= MAX_FOLLOWING) {
    return response(400, { error: `You can follow up to ${MAX_FOLLOWING.toLocaleString('en-US')} accounts.` });
  }

  const status    = target.isPrivate ? 'pending' : 'active';
  const createdAt = new Date().toISOString();
  const items = [
    { Put: {
      TableName: FOLLOWS_TABLE,
      Item: { userId: viewer.userId, edge: out(target.userId), otherId: target.userId, status, createdAt },
      ConditionExpression: 'attribute_not_exists(edge)',
    } },
    { Put: {
      TableName: FOLLOWS_TABLE,
      Item: { userId: target.userId, edge: inn(viewer.userId), otherId: viewer.userId, status, createdAt },
      ConditionExpression: 'attribute_not_exists(edge)',
    } },
    ...(status === 'active' ? counterUpdates(viewer.userId, target.userId, 1) : []),
  ];
  const failed = await transact(items, response);
  if (failed) return failed;

  await notify(target, status === 'active' ? 'follow' : 'follow_request', 'followRequest', viewer);

  const fresh = await getUserById(target.userId);
  return response(200, summary(fresh ?? target, await relationship(viewer.userId, fresh ?? target)));
}

// Ends a follow (or a pending request) between followerId and followeeId
async function unlink(followerId, followeeId, response) {
  const edge = await getEdge(followerId, out(followeeId));
  if (!edge) return null;
  const items = [
    { Delete: { TableName: FOLLOWS_TABLE, Key: { userId: followerId, edge: out(followeeId) }, ...edgeCondition(edge.status) } },
    { Delete: { TableName: FOLLOWS_TABLE, Key: { userId: followeeId, edge: inn(followerId) }, ...edgeCondition(edge.status) } },
    ...(edge.status === 'active' ? counterUpdates(followerId, followeeId, -1) : []),
  ];
  return transact(items, response);
}

// Turns a pending request into a follow
async function approve(ownerId, requesterId, response) {
  const items = [
    { Update: {
      TableName: FOLLOWS_TABLE, Key: { userId: ownerId, edge: inn(requesterId) },
      UpdateExpression: 'SET #s = :active, approvedAt = :now',
      ConditionExpression: '#s = :pending',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':active': 'active', ':pending': 'pending', ':now': new Date().toISOString() },
    } },
    { Update: {
      TableName: FOLLOWS_TABLE, Key: { userId: requesterId, edge: out(ownerId) },
      UpdateExpression: 'SET #s = :active, approvedAt = :now',
      ConditionExpression: '#s = :pending',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':active': 'active', ':pending': 'pending', ':now': new Date().toISOString() },
    } },
    ...counterUpdates(requesterId, ownerId, 1),
  ];
  return transact(items, response);
}

// Queries one side of a user's follows. Cursors are checked so a crafted one
// can't read another user's partition.
async function queryEdges(userId, prefix, { status, cursor, limit = LIST_PAGE } = {}) {
  let ExclusiveStartKey;
  if (cursor) {
    try {
      const key = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
      if (key?.userId !== userId || typeof key.edge !== 'string' || !key.edge.startsWith(prefix)
          || Object.keys(key).length !== 2) return null;
      ExclusiveStartKey = key;
    } catch {
      return null;
    }
  }
  const items = [];
  let last;
  do {
    const result = await db.send(new QueryCommand({
      TableName:                 FOLLOWS_TABLE,
      KeyConditionExpression:    'userId = :u AND begins_with(edge, :p)',
      FilterExpression:          '#s = :s',
      ExpressionAttributeNames:  { '#s': 'status' },
      ExpressionAttributeValues: { ':u': userId, ':p': prefix, ':s': status },
      Limit:                     limit,
      ExclusiveStartKey,
    }));
    items.push(...(result.Items ?? []));
    last = result.LastEvaluatedKey;
    ExclusiveStartKey = last;
  } while (last && items.length < limit);
  return {
    items: items.slice(0, limit),
    next:  last ? Buffer.from(JSON.stringify(last)).toString('base64url') : null,
  };
}

// Small public cards for a list of user ids, skipping banned and missing accounts
async function cards(userIds) {
  const found = new Map();
  for (let i = 0; i < userIds.length; i += 100) {
    let request = { [USERS_TABLE]: {
      Keys: userIds.slice(i, i + 100).map(userId => ({ userId })),
      ProjectionExpression: 'userId, username, displayName, profilePicKey, isBanned, isPrivate',
    } };
    while (request && Object.keys(request).length) {
      const result = await db.send(new BatchGetCommand({ RequestItems: request }));
      for (const u of result.Responses?.[USERS_TABLE] ?? []) found.set(u.userId, u);
      request = result.UnprocessedKeys;
    }
  }
  return userIds.map(id => found.get(id)).filter(u => u && !u.isBanned).map(u => ({
    userId: u.userId, username: u.username, displayName: u.displayName,
    profilePicKey: u.profilePicKey ?? '', isPrivate: !!u.isPrivate,
  }));
}

// When an account goes public, everyone waiting is let in
export async function approveAllPending(ownerId) {
  const conflict = () => ({ conflict: true });
  let cursor = null;
  do {
    const page = await queryEdges(ownerId, 'IN#', { status: 'pending', cursor, limit: 100 });
    if (!page) return;
    for (const edge of page.items) await approve(ownerId, edge.otherId, conflict);
    cursor = page.next;
  } while (cursor);
}

export async function handleFollows({ method, segments, query = {}, userId, isAdmin, findUserByUsername, rateLimited, response }) {
  if (segments[0] !== 'follows') return null;
  if (!userId) return response(401, { error: 'Sign in first.' });

  const decode = value => { try { return decodeURIComponent(value ?? ''); } catch { return null; } };
  const [, area, rawA, action] = segments;
  const a = decode(rawA);
  if (a === null) return response(404, { error: 'Route not found.' });

  if (method !== 'GET') {
    const limited = await rateLimited(userId, 'follows', 30, 60)
      ?? await rateLimited(userId, 'follows-day', 400, 24 * 60 * 60);
    if (limited) return limited;
  }

  const viewer = await getUserById(userId);
  if (!viewer) return response(404, { error: 'Create your profile first.' });

  // /follows/user/{username}[/followers|/following]
  if (area === 'user' && a) {
    const target = await findUserByUsername(a.toLowerCase(), a);
    if (!target || (target.isBanned && !isAdmin)) return response(404, { error: 'User not found.' });

    if (segments.length === 3) {
      if (method === 'GET')    return response(200, summary(target, await relationship(userId, target)));
      if (method === 'POST')   return follow(viewer, target, response);
      if (method === 'DELETE') {
        const failed = await unlink(userId, target.userId, response);
        if (failed) return failed;
        const fresh = await getUserById(target.userId);
        return response(200, summary(fresh ?? target, await relationship(userId, fresh ?? target)));
      }
    }

    if (segments.length === 4 && method === 'GET' && (action === 'followers' || action === 'following')) {
      const rel = await relationship(userId, target);
      if (!rel.canSeePosts && !isAdmin) {
        return response(403, { error: 'This account is private.', private: true });
      }
      const page = await queryEdges(target.userId, action === 'followers' ? 'IN#' : 'OUT#',
        { status: 'active', cursor: query.cursor });
      if (!page) return response(400, { error: 'Invalid cursor.' });
      return response(200, { users: await cards(page.items.map(e => e.otherId)), next: page.next });
    }
  }

  // /follows/requests[/{userId}/approve|decline]
  if (area === 'requests') {
    if (method === 'GET' && segments.length === 2) {
      const page = await queryEdges(userId, 'IN#', { status: 'pending', cursor: query.cursor });
      if (!page) return response(400, { error: 'Invalid cursor.' });
      return response(200, { users: await cards(page.items.map(e => e.otherId)), next: page.next });
    }
    if (method === 'POST' && segments.length === 4 && (action === 'approve' || action === 'decline')) {
      const request = await getEdge(userId, inn(a));
      if (request?.status !== 'pending') return response(404, { error: 'Request not found.' });

      if (action === 'decline') {
        const failed = await unlink(a, userId, response);
        return failed ?? response(200, { status: 'declined' });
      }
      const failed = await approve(userId, a, response);
      if (failed) return failed;
      const requester = await getUserById(a);
      if (requester) await notify(requester, 'follow_accepted', 'followAccepted', viewer);
      return response(200, { status: 'approved' });
    }
  }

  // DELETE /follows/followers/{userId} — remove someone who follows me
  if (area === 'followers' && method === 'DELETE' && segments.length === 3) {
    if (!(await getEdge(userId, inn(a)))) return response(404, { error: 'Not a follower.' });
    const failed = await unlink(a, userId, response);
    return failed ?? response(200, { status: 'removed' });
  }

  return response(404, { error: 'Route not found.' });
}
