import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand,
  ScanCommand, TransactWriteCommand, BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const GROUPS_TABLE  = 'aura-groups';
const MEMBERS_TABLE = 'aura-group-members';
const USERS_TABLE   = 'aura-users';
const MAX_GROUPS_PER_USER = 5;
const BROWSE_LIMIT        = 50;
const MAX_DESCRIPTION     = 500;

const JOIN_TYPES = ['open', 'request', 'invite'];   // open is public; request and invite are private
// Whole words only, so "Laura's Friends" is allowed but "Aura Fans" isn't
const RESERVED_WORDS = /\b(aura|admin|official|moderator)\b/i;
// Group names are unique. A reservation item keyed NAME#<normalized name> in
// the groups table claims a name; it has no status or ownerId, so browsing
// and the ownerId index never see it.
const NAME_PREFIX = 'NAME#';

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

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cancellationCodes(err) {
  return (err.CancellationReasons ?? []).map(r => r?.Code);
}

// Runs the writes all-or-nothing. A failed condition means someone else changed
// the same membership first, so the caller gets a retryable 409.
async function commit(items) {
  try {
    await dynamo.send(new TransactWriteCommand({ TransactItems: items }));
    return null;
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    return response(409, { error: 'That membership changed while saving. Please refresh and try again.' });
  }
}

async function queryAll(params) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({ ...params, ExclusiveStartKey }));
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function batchGet(table, keys) {
  const items = [];
  for (let i = 0; i < keys.length; i += 100) {
    let request = { [table]: { Keys: keys.slice(i, i + 100) } };
    while (request && Object.keys(request).length) {
      const result = await dynamo.send(new BatchGetCommand({ RequestItems: request }));
      items.push(...(result.Responses?.[table] ?? []));
      request = result.UnprocessedKeys;
    }
  }
  return items;
}

async function getGroupItem(groupId) {
  if (!groupId || groupId.startsWith(NAME_PREFIX)) return null;
  const result = await dynamo.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { groupId } }));
  return result.Item?.status === 'active' ? result.Item : null;
}

async function getMember(groupId, userId) {
  if (!userId) return null;
  const result = await dynamo.send(new GetCommand({ TableName: MEMBERS_TABLE, Key: { groupId, userId } }));
  return result.Item ?? null;
}

// 'owner' | 'moderator' | 'member' for active members, otherwise null
function activeRole(group, member) {
  if (member?.status !== 'active') return null;
  return group.ownerId === member.userId ? 'owner' : member.role;
}

// The owner can act on anyone but themselves; moderators only on plain members
function canActOn(actorRole, target) {
  if (target?.role === 'owner') return false;
  if (actorRole === 'owner') return true;
  return actorRole === 'moderator' && target?.role !== 'moderator';
}

function memberCountChange(groupId, delta) {
  return {
    Update: {
      TableName:                 GROUPS_TABLE,
      Key:                       { groupId },
      UpdateExpression:          'ADD memberCount :delta',
      ConditionExpression:       '#status = :active',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':delta': delta, ':active': 'active' },
    },
  };
}

// Writes a membership only if it is still in the state the caller saw
function putMember(item, previousStatus) {
  return {
    Put: {
      TableName: MEMBERS_TABLE,
      Item: item,
      ConditionExpression: previousStatus
        ? '#status = :prev'
        : 'attribute_not_exists(userId)',
      ...(previousStatus && {
        ExpressionAttributeNames:  { '#status': 'status' },
        ExpressionAttributeValues: { ':prev': previousStatus },
      }),
    },
  };
}

function deleteMember(groupId, userId, expectedStatus) {
  return {
    Delete: {
      TableName:                 MEMBERS_TABLE,
      Key:                       { groupId, userId },
      ConditionExpression:       '#status = :expected',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':expected': expectedStatus },
    },
  };
}

// What the viewer may see and do in a group
function permissions(group, member) {
  const role       = activeRole(group, member);
  const isMod      = role === 'owner' || role === 'moderator';
  const isPublic   = group.joinType === 'open';
  const banned     = member?.status === 'banned';
  return {
    role,
    isOwner:        role === 'owner',
    canModerate:    isMod,
    canPost:        !!role,
    canSeePosts:    !!role || (isPublic && !banned),
    canSeeMembers:  isMod || (!group.hideMemberList && (!!role || (isPublic && !banned))),
  };
}

function publicGroup(group, perms) {
  const visible = { ...group };
  delete visible.nameLower;
  if (group.hideMemberList && !perms.canModerate) delete visible.memberCount;
  return visible;
}

// ─── Create group ─────────────────────────────────────────────
async function createGroup(userId, body) {
  const { name, description, joinType, hideMemberList, allowTakes } = body;

  if (typeof name !== 'string' || name.trim().length < 3) {
    return response(400, { error: 'Group name must be at least 3 characters.' });
  }
  if (name.trim().length > 50) {
    return response(400, { error: 'Group name must be under 50 characters.' });
  }
  if (RESERVED_WORDS.test(name)) {
    return response(400, { error: 'Group names cannot use the words aura, admin, official or moderator.' });
  }
  if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION)) {
    return response(400, { error: `Description must be under ${MAX_DESCRIPTION} characters.` });
  }
  if (joinType !== undefined && !JOIN_TYPES.includes(joinType)) {
    return response(400, { error: `joinType must be one of: ${JOIN_TYPES.join(', ')}.` });
  }
  if (allowTakes !== undefined && typeof allowTakes !== 'boolean') {
    return response(400, { error: 'allowTakes must be true or false.' });
  }

  const owned = await queryAll({
    TableName:                 GROUPS_TABLE,
    IndexName:                 'ownerId-index',
    KeyConditionExpression:    'ownerId = :uid',
    FilterExpression:          '#status = :active',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':uid': userId, ':active': 'active' },
  });
  if (owned.length >= MAX_GROUPS_PER_USER) {
    return response(400, { error: `You can only own up to ${MAX_GROUPS_PER_USER} groups.` });
  }

  const groupId = generateId();
  const now     = new Date().toISOString();
  const cleanName = name.trim().replace(/\s+/g, ' ');

  const group = {
    groupId,
    name:           cleanName,
    nameLower:      normalizeName(cleanName),
    description:    description?.trim() ?? '',
    ownerId:        userId,
    joinType:       joinType ?? 'open',
    hideMemberList: !!hideMemberList,
    allowTakes:     allowTakes ?? true,   // aura-aura refuses takes in the group when false
    momentsEnabled: false,
    bannerKey:      '',
    memberCount:    1,
    status:         'active',
    createdAt:      now,
    updatedAt:      now,
  };

  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: GROUPS_TABLE, Item: group, ConditionExpression: 'attribute_not_exists(groupId)' } },
        {
          Put: {
            TableName: GROUPS_TABLE,
            Item: { groupId: `${NAME_PREFIX}${group.nameLower}`, reservedFor: groupId, createdAt: now },
            ConditionExpression: 'attribute_not_exists(groupId)',
          },
        },
        {
          Put: {
            TableName: MEMBERS_TABLE,
            Item: { groupId, userId, role: 'owner', status: 'active', joinedAt: now },
          },
        },
      ],
    }));
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    if (cancellationCodes(err)[1] === 'ConditionalCheckFailed') {
      return response(409, { error: 'A group with that name already exists.' });
    }
    throw err;
  }

  return response(201, publicGroup(group, permissions(group, { userId, role: 'owner', status: 'active' })));
}

// ─── Browse ───────────────────────────────────────────────────
// Open and request groups, largest first. Invite-only groups never appear.
// TODO: scans every group; add a browse index before launch
async function browseGroups(userId, query) {
  const groups = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new ScanCommand({
      TableName:                 GROUPS_TABLE,
      FilterExpression:          '#status = :active AND joinType <> :invite',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':active': 'active', ':invite': 'invite' },
      ExclusiveStartKey,
    }));
    groups.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const needle  = (query ?? '').trim().toLowerCase();
  const matches = groups
    .filter(g => !needle || g.nameLower?.includes(needle))
    .sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
    .slice(0, BROWSE_LIMIT);

  const memberships = await myMemberships(userId);
  return response(200, {
    groups: matches.map(group => {
      const member = memberships.get(group.groupId);
      return { ...publicGroup(group, permissions(group, member)), myStatus: member?.status ?? null };
    }),
  });
}

async function myMemberships(userId) {
  if (!userId) return new Map();
  const items = await queryAll({
    TableName:                 MEMBERS_TABLE,
    IndexName:                 'userId-index',
    KeyConditionExpression:    'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  });
  return new Map(items.map(m => [m.groupId, m]));
}

// ─── My groups ────────────────────────────────────────────────
// Groups the user belongs to, plus pending requests and invites
async function getMyGroups(userId) {
  const memberships = [...(await myMemberships(userId)).values()].filter(m => m.status !== 'banned');
  const groups = await batchGet(GROUPS_TABLE, memberships.map(m => ({ groupId: m.groupId })));
  const byId   = new Map(groups.filter(g => g.status === 'active').map(g => [g.groupId, g]));

  const result = memberships
    .filter(m => byId.has(m.groupId))
    .map(m => {
      const group = byId.get(m.groupId);
      const perms = permissions(group, m);
      return { ...publicGroup(group, perms), myStatus: m.status, myRole: perms.role, muted: !!m.muted };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return response(200, { groups: result });
}

// ─── Get group ────────────────────────────────────────────────
async function getGroup(groupId, userId) {
  const group = await getGroupItem(groupId);
  if (!group) return response(404, { error: 'Group not found.' });

  const member = await getMember(groupId, userId);
  // Invite-only groups stay hidden from anyone not in or invited to them
  if (group.joinType === 'invite' && !['active', 'invited'].includes(member?.status)) {
    return response(404, { error: 'Group not found.' });
  }

  const perms = permissions(group, member);
  return response(200, {
    ...publicGroup(group, perms),
    myStatus: member?.status ?? null,
    muted:    !!member?.muted,
    ...perms,
  });
}

// ─── Update settings ──────────────────────────────────────────
async function updateGroup(groupId, userId, body) {
  const group = await getGroupItem(groupId);
  if (!group) return response(404, { error: 'Group not found.' });
  const role = activeRole(group, await getMember(groupId, userId));
  if (role !== 'owner' && role !== 'moderator') return response(403, { error: 'Only owners and moderators can change settings.' });

  const { description, joinType, hideMemberList, momentsEnabled, allowTakes } = body;
  const ownerOnly = description !== undefined || joinType !== undefined || hideMemberList !== undefined
    || allowTakes !== undefined;
  if (ownerOnly && role !== 'owner') return response(403, { error: 'Only the owner can change these settings.' });

  if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION)) {
    return response(400, { error: `Description must be under ${MAX_DESCRIPTION} characters.` });
  }
  if (joinType !== undefined && !JOIN_TYPES.includes(joinType)) {
    return response(400, { error: `joinType must be one of: ${JOIN_TYPES.join(', ')}.` });
  }
  for (const [field, value] of Object.entries({ hideMemberList, momentsEnabled, allowTakes })) {
    if (value !== undefined && typeof value !== 'boolean') return response(400, { error: `${field} must be true or false.` });
  }

  const updates = { updatedAt: new Date().toISOString() };
  if (description    !== undefined) updates.description    = description.trim();
  if (joinType       !== undefined) updates.joinType       = joinType;
  if (hideMemberList !== undefined) updates.hideMemberList = hideMemberList;
  if (momentsEnabled !== undefined) updates.momentsEnabled = momentsEnabled;
  if (allowTakes     !== undefined) updates.allowTakes     = allowTakes;

  const fields = Object.keys(updates);
  const result = await dynamo.send(new UpdateCommand({
    TableName:                 GROUPS_TABLE,
    Key:                       { groupId },
    UpdateExpression:          `SET ${fields.map(f => `#${f} = :${f}`).join(', ')}`,
    ConditionExpression:       '#status = :active',
    ExpressionAttributeNames:  { '#status': 'status', ...Object.fromEntries(fields.map(f => [`#${f}`, f])) },
    ExpressionAttributeValues: { ':active': 'active', ...Object.fromEntries(fields.map(f => [`:${f}`, updates[f]])) },
    ReturnValues:              'ALL_NEW',
  }));

  return response(200, publicGroup(result.Attributes, { canModerate: true }));
}

// ─── Delete group ─────────────────────────────────────────────
// The name stays reserved so a copycat can't take it over
async function deleteGroup(groupId, userId) {
  const group = await getGroupItem(groupId);
  if (!group) return response(404, { error: 'Group not found.' });
  if (group.ownerId !== userId) return response(403, { error: 'Only the owner can delete the group.' });

  await dynamo.send(new UpdateCommand({
    TableName:                 GROUPS_TABLE,
    Key:                       { groupId },
    UpdateExpression:          'SET #status = :deleted, updatedAt = :now',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':deleted': 'deleted', ':now': new Date().toISOString() },
  }));

  return response(200, { message: 'Group deleted.' });
}

// ─── Join ─────────────────────────────────────────────────────
// open: join now. request: ask, or join now if invited. invite: invited only.
async function joinGroup(groupId, userId) {
  const group = await getGroupItem(groupId);
  if (!group) return response(404, { error: 'Group not found.' });

  const member = await getMember(groupId, userId);
  if (member?.status === 'active') return response(400, { error: 'Already a member.' });
  if (member?.status === 'banned') return response(403, { error: 'You are banned from this group.' });
  if (group.joinType === 'invite' && member?.status !== 'invited') {
    return response(404, { error: 'Group not found.' });
  }

  const now = new Date().toISOString();

  if (group.joinType === 'request' && member?.status !== 'invited') {
    if (member?.status === 'pending') return response(200, { message: 'Join request already sent.', status: 'pending' });
    const error = await commit([putMember({ groupId, userId, role: 'member', status: 'pending', requestedAt: now })]);
    if (error) return error;
    return response(200, { message: 'Join request sent.', status: 'pending' });
  }

  const error = await commit([
    putMember({ groupId, userId, role: 'member', status: 'active', joinedAt: now }, member?.status),
    memberCountChange(groupId, 1),
  ]);
  if (error) return error;
  return response(200, { message: 'Joined group.', status: 'active' });
}

// ─── Leave ────────────────────────────────────────────────────
// Also cancels a pending request or declines an invite
async function leaveGroup(groupId, userId) {
  const group = await getGroupItem(groupId);
  if (!group) return response(404, { error: 'Group not found.' });
  if (group.ownerId === userId) {
    return response(400, { error: 'Owners cannot leave. Delete the group instead.' });
  }

  const member = await getMember(groupId, userId);
  if (!member || member.status === 'banned') return response(400, { error: 'You are not in this group.' });

  const items = [deleteMember(groupId, userId, member.status)];
  if (member.status === 'active') items.push(memberCountChange(groupId, -1));
  const error = await commit(items);
  if (error) return error;

  const messages = { active: 'Left group.', pending: 'Request cancelled.', invited: 'Invite declined.' };
  return response(200, { message: messages[member.status] });
}

// ─── Moderation ───────────────────────────────────────────────
async function loadModeration(groupId, actorId, targetUserId) {
  const group = await getGroupItem(groupId);
  if (!group) return { error: response(404, { error: 'Group not found.' }) };
  const actorRole = activeRole(group, await getMember(groupId, actorId));
  if (actorRole !== 'owner' && actorRole !== 'moderator') {
    return { error: response(403, { error: 'Only owners and moderators can do that.' }) };
  }
  if (targetUserId === actorId) return { error: response(400, { error: 'You cannot do that to yourself.' }) };
  const target = await getMember(groupId, targetUserId);
  if (target && group.ownerId === targetUserId) target.role = 'owner';
  return { group, actorRole, target };
}

async function kickMember(groupId, actorId, targetUserId) {
  const { error, actorRole, target } = await loadModeration(groupId, actorId, targetUserId);
  if (error) return error;
  if (target?.status !== 'active') return response(404, { error: 'That user is not a member.' });
  if (!canActOn(actorRole, target)) return response(403, { error: 'You cannot remove that member.' });

  const failed = await commit([deleteMember(groupId, targetUserId, 'active'), memberCountChange(groupId, -1)]);
  if (failed) return failed;
  return response(200, { message: 'Member removed.' });
}

async function banMember(groupId, actorId, targetUserId) {
  const { error, group, actorRole, target } = await loadModeration(groupId, actorId, targetUserId);
  if (error) return error;
  if (group.ownerId === targetUserId) return response(403, { error: 'The owner cannot be banned.' });
  if (target?.status === 'banned') return response(200, { message: 'User banned.' });
  if (target?.status === 'active' && !canActOn(actorRole, target)) {
    return response(403, { error: 'You cannot ban that member.' });
  }

  const items = [putMember({
    groupId, userId: targetUserId, role: 'member', status: 'banned',
    bannedAt: new Date().toISOString(), bannedBy: actorId,
  }, target?.status)];
  if (target?.status === 'active') items.push(memberCountChange(groupId, -1));

  const failed = await commit(items);
  if (failed) return failed;
  return response(200, { message: 'User banned.' });
}

async function unbanMember(groupId, actorId, targetUserId) {
  const { error, target } = await loadModeration(groupId, actorId, targetUserId);
  if (error) return error;
  if (target?.status !== 'banned') return response(404, { error: 'That user is not banned.' });

  const failed = await commit([deleteMember(groupId, targetUserId, 'banned')]);
  if (failed) return failed;
  return response(200, { message: 'User unbanned.' });
}

async function setModerator(groupId, actorId, targetUserId, makeModerator) {
  const { error, actorRole, target } = await loadModeration(groupId, actorId, targetUserId);
  if (error) return error;
  if (actorRole !== 'owner') return response(403, { error: 'Only the owner can change moderators.' });
  if (target?.status !== 'active' || target.role === 'owner') return response(404, { error: 'That user is not a member.' });

  const [from, to] = makeModerator ? ['member', 'moderator'] : ['moderator', 'member'];
  if (target.role !== from) return response(200, { message: makeModerator ? 'Already a moderator.' : 'Not a moderator.' });

  try {
    await dynamo.send(new UpdateCommand({
      TableName:                 MEMBERS_TABLE,
      Key:                       { groupId, userId: targetUserId },
      UpdateExpression:          'SET #role = :to',
      ConditionExpression:       '#status = :active AND #role = :from',
      ExpressionAttributeNames:  { '#role': 'role', '#status': 'status' },
      ExpressionAttributeValues: { ':to': to, ':from': from, ':active': 'active' },
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    return response(409, { error: 'That membership changed while saving. Please refresh and try again.' });
  }
  return response(200, { message: makeModerator ? 'Moderator appointed.' : 'Moderator removed.' });
}

async function answerRequest(groupId, actorId, targetUserId, approve) {
  const { error } = await loadModeration(groupId, actorId, targetUserId);
  if (error) return error;
  const target = await getMember(groupId, targetUserId);
  if (target?.status !== 'pending') return response(404, { error: 'No pending request from that user.' });

  const items = approve
    ? [
        putMember({ groupId, userId: targetUserId, role: 'member', status: 'active', joinedAt: new Date().toISOString() }, 'pending'),
        memberCountChange(groupId, 1),
      ]
    : [deleteMember(groupId, targetUserId, 'pending')];

  const failed = await commit(items);
  if (failed) return failed;
  return response(200, { message: approve ? 'Request approved.' : 'Request declined.' });
}

// ─── Invite by username ───────────────────────────────────────
async function inviteMember(groupId, actorId, body) {
  const username = typeof body.username === 'string' ? body.username.trim().replace(/^@/, '').toLowerCase() : '';
  if (!username) return response(400, { error: 'Enter a username.' });

  const reservation = await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: `USERNAME#${username}` } }));
  const targetUserId = reservation.Item?.ownerId;
  if (!targetUserId) return response(404, { error: `No user named @${username}.` });

  const { error, target } = await loadModeration(groupId, actorId, targetUserId);
  if (error) return error;
  if (target?.status === 'active') return response(400, { error: `@${username} is already a member.` });
  if (target?.status === 'banned') return response(403, { error: `@${username} is banned from this group. Unban them first.` });
  if (target?.status === 'invited') return response(200, { message: `@${username} is already invited.` });

  const now = new Date().toISOString();
  // Someone who already asked to join is simply let in
  const items = target?.status === 'pending'
    ? [
        putMember({ groupId, userId: targetUserId, role: 'member', status: 'active', joinedAt: now }, 'pending'),
        memberCountChange(groupId, 1),
      ]
    : [putMember({ groupId, userId: targetUserId, role: 'member', status: 'invited', invitedAt: now, invitedBy: actorId })];

  const failed = await commit(items);
  if (failed) return failed;
  return response(200, {
    message: target?.status === 'pending' ? `@${username} had asked to join and is now a member.` : `Invited @${username}.`,
  });
}

// ─── Mute (per member) ────────────────────────────────────────
async function setMuted(groupId, userId, body) {
  if (typeof body.muted !== 'boolean') return response(400, { error: 'muted must be true or false.' });
  try {
    await dynamo.send(new UpdateCommand({
      TableName:                 MEMBERS_TABLE,
      Key:                       { groupId, userId },
      UpdateExpression:          'SET muted = :muted',
      ConditionExpression:       '#status = :active',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':muted': body.muted, ':active': 'active' },
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    return response(404, { error: 'You are not a member of this group.' });
  }
  return response(200, { muted: body.muted });
}

// ─── Member lists ─────────────────────────────────────────────
// status=active (default) follows the member-list setting; pending, invited
// and banned lists are for owners and moderators only.
async function listMembers(groupId, userId, status = 'active') {
  if (!['active', 'pending', 'invited', 'banned'].includes(status)) {
    return response(400, { error: 'Invalid status.' });
  }
  const group = await getGroupItem(groupId);
  if (!group) return response(404, { error: 'Group not found.' });
  const member = await getMember(groupId, userId);
  if (group.joinType === 'invite' && !['active', 'invited'].includes(member?.status)) {
    return response(404, { error: 'Group not found.' });
  }

  const perms   = permissions(group, member);
  const allowed = status === 'active' ? perms.canSeeMembers : perms.canModerate;
  if (!allowed) return response(403, { error: 'You cannot see this list.' });

  const members = await queryAll({
    TableName:                 MEMBERS_TABLE,
    KeyConditionExpression:    'groupId = :g',
    FilterExpression:          '#status = :status',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':g': groupId, ':status': status },
  });

  const users  = await batchGet(USERS_TABLE, members.map(m => ({ userId: m.userId })));
  const byId   = new Map(users.map(u => [u.userId, u]));
  const rank   = { owner: 0, moderator: 1, member: 2 };

  const list = members
    .map(m => {
      const user = byId.get(m.userId) ?? {};
      const role = group.ownerId === m.userId ? 'owner' : m.role;
      return {
        userId:        m.userId,
        username:      user.username ?? '',
        displayName:   user.displayName ?? user.username ?? '',
        profilePicKey: user.profilePicKey ?? '',
        role,
        status:        m.status,
        since:         m.joinedAt ?? m.requestedAt ?? m.invitedAt ?? m.bannedAt ?? null,
      };
    })
    .sort((a, b) => (rank[a.role] - rank[b.role]) || String(a.since).localeCompare(String(b.since)));

  return response(200, { members: list });
}

// ─── Main handler ─────────────────────────────────────────────
export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  const path   = event.requestContext?.http?.path   ?? event.path;
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const segments = path.split('/').filter(Boolean);
  const query    = event.queryStringParameters ?? {};

  // Logged-out requests are limited per IP address
  const who      = userId ?? `ip:${event.requestContext?.http?.sourceIp ?? 'unknown'}`;

  try {
    if (segments[0] !== 'groups') return response(404, { error: 'Route not found.' });
    const limited = await firstLimit([who, 'api', userId ? 120 : 60, 60]);
    if (limited) return limited;
    const body = JSON.parse(event.body ?? '{}');

    // GET /groups — browse
    if (method === 'GET' && segments.length === 1) return await browseGroups(userId, query.q);

    // Everything else needs a login
    if (!userId) return response(401, { error: 'Unauthorized' });

    // POST /groups — create
    if (method === 'POST' && segments.length === 1) {
      const actionLimited = await firstLimit([userId, 'groupcreate', 5, 3600]);
      if (actionLimited) return actionLimited;
      return await createGroup(userId, body);
    }

    // Joining, inviting and moderating
    if (method === 'POST') {
      const actionLimited = await firstLimit([userId, 'groupaction', 30, 60]);
      if (actionLimited) return actionLimited;
    }

    // GET /groups/mine — my groups, requests and invites
    if (method === 'GET' && segments.length === 2 && segments[1] === 'mine') return await getMyGroups(userId);

    const groupId = segments[1];

    if (segments.length === 2) {
      if (method === 'GET')    return await getGroup(groupId, userId);
      if (method === 'PUT')    return await updateGroup(groupId, userId, body);
      if (method === 'DELETE') return await deleteGroup(groupId, userId);
    }

    if (segments.length === 3) {
      const action = segments[2];
      if (method === 'GET'  && action === 'members') return await listMembers(groupId, userId, query.status);
      if (method === 'POST' && action === 'join')    return await joinGroup(groupId, userId);
      if (method === 'POST' && action === 'leave')   return await leaveGroup(groupId, userId);
      if (method === 'POST' && action === 'invite')  return await inviteMember(groupId, userId, body);
      if (method === 'POST' && action === 'mute')    return await setMuted(groupId, userId, body);
    }

    // POST /groups/{id}/{action}/{userId}
    if (method === 'POST' && segments.length === 4) {
      const [, , action, target] = segments;
      if (action === 'kick')      return await kickMember(groupId, userId, target);
      if (action === 'ban')       return await banMember(groupId, userId, target);
      if (action === 'unban')     return await unbanMember(groupId, userId, target);
      if (action === 'moderator') return await setModerator(groupId, userId, target, true);
      if (action === 'demote')    return await setModerator(groupId, userId, target, false);
      if (action === 'approve')   return await answerRequest(groupId, userId, target, true);
      if (action === 'decline')   return await answerRequest(groupId, userId, target, false);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error.' });
  }
};
