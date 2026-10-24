import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand,
  UpdateCommand, DeleteCommand, QueryCommand,
  ScanCommand, TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const GROUPS_TABLE  = 'aura-groups';
const MEMBERS_TABLE = 'aura-group-members';
const USERS_TABLE   = 'aura-users';
const MAX_GROUPS_PER_USER = 5;

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

// ─── Create group ─────────────────────────────────────────────
async function createGroup(userId, body) {
  const { name, description, joinType, hideMemberList } = body;

  if (!name || name.trim().length < 3) {
    return response(400, { error: 'Group name must be at least 3 characters.' });
  }
  if (name.length > 50) {
    return response(400, { error: 'Group name must be under 50 characters.' });
  }

  // Check banned words in group name (basic moderation)
  const bannedWords = ['admin', 'moderator', 'official', 'aura'];
  const nameLower = name.toLowerCase();
  for (const word of bannedWords) {
    if (nameLower.includes(word)) {
      return response(400, { error: `Group name cannot contain reserved words.` });
    }
  }

  // Check how many groups user already owns
  const owned = await dynamo.send(new ScanCommand({
    TableName: GROUPS_TABLE,
    FilterExpression: 'ownerId = :uid AND #status = :active',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':uid': userId, ':active': 'active' },
  }));

  if ((owned.Items?.length ?? 0) >= MAX_GROUPS_PER_USER) {
    return response(400, {
      error: `You can only own up to ${MAX_GROUPS_PER_USER} groups.`,
    });
  }

  const groupId = generateId();
  const now     = new Date().toISOString();

  const group = {
    groupId,
    name:           name.trim(),
    description:    description?.trim() ?? '',
    ownerId:        userId,
    joinType:       joinType ?? 'open', // open | invite | request
    hideMemberList: hideMemberList ?? false,
    bannerKey:      '',
    memberCount:    1,
    status:         'active',
    createdAt:      now,
    updatedAt:      now,
  };

  // Add group + add owner as member in one transaction
  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName:           GROUPS_TABLE,
          Item:                group,
          ConditionExpression: 'attribute_not_exists(groupId)',
        },
      },
      {
        Put: {
          TableName: MEMBERS_TABLE,
          Item: {
            groupId,
            userId,
            role:     'owner',
            joinedAt: now,
            status:   'active',
          },
        },
      },
    ],
  }));

  return response(201, group);
}

// ─── Get group ────────────────────────────────────────────────
async function getGroup(groupId, requesterId) {
  const result = await dynamo.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
  }));

  if (!result.Item || result.Item.status !== 'active') {
    return response(404, { error: 'Group not found.' });
  }

  const group = result.Item;

  // Check if requester is a member (logged-out viewers aren't)
  const memberResult = requesterId
    ? await dynamo.send(new GetCommand({
        TableName: MEMBERS_TABLE,
        Key: { groupId, userId: requesterId },
      }))
    : {};

  const isMember = !!memberResult.Item && memberResult.Item.status === 'active';
  const isOwner  = !!requesterId && group.ownerId === requesterId;
  const isMod    = memberResult.Item?.role === 'moderator';

  // Hide member list if configured and not owner/mod
  if (group.hideMemberList && !isOwner && !isMod) {
    delete group.memberCount;
  }

  return response(200, { ...group, isMember, isOwner, isMod });
}

// ─── Join group ───────────────────────────────────────────────
async function joinGroup(groupId, userId) {
  const groupResult = await dynamo.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
  }));

  if (!groupResult.Item || groupResult.Item.status !== 'active') {
    return response(404, { error: 'Group not found.' });
  }

  const group = groupResult.Item;

  // Check existing membership
  const existing = await dynamo.send(new GetCommand({
    TableName: MEMBERS_TABLE,
    Key: { groupId, userId },
  }));

  if (existing.Item?.status === 'active') {
    return response(400, { error: 'Already a member.' });
  }
  if (existing.Item?.status === 'banned') {
    return response(403, { error: 'You are banned from this group.' });
  }

  const now = new Date().toISOString();

  if (group.joinType === 'open') {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: MEMBERS_TABLE,
            Item: { groupId, userId, role: 'member', joinedAt: now, status: 'active' },
          },
        },
        {
          Update: {
            TableName:                 GROUPS_TABLE,
            Key:                       { groupId },
            UpdateExpression:          'ADD memberCount :one',
            ExpressionAttributeValues: { ':one': 1 },
          },
        },
      ],
    }));
    return response(200, { message: 'Joined group.', status: 'active' });
  }

  if (group.joinType === 'request') {
    await dynamo.send(new PutCommand({
      TableName: MEMBERS_TABLE,
      Item: { groupId, userId, role: 'member', requestedAt: now, status: 'pending' },
    }));
    return response(200, { message: 'Join request sent.', status: 'pending' });
  }

  if (group.joinType === 'invite') {
    return response(403, { error: 'This group is invite only.' });
  }

  return response(400, { error: 'Invalid join type.' });
}

// ─── Leave group ──────────────────────────────────────────────
async function leaveGroup(groupId, userId) {
  const groupResult = await dynamo.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
  }));

  if (!groupResult.Item) return response(404, { error: 'Group not found.' });
  if (groupResult.Item.ownerId === userId) {
    return response(400, { error: 'Owner cannot leave. Transfer ownership or delete the group.' });
  }

  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      {
        Delete: {
          TableName: MEMBERS_TABLE,
          Key:       { groupId, userId },
        },
      },
      {
        Update: {
          TableName:                 GROUPS_TABLE,
          Key:                       { groupId },
          UpdateExpression:          'ADD memberCount :neg',
          ExpressionAttributeValues: { ':neg': -1 },
        },
      },
    ],
  }));

  return response(200, { message: 'Left group.' });
}

// ─── Kick / ban member ────────────────────────────────────────
async function kickMember(groupId, requesterId, targetUserId, ban = false) {
  const groupResult = await dynamo.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
  }));

  if (!groupResult.Item) return response(404, { error: 'Group not found.' });

  const requesterMember = await dynamo.send(new GetCommand({
    TableName: MEMBERS_TABLE,
    Key: { groupId, userId: requesterId },
  }));

  const isOwner = groupResult.Item.ownerId === requesterId;
  const isMod   = requesterMember.Item?.role === 'moderator';

  if (!isOwner && !isMod) {
    return response(403, { error: 'Only owners and moderators can remove members.' });
  }
  if (targetUserId === groupResult.Item.ownerId) {
    return response(403, { error: 'Cannot kick the group owner.' });
  }

  if (ban) {
    await dynamo.send(new UpdateCommand({
      TableName:                 MEMBERS_TABLE,
      Key:                       { groupId, userId: targetUserId },
      UpdateExpression:          'SET #status = :banned',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':banned': 'banned' },
    }));
  } else {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: MEMBERS_TABLE,
            Key:       { groupId, userId: targetUserId },
          },
        },
        {
          Update: {
            TableName:                 GROUPS_TABLE,
            Key:                       { groupId },
            UpdateExpression:          'ADD memberCount :neg',
            ExpressionAttributeValues: { ':neg': -1 },
          },
        },
      ],
    }));
  }

  return response(200, { message: ban ? 'User banned.' : 'User kicked.' });
}

// ─── Appoint moderator ────────────────────────────────────────
async function appointModerator(groupId, ownerId, targetUserId) {
  const groupResult = await dynamo.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
  }));

  if (!groupResult.Item) return response(404, { error: 'Group not found.' });
  if (groupResult.Item.ownerId !== ownerId) {
    return response(403, { error: 'Only the owner can appoint moderators.' });
  }

  await dynamo.send(new UpdateCommand({
    TableName:                 MEMBERS_TABLE,
    Key:                       { groupId, userId: targetUserId },
    UpdateExpression:          'SET #role = :mod',
    ExpressionAttributeNames:  { '#role': 'role' },
    ExpressionAttributeValues: { ':mod': 'moderator' },
  }));

  return response(200, { message: 'Moderator appointed.' });
}

// ─── Delete group ─────────────────────────────────────────────
async function deleteGroup(groupId, ownerId) {
  const groupResult = await dynamo.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
  }));

  if (!groupResult.Item) return response(404, { error: 'Group not found.' });
  if (groupResult.Item.ownerId !== ownerId) {
    return response(403, { error: 'Only the owner can delete the group.' });
  }

  await dynamo.send(new UpdateCommand({
    TableName:                 GROUPS_TABLE,
    Key:                       { groupId },
    UpdateExpression:          'SET #status = :deleted',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':deleted': 'deleted' },
  }));

  return response(200, { message: 'Group deleted.' });
}

// ─── Approve join request ─────────────────────────────────────
async function approveRequest(groupId, requesterId, targetUserId, approve) {
  const groupResult = await dynamo.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
  }));

  if (!groupResult.Item) return response(404, { error: 'Group not found.' });

  const requesterMember = await dynamo.send(new GetCommand({
    TableName: MEMBERS_TABLE,
    Key: { groupId, userId: requesterId },
  }));

  const isOwner = groupResult.Item.ownerId === requesterId;
  const isMod   = requesterMember.Item?.role === 'moderator';

  if (!isOwner && !isMod) {
    return response(403, { error: 'Only owners and moderators can approve requests.' });
  }

  if (approve) {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName:                 MEMBERS_TABLE,
            Key:                       { groupId, userId: targetUserId },
            UpdateExpression:          'SET #status = :active, joinedAt = :now',
            ExpressionAttributeNames:  { '#status': 'status' },
            ExpressionAttributeValues: { ':active': 'active', ':now': new Date().toISOString() },
          },
        },
        {
          Update: {
            TableName:                 GROUPS_TABLE,
            Key:                       { groupId },
            UpdateExpression:          'ADD memberCount :one',
            ExpressionAttributeValues: { ':one': 1 },
          },
        },
      ],
    }));
    return response(200, { message: 'Request approved.' });
  } else {
    await dynamo.send(new DeleteCommand({
      TableName: MEMBERS_TABLE,
      Key:       { groupId, userId: targetUserId },
    }));
    return response(200, { message: 'Request declined.' });
  }
}

// ─── List groups ──────────────────────────────────────────────
async function listGroups(limit = 20) {
  const result = await dynamo.send(new ScanCommand({
    TableName:        GROUPS_TABLE,
    FilterExpression: '#status = :active',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':active': 'active' },
    Limit: 100,
  }));

  const groups = (result.Items ?? [])
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, limit);

  return response(200, { groups });
}

// ─── Main handler ─────────────────────────────────────────────
export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  const path   = event.requestContext?.http?.path   ?? event.path;
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const segments = path.split('/').filter(Boolean);

  try {
    const body = JSON.parse(event.body ?? '{}');

    // GET /groups — list groups
    if (method === 'GET' && path === '/groups') {
      return await listGroups();
    }

    // POST /groups — create group
    if (method === 'POST' && path === '/groups') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await createGroup(userId, body);
    }

    // GET /groups/{id} — get group
    if (method === 'GET' && segments[0] === 'groups' && segments.length === 2) {
      return await getGroup(segments[1], userId);
    }

    // DELETE /groups/{id} — delete group
    if (method === 'DELETE' && segments[0] === 'groups' && segments.length === 2) {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await deleteGroup(segments[1], userId);
    }

    // POST /groups/{id}/join — join group
    if (method === 'POST' && segments[0] === 'groups' && segments[2] === 'join') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await joinGroup(segments[1], userId);
    }

    // POST /groups/{id}/leave — leave group
    if (method === 'POST' && segments[0] === 'groups' && segments[2] === 'leave') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await leaveGroup(segments[1], userId);
    }

    // POST /groups/{id}/kick/{userId} — kick member
    if (method === 'POST' && segments[0] === 'groups' && segments[2] === 'kick') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await kickMember(segments[1], userId, segments[3], false);
    }

    // POST /groups/{id}/ban/{userId} — ban member
    if (method === 'POST' && segments[0] === 'groups' && segments[2] === 'ban') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await kickMember(segments[1], userId, segments[3], true);
    }

    // POST /groups/{id}/moderator/{userId} — appoint mod
    if (method === 'POST' && segments[0] === 'groups' && segments[2] === 'moderator') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await appointModerator(segments[1], userId, segments[3]);
    }

    // POST /groups/{id}/approve/{userId} — approve request
    if (method === 'POST' && segments[0] === 'groups' && segments[2] === 'approve') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await approveRequest(segments[1], userId, segments[3], true);
    }

    // POST /groups/{id}/decline/{userId} — decline request
    if (method === 'POST' && segments[0] === 'groups' && segments[2] === 'decline') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await approveRequest(segments[1], userId, segments[3], false);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    if (err.name === 'TransactionCanceledException') {
      return response(400, { error: 'Transaction failed.' });
    }
    return response(500, { error: 'Internal server error.' });
  }
};