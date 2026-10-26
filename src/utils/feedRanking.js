import { decodeVector, similarity } from './embeddings';

// hotScore units: 1.0 = about 12.5 hours newer, or 10x the aura
export const MORE_BOOST    = 1.5;
export const LESS_PENALTY  = 3;
export const EXPLORE_EVERY = 5;

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
  const pick = choice => words.filter(w => w.choice === choice).map(w => decodeVector(w.vec)).filter(Boolean);
  return { more: pick('more'), less: pick('less') };
}

function bestMatch(postVec, vectors) {
  let best = 0;
  for (const vec of vectors) best = Math.max(best, ramp(similarity(postVec, vec)));
  return best;
}

// Returns the post's score and whether it matches anything the user wants more of
function evaluate(post, prefs, words) {
  const tags = post.tags ?? [];
  let score = post.hotScore ?? 0;

  const topicMore = tags.some(t => prefs.more.includes(t));
  const topicLess = tags.some(t => prefs.less.includes(t));

  const postVec   = (words.more.length || words.less.length) ? decodeVector(post.embedding) : null;
  const wordMore  = postVec ? bestMatch(postVec, words.more) : 0;
  const wordLess  = postVec ? bestMatch(postVec, words.less) : 0;

  score += MORE_BOOST   * Math.max(topicMore ? 1 : 0, wordMore);
  score -= LESS_PENALTY * Math.max(topicLess ? 1 : 0, wordLess);
  return { score, match: topicMore || wordMore > 0 };
}

export function scorePost(post, prefs) {
  return evaluate(post, prefs, keywordVectors(prefs)).score;
}

// Every EXPLORE_EVERY-th slot goes to the best post outside what the user asked
// for more of, so the feed never narrows to only what they already picked
export function rankFeed(posts, prefs) {
  const words  = keywordVectors(prefs);
  const ranked = posts
    .map((post, i) => ({ post, i, ...evaluate(post, prefs, words) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  if (!prefs.more.length && !words.more.length) return ranked.map(entry => entry.post);

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
