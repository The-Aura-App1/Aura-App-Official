// Group levels ("Resonance") and weekly boards. Identical copies live in
// aura-aura, aura-posts and aura-comments; src/backendContract.test.js fails
// if they drift. See docs/group-power-ups.md.
//
// Table aura-group-stats: partition key `groupId`, sort key `sk`, TTL on
// `expiresAt`. Items:
//   LEVEL                            { xp }                       the group's total XP
//   XPDAY#<date>#<userId>            { xp, expiresAt }            one member's XP today (capped)
//   WEEK#<yyyy-Www>#<userId>         { given, username, ... }     aura given inside the group that week
//   SPOTLIGHT                        { postId, until, ... }       the pinned post (aura-aura)
//   RAIN, RAINDAY#<date>, RAINCATCH#<rainId>#<userId>             Aura Rain (aura-aura)
//
// XP only ever comes from real activity, and each member adds at most
// XP_DAILY_CAP a day, so one person can't level a group alone. Every write
// here is best effort: a missing table or a failed write never breaks the
// post, comment or give that earned it.
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

export const GROUP_STATS_TABLE = 'aura-group-stats';
export const XP = { post: 10, comment: 3, give: 2, game: 5 };
export const XP_DAILY_CAP = 60;

// XP needed to reach a level: 0, 100, 300, 600, 1000, 1500 ... (50 × L × (L − 1))
export const levelFloor = level => 50 * level * (level - 1);
export function levelFor(xp) {
  let level = 1;
  while (levelFloor(level + 1) <= xp) level++;
  return level;
}

// ISO week, like 2026-W46 (weeks start on Monday, UTC)
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const expiresIn = days => Math.floor(Date.now() / 1000) + days * 86400;

export async function addGroupXp(db, groupId, userId, kind) {
  const amount = XP[kind];
  if (!groupId || !userId || !amount) return 0;
  try {
    await db.send(new UpdateCommand({
      TableName: GROUP_STATS_TABLE,
      Key: { groupId, sk: `XPDAY#${new Date().toISOString().slice(0, 10)}#${userId}` },
      UpdateExpression: 'ADD #xp :n SET #exp = :ttl',
      ConditionExpression: 'attribute_not_exists(#xp) OR #xp <= :room',
      ExpressionAttributeNames: { '#xp': 'xp', '#exp': 'expiresAt' },
      ExpressionAttributeValues: { ':n': amount, ':room': XP_DAILY_CAP - amount, ':ttl': expiresIn(3) },
    }));
    await db.send(new UpdateCommand({
      TableName: GROUP_STATS_TABLE,
      Key: { groupId, sk: 'LEVEL' },
      UpdateExpression: 'ADD #xp :n',
      ExpressionAttributeNames: { '#xp': 'xp' },
      ExpressionAttributeValues: { ':n': amount },
    }));
    return amount;
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') console.warn(`Group XP not saved (${err.name}).`);
    return 0;
  }
}

// Counts a give toward this week's Top Supporters board, plus XP
export async function recordGroupGive(db, groupId, giver, amount) {
  if (!groupId || !giver?.userId || !(amount > 0)) return;
  try {
    await db.send(new UpdateCommand({
      TableName: GROUP_STATS_TABLE,
      Key: { groupId, sk: `WEEK#${isoWeek()}#${giver.userId}` },
      UpdateExpression: 'ADD #given :a, #gives :one SET #uid = :u, #name = :name, #display = :display, #pic = :pic, #hidden = :hidden, #exp = :ttl',
      ExpressionAttributeNames: {
        '#given': 'given', '#gives': 'gives', '#uid': 'userId', '#name': 'username', '#display': 'displayName',
        '#pic': 'picKey', '#hidden': 'hidden', '#exp': 'expiresAt',
      },
      ExpressionAttributeValues: {
        ':a': amount, ':one': 1, ':u': giver.userId, ':name': giver.username ?? '', ':display': giver.displayName ?? '',
        ':pic': giver.profilePicKey ?? '', ':hidden': !!giver.hideAuraRank, ':ttl': expiresIn(70),
      },
    }));
  } catch (err) {
    console.warn(`Group board not updated (${err.name}).`);
  }
  await addGroupXp(db, groupId, giver.userId, 'give');
}
