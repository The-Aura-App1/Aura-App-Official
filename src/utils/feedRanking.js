// hotScore units: 1.0 = about 12.5 hours newer, or 10x the aura
export const MORE_BOOST    = 1.5;
export const LESS_PENALTY  = 3;
export const EXPLORE_EVERY = 5;

export function scorePost(post, prefs) {
  const tags = post.tags ?? [];
  let score = post.hotScore ?? 0;
  if (tags.some(t => prefs.more.includes(t))) score += MORE_BOOST;
  if (tags.some(t => prefs.less.includes(t))) score -= LESS_PENALTY;
  return score;
}

// Every EXPLORE_EVERY-th slot goes to the best post outside the "more" topics,
// so the feed never narrows to only what the user already picked
export function rankFeed(posts, prefs) {
  const sorted = posts
    .map((post, i) => ({ post, i, score: scorePost(post, prefs) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(entry => entry.post);
  if (!prefs.more.length) return sorted;

  const isMatch = post => (post.tags ?? []).some(t => prefs.more.includes(t));
  const used = new Set();
  const out  = [];
  let next = 0;
  let explore = 0;

  while (out.length < sorted.length) {
    if (out.length % EXPLORE_EVERY === EXPLORE_EVERY - 1) {
      while (explore < sorted.length && (used.has(explore) || isMatch(sorted[explore]))) explore++;
      if (explore < sorted.length) {
        used.add(explore);
        out.push(sorted[explore]);
        continue;
      }
    }
    while (used.has(next)) next++;
    used.add(next);
    out.push(sorted[next]);
  }
  return out;
}
