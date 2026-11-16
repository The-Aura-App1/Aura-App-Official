/**
 * @jest-environment node
 */
// Some constants live in both the web app and the Lambdas (see CLAUDE.md,
// "change both together"). These tests read the Lambda source and fail if the
// copies drift apart, so a mismatch is caught before anything is deployed.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TOPIC_IDS, MAX_POST_TOPICS } from './utils/topics';
import { EMBED_MODEL, EMBED_DIM, encodeVector } from './utils/embeddings';
import { MAX_HASHTAGS, HASHTAG_PATTERN } from './utils/hashtags';
import { THEMES, THEME_IDS } from './themes';
import { REPORT_REASON_IDS } from './utils/reportReasons';
import * as powerUpsApp from './utils/powerUps';

const LAMBDAS = path.join(__dirname, '..', 'backend', 'lambdas');
const MODEL   = path.join(__dirname, '..', 'public', 'models', 'Xenova', 'all-MiniLM-L6-v2', 'onnx', 'model_quantized.onnx');
const MODEL_SHA256 = 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1';

function lambdaSource(name) {
  return fs.readFileSync(path.join(LAMBDAS, name, 'index.mjs'), 'utf8');
}

function constant(source, name) {
  const match = source.match(new RegExp(`const ${name}\\s*=\\s*([^;]+);`));
  if (!match) throw new Error(`${name} not found`);
  return match[1];
}

const posts = lambdaSource('aura-posts');

test('aura-posts accepts exactly the topics the app offers', () => {
  const serverTopics = [...constant(posts, 'TOPICS').matchAll(/'([a-z]+)'/g)].map(m => m[1]);
  expect([...serverTopics].sort()).toEqual([...TOPIC_IDS].sort());
  expect(Number(constant(posts, 'MAX_POST_TOPICS'))).toBe(MAX_POST_TOPICS);
});

test('aura-posts enforces the same hashtag rules as the app', () => {
  expect(Number(constant(posts, 'MAX_HASHTAGS'))).toBe(MAX_HASHTAGS);
  expect(constant(posts, 'HASHTAG_PATTERN')).toBe(HASHTAG_PATTERN.toString());
});

test('aura-posts expects the same embedding model and size as the app', () => {
  expect(constant(posts, 'EMBED_MODEL')).toBe(`'${EMBED_MODEL}'`);
  expect(Number(constant(posts, 'EMBED_DIM'))).toBe(EMBED_DIM);
});

test('aura-aura and aura-users use the same daily limits', () => {
  const rules = source => constant(source, 'RULES').replace(/\s+/g, '');
  expect(rules(lambdaSource('aura-users'))).toBe(rules(lambdaSource('aura-aura')));
});

test('aura-users saves exactly the themes the app knows about', () => {
  const serverThemes = [...constant(lambdaSource('aura-users'), 'THEME_IDS').matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
  expect(serverThemes).toEqual(THEME_IDS);
  for (const theme of THEMES) expect(THEME_IDS).toContain(theme.id);
});

test('aura-posts accepts vectors the app produces and rejects bad ones', () => {
  const body = posts.match(/function isValidEmbedding\(value\) \{\r?\n([\s\S]*?)\r?\n\}/)[1];
  // eslint-disable-next-line no-new-func
  const isValidEmbedding = new Function('value', 'Buffer', 'EMBED_DIM', body);
  const check = value => isValidEmbedding(value, Buffer, EMBED_DIM);

  const unit = Array.from({ length: EMBED_DIM }, (_, i) => Math.sin(i + 1));
  const norm = Math.hypot(...unit);
  expect(check(encodeVector(unit.map(n => n / norm)))).toBe(true);

  expect(check(encodeVector(unit.map(() => 0)))).toBe(false);        // not normalized
  expect(check(Buffer.alloc(10).toString('base64'))).toBe(false);    // wrong length
  expect(check('not base64!')).toBe(false);
  expect(check(12345)).toBe(false);
});

test('the wallet and aura-aura agree on whether ad rewards are on', () => {
  const wallet = fs.readFileSync(path.join(__dirname, 'pages', 'AuraWallet.jsx'), 'utf8');
  expect(constant(lambdaSource('aura-aura'), 'ADS_ENABLED').split(/\s/)[0])
    .toBe(constant(wallet, 'ADS_ENABLED'));
});

test('every Lambda that cleans text uses the same rules', () => {
  const copies = ['aura-users', 'aura-posts', 'aura-comments', 'aura-groups']
    .map(name => fs.readFileSync(path.join(LAMBDAS, name, 'text.mjs'), 'utf8').replace(/\r\n/g, '\n'));
  for (const copy of copies) expect(copy).toBe(copies[0]);
});

test('every Lambda that checks private accounts uses the same rules', () => {
  const copies = ['aura-posts', 'aura-comments', 'aura-aura']
    .map(name => fs.readFileSync(path.join(LAMBDAS, name, 'privacy.mjs'), 'utf8').replace(/\r\n/g, '\n'));
  for (const copy of copies) expect(copy).toBe(copies[0]);
  // aura-users writes the follows the others read
  const follows = fs.readFileSync(path.join(LAMBDAS, 'aura-users', 'follows.mjs'), 'utf8');
  expect(constant(follows, 'FOLLOWS_TABLE')).toBe(constant(copies[0], 'FOLLOWS_TABLE'));
});

test('posts and accounts agree on who may comment', () => {
  expect(constant(lambdaSource('aura-posts'), 'COMMENT_VISIBILITY'))
    .toBe(constant(lambdaSource('aura-users'), 'COMMENT_VISIBILITY'));
});

test('the self-hosted model file is the verified original', () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(MODEL)).digest('hex');
  expect(hash).toBe(MODEL_SHA256);
});

test('aura-comments finds @mentions by the same rule the app links them', () => {
  const app = fs.readFileSync(path.join(__dirname, 'utils', 'mentions.js'), 'utf8');
  expect(constant(lambdaSource('aura-comments'), 'MENTION')).toBe(constant(app, 'MENTION'));
});

test('tag notifications can be turned off in Settings and saved by aura-users', () => {
  expect(constant(lambdaSource('aura-users'), 'NOTIFICATION_TYPES')).toContain("'mention'");
  // every switch in Settings (and Angel's) is one aura-users saves
  const { NOTIFICATION_OPTIONS } = require('./utils/notificationOptions');
  const types = constant(lambdaSource('aura-users'), 'NOTIFICATION_TYPES');
  expect(NOTIFICATION_OPTIONS.map(o => o.key)).toContain('mention');
  for (const { key } of NOTIFICATION_OPTIONS) expect(types).toContain(`'${key}'`);
});

test('the app offers exactly the games aura-aura runs, with the same stake caps', () => {
  const dir = path.join(LAMBDAS, 'aura-aura');
  const rules = fs.readFileSync(path.join(dir, 'gameRules.mjs'), 'utf8');
  const games = fs.readFileSync(path.join(dir, 'games.mjs'), 'utf8');
  const serverIds = constant(rules, 'GAMES').replace(/[{}\s]/g, '').split(',');
  const { GAME_LIST, STAKE_CAP } = require('./components/games/gameInfo');
  expect([...serverIds].sort()).toEqual(GAME_LIST.map(g => g.id).sort());
  // the same games take more than two players, up to the same number
  const appMax = Object.fromEntries(GAME_LIST.filter(g => g.maxPlayers).map(g => [g.id, g.maxPlayers]));
  const serverMax = Object.fromEntries([...constant(rules, 'MAX_PLAYERS').matchAll(/(\w+):\s*(\d+)/g)].map(([, id, n]) => [id, Number(n)]));
  expect(serverMax).toEqual(appMax);
  expect(constant(games, 'STAKE_CAP').replace(/\s/g, '')).toBe(`{regular:${STAKE_CAP.regular},premium:${STAKE_CAP.premium}}`);
  expect(constant(lambdaSource('aura-users'), 'NOTIFICATION_TYPES')).toContain("'games'");
});

test('the app offers bots for the same games and levels aura-aura plays', () => {
  const server = fs.readFileSync(path.join(LAMBDAS, 'aura-aura', 'bots.mjs'), 'utf8');
  const { BOT_GAMES, BOT_LEVELS } = require('./components/games/gameInfo');
  const list = name => [...server.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`))[1].matchAll(/'(\w+)'/g)].map(m => m[1]);
  expect(list('BOT_GAMES')).toEqual(BOT_GAMES);
  expect(list('BOT_LEVELS')).toEqual(BOT_LEVELS.map(l => l.id));
  const names = Object.fromEntries([...server.match(/BOT_NAMES = \{([^}]*)\}/)[1].matchAll(/(\w+): '(\w+)'/g)].map(m => [m[1], m[2]]));
  expect(names).toEqual(Object.fromEntries(BOT_LEVELS.map(l => [l.id, l.name])));
});

test('the app offers exactly the reactions aura-posts accepts', () => {
  const server = fs.readFileSync(path.join(LAMBDAS, 'aura-posts', 'reactions.mjs'), 'utf8');
  const app = require('./utils/reactions');
  const list = server.match(/export const REACTION_EMOJIS = \[([\s\S]*?)\];/)[1];
  expect([...list.matchAll(/'([^']+)'/g)].map(m => m[1])).toEqual(app.REACTION_EMOJIS);
  expect(new Set(app.REACTION_EMOJIS).size).toBe(app.REACTION_EMOJIS.length);
  // any emoji is allowed, except letter-like ones (so nobody can spell words), with the same check on both sides
  for (const e of app.REACTION_EMOJIS) expect(app.isReactionEmoji(e)).toBe(true);
  const appSource = fs.readFileSync(path.join(__dirname, 'utils', 'reactions.js'), 'utf8');
  const check = src => {
    const from = src.indexOf('const LETTERLIKE');
    return src.slice(from, src.indexOf('\n}\n', src.indexOf('export function isReactionEmoji')) + 2).replace(/\r\n/g, '\n');
  };
  expect(check(server.replace(/\r\n/g, '\n'))).toBe(check(appSource.replace(/\r\n/g, '\n')));
  for (const ok of ['🔥', '👍🏽', '👨‍👩‍👧', '❤️‍🔥', '🫠', '🏳️‍🌈']) expect(app.isReactionEmoji(ok)).toBe(true);
  for (const bad of ['A', '🅰️', 'Ⓜ️', '🇺🇸', '1️⃣', '#️⃣', '™️', '🆗', '🔥🔥', 'a🔥', '', '㊗️']) expect(app.isReactionEmoji(bad)).toBe(false);
  expect(Number(server.match(/MAX_PER_USER = (\d+)/)[1])).toBe(app.MAX_PER_USER);
  expect(Number(server.match(/MAX_KINDS = (\d+)/)[1])).toBe(app.MAX_KINDS);
});

test('Angel\'s support messages match what aura-users accepts', () => {
  const server = fs.readFileSync(path.join(LAMBDAS, 'aura-users', 'support.mjs'), 'utf8');
  const { SUPPORT_CATEGORIES, SUPPORT_MIN, SUPPORT_MAX } = require('./angel/flows');
  const ids = [...constant(server, 'SUPPORT_CATEGORIES').matchAll(/(\w+):\s*'/g)].map(m => m[1]);
  expect(ids).toEqual(SUPPORT_CATEGORIES.map(([id]) => id));
  expect(Number(constant(server, 'SUPPORT_MIN'))).toBe(SUPPORT_MIN);
  expect(Number(constant(server, 'SUPPORT_MAX'))).toBe(SUPPORT_MAX);
  expect(fs.readFileSync(path.join(LAMBDAS, 'aura-users', 'feedback.mjs'), 'utf8')).toContain("area === 'support'");
});

test('the app offers the time limits aura-aura accepts, with the same chess clocks', () => {
  const rules = fs.readFileSync(path.join(LAMBDAS, 'aura-aura', 'gameRules.mjs'), 'utf8');
  const { TIME_CHOICES, CLOCK_GAMES, CLOCK_LAG_MS, defaultTime } = require('./components/games/gameInfo');
  const server = [...constant(rules, 'TIME_CHOICES').matchAll(/'([\w+]+)':\s*\{\s*kind: '(\w+)', (?:ms: (\d+)|base: (\d+), inc: (\d+))/g)]
    .map(([, id, kind, ms, base, inc]) => (kind === 'clock' ? { id, kind, base: Number(base), inc: Number(inc) } : { id, kind }));
  expect(server).toEqual(TIME_CHOICES.map(({ id, kind, base, inc }) => (kind === 'clock' ? { id, kind, base, inc } : { id, kind })));
  expect(constant(rules, 'CLOCK_GAMES')).toBe(JSON.stringify(CLOCK_GAMES).replace(/"/g, "'"));
  expect(Number(constant(rules, 'CLOCK_LAG_MS'))).toBe(CLOCK_LAG_MS);
  expect(rules).toContain(`defaultTime = game => (CLOCK_GAMES.includes(game) ? '${defaultTime('chess')}' : '${defaultTime('pool')}')`);
});

test('the pool table in the app is the size of the one aura-aura plays on', () => {
  const server = fs.readFileSync(path.join(LAMBDAS, 'aura-aura', 'pool.mjs'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'components', 'games', 'PoolTable.jsx'), 'utf8');
  for (const name of ['W', 'H', 'R', 'HEAD_LINE', 'CORNER_MOUTH', 'SIDE_MOUTH']) expect(constant(app, name).trim()).toBe(constant(server, name).trim());
  expect(constant(app, 'POCKETS')).toBe(constant(server, 'POCKETS'));
});

test('mini golf in the app is drawn at the size aura-aura plays it', () => {
  const server = fs.readFileSync(path.join(LAMBDAS, 'aura-aura', 'golf.mjs'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'components', 'games', 'GolfCourse.jsx'), 'utf8');
  for (const name of ['W', 'H', 'T', 'COLS', 'BALL', 'CUP']) expect(constant(app, name).trim()).toBe(constant(server, name).trim());
});

test('post styles: aura-posts accepts exactly the fonts, backgrounds, frames and colors the app offers', () => {
  const dir = path.join(LAMBDAS, 'aura-posts');
  const server = fs.readFileSync(path.join(dir, 'postStyle.mjs'), 'utf8');
  const style = require('./utils/postStyle');
  expect(fs.readFileSync(path.join(dir, 'postFonts.json'), 'utf8')).toBe(fs.readFileSync(path.join(__dirname, 'utils', 'postFonts.json'), 'utf8'));
  const list = name => JSON.parse(constant(server, name).replace(/'/g, '"'));
  expect(list('BACKGROUND_IDS')).toEqual(style.POST_BACKGROUNDS.map(b => b.id));
  expect(list('FRAME_IDS')).toEqual(style.POST_FRAMES.map(f => f.id));
  expect(list('SAFE_COLORS')).toEqual(style.SAFE_COLORS);
  expect(constant(server, 'STYLE_PREMIUM_ONLY')).toBe(String(style.STYLE_PREMIUM_ONLY));
  // Every font in the list is shipped with the app
  for (const f of style.POST_FONTS) {
    const file = path.join(__dirname, '..', 'public', 'fonts', 'post', `${f.id}.woff2`);
    expect(fs.existsSync(file) && fs.readFileSync(file).subarray(0, 4).toString('latin1')).toBe('wOF2');
  }
});

test('report reasons: the app offers exactly the ones aura-posts, aura-comments and aura-users keep', () => {
  const ids = src => [...src.match(/const REPORT_REASONS = (?:new Set\()?\[([^\]]*)\]/)[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
  for (const source of [
    lambdaSource('aura-posts'),
    lambdaSource('aura-comments'),
    fs.readFileSync(path.join(LAMBDAS, 'aura-users', 'follows.mjs'), 'utf8'),
  ]) expect(ids(source)).toEqual(REPORT_REASON_IDS);
});

test('group power-ups: the app shows the same prices, limits, XP and level curve aura-aura uses', () => {
  const app = powerUpsApp;
  const server = fs.readFileSync(path.join(LAMBDAS, 'aura-aura', 'powerups.mjs'), 'utf8');
  const block = server.match(/export const POWER_UPS = \{([^}]*)\}/)[1];
  const serverPowerUps = Object.fromEntries([...block.matchAll(/(\w+):\s*(\d+)/g)].map(m => [m[1], Number(m[2])]));
  expect(serverPowerUps).toEqual(app.POWER_UPS);

  const copies = ['aura-aura', 'aura-posts', 'aura-comments', 'aura-groups']
    .map(name => fs.readFileSync(path.join(LAMBDAS, name, 'groupStats.mjs'), 'utf8').replace(/\r\n/g, '\n'));
  expect(new Set(copies).size).toBe(1);
  const stats = copies[0];
  // level perks, boosts and limits
  const obj = name => JSON.parse(stats.match(new RegExp(`export const ${name} = (\\{[^}]*\\})`))[1].replace(/(\w+):/g, '"$1":'));
  expect(obj('PERKS')).toEqual(app.PERKS);
  expect(obj('BOOSTS')).toEqual(app.BOOSTS);
  for (const name of ['MAX_LEVEL', 'MAX_PINS', 'MAX_BACKGROUNDS']) expect(Number(stats.match(new RegExp(`${name} = (\\d+)`))[1])).toBe(app[name]);
  expect(JSON.parse(stats.match(/export const XP = (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":'))).toEqual(app.XP);
  expect(Number(stats.match(/XP_DAILY_CAP = (\d+)/)[1])).toBe(app.XP_DAILY_CAP);
  expect(stats).toContain('export const levelFloor = level => 50 * level * (level - 1);');
  expect([1, 2, 3, 10].map(app.levelFloor)).toEqual([0, 100, 300, 4500]);
});

test('post overlay limits match aura-posts', () => {
  const app = require('./utils/overlays');
  const server = fs.readFileSync(path.join(LAMBDAS, 'aura-posts', 'overlays.mjs'), 'utf8');
  for (const name of ['MAX_OVERLAYS', 'OVERLAY_TEXT_MAX', 'OVERLAY_LABEL_MAX', 'OVERLAY_URL_MAX']) {
    expect(Number(constant(server, name))).toBe(app[name]);
  }
});
