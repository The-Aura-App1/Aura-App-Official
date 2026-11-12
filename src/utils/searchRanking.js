import { decodeVector, similarity } from './embeddings';
import { hashtagKey } from './hashtags';
import { TOPICS } from './topics';
import { KEYWORD_FLOOR, KEYWORD_FULL, TASTE_WEIGHT } from './feedRanking';
import { EMPTY_TASTE, hasTaste, prepareTaste, tasteMatch } from './tasteProfile';

// Search uses the feed's algorithm, but the words typed come first:
//   1. relevance: the words themselves (caption, hashtags, topics, author),
//      or the closest meaning from the on-device model when the words differ
//   2. aura and freshness (the post's hotScore, same as the feed)
//   3. a light nudge from what the feed has learned on this device
// It never leaves the device: the query isn't sent anywhere or saved.

// A perfect match outranks a post this many hotScore units hotter
// (1.0 = about 12.5 hours newer, or 10x the aura)
export const RELEVANCE_WEIGHT = 4;
// Posts below this relevance aren't results at all
export const MIN_RELEVANCE = 0.35;

const TOPIC_LABELS = Object.fromEntries(TOPICS.map(t => [t.id, t.label]));

// Lowercase, accents dropped: "Café" and "cafe" match
export function fold(text) {
  return String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function queryWords(query) {
  return [...new Set(fold(query).split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 2))].slice(0, 8);
}

function wordsOf(text) {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// How well the typed words match the post's own text, 0-1. Every word counts
// equally; a word matches fully as a hashtag, topic or whole word, and partly
// as the start of a word ("photo" in "photography") or in the author's name.
export function textMatch(post, words) {
  if (!words.length) return 0;
  const hashtags = new Set((post.hashtags ?? []).map(hashtagKey));
  const topics   = (post.tags ?? []).flatMap(t => wordsOf(TOPIC_LABELS[t] ?? t));
  const caption  = wordsOf(post.caption);
  const author   = [...wordsOf(post.authorUsername), ...wordsOf(post.authorDisplay)];

  let total = 0;
  for (const word of words) {
    if (hashtags.has(word) || topics.includes(word) || caption.includes(word)) total += 1;
    else if ([...hashtags].some(h => h.startsWith(word)) || caption.some(w => w.startsWith(word))
      || topics.some(w => w.startsWith(word))) total += 0.7;
    else if (author.some(w => w.startsWith(word))) total += 0.6;
  }
  return total / words.length;
}

function meaningMatch(post, queryVec) {
  if (!queryVec) return 0;
  const postVec = decodeVector(post.embedding);
  if (!postVec) return 0;
  const sim = similarity(postVec, queryVec);
  return Math.max(0, Math.min(1, (sim - KEYWORD_FLOOR) / (KEYWORD_FULL - KEYWORD_FLOOR)));
}

// Relevance 0-1: the better of words and meaning, with a little extra when both agree
export function relevance(post, words, queryVec) {
  const text    = textMatch(post, words);
  const meaning = meaningMatch(post, queryVec);
  return Math.min(1, Math.max(text, meaning * 0.9) + 0.15 * Math.min(text, meaning));
}

/**
 * @param {object[]} posts      candidate posts (the feed's pool)
 * @param {string}   query      what was typed
 * @param {Float32Array|null} queryVec  the query's vector, once the model has it
 * @returns {object[]} matching posts, best first
 */
export function searchPosts(posts, query, queryVec = null, taste = EMPTY_TASTE) {
  const words   = queryWords(query);
  if (!words.length && !queryVec) return [];
  const learned = taste && hasTaste(taste) ? prepareTaste(taste) : null;
  return posts
    .map((post, i) => ({ post, i, rel: relevance(post, words, queryVec) }))
    .filter(entry => entry.rel >= MIN_RELEVANCE)
    .map(entry => ({
      ...entry,
      score: RELEVANCE_WEIGHT * entry.rel + (entry.post.hotScore ?? 0)
        + (learned ? TASTE_WEIGHT * 0.5 * tasteMatch(entry.post, learned) : 0),
    }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(entry => entry.post);
}
