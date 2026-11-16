// Sets one group's level, for testing level perks (2026-11-16: "make First
// Group the max level"). Writes only that group's LEVEL item in
// aura-group-stats, raising its XP to the level's floor; it never lowers XP.
//
// Usage (PowerShell, from the repo folder):
//   node scripts/set-group-level.mjs --name "First Group"              (dry run: finds the group, prints the change)
//   node scripts/set-group-level.mjs --name "First Group" --write      (writes)
//   --level N picks a level (default: the max, 15)
//
// It uses the AWS CLI with --profile aura, like the other scripts here.
import { execFileSync } from 'node:child_process';

const MAX_LEVEL = 15;   // groupStats.mjs
const levelFloor = level => 50 * level * (level - 1);

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(`--${name}`); return i === -1 ? null : args[i + 1]; };
const name = opt('name');
const level = Number(opt('level') ?? MAX_LEVEL);
const write = args.includes('--write');
if (!name) { console.error('Pass --name "<group name>".'); process.exit(1); }
if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) { console.error(`--level must be 1 to ${MAX_LEVEL}.`); process.exit(1); }

const aws = (...cmd) => JSON.parse(execFileSync('aws', [...cmd, '--profile', 'aura', '--region', 'us-east-1', '--output', 'json'], { encoding: 'utf8', maxBuffer: 1 << 26 }) || '{}');

const found = aws('dynamodb', 'scan', '--table-name', 'aura-groups',
  '--filter-expression', 'nameLower = :n AND #s = :active',
  '--expression-attribute-names', JSON.stringify({ '#s': 'status' }),
  '--expression-attribute-values', JSON.stringify({ ':n': { S: name.trim().toLowerCase() }, ':active': { S: 'active' } }),
  '--projection-expression', 'groupId, #s').Items ?? [];
if (found.length !== 1) { console.error(`Found ${found.length} active groups named "${name}".`); process.exit(1); }
const groupId = found[0].groupId.S;

const current = aws('dynamodb', 'get-item', '--table-name', 'aura-group-stats',
  '--key', JSON.stringify({ groupId: { S: groupId }, sk: { S: 'LEVEL' } })).Item;
const xp = Number(current?.xp?.N ?? 0);
const target = levelFloor(level);
console.log(`${name} (${groupId}): ${xp} XP now; level ${level} needs ${target}.`);
if (xp >= target) { console.log('Already there. Nothing to do.'); process.exit(0); }
if (!write) { console.log(`Dry run. Add --write to raise it to ${target} XP.`); process.exit(0); }

aws('dynamodb', 'update-item', '--table-name', 'aura-group-stats',
  '--key', JSON.stringify({ groupId: { S: groupId }, sk: { S: 'LEVEL' } }),
  '--update-expression', 'SET xp = :xp',
  '--condition-expression', 'attribute_not_exists(xp) OR xp < :xp',
  '--expression-attribute-values', JSON.stringify({ ':xp': { N: String(target) } }),
  '--return-values', 'UPDATED_NEW');
console.log(`Done: ${name} is level ${level} (${target} XP).`);
