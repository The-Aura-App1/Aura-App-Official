// The one-time 500 aura for a first suggestion: aura-users saves the
// suggestion (and marks the account), aura-aura pays. Both run for real
// against one in-memory DynamoDB. Run: npm run test:games
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

// ─── A tiny DynamoDB: the expressions these two use ───────────
const KEYS = { 'aura-users': 'userId', 'aura-feedback': 'feedbackID', 'aura-transactions': 'transactionId', 'aura-daily-budgets': 'budgetKey' };
const tables = new Map();
const table = name => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
const keyOf = (name, key) => key[KEYS[name]];
const read = (name, key) => structuredClone(table(name).get(keyOf(name, key)));
const write = (name, item) => table(name).set(item[KEYS[name]], structuredClone(item));
const splitTop = s => s.split(/,(?![^(]*\))/).map(x => x.trim()).filter(Boolean);

function holds(expr, item, names = {}, values = {}) {
  if (!expr) return true;
  const field = f => item?.[names[f] ?? f];
  return expr.split(/\s+AND\s+/).every(raw => {
    const part = raw.trim();
    let m;
    if ((m = part.match(/^attribute_exists\((\S+)\)$/))) return field(m[1]) !== undefined;
    if ((m = part.match(/^attribute_not_exists\((\S+)\)$/))) return field(m[1]) === undefined;
    if ((m = part.match(/^(\S+)\s*(=|<>)\s*(:\w+)$/))) return (field(m[1]) === values[m[3]]) === (m[2] === '=');
    throw new Error(`condition not faked: ${part}`);
  });
}

function applied(expr, item, names = {}, values = {}) {
  const out = { ...item };
  const name = f => names[f] ?? f;
  for (const [, kw, body] of expr.matchAll(/(SET|ADD)\s+([\s\S]*?)(?=\s+(?:SET|ADD)\s+|$)/g)) {
    for (const clause of splitTop(body)) {
      if (kw === 'ADD') {
        const [f, v] = clause.split(/\s+/);
        out[name(f)] = (out[name(f)] ?? 0) + values[v];
        continue;
      }
      const [f, rhs] = clause.split(/\s*=\s*/);
      const ine = rhs.match(/^if_not_exists\((\S+),\s*(:\w+)\)$/);
      out[name(f)] = ine ? (out[name(ine[1])] ?? values[ine[2]]) : values[rhs];
    }
  }
  return out;
}

const cancelled = codes => Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException', CancellationReasons: codes.map(Code => ({ Code })) });
let failNextPayment = false;
const log = [];

globalThis.__fakeDynamo = {
  async send(cmd) {
    const i = cmd.input;
    log.push(cmd.op);
    if (cmd.op === 'Get') return { Item: read(i.TableName, i.Key) };
    if (cmd.op === 'BatchGet') {
      const Responses = {};
      for (const [name, req] of Object.entries(i.RequestItems)) Responses[name] = req.Keys.map(k => read(name, k)).filter(Boolean);
      return { Responses };
    }
    if (cmd.op === 'Scan') return { Items: [...table(i.TableName).values()].filter(x => x.kind === i.ExpressionAttributeValues[':kind'] && x.status !== 'removed') };
    if (cmd.op === 'Update') {
      if (i.TableName === 'aura-rate-limits') return {};
      const item = read(i.TableName, i.Key);
      if (!holds(i.ConditionExpression, item, i.ExpressionAttributeNames, i.ExpressionAttributeValues)) {
        throw Object.assign(new Error('failed'), { name: 'ConditionalCheckFailedException' });
      }
      write(i.TableName, applied(i.UpdateExpression, { ...i.Key, ...item }, i.ExpressionAttributeNames, i.ExpressionAttributeValues));
      return {};
    }
    if (cmd.op === 'TransactWrite') {
      if (failNextPayment && i.TransactItems.some(t => t.Put?.TableName === 'aura-transactions')) {
        failNextPayment = false;
        throw Object.assign(new Error('throttled'), { name: 'ThrottlingException' });
      }
      const steps = i.TransactItems.map(t => {
        if (t.Put) {
          const p = t.Put;
          return { ok: holds(p.ConditionExpression, read(p.TableName, p.Item), p.ExpressionAttributeNames, p.ExpressionAttributeValues), apply: () => write(p.TableName, p.Item) };
        }
        const u = t.Update;
        const item = read(u.TableName, u.Key);
        return {
          ok: holds(u.ConditionExpression, item, u.ExpressionAttributeNames, u.ExpressionAttributeValues),
          apply: () => write(u.TableName, applied(u.UpdateExpression, { ...u.Key, ...item }, u.ExpressionAttributeNames, u.ExpressionAttributeValues)),
        };
      });
      if (steps.some(s => !s.ok)) throw cancelled(steps.map(s => (s.ok ? 'None' : 'ConditionalCheckFailed')));
      steps.forEach(s => s.apply());
      return {};
    }
    throw new Error(`unexpected ${cmd.op}`);
  },
};

const { handleFeedback, _test } = await import('../lambdas/aura-users/feedback.mjs');
const aura = await import('../lambdas/aura-aura/index.mjs');
assert.equal(aura.SUGGESTION_BONUS, 500);

// ─── The world ────────────────────────────────────────────────
const start = { auraBalance: 1000, auraSpendable: 300, auraEarned: 700, auraVersion: 2 };
const version = (await import('node:fs')).readFileSync(new URL('../lambdas/aura-aura/index.mjs', import.meta.url), 'utf8').match(/const AURA_VERSION\s*=\s*(\d+)/)[1];
start.auraVersion = Number(version);
for (const userId of ['ana', 'ben', 'cy', 'dee', 'eli']) {
  write('aura-users', { userId, username: userId, createdAt: '2026-01-01T00:00:00Z', ...start, isBanned: userId === 'dee' });
}
const user = id => read('aura-users', { userId: id });
const response = (statusCode, body) => ({ statusCode, body });
const used = new Map();
const rateLimited = async (id, kind, max) => {
  const k = `${id}#${kind}`;
  used.set(k, (used.get(k) ?? 0) + 1);
  return used.get(k) > max ? response(429, { error: 'slow down' }) : null;
};
const suggest = (userId, text) => handleFeedback({ method: 'POST', segments: ['feedback', 'suggestions'], userId, rawBody: JSON.stringify({ text }), rateLimited, response });
const list = async userId => (await handleFeedback({ method: 'GET', segments: ['feedback', 'suggestions'], userId, query: {}, rateLimited, response })).body;
const claim = async (userId, body = { kind: 'suggestion' }) => {
  const res = await aura.handler({
    requestContext: { http: { method: 'POST', path: '/aura/daily-bonus' }, authorizer: { jwt: { claims: { sub: userId } } } },
    body: JSON.stringify(body),
  });
  return { status: res.statusCode, body: JSON.parse(res.body) };
};
const payments = id => [...table('aura-transactions').values()].filter(t => t.toUserId === id && t.type === 'suggestion_bonus');

// Junk doesn't count (and doesn't save)
for (const junk of ['aaaaaaaaaaaaaa', 'asdasdasdasdas', '1234567890!!', '..........', 'lol lol lol lol']) {
  const r = await suggest('ana', junk);
  assert.equal(r.statusCode, 400, junk);
}
assert.equal(_test.junkReason('Add a dark mode for the games page'), null);
assert.equal(_test.junkReason('Más temas, por favor'), null, 'other languages are fine');
assert.equal(user('ana').firstSuggestionAt, undefined);
assert.equal((await list('ana')).suggestionBonus, 'offer');

// Can't claim before suggesting
let r = await claim('ana');
assert.equal(r.status, 409);
assert.match(r.body.error, /Post a suggestion first/);

// First suggestion: saved, marked, then paid 500 spendable (not earned)
let s = await suggest('ana', 'Please add a timer to card games');
assert.equal(s.statusCode, 201);
assert.equal(s.body.suggestionBonus, 'due');
assert.equal((await list('ana')).suggestionBonus, 'due');
r = await claim('ana');
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.match(r.body.message, /500 aura added/);
assert.equal(user('ana').auraSpendable, 800);
assert.equal(user('ana').auraBalance, 1500);
assert.equal(user('ana').auraEarned, 700, 'never earned, so never cashable');
assert.equal(payments('ana').length, 1);
assert.equal(payments('ana')[0].amount, 500);
assert.equal((await list('ana')).suggestionBonus, 'claimed');

// A second suggestion, or asking again, pays nothing
s = await suggest('ana', 'And a rematch button after a game ends');
assert.equal(s.statusCode, 201);
assert.equal(s.body.suggestionBonus, 'claimed');
r = await claim('ana');
assert.equal(r.status, 409);
assert.match(r.body.error, /already/);
assert.equal(user('ana').auraSpendable, 800);
assert.equal(payments('ana').length, 1);
assert.ok(user('ana').firstSuggestionAt <= user('ana').suggestionBonusAt, 'the first mark stays');

// Double tap: two claims at the same moment pay once
await suggest('ben', 'Let groups pick a banner colour');
const both = await Promise.all([claim('ben'), claim('ben'), claim('ben')]);
assert.deepEqual(both.map(x => x.status).sort(), [200, 409, 409]);
assert.equal(user('ben').auraSpendable, 800);
assert.equal(payments('ben').length, 1);

// Two suggestions at the same moment: both save, the bonus is still once
await Promise.all([suggest('eli', 'Show who reacted to my comment'), suggest('eli', 'Sort comments by newest first please')]);
assert.equal((await list('eli')).suggestions.filter(x => x.isMine).length, 2);
await Promise.all([claim('eli'), claim('eli')]);
assert.equal(payments('eli').length, 1);
assert.equal(user('eli').auraSpendable, 800);

// The payment fails: the suggestion stays, nothing is paid, and asking again pays once
await suggest('cy', 'Night mode for the chess board');
failNextPayment = true;
const quiet = console.error;
console.error = () => {};   // the handler logs the failure; expected here
r = await claim('cy');
console.error = quiet;
assert.equal(r.status, 500);
assert.equal(user('cy').auraSpendable, 300, 'nothing paid');
assert.equal(payments('cy').length, 0);
const cyList = await list('cy');
assert.equal(cyList.suggestionBonus, 'due', 'still owed, so the page asks again');
assert.ok(cyList.suggestions.some(x => x.isMine && /chess board/.test(x.text)), 'the suggestion is saved');
r = await claim('cy');
assert.equal(r.status, 200);
r = await claim('cy');
assert.equal(r.status, 409);
assert.equal(user('cy').auraSpendable, 800);
assert.equal(payments('cy').length, 1);

// Banned accounts can't suggest or claim, and aren't offered it
assert.equal((await suggest('dee', 'Please unban me, I was framed')).statusCode, 403);
assert.equal((await claim('dee')).status, 403);
assert.equal((await list('dee')).suggestionBonus, null);
assert.equal(user('dee').auraSpendable, 300);

// The limit of 3 a day is unchanged (ana has used 2 that saved plus the 5 junk tries, which don't count)
assert.equal((await suggest('ana', 'Third idea: emoji in group names')).statusCode, 201);
assert.equal((await suggest('ana', 'Fourth idea: more chess clocks')).statusCode, 429);

// Every balance change is in aura-transactions and the balance history
const paid = [...table('aura-transactions').values()].filter(t => t.type === 'suggestion_bonus');
assert.equal(paid.length, 4);
for (const t of paid) {
  assert.equal(user(t.toUserId).auraBalance - start.auraBalance, 500);
  const day = t.createdAt.slice(0, 10);
  assert.equal(read('aura-daily-budgets', { budgetKey: `HIST#${t.toUserId}#${day}` }).net, 500);
}
console.log('suggestion bonus: ok');
