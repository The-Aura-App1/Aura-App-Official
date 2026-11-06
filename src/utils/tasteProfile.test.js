import { encodeVector, EMBED_DIM } from './embeddings';
import { EMPTY_PREFS } from './feedPrefs';
import { rankFeed, scorePost, EXPLORE_EVERY } from './feedRanking';
import {
  EMPTY_TASTE, HALF_LIFE_DAYS, learn, prepareTaste, tasteMatch,
  recordEngagement, loadTaste, setLearningOn, clearTaste,
} from './tasteProfile';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 28);

// A unit vector pointing mostly along one axis, so posts on the same axis are
// similar and posts on different axes aren't.
function vectorAlong(axis) {
  const v = Array.from({ length: EMBED_DIM }, (_, i) => (i === axis ? 1 : 0.02));
  const norm = Math.hypot(...v);
  return encodeVector(v.map(n => n / norm));
}

const post = (id, extra = {}) => ({ postId: id, hotScore: 0, tags: [], hashtags: [], ...extra });

const surfing  = post('surf', { tags: ['sports'], hashtags: ['surfing'], authorId: 'kai', embedding: vectorAlong(1) });
const surfing2 = post('surf2', { tags: ['sports'], hashtags: ['surfing'], authorId: 'mia', embedding: vectorAlong(1) });
const cooking  = post('cook', { tags: ['food'], hashtags: ['baking'], authorId: 'lee', embedding: vectorAlong(2) });

test('giving aura to a post lifts similar posts', () => {
  const taste = learn(EMPTY_TASTE, surfing, 'give', 25, NOW);
  const prepared = prepareTaste(taste, NOW);
  expect(tasteMatch(surfing2, prepared)).toBeGreaterThan(0.3);
  expect(tasteMatch(cooking, prepared)).toBe(0);
  expect(rankFeed([cooking, surfing2], EMPTY_PREFS, taste)[0].postId).toBe('surf2');
});

test('taking aura from a post pushes similar posts down', () => {
  const taste = learn(EMPTY_TASTE, cooking, 'take', 25, NOW);
  expect(tasteMatch(post('cook2', { tags: ['food'], embedding: vectorAlong(2) }), prepareTaste(taste, NOW))).toBeLessThan(-0.2);
});

test('bigger gives teach more, but slowly', () => {
  const small = learn(EMPTY_TASTE, surfing, 'give', 5, NOW).topics.sports.w;
  const big = learn(EMPTY_TASTE, surfing, 'give', 500, NOW).topics.sports.w;
  expect(big).toBeGreaterThan(small);
  expect(big).toBeLessThan(small * 2);
});

test('what was learned fades with a 30-day half-life', () => {
  const taste = learn(EMPTY_TASTE, surfing, 'like', 0, NOW);
  const later = prepareTaste(taste, NOW + HALF_LIFE_DAYS * DAY);
  expect(later.topics.sports).toBeCloseTo(taste.topics.sports.w / 2, 5);
});

test('no single topic can grow without limit', () => {
  let taste = EMPTY_TASTE;
  for (let i = 0; i < 100; i++) taste = learn(taste, surfing, 'give', 500, NOW);
  expect(taste.topics.sports.w).toBeLessThanOrEqual(5);
  expect(tasteMatch(surfing2, prepareTaste(taste, NOW))).toBeLessThanOrEqual(1);
});

test("the user's own choices always outweigh what was learned", () => {
  let taste = EMPTY_TASTE;
  for (let i = 0; i < 50; i++) taste = learn(taste, surfing, 'give', 500, NOW);
  const prefs = { ...EMPTY_PREFS, less: ['sports'] };
  expect(scorePost(surfing2, prefs, taste)).toBeLessThan(scorePost(cooking, prefs, taste));
});

test('the feed still leaves room for new kinds of posts', () => {
  const taste = learn(EMPTY_TASTE, surfing, 'give', 100, NOW);
  const liked = Array.from({ length: 8 }, (_, i) => post(`s${i}`, { tags: ['sports'], hotScore: 2, embedding: vectorAlong(1) }));
  const other = post('new', { tags: ['music'], hotScore: 0, embedding: vectorAlong(3) });
  const order = rankFeed([...liked, other], EMPTY_PREFS, taste).map(p => p.postId);
  expect(order.indexOf('new')).toBe(EXPLORE_EVERY - 1);
});

test('learning can be turned off and reset, and only lives on this device', () => {
  setLearningOn('u1', false);
  recordEngagement('u1', surfing, 'give', 10);
  expect(loadTaste('u1').vectors).toHaveLength(0);
  setLearningOn('u1', true);
  recordEngagement('u1', surfing, 'give', 10);
  expect(loadTaste('u1').topics.sports.w).toBeGreaterThan(0);
  expect(localStorage.getItem('aura.taste.v1.u1')).toContain('sports');
  clearTaste('u1');
  expect(loadTaste('u1').topics).toEqual({});
});
