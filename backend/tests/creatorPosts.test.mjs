// The Creator page's post list (GET /users/{id}/posts?scope=mine), through
// the real aura-posts handler with an in-memory stand-in for DynamoDB. Run: npm run test:games
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

// ─── A tiny DynamoDB: posts and users, scans honour the group filter ───
const users = new Map([['bob', { userId: 'bob', username: 'bob', createdAt: '2026-01-01T00:00:00Z' }], ['amy', { userId: 'amy', username: 'amy', createdAt: '2026-01-01T00:00:00Z' }]]);
const posts = [];
for (let i = 0; i < 70; i++) posts.push({ postId: `p${i}`, authorId: 'bob', status: 'active', viewCount: i, likeCount: 1, createdAt: new Date(Date.UTC(2026, 9, 1) + i * 3_600_000).toISOString(), reactions: {} });
posts.push({ postId: 'g1', authorId: 'bob', status: 'active', groupId: 'grp', viewCount: 9, likeCount: 2, createdAt: '2026-11-15T00:00:00Z', reactions: {} });
globalThis.__fakeDynamo = {
  async send(cmd) {
    const i = cmd.input;
    if (cmd.op === 'Get') return { Item: i.TableName === 'aura-users' ? users.get(i.Key.userId) : undefined };
    if (cmd.op === 'Scan' && i.TableName === 'aura-posts') {
      const noGroups = i.FilterExpression.includes('attribute_not_exists(groupId)');
      return { Items: posts.filter(p => p.authorId === i.ExpressionAttributeValues[':aid'] && (!noGroups || !p.groupId)).map(p => structuredClone(p)) };
    }
    if (cmd.op === 'BatchGet') return { Responses: {} };
    return { Items: [] };
  },
};
const { handler } = await import('../lambdas/aura-posts/index.mjs');
const get = async (who, query) => {
  const res = await handler({
    requestContext: { http: { method: 'GET', path: '/users/bob/posts', sourceIp: '1.2.3.4' }, ...(who && { authorizer: { jwt: { claims: { sub: who } } } }) },
    queryStringParameters: query,
  });
  return JSON.parse(res.body).posts;
};

// The author asking for their own posts: up to 500, group posts too, with views and likes
let mine = await get('bob', { limit: '500', scope: 'mine' });
assert.equal(mine.length, 71);
assert.ok(mine.some(p => p.postId === 'g1'), 'group posts included');
assert.equal(typeof mine[0].viewCount, 'number');
// The same request from anyone else: the profile list (50 at most, no group posts, no views)
let theirs = await get('amy', { limit: '500', scope: 'mine' });
assert.equal(theirs.length, 50);
assert.ok(!theirs.some(p => p.postId === 'g1'));
assert.equal(theirs[0].viewCount, undefined);
// Signed out: the same
theirs = await get(null, { limit: '500', scope: 'mine' });
assert.ok(theirs.length <= 50 && !theirs.some(p => p.postId === 'g1'));
// Without scope, the author still gets the usual profile list
mine = await get('bob', { limit: '500' });
assert.equal(mine.length, 50);
console.log('creator posts: ok');
