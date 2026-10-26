import { rankFeed, scorePost, MORE_BOOST, LESS_PENALTY, EXPLORE_EVERY } from './feedRanking';
import { encodeVector, EMBED_DIM } from './embeddings';

// A vector whose similarity to the base direction (dimension 0) is `sim`
function vecWithSim(sim) {
  const v = new Array(EMBED_DIM).fill(0);
  v[0] = sim;
  v[1] = Math.sqrt(1 - sim * sim);
  return encodeVector(v);
}
const BASE = vecWithSim(1);
const word = (sim, choice = 'more') => ({ text: `w${sim}${choice}`, vec: vecWithSim(sim), choice });
const embedded = (id, hotScore, tags = []) => ({ postId: id, hotScore, tags, embedding: BASE });

const post = (id, hotScore, tags = []) => ({ postId: id, hotScore, tags });
const ids  = posts => posts.map(p => p.postId);
const NONE = { more: [], less: [] };

test('with no preferences the server order (hotScore) is kept', () => {
  const posts = [post('a', 3), post('b', 5), post('c', 1)];
  expect(ids(rankFeed(posts, NONE))).toEqual(['b', 'a', 'c']);
});

test('ties keep their original order', () => {
  const posts = [post('a', 2), post('b', 2), post('c', 2)];
  expect(ids(rankFeed(posts, NONE))).toEqual(['a', 'b', 'c']);
});

test('"more" topics move up and "less" topics move down', () => {
  const posts = [post('top', 5), post('music', 4, ['music']), post('gaming', 4.5, ['gaming'])];
  const ranked = rankFeed(posts, { more: ['music'], less: ['gaming'] });
  expect(ids(ranked)).toEqual(['music', 'top', 'gaming']);
});

test('scores apply the boost and penalty once per post, not per tag', () => {
  expect(scorePost(post('x', 1, ['music', 'art']), { more: ['music', 'art'], less: [] })).toBe(1 + MORE_BOOST);
  expect(scorePost(post('y', 1, ['music', 'art']), { more: [], less: ['music', 'art'] })).toBe(1 - LESS_PENALTY);
  expect(scorePost(post('z', 1, ['music', 'art']), { more: ['music'], less: ['art'] })).toBe(1 + MORE_BOOST - LESS_PENALTY);
});

test('"less" posts are pushed down but never removed', () => {
  const posts = [post('a', 3, ['gaming']), post('b', 1)];
  const ranked = rankFeed(posts, { more: [], less: ['gaming'] });
  expect(ids(ranked)).toEqual(['b', 'a']);
});

test('untagged posts are unaffected by preferences', () => {
  expect(scorePost(post('a', 2), { more: ['music'], less: ['art'] })).toBe(2);
  expect(scorePost({ postId: 'old', hotScore: 2 }, { more: ['music'], less: [] })).toBe(2);
});

test(`every ${EXPLORE_EVERY}th slot is a post outside the "more" topics`, () => {
  const music = Array.from({ length: 10 }, (_, i) => post(`m${i}`, 10 - i * 0.1, ['music']));
  const other = [post('o1', 1, ['art']), post('o2', 0.5)];
  const ranked = rankFeed([...music, ...other], { more: ['music'], less: [] });

  expect(ranked).toHaveLength(12);
  expect(ranked[EXPLORE_EVERY - 1].postId).toBe('o1');
  expect(ranked[EXPLORE_EVERY * 2 - 1].postId).toBe('o2');
  expect(new Set(ids(ranked)).size).toBe(12);
});

test('exploration falls back to normal order when every post matches', () => {
  const posts = Array.from({ length: 7 }, (_, i) => post(`m${i}`, 7 - i, ['music']));
  expect(ids(rankFeed(posts, { more: ['music'], less: [] }))).toEqual(ids(posts));
});

test('keyword matches ramp from no effect to the full boost', () => {
  const p = embedded('a', 1);
  const at = sim => scorePost(p, { more: [], less: [], words: [word(sim)] }) - 1;
  expect(at(0.1)).toBeCloseTo(0, 5);
  expect(at(0.35)).toBeCloseTo(MORE_BOOST / 2, 1);
  expect(at(0.6)).toBeCloseTo(MORE_BOOST, 5);
});

test('"less" keywords push posts down by up to the full penalty', () => {
  const p = embedded('a', 1);
  expect(scorePost(p, { more: [], less: [], words: [word(0.6, 'less')] })).toBeCloseTo(1 - LESS_PENALTY, 5);
});

test('the best keyword counts, and topic plus keyword matches do not stack', () => {
  const p = embedded('a', 1, ['music']);
  const prefs = { more: ['music'], less: [], words: [word(0.6), word(0.5), word(0.1)] };
  expect(scorePost(p, prefs)).toBeCloseTo(1 + MORE_BOOST, 5);
});

test('posts without an embedding ignore keywords', () => {
  expect(scorePost(post('a', 2), { more: [], less: [], words: [word(0.9)] })).toBe(2);
  expect(scorePost({ ...post('b', 2), embedding: 'garbage' }, { more: [], less: [], words: [word(0.9)] })).toBe(2);
});

test('keyword matches move posts up and count as matches for exploration', () => {
  const matches = Array.from({ length: 6 }, (_, i) => embedded(`k${i}`, 5 - i * 0.1));
  const others  = [post('o1', 5.5)];
  const ranked  = rankFeed([...others, ...matches], { more: [], less: [], words: [word(0.6)] });
  expect(ids(ranked).slice(0, 4)).toEqual(['k0', 'k1', 'k2', 'k3']);
  expect(ranked[EXPLORE_EVERY - 1].postId).toBe('o1');
});

test('a keyword that equals a hashtag is a full match, even without an embedding', () => {
  const tagged = { ...post('a', 1), hashtags: ['Live_Music'] };
  const live   = { text: 'live music', vec: vecWithSim(0), choice: 'more' };
  expect(scorePost(tagged, { more: [], less: [], words: [live] })).toBeCloseTo(1 + MORE_BOOST, 5);
  expect(scorePost(tagged, { more: [], less: [], words: [{ ...live, choice: 'less' }] })).toBeCloseTo(1 - LESS_PENALTY, 5);
  expect(scorePost(tagged, { more: [], less: [], words: [{ ...live, text: 'jazz' }] })).toBe(1);
});

test('empty feed returns an empty list', () => {
  expect(rankFeed([], { more: ['music'], less: [] })).toEqual([]);
});
