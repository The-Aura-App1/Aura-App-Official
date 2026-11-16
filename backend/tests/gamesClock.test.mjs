// Time limits and chess clocks through the real games handler, with an
// in-memory stand-in for DynamoDB. Run: npm run test:games
import { register } from 'node:module';
import assert from 'node:assert/strict';

// The AWS SDK isn't installed locally (Lambda provides it): commands become plain records
const SDK = 'export class GetCommand { constructor(i) { this.input = i; this.op = "get"; } }'
  + ' export class PutCommand { constructor(i) { this.input = i; this.op = "put"; } }'
  + ' export class QueryCommand { constructor(i) { this.input = i; this.op = "query"; } }'
  + ' export class UpdateCommand { constructor(i) { this.input = i; this.op = "update"; } }'
  + ' export class BatchGetCommand { constructor(i) { this.input = i; this.op = "batch"; } }';
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(spec, ctx, next) {
    if (spec === '@aws-sdk/lib-dynamodb') return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(SDK)}), shortCircuit: true };
    return next(spec, ctx);
  }`));
const { handleGames } = await import('../lambdas/aura-aura/games.mjs');

let now = 1_800_000_000_000;
Date.now = () => now;

const games = new Map();
const dynamo = {
  async send(cmd) {
    const { TableName, Key } = cmd.input;
    if (cmd.op === 'get') {
      if (TableName === 'aura-games') return { Item: structuredClone(games.get(Key.matchId)) };
      if (TableName === 'aura-groups') return { Item: { groupId: Key.groupId, status: 'active' } };
      if (TableName === 'aura-group-members') return { Item: { status: 'active' } };
      return { Item: undefined };   // no block edges, no users to notify
    }
    return {};
  },
};
const ctx = {
  dynamo,
  response: (statusCode, body) => ({ statusCode, body }),
  firstLimit: async () => null,
  balanceUpdate: () => ({}),
  transactionRecord: () => ({}),
  today: () => '2026-11-16',
  async commit(items) {
    for (const item of items) {
      const put = item.Put;
      if (put?.TableName !== 'aura-games') continue;
      const had = games.get(put.Item.matchId);
      if (put.ConditionExpression?.startsWith('version') && had?.version !== put.ExpressionAttributeValues[':v']) return { statusCode: 409 };
      games.set(put.Item.matchId, structuredClone(put.Item));
    }
    return null;
  },
  query: {},
};
const user = id => ({ userId: id, username: id, displayName: id, createdAt: '2026-01-01T00:00:00Z', auraSpendable: 1000, auraEarned: 0 });
const A = user('alice'), B = user('bob');
const call = (who, method, path, body = {}) => handleGames(ctx, who, method, path.split('/').filter(Boolean), body);

async function chessGame(time) {
  const made = await call(A, 'POST', '/games/group/g1', { game: 'chess', stake: 0, time });
  assert.equal(made.statusCode, 201, JSON.stringify(made.body));
  const id = made.body.match.matchId;
  const joined = await call(B, 'POST', `/games/${id}/join`);
  assert.equal(joined.statusCode, 200);
  const m = games.get(id);
  const white = m.state.white === 0 ? A : B, black = white === A ? B : A;
  return { id, white, black };
}
const move = (who, id, from, to) => call(who, 'POST', `/games/${id}/move`, { move: { from, to } });

// Choices are checked
assert.equal((await call(A, 'POST', '/games/group/g1', { game: 'connect4', stake: 0, time: 'c3+0' })).statusCode, 400, 'clocks are chess only');
assert.equal((await call(A, 'POST', '/games/group/g1', { game: 'connect4', stake: 0, time: 'm7' })).statusCode, 400, 'unknown time');
{
  // a per-move limit sets each turn's deadline
  const made = await call(A, 'POST', '/games/group/g1', { game: 'connect4', stake: 0, time: 'm30' });
  const id = made.body.match.matchId;
  const joined = await call(B, 'POST', `/games/${id}/join`);
  assert.equal(joined.body.match.deadline, now + 30000);
  assert.equal(joined.body.match.time, 'm30');
}
{
  // no time given: chess gets 10 minutes each, other games 2 minutes a move
  const made = await call(A, 'POST', '/games/group/g1', { game: 'chess', stake: 0 });
  assert.equal(made.body.match.time, 'c10+0');
}

// A 1-minute game: the clocks start once both sides have moved, then each
// turn is charged (less the half-second allowance) plus the increment
{
  const { id, white, black } = await chessGame('c3+2');
  let m = games.get(id);
  assert.deepEqual(m.clocks, [180000, 180000]);
  now += 50000;                                   // first moves aren't charged
  assert.equal((await move(white, id, 'e2', 'e4')).statusCode, 200);
  now += 50000;
  assert.equal((await move(black, id, 'e7', 'e5')).statusCode, 200);
  m = games.get(id);
  assert.deepEqual(m.clocks, [180000, 180000]);
  assert.equal(m.deadline, now + 180000 + 500);
  const ws = m.state.white;
  now += 10500;
  const r = await move(white, id, 'g1', 'f3');
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.match.clocks[ws], 180000 - 10000 + 2000, 'charged 10 s, got 2 s back');
  assert.equal(r.body.match.clockRunning, true);
  // a poll for the same version gets the short answer
  ctx.query = { v: String(games.get(id).version) };
  const same = await call(A, 'GET', `/games/${id}`);
  assert.equal(same.body.same, true);
  ctx.query = {};
  // black thinks past their flag: the late move loses on time
  now += 181000;
  const late = await move(black, id, 'b8', 'c6');
  assert.equal(late.statusCode, 200);
  assert.equal(late.body.match.status, 'finished');
  assert.equal(late.body.match.endReason, 'timeout');
  assert.equal(late.body.match.winnerUserId, white.userId);
  assert.equal(late.body.match.clocks[1 - ws], 0);
}

// The waiting player claims a fallen flag; can't claim early
{
  const { id, white, black } = await chessGame('c1+0');
  await move(white, id, 'e2', 'e4');
  await move(black, id, 'e7', 'e5');
  now += 30000;
  assert.equal((await call(black, 'POST', `/games/${id}/claim`)).statusCode, 409, 'white still has time');
  now += 31000;
  const claim = await call(black, 'POST', `/games/${id}/claim`);
  assert.equal(claim.body.match.winnerUserId, black.userId);
  assert.equal(claim.body.match.endReason, 'timeout');
}

// A flag against a lone king is a draw: nothing left to mate with
{
  const { id, white, black } = await chessGame('c1+0');
  await move(white, id, 'e2', 'e4');
  await move(black, id, 'e7', 'e5');
  const m = games.get(id);
  // black down to a bare king (the board is only checked when moves are made)
  m.state.board = m.state.board.replace(/[pnbrq]/g, '.');
  games.set(id, m);
  now += 61000;
  const claim = await call(black, 'POST', `/games/${id}/claim`);
  assert.equal(claim.body.match.status, 'finished');
  assert.equal(claim.body.match.winnerUserId, null, 'a draw');
}

console.log('clock checks passed');

// ── Playing a bot ──
{
  // no bots for luck games, or with a stake, or at an unknown level
  assert.equal((await call(A, 'POST', '/games/group/g1', { game: 'dice', bot: 'easy' })).statusCode, 400);
  assert.equal((await call(A, 'POST', '/games/group/g1', { game: 'chess', bot: 'impossible' })).statusCode, 400);
  const made = await call(A, 'POST', '/games/group/g1', { game: 'connect4', bot: 'hard', stake: 500 });
  assert.equal(made.statusCode, 201, JSON.stringify(made.body));
  const m0 = made.body.match;
  assert.equal(m0.status, 'active');
  assert.equal(m0.stake, 0, 'bot games are never for aura');
  assert.equal(m0.bot, 'hard');
  assert.ok(m0.players[1].userId.startsWith('bot:'));
  const id = m0.matchId;
  const botTurnNow = () => games.get(id).state.turn === 1;
  // if the bot starts, it moves once it has "thought" (not straight away)
  if (botTurnNow()) {
    assert.equal((await call(A, 'GET', `/games/${id}`)).body.match.turnUserId, m0.players[1].userId, 'too soon');
    now += 2000;
    await call(A, 'GET', `/games/${id}`);
    assert.equal(games.get(id).state.turn, 0);
  }
  // play a few moves: each human move is answered by the bot on the next check-in
  for (let k = 0; k < 5 && games.get(id).status === 'active'; k++) {
    const st = games.get(id).state;
    const col = st.cols.findIndex(c => c.length < 6);
    const r = await call(A, 'POST', `/games/${id}/move`, { move: { col } });
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
    if (games.get(id).status !== 'active') break;
    now += 2000;
    const after = await call(A, 'GET', `/games/${id}`);
    assert.equal(after.statusCode, 200);
    if (games.get(id).status === 'active') assert.equal(games.get(id).state.turn, 0, 'the bot answered');
  }
  // only the person playing sees a bot game in the group's list
  const QUERY = { op: 'query' };
  const realSend = dynamo.send;
  dynamo.send = async c => (c.op === QUERY.op ? { Items: [...games.values()].filter(g => g.groupId === 'g1') } : realSend(c));
  const mine = await call(A, 'GET', '/games/group/g1');
  const theirs = await call(B, 'GET', '/games/group/g1');
  dynamo.send = realSend;
  assert.ok(mine.body.games.some(g => g.matchId === id));
  assert.ok(!theirs.body.games.some(g => g.matchId === id));
  // claiming a win on time against a bot isn't a thing
  if (games.get(id).status === 'active') {
    now += 20 * 60000;
    assert.equal((await call(A, 'POST', `/games/${id}/claim`)).statusCode, 409);
  }
  console.log('bot game checks passed');
}
