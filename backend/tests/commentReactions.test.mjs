// Reactions on comments, through the real aura-posts handler with an
// in-memory stand-in for DynamoDB. Run: npm run test:games
import { register } from 'node:module';
import assert from 'node:assert/strict';

// The AWS SDK isn't installed locally (Lambda provides it): commands become plain records
const SDK = ['Get', 'Put', 'Query', 'Scan', 'Update', 'BatchGet', 'TransactWrite', 'Delete']
  .map(n => `export class ${n}Command { constructor(i) { this.input = i; this.op = ${JSON.stringify(n)}; } }`).join('\n')
  + '\nexport const DynamoDBDocumentClient = { from: () => globalThis.__fakeDynamo };';
const CLIENT = 'export class DynamoDBClient {}';
const S3 = 'export class S3Client {} export class PutObjectCommand {} export async function getSignedUrl() { return ""; }';
const stub = src => 'data:text/javascript,' + encodeURIComponent(src);
register(stub(`
  const map = { '@aws-sdk/lib-dynamodb': ${JSON.stringify(stub(SDK))}, '@aws-sdk/client-dynamodb': ${JSON.stringify(stub(CLIENT))},
    '@aws-sdk/client-s3': ${JSON.stringify(stub(S3))}, '@aws-sdk/s3-request-presigner': ${JSON.stringify(stub(S3))} };
  export async function resolve(spec, ctx, next) { return map[spec] ? { url: map[spec], shortCircuit: true } : next(spec, ctx); }`));

// ─── A tiny DynamoDB: just what reactions use ─────────────────
const tables = new Map();
const keyOf = key => JSON.stringify(Object.keys(key).sort().map(k => [k, key[k]]));
const table = name => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
const put = (name, item, keyNames) => table(name).set(keyOf(Object.fromEntries(keyNames.map(k => [k, item[k]]))), structuredClone(item));
const read = (name, key) => structuredClone(table(name).get(keyOf(key)));
const cancel = codes => Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException', CancellationReasons: codes.map(Code => ({ Code })) });

function reactionStep(u) {
  const v = u.ExpressionAttributeValues, n = u.ExpressionAttributeNames;
  const item = read(u.TableName, u.Key);
  const expr = u.UpdateExpression;
  if (expr.startsWith('ADD #r')) {
    const have = item?.reactions ?? new Set();
    if (have.has(v[':one']) || have.size >= v[':max']) return { ok: false };
    return { ok: true, apply: () => put(u.TableName, { ...u.Key, ...item, reactions: new Set([...have, v[':one']]) }, Object.keys(u.Key)) };
  }
  if (expr.startsWith('DELETE #r')) {
    const have = item?.reactions ?? new Set();
    if (!have.has(v[':one'])) return { ok: false };
    return { ok: true, apply: () => put(u.TableName, { ...item, reactions: new Set([...have].filter(r => r !== v[':one'])) }, Object.keys(u.Key)) };
  }
  const k = n['#k'];
  const counts = item?.reactions ?? {};
  if (expr.includes('if_not_exists(#rx.#k')) {
    if (!item || item.status !== 'active' || (!(k in counts) && Object.keys(counts).length >= v[':kinds'])) return { ok: false };
    return { ok: true, apply: () => put(u.TableName, { ...item, reactions: { ...counts, [k]: (counts[k] ?? 0) + 1 } }, Object.keys(u.Key)) };
  }
  if (!(counts[k] > 0)) return { ok: false };
  return { ok: true, apply: () => put(u.TableName, { ...item, reactions: { ...counts, [k]: counts[k] - 1 } }, Object.keys(u.Key)) };
}

globalThis.__fakeDynamo = {
  async send(cmd) {
    const i = cmd.input;
    if (cmd.op === 'Get') return { Item: read(i.TableName, i.Key) };
    if (cmd.op === 'BatchGet') {
      const Responses = {};
      for (const [name, req] of Object.entries(i.RequestItems)) Responses[name] = req.Keys.map(k => read(name, k)).filter(Boolean);
      return { Responses };
    }
    if (cmd.op === 'Query' || cmd.op === 'Scan') return { Items: [] };
    if (cmd.op === 'Update') {
      if (i.UpdateExpression.startsWith('SET #rx = if_not_exists')) {
        const item = read(i.TableName, i.Key);
        if (item && !item.reactions) put(i.TableName, { ...item, reactions: {} }, Object.keys(i.Key));
      }
      return {};   // rate limits and view counts: always fine here
    }
    if (cmd.op === 'TransactWrite') {
      const steps = i.TransactItems.map(t => reactionStep(t.Update));
      if (steps.some(s => !s.ok)) throw cancel(steps.map(s => (s.ok ? 'None' : 'ConditionalCheckFailed')));
      steps.forEach(s => s.apply());
      return {};
    }
    throw new Error(`unexpected ${cmd.op}`);
  },
};

const { handler } = await import('../lambdas/aura-posts/index.mjs');

// ─── The world ────────────────────────────────────────────────
const users = ['alice', 'bob', 'eve', 'dave', 'carol'];
for (const id of users) put('aura-users', { userId: id, username: id, createdAt: '2026-01-01T00:00:00Z', isBanned: id === 'dave', isPrivate: id === 'carol' }, ['userId']);
put('aura-follows', { userId: 'eve', edge: 'BLOCK#alice', otherId: 'alice', status: 'active' }, ['userId', 'edge']);
put('aura-groups', { groupId: 'g1', status: 'active', joinType: 'invite', ownerId: 'bob' }, ['groupId']);
const posts = { p1: 'bob', p2: 'carol', p3: 'bob', p5: 'eve' };
for (const [postId, authorId] of Object.entries(posts)) put('aura-posts', { postId, authorId, status: 'active', ...(postId === 'p3' && { groupId: 'g1' }) }, ['postId']);
const comment = (commentId, postId, authorId, status = 'active') => put('aura-comments', { commentId, postId, authorId, status }, ['commentId']);
comment('c1', 'p1', 'bob');
comment('c2', 'p1', 'bob', 'pending_review');
comment('c3', 'p2', 'carol');
comment('c4', 'p3', 'bob');
comment('c5', 'p1', 'eve');

const react = async (who, commentId, reaction, on = true) => {
  const res = await handler({
    requestContext: { http: { method: 'POST', path: `/comments/${commentId}/reactions`, sourceIp: '1.2.3.4' }, ...(who && { authorizer: { jwt: { claims: { sub: who } } } }) },
    body: JSON.stringify({ reaction, on }),
  });
  return { status: res.statusCode, body: JSON.parse(res.body) };
};

// Reacting on a visible comment
let r = await react('alice', 'c1', '🔥');
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.deepEqual(r.body.reactions, { '🔥': 1 });
assert.deepEqual(r.body.myReactions, ['🔥']);
// ❤ and ❤️ are the same reaction
r = await react('bob', 'c1', '❤');
assert.deepEqual(r.body.reactions, { '🔥': 1, '❤️': 1 });
r = await react('bob', 'c1', '❤️', false);
assert.equal(r.status, 200);
assert.deepEqual(r.body.reactions, { '🔥': 1 }, 'taking it back by the other spelling works');
// Doing it twice changes nothing
r = await react('alice', 'c1', '🔥');
assert.deepEqual(r.body.reactions, { '🔥': 1 });
// 3 per person
await react('alice', 'c1', '😂');
await react('alice', 'c1', '👀');
r = await react('alice', 'c1', '🎉');
assert.equal(r.status, 409);
assert.match(r.body.error, /up to 3 reactions to a comment/);
// Letters, fake flags, the deny list and group pins don't work on comments
for (const bad of ['A', '🇦🇦', '🇦', '🖕', '🖕🏽', '🍆', '🔫', 'pin:g1:abcdef12', '🔥🔥']) assert.equal((await react('bob', 'c1', bad)).status, 400, bad);

// Who can't react
assert.equal((await react(null, 'c1', '🔥')).status, 401, 'signed out');
assert.equal((await react('dave', 'c1', '🔥')).status, 403, 'banned');
assert.equal((await react('alice', 'c2', '🔥')).status, 404, 'hidden for review');
assert.equal((await react('alice', 'c3', '🔥')).status, 404, 'a private account\'s post');
assert.equal((await react('alice', 'c4', '🔥')).status, 404, 'a group they can\'t see');
assert.equal((await react('alice', 'c5', '🔥')).status, 404, 'its author blocked them');
assert.equal((await react('alice', 'nope', '🔥')).status, 404, 'no such comment');

// 20 different reactions per comment at most
const busy = read('aura-comments', { commentId: 'c1' });
put('aura-comments', { ...busy, reactions: Object.fromEntries([...'😀😃😄😁😆😅🤣😂🙂😉😊😇🥰😍🤩😘😋😛😜🤪'].map(e => [e, 1])) }, ['commentId']);
r = await react('bob', 'c1', '🦄');
assert.equal(r.status, 409);
assert.match(r.body.error, /already has 20 different reactions/);
assert.equal((await react('bob', 'c1', '😀')).status, 200, 'one already on it still works');

// Reactions and likes live under different keys
assert.ok(read('aura-likes', { userId: 'alice', postId: 'react#comment#c1' }));
assert.equal(read('aura-likes', { userId: 'alice', postId: 'comment#c1' }), undefined);
// Post reactions still work through the shared code
const onPost = await handler({
  requestContext: { http: { method: 'POST', path: '/posts/p1/reactions', sourceIp: '1.2.3.4' }, authorizer: { jwt: { claims: { sub: 'alice' } } } },
  body: JSON.stringify({ reaction: '❤', on: true }),
});
assert.equal(onPost.statusCode, 200, onPost.body);
assert.deepEqual(JSON.parse(onPost.body).reactions, { '❤️': 1 });
console.log('comment reactions: ok');
