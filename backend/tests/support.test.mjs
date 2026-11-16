// Support messages from Angel (aura-users/support.mjs), with stand-ins for
// DynamoDB and SES. Run: npm run test:games (it runs every backend test)
import { register } from 'node:module';
import assert from 'node:assert/strict';

const STUB = `
export class DynamoDBClient {}
export const DynamoDBDocumentClient = { from: () => ({ send: c => globalThis.__db(c) }) };
export class SESv2Client { send(c) { return globalThis.__ses(c); } }
const cmd = op => class { constructor(input) { this.input = input; this.op = op; } };
export const GetCommand = cmd('get'), UpdateCommand = cmd('update'), SendEmailCommand = cmd('send');
`;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@aws-sdk/')) return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(STUB)}), shortCircuit: true };
    return next(spec, ctx);
  }`));
const { sendSupport, checkSupport, validEmail } = await import('../lambdas/aura-users/support.mjs');

const saved = [], sent = [];
globalThis.__db = async c => {
  if (c.op === 'get') return { Item: { userId: 'u1', username: 'alex', displayName: 'Alex', createdAt: '2026-01-02T00:00:00Z' } };
  saved.push(c.input);
  return {};
};
let sesFails = false;
globalThis.__ses = async c => { if (sesFails) throw Object.assign(new Error('no'), { name: 'MessageRejected' }); sent.push(c.input); return {}; };
const response = (statusCode, body) => ({ statusCode, body });
let limitedAfter = Infinity, calls = 0;
const rateLimited = async () => (++calls > limitedAfter ? response(429, { error: 'Slow down.' }) : null);
const ok = { category: 'bug', message: 'The wallet shows zero after a game.', contactEmail: 'alex@gmail.com' };

// Checks
assert.equal(validEmail('a@b.co'), 'a@b.co');
for (const bad of ['', 'nope', 'a@b', 'a b@c.com', 'a@b.com\nBcc: x@y.com', 'x'.repeat(250) + '@b.com', null]) assert.equal(validEmail(bad), null, String(bad));
assert.match(checkSupport({ ...ok, category: 'refund' }).error, /what it's about/);
assert.match(checkSupport({ ...ok, message: 'short' }).error, /a little more/);
assert.match(checkSupport({ ...ok, message: 'x'.repeat(2001) }).error, /under 2000/);
assert.match(checkSupport({ ...ok, contactEmail: 'not-an-email' }).error, /email address/);
assert.equal(checkSupport({ ...ok, message: '  hi​ there,   the app\r\n\r\n\r\n\r\ncrashed  ' }).text, 'hi there, the app\n\ncrashed');

// Not set up yet: saved, and the person is told it didn't go
delete process.env.SUPPORT_TO;
let r = await sendSupport({ userId: 'u1', body: ok, rateLimited, response });
assert.equal(r.statusCode, 503);
assert.equal(saved.at(-1).ExpressionAttributeValues[':s'], 'unsent');

// Set up: emailed to the inbox, replying to the person
process.env.SUPPORT_TO = 'support@example.com';
process.env.SUPPORT_FROM = 'support@example.com';
r = await sendSupport({ userId: 'u1', body: ok, rateLimited, response });
assert.equal(r.statusCode, 201);
assert.match(r.body.ticket, /^[0-9A-F]{10}$/);
const mail = sent.at(-1);
assert.deepEqual(mail.Destination.ToAddresses, ['support@example.com']);
assert.deepEqual(mail.ReplyToAddresses, ['alex@gmail.com']);
assert.match(mail.Content.Simple.Subject.Data, /\[Aura support [0-9A-F]{10}\] Something isn't working \(@alex\)/);
assert.match(mail.Content.Simple.Body.Text.Data, /Reply to: alex@gmail\.com[\s\S]*The wallet shows zero after a game\./);
assert.equal(saved.at(-1).ExpressionAttributeValues[':s'], 'sent');
assert.equal(saved.at(-1).Key.feedbackID, `SUPPORT#${r.body.ticket}`);

// SES refusing it: saved as unsent, 503
sesFails = true;
r = await sendSupport({ userId: 'u1', body: ok, rateLimited, response });
assert.equal(r.statusCode, 503);
sesFails = false;

// Bad input never reaches SES; rate limits come first
const before = sent.length;
assert.equal((await sendSupport({ userId: 'u1', body: { ...ok, contactEmail: 'x' }, rateLimited, response })).statusCode, 400);
limitedAfter = calls;
assert.equal((await sendSupport({ userId: 'u1', body: ok, rateLimited, response })).statusCode, 429);
assert.equal(sent.length, before);

console.log('support checks passed');
