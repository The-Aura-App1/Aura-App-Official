import { postStats, inPeriod, totals, sortStats, topPost, canUseCreator } from './creatorStats';

const now = Date.parse('2026-11-16T12:00:00Z');
const day = n => new Date(now - n * 86_400_000).toISOString();
const raw = [
  { postId: 'a', caption: 'Sunrise', createdAt: day(2), viewCount: 200, auraReceived: 50, likeCount: 9, commentCount: 3, reactions: { '🔥': 4, '😂': 0, '👍': -2 } },
  { postId: 'b', caption: '', type: 'photo', createdAt: day(20), viewCount: 40, auraReceived: 80, likeCount: 2, commentCount: 1, groupId: 'g1' },
  { postId: 'c', caption: 'Old one', createdAt: day(90), viewCount: 5, auraReceived: 0 },
  { postId: 'd', caption: 'Broken counts', createdAt: day(1), viewCount: 'x', auraReceived: -5, likeCount: null },
];
const stats = raw.map(postStats);

test('a post\'s numbers, with bad or missing counts read as zero', () => {
  expect(stats[0]).toMatchObject({ views: 200, aura: 50, likes: 9, comments: 3, reactions: 4, rate: 25, inGroup: false });
  expect(stats[1]).toMatchObject({ inGroup: true, rate: 200 });
  expect(stats[2].rate).toBeNull();   // under 10 views
  expect(stats[3]).toMatchObject({ views: 0, aura: 0, likes: 0, comments: 0, reactions: 0, rate: null });
});

test('periods, totals, sorting and the top post', () => {
  expect(inPeriod(stats, '7d', now).map(p => p.postId)).toEqual(['a', 'd']);
  expect(inPeriod(stats, '30d', now).map(p => p.postId)).toEqual(['a', 'b', 'd']);
  expect(inPeriod(stats, 'all', now)).toHaveLength(4);
  const t = totals(inPeriod(stats, '30d', now));
  expect(t).toEqual({ posts: 3, views: 240, aura: 130, likes: 11, comments: 4, reactions: 4, rate: (130 / 240) * 100 });
  expect(totals([]).rate).toBeNull();
  expect(sortStats(stats, 'views').map(p => p.postId)).toEqual(['a', 'b', 'c', 'd']);
  expect(sortStats(stats, 'aura')[0].postId).toBe('b');
  expect(sortStats(stats, 'rate')[0].postId).toBe('b');
  expect(sortStats(stats, 'new')[0].postId).toBe('d');
  expect(topPost(stats).postId).toBe('b');
  expect(topPost([])).toBeNull();
});

test('who can open the Creator page', () => {
  expect(canUseCreator({ isCreator: true })).toBe(true);
  expect(canUseCreator({ isAdmin: true })).toBe(true);
  expect(canUseCreator({ isPremium: true })).toBe(false);
  expect(canUseCreator(null)).toBe(false);
});
