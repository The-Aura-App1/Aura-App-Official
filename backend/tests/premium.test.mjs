// The free launch Premium offer and house accounts (aura-users/premium.mjs),
// with a stand-in for DynamoDB that checks the same conditions.
import { register } from 'node:module';
import assert from 'node:assert/strict';

const STUB = `
const cmd = op => class { constructor(input) { this.input = input; this.op = op; } };
export const GetCommand = cmd('get'), UpdateCommand = cmd('update'), TransactWriteCommand = cmd('tx');
`;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(spec, ctx, next) {
    if (spec === '@aws-sdk/lib-dynamodb') return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(STUB)}), shortCircuit: true };
    return next(spec, ctx);
  }`));
const { claimLaunchPremium, ensureHouseAccount, launchSpotsLeft, LAUNCH_SPOTS, HOUSE_IDS } = await import('../lambdas/aura-users/premium.mjs');

let claimed = 0;
const users = new Map();
const db = {
  async send(c) {
    if (c.op === 'get') return { Item: claimed ? { claimed } : undefined };
    if (c.op === 'update') { users.set(c.input.Key.userId, { ...users.get(c.input.Key.userId), isPremium: true, isCreator: true }); return {}; }
    if (c.op === 'tx') {
      const [, person] = c.input.TransactItems.map(i => i.Update);
      const u = users.get(person.Key.userId);
      const reasons = [
        { Code: claimed < LAUNCH_SPOTS ? 'None' : 'ConditionalCheckFailed' },
        { Code: u && !u.premiumClaimedAt && !u.isPremium ? 'None' : 'ConditionalCheckFailed' },
      ];
      if (reasons.some(r => r.Code !== 'None')) throw Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException', CancellationReasons: reasons });
      claimed += 1;
      users.set(person.Key.userId, { ...u, isPremium: true, premiumClaimedAt: 'now', premiumSource: 'launch' });
      return {};
    }
    return {};
  },
};
const response = (statusCode, body) => ({ statusCode, body });

assert.equal(await launchSpotsLeft(db), LAUNCH_SPOTS);
for (let i = 0; i < LAUNCH_SPOTS; i++) {
  users.set(`u${i}`, { userId: `u${i}` });
  const r = await claimLaunchPremium(db, users.get(`u${i}`), response);
  assert.equal(r.statusCode, 200, `claim ${i}`);
}
assert.equal(await launchSpotsLeft(db), 0);
// the 101st is turned away
users.set('late', { userId: 'late' });
const late = await claimLaunchPremium(db, users.get('late'), response);
assert.equal(late.statusCode, 409);
assert.match(late.body.error, /All 100/);
assert.equal(users.get('late').isPremium, undefined);
// already Premium, already claimed, banned
assert.equal((await claimLaunchPremium(db, { userId: 'p', isPremium: true }, response)).statusCode, 409);
assert.equal((await claimLaunchPremium(db, users.get('u0'), response)).statusCode, 409);
assert.equal((await claimLaunchPremium(db, { userId: 'b', isBanned: true }, response)).statusCode, 403);

// House accounts become Premium creators; everyone else is left alone
const official = [...HOUSE_IDS][0];
users.set(official, { userId: official });
const upgraded = await ensureHouseAccount(db, { userId: official });
assert.equal(upgraded.isPremium && upgraded.isCreator, true);
const someone = await ensureHouseAccount(db, { userId: 'someone' });
assert.equal(someone.isPremium, undefined);
assert.equal(HOUSE_IDS.size, 2);

console.log('premium checks passed');
