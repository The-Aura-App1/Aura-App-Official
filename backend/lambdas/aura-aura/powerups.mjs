// Group power-ups, Stage A (docs/group-power-ups.md). Served by aura-aura,
// the only writer of balances, under the API route ANY /power-ups/{proxy+}:
//
//   GET  /power-ups/{groupId}              level, Spotlight, Aura Rain and this week's Top Supporters
//   POST /power-ups/{groupId}/spotlight    { postId }  pin your own post to the top for 24 h
//   POST /power-ups/{groupId}/rain         { pot }     drop a pot of your aura on the group for 10 min
//   POST /power-ups/{groupId}/rain/catch               catch a share of the rain
//
// Rules (economy, CLAUDE.md): power-ups cost spendable aura only and pay out
// spendable only; nothing is created. A rain's pot comes from the person who
// starts it, and whatever isn't caught goes back to them. Accounts under 7
// days old, or in the group under 3 days, can't catch. Owners can switch
// power-ups off for their group (powerUpsEnabled on the group).
import { randomInt } from 'crypto';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GROUP_STATS_TABLE, levelFloor, levelFor, isoWeek } from './groupStats.mjs';

// Keep in sync with src/utils/powerUps.js (a test keeps them equal)
export const POWER_UPS = {
  spotlightCost:  150,
  spotlightHours: 24,
  rainMin:        100,
  rainMax:        2000,
  rainDailyCap:   2000,   // per group, per UTC day
  rainMinutes:    10,
  rainShare:      10,     // nobody catches more than a tenth of the pot
  minAccountDays: 7,
  minMemberDays:  3,
};

const GROUPS_TABLE  = 'aura-groups';
const MEMBERS_TABLE = 'aura-group-members';
const POSTS_TABLE   = 'aura-posts';
const DAY_MS = 86400000;
const BOARD_SIZE = 10;

const ttl = days => Math.floor(Date.now() / 1000) + days * 86400;
const today = () => new Date().toISOString().slice(0, 10);

export async function handlePowerUps(ctx, user, method, segments, body) {
  const { dynamo, response, balanceUpdate, transactionRecord, commit, firstLimit } = ctx;
  const groupId = segments[1];
  if (!groupId) return response(404, { error: 'Route not found.' });

  const get = async (TableName, Key) => (await dynamo.send(new GetCommand({ TableName, Key }))).Item ?? null;
  const stat = sk => get(GROUP_STATS_TABLE, { groupId, sk });

  const [group, member] = await Promise.all([get(GROUPS_TABLE, { groupId }), get(MEMBERS_TABLE, { groupId, userId: user.userId })]);
  if (!group || group.status !== 'active') return response(404, { error: 'Group not found.' });
  if (member?.status !== 'active') return response(403, { error: 'Only members can use power-ups here.' });
  const enabled = group.powerUpsEnabled !== false;
  // How old a date is; a missing or unreadable one counts as brand new (fails closed)
  const ageMs = iso => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? Date.now() - t : 0;
  };

  // Gives back whatever an ended rain didn't hand out. Safe to call any time:
  // the condition means only one caller ever refunds a rain.
  async function settleRain(rain) {
    if (!rain || rain.refunded || rain.endsAt > Date.now() || !(rain.remaining > 0)) return rain;
    const back = rain.remaining;
    const failed = await commit([
      { Update: {
        TableName: GROUP_STATS_TABLE, Key: { groupId, sk: 'RAIN' },
        UpdateExpression: 'SET #ref = :t, #rem = :zero',
        ConditionExpression: '#rid = :id AND attribute_not_exists(#ref) AND #end < :now',
        ExpressionAttributeNames: { '#ref': 'refunded', '#rem': 'remaining', '#rid': 'rainId', '#end': 'endsAt' },
        ExpressionAttributeValues: { ':t': true, ':zero': 0, ':id': rain.rainId, ':now': Date.now() },
      } },
      balanceUpdate(rain.byUserId, { auraSpendable: back, auraBalance: back }),
      transactionRecord({ type: 'rain_refund', userId: rain.byUserId, groupId, rainId: rain.rainId, amount: back, toSpendable: back }),
    ], ['Already settled.']);
    return failed ? await stat('RAIN') : { ...rain, refunded: true, remaining: 0 };
  }

  // GET /power-ups/{groupId}
  if (method === 'GET' && segments.length === 2) {
    const week = isoWeek();
    const [level, spotlight, rawRain, board] = await Promise.all([
      stat('LEVEL'), stat('SPOTLIGHT'), stat('RAIN'),
      dynamo.send(new QueryCommand({
        TableName: GROUP_STATS_TABLE,
        KeyConditionExpression: 'groupId = :g AND begins_with(sk, :p)',
        ExpressionAttributeValues: { ':g': groupId, ':p': `WEEK#${week}#` },
      })).then(r => r.Items ?? []),
    ]);
    const rain = await settleRain(rawRain);
    const xp = level?.xp ?? 0;
    const lv = levelFor(xp);
    const active = rain && rain.endsAt > Date.now();
    const mine = active ? await stat(`RAINCATCH#${rain.rainId}#${user.userId}`) : null;
    const rows = board.filter(r => r.given > 0).sort((a, b) => b.given - a.given || a.username.localeCompare(b.username));
    const visible = rows.filter(r => !r.hidden);
    const me = rows.find(r => r.userId === user.userId);
    return response(200, {
      enabled,
      canManage: group.ownerId === user.userId || member.role === 'owner' || member.role === 'moderator',
      level: { level: lv, xp, floor: levelFloor(lv), next: levelFloor(lv + 1) },
      spotlight: spotlight && spotlight.until > Date.now()
        ? { postId: spotlight.postId, until: spotlight.until, byUsername: spotlight.byUsername, byUserId: spotlight.byUserId } : null,
      rain: active ? {
        rainId: rain.rainId, pot: rain.pot, remaining: rain.remaining, share: rain.share, endsAt: rain.endsAt,
        byUsername: rain.byUsername, byUserId: rain.byUserId, catches: rain.catches ?? 0,
        caught: mine?.amount ?? null, eligible: catchBlocker(rain) ?? true,
      } : null,
      lastRain: !active && rain ? { pot: rain.pot, byUsername: rain.byUsername, endedAt: rain.endsAt, catches: rain.catches ?? 0 } : null,
      board: {
        week,
        top: visible.slice(0, BOARD_SIZE).map((r, i) => ({ rank: i + 1, userId: r.userId, username: r.username, displayName: r.displayName, picKey: r.picKey, given: r.given })),
        me: me ? { given: me.given, rank: visible.indexOf(me) + 1 || null, hidden: !!me.hidden } : null,
      },
      now: Date.now(),
    });
  }

  // Why this person can't catch a rain, or null if they can
  function catchBlocker(rain) {
    if (rain.byUserId === user.userId) return 'You started this rain.';
    if (ageMs(user.createdAt) < POWER_UPS.minAccountDays * DAY_MS) return `Accounts can catch aura once they're ${POWER_UPS.minAccountDays} days old.`;
    if (ageMs(member.joinedAt) < POWER_UPS.minMemberDays * DAY_MS) return `You can catch aura once you've been in the group ${POWER_UPS.minMemberDays} days.`;
    return null;
  }

  if (method !== 'POST') return response(404, { error: 'Route not found.' });
  if (!enabled) return response(403, { error: 'Power-ups are turned off in this group.' });
  const limited = await firstLimit([user.userId, 'powerup', 20, 60]);
  if (limited) return limited;
  const spend = cost => balanceUpdate(user.userId, { auraSpendable: -cost, auraBalance: -cost }, 'auraSpendable >= :cost', { ':cost': cost });

  // POST /power-ups/{groupId}/spotlight
  if (segments.length === 3 && segments[2] === 'spotlight') {
    const postId = body?.postId;
    if (typeof postId !== 'string' || !postId) return response(400, { error: 'Pick one of your posts.' });
    const post = await get(POSTS_TABLE, { postId });
    if (!post || post.status !== 'active' || post.groupId !== groupId) return response(404, { error: 'That post isn\'t in this group.' });
    if (post.authorId !== user.userId) return response(403, { error: 'You can only spotlight your own posts.' });
    const cost = POWER_UPS.spotlightCost;
    if ((user.auraSpendable ?? 0) < cost) return response(400, { error: `Spotlight costs ${cost} spendable aura.` });
    const now = Date.now();
    const until = now + POWER_UPS.spotlightHours * 3600000;
    const failed = await commit([
      { Put: {
        TableName: GROUP_STATS_TABLE,
        Item: { groupId, sk: 'SPOTLIGHT', postId, byUserId: user.userId, byUsername: user.username, startedAt: now, until, expiresAt: ttl(2) },
        ConditionExpression: 'attribute_not_exists(postId) OR #until < :now',
        ExpressionAttributeNames: { '#until': 'until' },
        ExpressionAttributeValues: { ':now': now },
      } },
      spend(cost),
      transactionRecord({ type: 'powerup', powerUp: 'spotlight', userId: user.userId, groupId, postId, amount: -cost, fromSpendable: cost }),
    ], ['Another post is in the Spotlight right now. Try again when it ends.', `Spotlight costs ${cost} spendable aura.`]);
    if (failed) return failed;
    return response(200, { message: `Your post is in the Spotlight for ${POWER_UPS.spotlightHours} hours.`, spotlight: { postId, until } });
  }

  // POST /power-ups/{groupId}/rain
  if (segments.length === 3 && segments[2] === 'rain') {
    const pot = body?.pot;
    if (!Number.isInteger(pot) || pot < POWER_UPS.rainMin || pot > POWER_UPS.rainMax) {
      return response(400, { error: `A rain is ${POWER_UPS.rainMin} to ${POWER_UPS.rainMax} aura.` });
    }
    if ((user.auraSpendable ?? 0) < pot) return response(400, { error: 'Not enough spendable aura.' });
    await settleRain(await stat('RAIN'));
    const now = Date.now();
    const rainId = `${now.toString(36)}${randomInt(1e9).toString(36)}`;
    const failed = await commit([
      { Put: {
        TableName: GROUP_STATS_TABLE,
        Item: {
          groupId, sk: 'RAIN', rainId, pot, remaining: pot, share: Math.max(1, Math.floor(pot / POWER_UPS.rainShare)),
          byUserId: user.userId, byUsername: user.username, startedAt: now, endsAt: now + POWER_UPS.rainMinutes * 60000, catches: 0,
        },
        ConditionExpression: 'attribute_not_exists(#rid) OR (#end < :now AND #rem = :zero)',
        ExpressionAttributeNames: { '#rid': 'rainId', '#end': 'endsAt', '#rem': 'remaining' },
        ExpressionAttributeValues: { ':now': now, ':zero': 0 },
      } },
      { Update: {
        TableName: GROUP_STATS_TABLE, Key: { groupId, sk: `RAINDAY#${today()}` },
        UpdateExpression: 'ADD #tot :pot SET #exp = :ttl',
        ConditionExpression: 'attribute_not_exists(#tot) OR #tot <= :room',
        ExpressionAttributeNames: { '#tot': 'total', '#exp': 'expiresAt' },
        ExpressionAttributeValues: { ':pot': pot, ':room': POWER_UPS.rainDailyCap - pot, ':ttl': ttl(3) },
      } },
      spend(pot),
      transactionRecord({ type: 'rain_start', userId: user.userId, groupId, rainId, amount: -pot, fromSpendable: pot }),
    ], [
      "There's already a rain falling here.",
      `This group can rain at most ${POWER_UPS.rainDailyCap} aura a day.`,
      'Not enough spendable aura.',
    ]);
    if (failed) return failed;
    return response(200, { message: `It's raining ${pot} aura on the group!`, rainId });
  }

  // POST /power-ups/{groupId}/rain/catch
  if (segments.length === 4 && segments[2] === 'rain' && segments[3] === 'catch') {
    const rain = await stat('RAIN');
    if (!rain || rain.endsAt <= Date.now() || !(rain.remaining > 0)) return response(409, { error: 'The rain has stopped.' });
    const blocker = catchBlocker(rain);
    if (blocker) return response(403, { error: blocker });
    const cap = Math.min(rain.share, rain.remaining);
    const amount = Math.max(1, Math.min(cap, randomInt(Math.ceil(cap / 4), cap + 1)));
    const failed = await commit([
      { Update: {
        TableName: GROUP_STATS_TABLE, Key: { groupId, sk: 'RAIN' },
        UpdateExpression: 'SET #rem = #rem - :amt ADD #cat :one',
        ConditionExpression: '#rid = :id AND #rem >= :amt AND #end > :now',
        ExpressionAttributeNames: { '#rem': 'remaining', '#cat': 'catches', '#rid': 'rainId', '#end': 'endsAt' },
        ExpressionAttributeValues: { ':amt': amount, ':one': 1, ':id': rain.rainId, ':now': Date.now() },
      } },
      { Put: {
        TableName: GROUP_STATS_TABLE,
        Item: { groupId, sk: `RAINCATCH#${rain.rainId}#${user.userId}`, amount, caughtAt: Date.now(), expiresAt: ttl(2) },
        ConditionExpression: 'attribute_not_exists(#sk)',
        ExpressionAttributeNames: { '#sk': 'sk' },
      } },
      balanceUpdate(user.userId, { auraSpendable: amount, auraBalance: amount }),
      transactionRecord({ type: 'rain_catch', userId: user.userId, groupId, rainId: rain.rainId, amount, toSpendable: amount }),
    ], ['Someone beat you to the last drops. Try again.', 'You already caught some of this rain.']);
    if (failed) return failed;
    return response(200, { message: `You caught ${amount} aura!`, amount });
  }

  return response(404, { error: 'Route not found.' });
}
