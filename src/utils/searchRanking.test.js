import { searchPosts, textMatch, queryWords, relevance, MIN_RELEVANCE } from './searchRanking';
import { encodeVector, decodeVector, EMBED_DIM } from './embeddings';

const unit = seed => {
  const v = Array.from({ length: EMBED_DIM }, (_, i) => Math.sin((i + 1) * seed));
  const n = Math.hypot(...v);
  return v.map(x => x / n);
};

const post = (id, extra = {}) => ({ postId: id, caption: '', hashtags: [], tags: [], hotScore: 0, ...extra });

test('query words are folded, deduplicated and short ones dropped', () => {
  expect(queryWords('  Café CAFE a #Jazz! ')).toEqual(['cafe', 'jazz']);
  expect(queryWords('')).toEqual([]);
});

test('whole words, hashtags and topics match fully; prefixes and authors partly', () => {
  const p = post('1', { caption: 'Sunset over the bay', hashtags: ['GoldenHour'], tags: ['photography'], authorUsername: 'corey_b' });
  expect(textMatch(p, ['sunset'])).toBe(1);
  expect(textMatch(p, ['goldenhour'])).toBe(1);
  expect(textMatch(p, ['photography'])).toBe(1);
  expect(textMatch(p, ['photo'])).toBeCloseTo(0.7);
  expect(textMatch(p, ['corey'])).toBeCloseTo(0.6);
  expect(textMatch(p, ['sunset', 'pizza'])).toBe(0.5);
  expect(textMatch(p, ['pizza'])).toBe(0);
});

test('relevance comes first, then aura and freshness', () => {
  const posts = [
    post('hot-unrelated', { caption: 'my lunch', hotScore: 10 }),
    post('partial-hot', { caption: 'jazz night downtown', hotScore: 3 }),
    post('exact-cold', { caption: 'jazz trio live tonight', hashtags: ['livejazz'], hotScore: 0 }),
    post('exact-warm', { caption: 'live jazz on the pier', hotScore: 1 }),
  ];
  const ids = searchPosts(posts, 'live jazz').map(p => p.postId);
  expect(ids).not.toContain('hot-unrelated');
  expect(ids.indexOf('exact-warm')).toBeLessThan(ids.indexOf('exact-cold'));
  expect(ids[0]).toBe('partial-hot');  // half the words, but much hotter
  expect(searchPosts(posts, '')).toEqual([]);
});

test('meaning finds posts that share no words with the query', () => {
  const v = unit(0.37);
  const p = post('1', { caption: 'saxophone solo', embedding: encodeVector(v) });
  const queryVec = decodeVector(encodeVector(v));
  expect(relevance(p, ['music'], null)).toBe(0);
  expect(relevance(p, ['music'], queryVec)).toBeGreaterThanOrEqual(MIN_RELEVANCE);
  expect(searchPosts([p], 'music', queryVec).map(x => x.postId)).toEqual(['1']);
  expect(searchPosts([p], 'music', decodeVector(encodeVector(unit(1.91))))).toEqual([]);
});
