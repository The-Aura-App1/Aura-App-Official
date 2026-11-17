// People's own topics on posts (aura-posts customTopics.mjs), through the
// real handler with an in-memory DynamoDB. Run: npm run test:games
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
const users = { me: { userId: 'me', username: 'me', displayName: 'Me', createdAt: '2026-01-01T00:00:00Z' } };
globalThis.__fakeDynamo = {
  async send(cmd) {
    const i = cmd.input;
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
    if (cmd.op === 'BatchGet') return { Responses: {} };
    return { Items: [] };
  },
};
const { handler } = await import('../lambdas/aura-posts/index.mjs');
const call = async (method, path, body) => {
  const res = await handler({ requestContext: { http: { method, path, sourceIp: '1.2.3.4' }, authorizer: { jwt: { claims: { sub: 'me' } } } }, body: body && JSON.stringify(body) });
  return { status: res.statusCode, body: JSON.parse(res.body) };
};
const post = (tags, customTopics) => call('POST', '/posts', { type: 'text', caption: 'Hello there', tags, customTopics });

// Saved next to the curated topics, normalized
let r = await post(['cooking'], ['home baking', 'sourdough']);
assert.equal(r.status, 201, JSON.stringify(r.body));
const saved = posts.at(-1);
assert.deepEqual(saved.tags, ['cooking']);
assert.deepEqual(saved.customTopics, ['home baking', 'sourdough']);

// Turned away: not normalized, links, deny list, one of Aura's own, twice, over 3 in all
assert.equal((await post([], ['Home Baking'])).status, 400);
assert.match((await post([], ['https://spam.example'])).body.error, /links/);
assert.match((await post([], ['aura team'])).body.error, /isn't allowed/);
assert.match((await post([], ['cooking'])).body.error, /Pick it from the list/);
assert.match((await post([], ['jazz', 'jazz'])).body.error, /once per post/);
assert.match((await post(['art', 'music'], ['jazz', 'blues'])).body.error, /Up to 3 topics in all/);
assert.equal((await post([], 'jazz')).status, 400);

// Up to 5 a day (2 used above, the refused ones used none)
assert.equal((await post([], ['jazz', 'blues', 'soul'])).status, 201);
r = await post([], ['funk']);
assert.equal(r.status, 429);
assert.match(r.body.error, /5 of your own topics a day/);
assert.equal((await post(['art'], [])).status, 201, 'curated topics are never limited this way');

// Old-style posts still save as before
assert.equal((await post(['art'])).status, 201);
assert.equal(posts.at(-1).customTopics, undefined);

// The feed never builds a list for a custom topic
const feed = await call('GET', '/posts');
assert.equal(feed.status, 200);
const listed = new Set(feed.body.posts.flatMap(p => p.customTopics ?? []));
assert.ok(listed.has('home baking'), 'custom topics come back on the posts');
assert.equal(JSON.stringify(feed.body).includes('"topic":"home baking"'), false);
console.log('custom topics: ok');
