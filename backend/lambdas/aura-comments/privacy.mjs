// Private accounts: only the owner, their approved followers and site
// moderators see the account's posts outside of groups (group posts follow the
// group's own rules). Identical copies live in aura-posts, aura-comments and
// aura-aura; src/backendContract.test.js fails if they drift.
//
// aura-follows holds two items per follow, written together by aura-users:
//   { userId: follower, edge: 'OUT#<followee>', status: 'active' | 'pending' }
//   { userId: followee, edge: 'IN#<follower>',  status: 'active' | 'pending' }
import { GetCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

export const FOLLOWS_TABLE = 'aura-follows';
const USERS_TABLE = 'aura-users';

export async function isFollowing(db, followerId, followeeId) {
  if (!followerId || !followeeId) return false;
  const result = await db.send(new GetCommand({
    TableName: FOLLOWS_TABLE,
    Key:       { userId: followerId, edge: `OUT#${followeeId}` },
  }));
  return result.Item?.status === 'active';
}

// Whether the viewer may see this account's non-group content
export async function canSeeAccount(db, viewerId, authorId, viewerIsAdmin = false) {
  if (!authorId || viewerId === authorId || viewerIsAdmin) return true;
  const result = await db.send(new GetCommand({
    TableName:                USERS_TABLE,
    Key:                      { userId: authorId },
    ProjectionExpression:     'isPrivate',
  }));
  if (!result.Item?.isPrivate) return true;
  return isFollowing(db, viewerId, authorId);
}

async function batchGet(db, table, keys, projection) {
  const items = [];
  for (let i = 0; i < keys.length; i += 100) {
    let request = { [table]: { Keys: keys.slice(i, i + 100), ...projection } };
    while (request && Object.keys(request).length) {
      const result = await db.send(new BatchGetCommand({ RequestItems: request }));
      items.push(...(result.Responses?.[table] ?? []));
      request = result.UnprocessedKeys;
    }
  }
  return items;
}

// The author ids among `authorIds` whose non-group content the viewer can't see
export async function hiddenAuthors(db, viewerId, authorIds, viewerIsAdmin = false) {
  const others = [...new Set(authorIds.filter(id => id && id !== viewerId))];
  if (viewerIsAdmin || !others.length) return new Set();

  const users = await batchGet(db, USERS_TABLE, others.map(userId => ({ userId })), {
    ProjectionExpression: 'userId, isPrivate',
  });
  const privateIds = users.filter(u => u.isPrivate).map(u => u.userId);
  if (!privateIds.length) return new Set();
  if (!viewerId) return new Set(privateIds);

  const edges = await batchGet(db, FOLLOWS_TABLE,
    privateIds.map(id => ({ userId: viewerId, edge: `OUT#${id}` })));
  const followed = new Set(edges.filter(e => e.status === 'active').map(e => e.edge.slice(4)));
  return new Set(privateIds.filter(id => !followed.has(id)));
}
