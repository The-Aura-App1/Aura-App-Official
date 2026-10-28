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

test('the self-hosted model file is the verified original', () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(MODEL)).digest('hex');
  expect(hash).toBe(MODEL_SHA256);
});
