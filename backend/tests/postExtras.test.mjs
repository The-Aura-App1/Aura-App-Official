// Tagging people and adding a place to a post (aura-posts createPost),
// through the real handler with an in-memory DynamoDB. Run: npm run test:games
import { register } from 'node:module';
import assert from 'node:assert/strict';

const SDK = ['Get', 'Put', 'Query', 'Scan', 'Update', 'BatchGet', 'TransactWrite', 'Delete']
  .map(n => `export class ${n}Command { constructor(i) { this.input = i; this.op = ${JSON.stringify(n)}; } }`).join('\n')
  + '\nexport const DynamoDBDocumentClient = { from: () => globalThis.__fakeDynamo };';
const stub = src => 'data:text/javascript,' + encodeURIComponent(src);
const STUBS = {
  '@aws-sdk/lib-dynamodb': stub(SDK),
  '@aws-sdk/client-dynamodb': stub('export class DynamoDBClient {}'),
  '@aws-sdk/client-s3': stub('export class S3Client {} export class PutObjectCommand {}'),
  '@aws-sdk/s3-request-presigner': stub('export async function getSignedUrl() { return ""; }'),
};
register(stub(`const map = ${JSON.stringify(STUBS)};
  export async function resolve(spec, ctx, next) { return map[spec] ? { url: map[spec], shortCircuit: true } : next(spec, ctx); }`));

const posts = [];
const limits = new Map();
const users = {
  me: { userId: 'me', username: 'me', displayName: 'Me', createdAt: '2026-01-01T00:00:00Z' },
  'USERNAME#ann': { userId: 'USERNAME#ann', ownerId: 'u-ann' }, 'u-ann': { userId: 'u-ann', username: 'ann' },
  'USERNAME#bob': { userId: 'USERNAME#bob', ownerId: 'u-bob' }, 'u-bob': { userId: 'u-bob', username: 'bob' },
  'USERNAME#gone': { userId: 'USERNAME#gone', ownerId: 'u-gone' }, 'u-gone': { userId: 'u-gone', username: 'gone', isBanned: true },
  'USERNAME#mine': { userId: 'USERNAME#mine', ownerId: 'me' },
  'USERNAME#blocker': { userId: 'USERNAME#blocker', ownerId: 'u-blocker' }, 'u-blocker': { userId: 'u-blocker', username: 'blocker' },
};
globalThis.__fakeDynamo = {
  async send(cmd) {
    const i = cmd.input;
    if (cmd.op === 'Get' && i.TableName === 'aura-follows') return { Item: i.Key.userId === 'u-blocker' && String(i.Key.edge).includes('me') ? { status: 'active' } : undefined };
    if (cmd.op === 'Get') return { Item: i.TableName === 'aura-users' ? users[i.Key.userId] : undefined };
    if (cmd.op === 'Update' && i.TableName === 'aura-rate-limits') {
      if (!i.Key.limitKey.includes('#custom-topic#')) return {};   // only the topic cap is under test
      const n = (limits.get(i.Key.limitKey) ?? 0) + 1;
      if (n > i.ExpressionAttributeValues[':limit']) throw Object.assign(new Error('limited'), { name: 'ConditionalCheckFailedException' });
      limits.set(i.Key.limitKey, n);
      return {};
    }
    if (cmd.op === 'Put' && i.TableName === 'aura-posts') { posts.push(structuredClone(i.Item)); return {}; }
    if (cmd.op === 'TransactWrite') { for (const t of i.TransactItems) if (t.Put?.TableName === 'aura-posts') posts.push(structuredClone(t.Put.Item)); return {}; }
    if (cmd.op === 'Scan' && i.TableName === 'aura-posts') return { Items: posts.map(p => structuredClone(p)) };
    if (cmd.op === 'BatchGet') {
      const Responses = {};
      for (const [name, req] of Object.entries(i.RequestItems)) Responses[name] = name === 'aura-users' ? req.Keys.map(k => users[k.userId]).filter(Boolean) : [];
      return { Responses };
    }
    // blocks: u-blocker has blocked me
    if (cmd.op === 'Get' && i.TableName === 'aura-follows') return { Item: i.Key.userId === 'u-blocker' && String(i.Key.edge).includes('me') ? { status: 'active' } : undefined };
    return { Items: [] };
  },
};
const { handler } = await import('../lambdas/aura-posts/index.mjs');
const call = async body => {
  const res = await handler({ requestContext: { http: { method: 'POST', path: '/posts', sourceIp: '1.2.3.4' }, authorizer: { jwt: { claims: { sub: 'me' } } } }, body: JSON.stringify({ type: 'text', caption: 'Hi there', ...body }) });
  return { status: res.statusCode, body: JSON.parse(res.body) };
};

// Tagged people are stored as real accounts, and a place name as typed
let r = await call({ people: ['@Ann', 'bob', 'ann'], location: '  Mount   Rainier ' });
assert.equal(r.status, 201, JSON.stringify(r.body));
assert.deepEqual(posts.at(-1).people, [{ userId: 'u-ann', username: 'ann' }, { userId: 'u-bob', username: 'bob' }]);
assert.equal(posts.at(-1).location, 'Mount Rainier');

// Turned away
assert.match((await call({ people: ['nobody_here'] })).body.error, /Couldn't find @nobody_here/);
assert.match((await call({ people: ['gone'] })).body.error, /Couldn't find @gone/, 'banned accounts');
assert.match((await call({ people: ['mine'] })).body.error, /tag yourself/);
assert.match((await call({ people: ['blocker'] })).body.error, /can't tag @blocker/);
assert.match((await call({ people: ['bad name!'] })).body.error, /by their username/);
assert.match((await call({ people: Array.from({ length: 11 }, (_, i) => `user_${i}`) })).body.error, /up to 10/);
assert.match((await call({ location: 'x'.repeat(61) })).body.error, /under 60/);
assert.match((await call({ location: 'www.spam.example/buy' })).body.error, /place name/);
assert.match((await call({ location: 'dm me @ insta' })).body.error, /place name/);

// Neither one is needed, and old-style posts are unchanged
r = await call({});
assert.equal(r.status, 201);
assert.equal(posts.at(-1).people, undefined);
assert.equal(posts.at(-1).location, undefined);
console.log('people and place: ok');
