import { decodeVector, similarity } from './embeddings';
import { hashtagKey } from './hashtags';
import { EMPTY_TASTE, hasTaste, prepareTaste, tasteMatch } from './tasteProfile';

// hotScore units: 1.0 = about 12.5 hours newer, or 10x the aura
export const MORE_BOOST    = 1.5;
export const LESS_PENALTY  = 3;
export const EXPLORE_EVERY = 5;

// What the feed has learned on this device (tasteProfile.js) can move a post
// by up to TASTE_WEIGHT either way. It's smaller than MORE_BOOST and
// LESS_PENALTY, so the user's own choices always win. A post that fits the
// learned taste by at least TASTE_MATCH counts as "more of what they like"
// when choosing exploration posts.
export const TASTE_WEIGHT = 1;
export const TASTE_MATCH  = 0.2;

// Keyword matches ramp from no effect at KEYWORD_FLOOR similarity to the full
// boost/penalty at KEYWORD_FULL. Measured on all-MiniLM-L6-v2: real matches
// score about 0.30-0.47, unrelated text about 0-0.2.
export const KEYWORD_FLOOR = 0.25;
export const KEYWORD_FULL  = 0.45;

function ramp(sim) {
  return Math.max(0, Math.min(1, (sim - KEYWORD_FLOOR) / (KEYWORD_FULL - KEYWORD_FLOOR)));
}

function keywordVectors(prefs) {
  const words = prefs.words ?? [];
  const pick = choice => words.filter(w => w.choice === choice)
    .map(w => ({ key: hashtagKey(w.text), vec: decodeVector(w.vec) }))
    .filter(w => w.vec);
  return { more: pick('more'), less: pick('less') };
}

// A keyword that is exactly one of the post's hashtags is a full match;
// otherwise the closest meaning counts
function bestMatch(postVec, hashKeys, words) {
  let best = 0;
  for (const { key, vec } of words) {
    if (hashKeys.has(key)) return 1;
    if (postVec) best = Math.max(best, ramp(similarity(postVec, vec)));
  }
  return best;
}

// Returns the post's score and whether it matches anything the user wants more of
function evaluate(post, prefs, words, taste) {
  const tags = post.tags ?? [];
  let score = post.hotScore ?? 0;

  const topicMore = tags.some(t => prefs.more.includes(t));
  const topicLess = tags.some(t => prefs.less.includes(t));

  const anyWords  = words.more.length || words.less.length;
  const postVec   = anyWords ? decodeVector(post.embedding) : null;
  const hashKeys  = new Set(anyWords ? (post.hashtags ?? []).map(hashtagKey) : []);
  const wordMore  = bestMatch(postVec, hashKeys, words.more);
  const wordLess  = bestMatch(postVec, hashKeys, words.less);

  const fit = taste ? tasteMatch(post, taste) : 0;

  score += MORE_BOOST   * Math.max(topicMore ? 1 : 0, wordMore);
  score -= LESS_PENALTY * Math.max(topicLess ? 1 : 0, wordLess);
  score += TASTE_WEIGHT * fit;
  return { score, match: topicMore || wordMore > 0 || fit >= TASTE_MATCH };
}

const prepared = taste => (taste && hasTaste(taste) ? prepareTaste(taste) : null);

export function scorePost(post, prefs, taste = EMPTY_TASTE) {
  return evaluate(post, prefs, keywordVectors(prefs), prepared(taste)).score;
}

// Every EXPLORE_EVERY-th slot goes to the best post outside what the user asked
// for more of or has shown they like, so the feed never narrows to only what
// they already know and their interests can keep changing
export function rankFeed(posts, prefs, taste = EMPTY_TASTE) {
  const words  = keywordVectors(prefs);
  const learned = prepared(taste);
  const ranked = posts
    .map((post, i) => ({ post, i, ...evaluate(post, prefs, words, learned) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  if (!prefs.more.length && !words.more.length && !learned) return ranked.map(entry => entry.post);

  const used = new Set();
  const out  = [];
  let next = 0;
  let explore = 0;

  while (out.length < ranked.length) {
    if (out.length % EXPLORE_EVERY === EXPLORE_EVERY - 1) {
      while (explore < ranked.length && (used.has(explore) || ranked[explore].match)) explore++;
      if (explore < ranked.length) {
        used.add(explore);
        out.push(ranked[explore].post);
        continue;
      }
    }
    while (used.has(next)) next++;
    used.add(next);
    out.push(ranked[next].post);
  }
  return out;
}
