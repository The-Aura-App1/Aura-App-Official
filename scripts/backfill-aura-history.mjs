// One-time backfill of the profile aura graph's history from aura-transactions.
//
// aura-aura has written HIST#<userId>#<date> and HISTM#<userId>#<yyyy-mm>
// totals (in aura-daily-budgets) for every balance change since the history
// feature was deployed. This fills in the days before that from the
// transaction log, so graphs don't start flat on the deploy day.
//
//   node scripts/backfill-aura-history.mjs --until 2026-11-16            (dry run: prints what it would write)
//   node scripts/backfill-aura-history.mjs --until 2026-11-16 --write    (writes)
//
// --until is the day aura-aura was deployed with history (UTC). Only days
// BEFORE it are written, so live totals are never overwritten; the deploy
// day's own month total gets the earlier days added to it.
// --since defaults to 2026-10-23, when balances were split into earned and
// spendable (older balances were reset to 0, so older changes don't count).
// Run it once. It uses the AWS CLI with --profile aura and only reads
// aura-transactions and writes HIST/HISTM items in aura-daily-budgets.

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(`--${name}`); return i === -1 ? null : args[i + 1]; };
const since = opt('since') ?? '2026-10-23';
const until = opt('until');
const write = args.includes('--write');
if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
  console.error('Pass --until YYYY-MM-DD: the UTC day aura-aura was deployed with balance history.');
  process.exit(1);
}

const aws = (...cmd) => JSON.parse(execFileSync('aws', [...cmd, '--profile', 'aura', '--region', 'us-east-1', '--output', 'json'], { encoding: 'utf8', maxBuffer: 1 << 28 }) || '{}');
const num = v => (v?.N !== undefined ? Number(v.N) : 0);
const str = v => v?.S;

// Every transaction, page by page
const items = [];
let start = null;
do {
  const page = aws('dynamodb', 'scan', '--table-name', 'aura-transactions', ...(start ? ['--starting-token', start] : []), '--max-items', '1000');
  items.push(...(page.Items ?? []));
  start = page.NextToken ?? null;
} while (start);

// How each kind of transaction moved balances (mirrors aura-aura's writes)
function moves(t) {
  const type = str(t.type);
  const amount = num(t.amount);
  switch (type) {
    case 'give': return [[str(t.fromUserId), -(num(t.fromSpendable) + num(t.fromEarned))], [str(t.toUserId), amount]];
    case 'take': return [[str(t.fromUserId), amount], [str(t.takenBy), -num(t.takerCost)]];
    case 'bonus': case 'ad': return [[str(t.toUserId), amount]];
    case 'game_stake': case 'game_win': case 'game_refund': return [[str(t.userId), amount]];
    default: return [];
  }
}

const days = new Map();     // HIST#user#day -> { net, moves }
const months = new Map();   // HISTM#user#month -> { net, moves }
const add = (map, key, delta) => { const e = map.get(key) ?? { net: 0, moves: 0 }; e.net += delta; e.moves += 1; map.set(key, e); };
let used = 0;
for (const t of items) {
  const day = (str(t.createdAt) ?? '').slice(0, 10);
  if (!day || day < since || day >= until || str(t.status) === 'failed') continue;
  let counted = false;
  for (const [userId, delta] of moves(t)) {
    if (!userId || !delta) continue;
    add(days, `HIST#${userId}#${day}`, delta);
    add(months, `HISTM#${userId}#${day.slice(0, 7)}`, delta);
    counted = true;
  }
  if (counted) used++;
}

console.log(`${items.length} transactions read, ${used} between ${since} and ${until} (exclusive).`);
console.log(`${days.size} day totals and ${months.size} month totals to write.`);
if (!write) {
  for (const [k, v] of [...days].slice(0, 15)) console.log('  ', k, v);
  console.log('Dry run. Add --write to save them.');
  process.exit(0);
}

const put = (key, e, mode) => aws('dynamodb', 'update-item', '--table-name', 'aura-daily-budgets',
  '--key', JSON.stringify({ budgetKey: { S: key } }),
  '--update-expression', mode === 'set' ? 'SET net = :n, moves = :m' : 'ADD net :n, moves :m',
  '--expression-attribute-values', JSON.stringify({ ':n': { N: String(e.net) }, ':m': { N: String(e.moves) } }));

let n = 0;
// Days before the deploy only ever came from here, so they're set outright.
for (const [k, e] of days) { put(k, e, 'set'); if (++n % 50 === 0) console.log(`  ${n} written`); }
// The deploy month may already have live totals, so the earlier days are
// added to it; months before it are set. Run the script once only.
const deployMonth = until.slice(0, 7);
for (const [k, e] of months) { put(k, e, k.endsWith(`#${deployMonth}`) ? 'add' : 'set'); n++; }
console.log(`Done: ${n} totals written.`);
