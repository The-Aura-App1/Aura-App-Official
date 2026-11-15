// The site moderators' review queue (the Reports section of /moderation).
//
// People report posts (aura-posts), comments (aura-comments) and accounts
// (aura-users, POST /follows/user/{username}/report). Each report adds to
// reportCount, reportedBy (one per person) and reportReasons on the item.
// Posts and comments with 5 reports are hidden ('pending_review') until a
// moderator decides. Accounts are never hidden by reports alone.
//
//   GET  /admin/reports   everything with open reports, most reported first
//   POST /admin/review    { kind: 'post' | 'comment' | 'user', id, action }
//     post/comment: 'keep' (back to active, reports cleared) or 'remove'
//     user:         'keep' (reports cleared) or 'ban' (same as POST /admin/ban)
//
// index.mjs checks that the caller is a moderator before calling these.

import { ScanCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const POSTS_TABLE    = 'aura-posts';
const COMMENTS_TABLE = 'aura-comments';
const USERS_TABLE    = 'aura-users';
const MAX_EACH       = 100;   // per kind, most reported first

async function scanReported(db, table, filter, values, names = {}) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new ScanCommand({
      TableName: table,
      FilterExpression: `reportCount > :zero AND ${filter}`,
      ExpressionAttributeValues: { ':zero': 0, ...values },
      ...(Object.keys(names).length && { ExpressionAttributeNames: names }),
      ExclusiveStartKey,
    }));
    items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items
    .sort((a, b) => (b.reportCount ?? 0) - (a.reportCount ?? 0) || String(b.lastReportedAt ?? '').localeCompare(String(a.lastReportedAt ?? '')))
    .slice(0, MAX_EACH);
}

const reasons = item => [...(item.reportReasons ?? [])].sort();
const open = { filter: '(#s = :active OR #s = :pending)', values: { ':active': 'active', ':pending': 'pending_review' }, names: { '#s': 'status' } };

export async function listReports(db) {
  const [posts, comments, users] = await Promise.all([
    scanReported(db, POSTS_TABLE, open.filter, open.values, open.names),
    scanReported(db, COMMENTS_TABLE, open.filter, open.values, open.names),
    scanReported(db, USERS_TABLE, '(attribute_not_exists(isBanned) OR isBanned = :f)', { ':f': false }),
  ]);
  return {
    posts: posts.map(p => ({
      kind: 'post', id: p.postId, hidden: p.status === 'pending_review',
      authorUsername: p.authorUsername, type: p.type, caption: String(p.caption ?? '').slice(0, 300),
      mediaKey: p.mediaKeys?.[0] ?? null, groupId: p.groupId ?? null, createdAt: p.createdAt,
      reportCount: p.reportCount, reasons: reasons(p), lastReportedAt: p.lastReportedAt ?? null,
    })),
    comments: comments.map(c => ({
      kind: 'comment', id: c.commentId, postId: c.postId, hidden: c.status === 'pending_review',
      authorUsername: c.authorUsername, text: String(c.text ?? '').slice(0, 300), createdAt: c.createdAt,
      reportCount: c.reportCount, reasons: reasons(c), lastReportedAt: c.lastReportedAt ?? null,
    })),
    users: users.filter(u => !String(u.userId).startsWith('USERNAME#')).map(u => ({
      kind: 'user', id: u.userId, username: u.username, displayName: u.displayName,
      bio: String(u.bio ?? '').slice(0, 200), createdAt: u.createdAt,
      reportCount: u.reportCount, reasons: reasons(u), lastReportedAt: u.lastReportedAt ?? null,
    })),
  };
}

const TABLES = { post: [POSTS_TABLE, 'postId'], comment: [COMMENTS_TABLE, 'commentId'], user: [USERS_TABLE, 'userId'] };
const CLEAR = 'REMOVE reportCount, reportedBy, reportReasons, lastReportedAt';

export async function reviewReport(db, moderatorId, body, { response, setBanned, isModerator }) {
  const { kind, id, action } = body ?? {};
  const target = TABLES[kind];
  if (!target || typeof id !== 'string' || !id || id.startsWith('USERNAME#')) return response(400, { error: 'Pick a post, comment or account.' });
  const allowed = kind === 'user' ? ['keep', 'ban'] : ['keep', 'remove'];
  if (!allowed.includes(action)) return response(400, { error: `Action must be ${allowed.join(' or ')}.` });

  const [table, key] = target;
  const item = (await db.send(new GetCommand({ TableName: table, Key: { [key]: id } }))).Item;
  if (!item) return response(404, { error: 'Not found.' });
  const now = new Date().toISOString();

  if (kind === 'user') {
    if (action === 'ban') {
      if (isModerator(id)) return response(400, { error: 'Moderator accounts cannot be banned.' });
      const why = reasons(item).join(', ') || 'reports';
      const banned = await setBanned(moderatorId, { username: item.username, banned: true, reason: `Reported: ${why}`.slice(0, 300) });
      if (banned.statusCode !== 200) return banned;
    }
    await db.send(new UpdateCommand({
      TableName: table, Key: { [key]: id },
      UpdateExpression: `${CLEAR} SET reviewedAt = :now, reviewedBy = :mod`,
      ExpressionAttributeValues: { ':now': now, ':mod': moderatorId },
    }));
    return response(200, { message: action === 'ban' ? `Banned @${item.username}.` : `Kept @${item.username}; reports cleared.` });
  }

  if (item.status !== 'active' && item.status !== 'pending_review') return response(409, { error: 'That was already removed.' });
  await db.send(new UpdateCommand({
    TableName: table, Key: { [key]: id },
    UpdateExpression: action === 'keep'
      ? `SET #s = :active, reviewedAt = :now, reviewedBy = :mod ${CLEAR}`
      : 'SET #s = :removed, removedBy = :modTag, removedAt = :now, reviewedAt = :now, reviewedBy = :mod',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: action === 'keep'
      ? { ':active': 'active', ':now': now, ':mod': moderatorId }
      : { ':removed': 'removed', ':modTag': 'moderator', ':now': now, ':mod': moderatorId },
  }));
  console.log(`Moderation: ${moderatorId} ${action === 'keep' ? 'kept' : 'removed'} ${kind} ${id}`);
  return response(200, { message: action === 'keep' ? `Kept the ${kind}; it's visible again and its reports are cleared.` : `Removed the ${kind}.` });
}
