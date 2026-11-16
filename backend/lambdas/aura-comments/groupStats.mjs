// Group levels ("Resonance"), boosts, weekly boards and game champions.
// Identical copies live in aura-aura, aura-posts, aura-comments and
// aura-groups; src/backendContract.test.js fails if they drift. See
// docs/group-power-ups.md.
//
// Table aura-group-stats: partition key `groupId`, sort key `sk`, TTL on
// `expiresAt`. Items:
//   LEVEL                            { xp, aura, boosts: { <userId>: untilMs } }
//                                    the group's total XP, all the aura given inside it, and
//                                    Premium members' active boosts
//   XPDAY#<date>#<userId>            { xp, expiresAt }            one member's XP today (capped)
//   WEEK#<yyyy-Www>#<userId>         { given, username, ... }     aura given inside the group that week
//   WINS#<userId>                    { wins, <game>: n, username, ... }  games won in the group
//   SPOTLIGHT                        { postId, until, ... }       the pinned post (aura-aura)
//   RAIN, RAINDAY#<date>, RAINCATCH#<rainId>#<userId>             Aura Rain (aura-aura)
//
// XP only ever comes from real activity, and each member adds at most
// XP_DAILY_CAP a day (before boosts), so one person can't level a group
// alone. Every write here is best effort: a missing table or a failed write
// never breaks the post, comment, give or game that earned it.
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export const GROUP_STATS_TABLE = 'aura-group-stats';
export const XP = { post: 10, comment: 3, give: 2, game: 5 };
export const XP_DAILY_CAP = 60;
export const MAX_LEVEL = 15;

// What a level unlocks (the app's LEVEL_UNLOCKS describes them)
export const PERKS = { picture: 2, pins: 7, glow: 10, backgrounds: 10 };
export const MAX_PINS = 12;
export const MAX_BACKGROUNDS = 8;

// Premium members may boost up to `perMonth` groups a calendar month (UTC);
// each boost lasts `days` and adds `bonus` to every XP the group earns, with
// at most `maxStack` boosts counting at once
export const BOOSTS = { perMonth: 5, days: 30, bonus: 0.25, maxStack: 4 };

// XP needed to reach a level: 0, 100, 300, 600, 1000, 1500 ... (50 × L × (L − 1)), up to MAX_LEVEL
export const levelFloor = level => 50 * level * (level - 1);
export function levelFor(xp) {
  let level = 1;
  while (level < MAX_LEVEL && levelFloor(level + 1) <= xp) level++;
  return level;
}

export const activeBoosts = (boosts, now = Date.now()) => Object.values(boosts ?? {}).filter(until => until > now).length;
export const boostMultiplier = (boosts, now = Date.now()) => 1 + BOOSTS.bonus * Math.min(BOOSTS.maxStack, activeBoosts(boosts, now));

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

// The group's LEVEL item, or null (best effort)
export async function groupLevel(db, groupId) {
  try {
    const item = (await db.send(new GetCommand({ TableName: GROUP_STATS_TABLE, Key: { groupId, sk: 'LEVEL' } }))).Item;
    const xp = item?.xp ?? 0;
    return { xp, level: levelFor(xp), aura: item?.aura ?? 0, boosts: item?.boosts ?? {} };
  } catch (err) {
    console.warn(`Group level not read (${err.name}).`);
    return null;
  }
}

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
    // Boosts add a share on top (if they can't be read, the plain amount counts)
    const level = await groupLevel(db, groupId);
    const added = Math.round(amount * boostMultiplier(level?.boosts));
    await db.send(new UpdateCommand({
      TableName: GROUP_STATS_TABLE,
      Key: { groupId, sk: 'LEVEL' },
      UpdateExpression: 'ADD #xp :n',
      ExpressionAttributeNames: { '#xp': 'xp' },
      ExpressionAttributeValues: { ':n': added },
    }));
    return added;
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') console.warn(`Group XP not saved (${err.name}).`);
    return 0;
  }
}

// Counts a give toward this week's Top Supporters board and the group's
// all-time aura, plus XP
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
    await db.send(new UpdateCommand({
      TableName: GROUP_STATS_TABLE,
      Key: { groupId, sk: 'LEVEL' },
      UpdateExpression: 'ADD #aura :a',
      ExpressionAttributeNames: { '#aura': 'aura' },
      ExpressionAttributeValues: { ':a': amount },
    }));
  } catch (err) {
    console.warn(`Group board not updated (${err.name}).`);
  }
  await addGroupXp(db, groupId, giver.userId, 'give');
}

// Counts a game won in the group, per game, for its champions board
export async function recordGameWin(db, groupId, player, game) {
  if (!groupId || !player?.userId || !/^[a-z0-9]{2,20}$/.test(game ?? '')) return;
  try {
    await db.send(new UpdateCommand({
      TableName: GROUP_STATS_TABLE,
      Key: { groupId, sk: `WINS#${player.userId}` },
      UpdateExpression: 'ADD #game :one, #wins :one SET #uid = :u, #name = :name, #display = :display, #pic = :pic',
      ExpressionAttributeNames: { '#game': game, '#wins': 'wins', '#uid': 'userId', '#name': 'username', '#display': 'displayName', '#pic': 'picKey' },
      ExpressionAttributeValues: {
        ':one': 1, ':u': player.userId, ':name': player.username ?? '', ':display': player.displayName ?? player.username ?? '', ':pic': player.picKey ?? '',
      },
    }));
  } catch (err) {
    console.warn(`Game win not counted (${err.name}).`);
  }
}
