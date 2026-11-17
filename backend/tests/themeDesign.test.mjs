// Theme Studio designs on the account (PUT /users/me { themeDesign }),
// through the real aura-users handler with an in-memory DynamoDB.
// Run: npm run test:games
import { register } from 'node:module';
import assert from 'node:assert/strict';

const SDK = ['Get', 'Put', 'Query', 'Scan', 'Update', 'BatchGet', 'TransactWrite', 'Delete']
  .map(n => `export class ${n}Command { constructor(i) { this.input = i; this.op = ${JSON.stringify(n)}; } }`).join('\n')
  + '\nexport const DynamoDBDocumentClient = { from: () => globalThis.__fakeDynamo };';
const stub = src => 'data:text/javascript,' + encodeURIComponent(src);
const STUBS = {
  '@aws-sdk/lib-dynamodb': stub(SDK),
  '@aws-sdk/client-dynamodb': stub('export class DynamoDBClient {}'),
  '@aws-sdk/client-sesv2': stub('export class SESv2Client {} export class SendEmailCommand {}'),
  '@aws-sdk/client-s3': stub('export class S3Client {} export class PutObjectCommand {}'),
  '@aws-sdk/s3-request-presigner': stub('export async function getSignedUrl() { return ""; }'),
};
register(stub(`const map = ${JSON.stringify(STUBS)};
  export async function resolve(spec, ctx, next) { return map[spec] ? { url: map[spec], shortCircuit: true } : next(spec, ctx); }`));

const users = new Map();
globalThis.__fakeDynamo = {
  async send(cmd) {
    const i = cmd.input;
    if (cmd.op === 'Get') return { Item: i.TableName === 'aura-users' ? structuredClone(users.get(i.Key.userId)) : undefined };
    if (cmd.op === 'Update' && i.TableName === 'aura-users' && i.UpdateExpression.startsWith('SET #')) {
      const item = { ...users.get(i.Key.userId) };
      for (const [name, field] of Object.entries(i.ExpressionAttributeNames)) item[field] = i.ExpressionAttributeValues[`:${name.slice(1)}`];
      users.set(i.Key.userId, item);
      return {};
    }
    if (cmd.op === 'Query' || cmd.op === 'Scan') return { Items: [] };
    if (cmd.op === 'BatchGet') return { Responses: {} };
    return {};
  },
};
const { handler } = await import('../lambdas/aura-users/index.mjs');

users.set('pat', { userId: 'pat', username: 'pat', isPremium: true, createdAt: '2026-01-01T00:00:00Z' });
users.set('reg', { userId: 'reg', username: 'reg', createdAt: '2026-01-01T00:00:00Z' });
const put = async (who, body) => {
  const res = await handler({
    requestContext: { http: { method: 'PUT', path: '/users/me', sourceIp: '1.2.3.4' }, authorizer: { jwt: { claims: { sub: who } } } },
    rawPath: '/users/me', body: JSON.stringify(body),
  });
  return { status: res.statusCode, body: JSON.parse(res.body) };
};
const design = { name: 'Neon', base: 'dark', background: '#000000', accent: '#22ff88', font: 'inter',
  design: { colors: { text: '#ffffff', junk: 'x' }, backdrop: { kind: 'video', mediaId: 'mabc12345', dim: 0.4 }, shape: { radius: 5 } } };

// Premium: saved, cleaned and stamped
let r = await put('pat', { theme: 'custom', themeDesign: design });
assert.equal(r.status, 200, JSON.stringify(r.body));
const saved = users.get('pat').themeDesign;
assert.equal(users.get('pat').theme, 'custom');
assert.deepEqual(saved.design.colors, { text: '#ffffff' });
assert.equal(saved.design.shape.radius, 2);
assert.equal(saved.design.backdrop.mediaId, 'mabc12345');
assert.ok(saved.updatedAt);

// Not Premium: refused, nothing saved
r = await put('reg', { themeDesign: design });
assert.equal(r.status, 403);
assert.match(r.body.error, /Premium/);
assert.equal(users.get('reg').themeDesign, undefined);

// Designs that aren't designs are refused
assert.equal((await put('pat', { themeDesign: { name: 'x' } })).status, 400);
assert.equal((await put('pat', { themeDesign: 'paint it black' })).status, 400);
// null removes it (anyone may clear theirs)
r = await put('pat', { themeDesign: null });
assert.equal(r.status, 200);
assert.equal(users.get('pat').themeDesign, null);
console.log('theme designs: ok');
