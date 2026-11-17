// Group levels, boosts, game wins and reactions (groupStats.mjs,
// aura-aura powerups.mjs, aura-posts reactions.mjs), with an in-memory
// stand-in for DynamoDB. Run: npm run test:games
import { register } from 'node:module';
import assert from 'node:assert/strict';

const STUB = `
const cmd = op => class { constructor(input) { this.input = input; this.op = op; } };
export const GetCommand = cmd('get'), UpdateCommand = cmd('update'), QueryCommand = cmd('query'), PutCommand = cmd('put');
`;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(spec, ctx, next) {
    if (spec === '@aws-sdk/lib-dynamodb') return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(STUB)}), shortCircuit: true };
    return next(spec, ctx);
  }`));
const stats = await import('../lambdas/aura-aura/groupStats.mjs');
const { handlePowerUps } = await import('../lambdas/aura-aura/powerups.mjs');
const reactions = await import('../lambdas/aura-posts/reactions.mjs');

// A tiny DynamoDB: items by table and key, with just the update forms these modules use
const tables = new Map();
const keyOf = (table, key) => `${table}|${JSON.stringify(Object.entries(key).sort())}`;
const getItem = (table, key) => tables.get(keyOf(table, key));
const setItem = (table, key, item) => tables.set(keyOf(table, key), item);
function applyUpdate({ TableName, Key, UpdateExpression, ExpressionAttributeNames: n = {}, ExpressionAttributeValues: v = {} }) {
  const item = { ...Key, ...(getItem(TableName, Key) ?? {}) };
  const name = s => n[s] ?? s;
  for (const part of UpdateExpression.split(/\b(?=ADD |SET )/)) {
    const body = part.replace(/^(ADD|SET) /, '');
    for (const clause of body.split(/,\s*(?![^(]*\))/)) {
      if (part.startsWith('ADD')) {
        const [attr, val] = clause.trim().split(/\s+/);
        item[name(attr)] = (item[name(attr)] ?? 0) + v[val];
      } else {
        const [lhs, rhs] = clause.split('=').map(x => x.trim());
        const value = rhs.startsWith('if_not_exists') ? (() => { const [, a, d] = /if_not_exists\((\S+), (\S+)\)/.exec(rhs); return item[name(a)] ?? v[d]; })() : v[rhs];
        const path = lhs.split('.').map(name);
        if (path.length === 2) item[path[0]] = { ...(item[path[0]] ?? {}), [path[1]]: value };
        else item[path[0]] = value;
      }
    }
  }
  setItem(TableName, Key, item);
}
const dynamo = {
  async send(c) {
    if (c.op === 'get') return { Item: getItem(c.input.TableName, c.input.Key) };
    if (c.op === 'update') { applyUpdate(c.input); return {}; }
    if (c.op === 'query') return { Items: [] };
    return {};
  },
};

let now = 1_800_000_000_000;
Date.now = () => now;

// Levels cap at 15
assert.equal(stats.levelFor(0), 1);
assert.equal(stats.levelFor(100), 2);
assert.equal(stats.levelFor(stats.levelFloor(15)), 15);
assert.equal(stats.levelFor(10 ** 9), stats.MAX_LEVEL);

// Boosts: +25% each, at most four at once, expired ones don't count
assert.equal(stats.boostMultiplier({}), 1);
assert.equal(stats.boostMultiplier({ a: now + 1, b: now + 1 }), 1.5);
assert.equal(stats.boostMultiplier({ a: now + 1, b: now + 1, c: now + 1, d: now + 1, e: now + 1, f: now + 1 }), 2);
assert.equal(stats.boostMultiplier({ a: now - 1 }), 1);

// XP: boosted on the group's total, but the daily cap is on the plain amount
assert.equal(await stats.addGroupXp(dynamo, 'g1', 'u1', 'post'), 10);
setItem('aura-group-stats', { groupId: 'g1', sk: 'LEVEL' }, { ...getItem('aura-group-stats', { groupId: 'g1', sk: 'LEVEL' }), boosts: { p1: now + 1000, p2: now + 1000 } });
assert.equal(await stats.addGroupXp(dynamo, 'g1', 'u1', 'post'), 15);
assert.equal(getItem('aura-group-stats', { groupId: 'g1', sk: 'LEVEL' }).xp, 25);

// Gives add to the group's all-time aura (for the leaderboard)
await stats.recordGroupGive(dynamo, 'g1', { userId: 'u2', username: 'bo' }, 40);
assert.equal(getItem('aura-group-stats', { groupId: 'g1', sk: 'LEVEL' }).aura, 40);

// Game wins, per game and overall
await stats.recordGameWin(dynamo, 'g1', { userId: 'u1', username: 'al', displayName: 'Al' }, 'chess');
await stats.recordGameWin(dynamo, 'g1', { userId: 'u1', username: 'al', displayName: 'Al' }, 'chess');
await stats.recordGameWin(dynamo, 'g1', { userId: 'u1', username: 'al', displayName: 'Al' }, 'pool');
const wins = getItem('aura-group-stats', { groupId: 'g1', sk: 'WINS#u1' });
assert.deepEqual([wins.chess, wins.pool, wins.wins, wins.username], [2, 1, 3, 'al']);
await stats.recordGameWin(dynamo, 'g1', { userId: 'u1' }, 'not a game!');
assert.equal(getItem('aura-group-stats', { groupId: 'g1', sk: 'WINS#u1' }).wins, 3);

// Boosting through aura-aura: Premium only, once per group at a time, five a month
setItem('aura-groups', { groupId: 'g2' }, { groupId: 'g2', status: 'active', ownerId: 'o' });
const monthCount = new Map();
const ctx = {
  dynamo,
  response: (statusCode, body) => ({ statusCode, body }),
  firstLimit: async () => null,
  balanceUpdate: () => ({}),
  transactionRecord: () => ({}),
  async commit(items, messages) {
    const [boost, budget] = items.map(i => i.Update);
    const level = getItem(boost.TableName, boost.Key) ?? {};
    const userId = boost.ExpressionAttributeNames['#u'];
    if ((level.boosts?.[userId] ?? 0) >= now) return { statusCode: 409, body: { error: messages[0] } };
    const used = monthCount.get(budget.Key.budgetKey) ?? 0;
    if (used >= stats.BOOSTS.perMonth) return { statusCode: 409, body: { error: messages[1] } };
    monthCount.set(budget.Key.budgetKey, used + 1);
    applyUpdate(boost);
    return null;
  },
};
const premium = id => ({ userId: id, username: id, isPremium: true, createdAt: '2026-01-01T00:00:00Z' });
const join = (groupId, userId) => setItem('aura-group-members', { groupId, userId }, { groupId, userId, status: 'active', role: 'member' });
join('g2', 'p'); join('g2', 'free');
assert.equal((await handlePowerUps(ctx, { userId: 'free', username: 'free' }, 'POST', ['power-ups', 'g2', 'boost'], {})).statusCode, 403);
const first = await handlePowerUps(ctx, premium('p'), 'POST', ['power-ups', 'g2', 'boost'], {});
assert.equal(first.statusCode, 200, JSON.stringify(first.body));
assert.equal((await handlePowerUps(ctx, premium('p'), 'POST', ['power-ups', 'g2', 'boost'], {})).statusCode, 409, 'already boosting');
for (let i = 3; i <= 6; i++) {
  setItem('aura-groups', { groupId: `g${i}` }, { groupId: `g${i}`, status: 'active', ownerId: 'o' });
  join(`g${i}`, 'p');
  assert.equal((await handlePowerUps(ctx, premium('p'), 'POST', ['power-ups', `g${i}`, 'boost'], {})).statusCode, 200);
}
setItem('aura-groups', { groupId: 'g7' }, { groupId: 'g7', status: 'active', ownerId: 'o' });
join('g7', 'p');
const sixth = await handlePowerUps(ctx, premium('p'), 'POST', ['power-ups', 'g7', 'boost'], {});
assert.equal(sixth.statusCode, 409);
assert.match(sixth.body.error, /all 5 boosts/);
// Not a member: no boosting
assert.equal((await handlePowerUps(ctx, premium('stranger'), 'POST', ['power-ups', 'g2', 'boost'], {})).statusCode, 403);
// A boost ends after 30 days
now += 31 * 86400000;
assert.equal(stats.boostMultiplier(getItem('aura-group-stats', { groupId: 'g2', sk: 'LEVEL' }).boosts), 1);

// Reactions: only the fixed emoji list and well-formed group pins
assert.deepEqual(reactions.parseReaction('🔥'), { kind: 'emoji' });
assert.deepEqual(reactions.parseReaction('pin:1731-abc:a1b2c3d4e5f60718'), { kind: 'pin', groupId: '1731-abc', pinId: 'a1b2c3d4e5f60718' });
for (const bad of ['A', '🅰️', '1️⃣', 'pin:g1:x', 'pin::abcdef', '', null, '🔥🔥']) assert.equal(reactions.parseReaction(bad), null, String(bad));
assert.deepEqual(reactions.parseReaction('🇺🇸'), { kind: 'emoji' }, 'flags are fine (2026-11-16)');
assert.equal(reactions.parseReaction('🇦🇦'), null, 'letter tiles that are no flag');
assert.deepEqual(reactions.visibleCounts({ '🔥': 2, '😂': 0, '👍': -1 }), { '🔥': 2 });

console.log('group checks passed');
