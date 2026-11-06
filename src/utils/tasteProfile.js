import { decodeVector, similarity } from './embeddings';
import { hashtagKey } from './hashtags';

// What the feed learns from what someone does: the aura they give and take,
// and what they like, comment on and share. Like feed preferences, it lives
// only in this browser's localStorage and is never sent to the server.
//
// For each engagement it remembers the post's topics, hashtags, creator and
// meaning (its embedding), each with a weight that fades with a 30-day
// half-life. Giving, liking, commenting and sharing add weight; taking aura
// subtracts it. Nothing is learned from posts someone only looks at or
// scrolls past.
const storageKey  = userId => `aura.taste.v1.${userId ?? 'anon'}`;
const enabledKey  = userId => `aura.tasteLearning.${userId ?? 'anon'}`;

export const HALF_LIFE_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

// How much each kind of engagement teaches. Gives and takes grow slowly with
// the amount, so a big give counts more without drowning everything else.
export const SIGNALS = {
  like:    0.5,
  comment: 0.7,
  share:   0.9,
  give:    1,
  take:    -1.2,
};
const amountFactor = amount => 1 + Math.log10(1 + Math.max(0, amount || 0)) / 2;

// Any single topic, hashtag or creator is capped so one burst of activity
// can't take over the feed; lists are trimmed to the strongest entries.
const MAX_WEIGHT  = 5;
const MAX_TAGS    = 120;
const MAX_AUTHORS = 120;
const MAX_VECTORS = 60;

export const EMPTY_TASTE = Object.freeze({ topics: {}, tags: {}, authors: {}, vectors: [] });

const decayed = (entry, now) => entry.w * 0.5 ** ((now - entry.t) / (HALF_LIFE_DAYS * DAY));
const clamp = (n, limit) => Math.max(-limit, Math.min(limit, n));

function cleanMap(raw, limit) {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw)
    .filter(([key, e]) => key && Number.isFinite(e?.w) && Number.isFinite(e?.t))
    .map(([key, e]) => [key, { w: clamp(e.w, MAX_WEIGHT), t: e.t }]);
  return Object.fromEntries(entries.sort((a, b) => Math.abs(b[1].w) - Math.abs(a[1].w)).slice(0, limit));
}

export function cleanTaste(raw) {
  const vectors = Array.isArray(raw?.vectors)
    ? raw.vectors.filter(v => decodeVector(v?.vec) && Number.isFinite(v.w) && Number.isFinite(v.t)).slice(-MAX_VECTORS)
    : [];
  return {
    topics:  cleanMap(raw?.topics, 50),
    tags:    cleanMap(raw?.tags, MAX_TAGS),
    authors: cleanMap(raw?.authors, MAX_AUTHORS),
    vectors,
  };
}

export function loadTaste(userId) {
  try {
    return cleanTaste(JSON.parse(localStorage.getItem(storageKey(userId))));
  } catch {
    return EMPTY_TASTE;
  }
}

function saveTaste(userId, taste) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(cleanTaste(taste)));
  } catch {}
}

export function clearTaste(userId) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {}
}

// On unless the person turns it off in Settings.
export function isLearningOn(userId) {
  try {
    return localStorage.getItem(enabledKey(userId)) !== 'off';
  } catch {
    return true;
  }
}

export function setLearningOn(userId, on) {
  try {
    localStorage.setItem(enabledKey(userId), on ? 'on' : 'off');
  } catch {}
}

function bump(map, key, delta, now) {
  const current = map[key] ? decayed(map[key], now) : 0;
  map[key] = { w: clamp(current + delta, MAX_WEIGHT), t: now };
}

// Pure version of recordEngagement, for tests.
export function learn(taste, post, kind, amount = 0, now = Date.now()) {
  const base = SIGNALS[kind];
  if (!base || !post) return taste;
  const delta = base * (kind === 'give' || kind === 'take' ? amountFactor(amount) : 1);
  const next = {
    topics: { ...taste.topics },
    tags: { ...taste.tags },
    authors: { ...taste.authors },
    vectors: [...taste.vectors],
  };
  for (const topic of post.tags ?? []) bump(next.topics, topic, delta, now);
  for (const tag of post.hashtags ?? []) bump(next.tags, hashtagKey(tag), delta, now);
  if (post.authorId) bump(next.authors, post.authorId, delta, now);
  if (decodeVector(post.embedding)) next.vectors.push({ vec: post.embedding, w: delta, t: now });
  return cleanTaste(next);
}

// Called when someone gives, takes, likes, comments on or shares a post.
export function recordEngagement(userId, post, kind, amount = 0) {
  if (!userId || !isLearningOn(userId)) return;
  saveTaste(userId, learn(loadTaste(userId), post, kind, amount));
}

export function hasTaste(taste) {
  return Object.keys(taste.topics).length > 0 || taste.vectors.length > 0;
}

// Similar posts score about 0.3–0.6 on all-MiniLM-L6-v2; unrelated ones about
// 0–0.2. Below SIMILAR_FLOOR a stored post says nothing about this one.
const SIMILAR_FLOOR = 0.25;
const SIMILAR_FULL  = 0.5;
const closeness = sim => Math.max(0, Math.min(1, (sim - SIMILAR_FLOOR) / (SIMILAR_FULL - SIMILAR_FLOOR)));

// Fades every weight to `now` and decodes the stored meanings once, so
// ranking a whole feed doesn't redo it for every post.
export function prepareTaste(taste, now = Date.now()) {
  const fade = map => Object.fromEntries(Object.entries(map).map(([key, e]) => [key, decayed(e, now)]));
  return {
    topics: fade(taste.topics),
    tags: fade(taste.tags),
    authors: fade(taste.authors),
    vectors: taste.vectors
      .map(v => ({ vec: decodeVector(v.vec), w: decayed(v, now) }))
      .filter(v => v.vec),
  };
}

// How well a post fits what someone has engaged with, from -1 (the kind of
// thing they take aura from) to 1 (the kind of thing they give aura to).
// Topics and meaning count most, hashtags next, and the creator least, so
// the feed never narrows down to a few accounts. `prepared` comes from
// prepareTaste.
export function tasteMatch(post, prepared) {
  const sum = (map, keys) => keys.reduce((total, key) => total + (map[key] ?? 0), 0);

  const topics = Math.tanh(sum(prepared.topics, post.tags ?? []) / 3);
  const tags   = Math.tanh(sum(prepared.tags, (post.hashtags ?? []).map(hashtagKey)) / 2);
  const author = Math.tanh((prepared.authors[post.authorId] ?? 0) / 3);

  let meaning = 0;
  const vec = prepared.vectors.length ? decodeVector(post.embedding) : null;
  if (vec) {
    let weighted = 0;
    let total = 0;
    for (const stored of prepared.vectors) {
      weighted += stored.w * closeness(similarity(vec, stored.vec));
      total += Math.abs(stored.w);
    }
    if (total) meaning = Math.max(-1, Math.min(1, (weighted / total) * 2));
  }

  return 0.35 * topics + 0.3 * meaning + 0.2 * tags + 0.15 * author;
}
