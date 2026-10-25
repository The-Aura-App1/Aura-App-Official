import { rankFeed, scorePost, MORE_BOOST, LESS_PENALTY, EXPLORE_EVERY } from './feedRanking';

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

test('empty feed returns an empty list', () => {
  expect(rankFeed([], { more: ['music'], less: [] })).toEqual([]);
});
