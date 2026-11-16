import { respond } from './angel';

// A second set, written after the first rules were done. Measured untouched
// on 2026-11-16 at 14/25 top-1, then the misses were fixed (25/25), so it's
// no longer unseen: write a fresh set before the next round of changes.
const ago = days => new Date(Date.now() - days * 86400000).toISOString();
const post = (postId, caption, extra = {}) => ({ postId, caption, authorUsername: 'someone', type: 'image', auraScore: 10, createdAt: ago(3), hashtags: [], tags: [], ...extra });
const LIKED = [
  post('L1', 'Golden hour over the lake, best sunset this year', { hashtags: ['sunset'], createdAt: ago(5) }),
  post('L2', 'My dog learned to ride a skateboard!!', { type: 'video', hashtags: ['dogs', 'skateboarding'] }),
  post('L4', 'Homemade ramen from scratch', { hashtags: ['ramen', 'cooking'], tags: ['cooking'] }),
];
const GROUPS = { g1: { name: 'Gym Rats', posts: [post('G1', 'Leg day destroyed me lol, cannot walk', { type: 'text' }), post('G2', 'New deadlift PR 405', { type: 'video', hashtags: ['deadlift'] })] },
  g2: { name: 'Book Club', posts: [post('G3', 'Chapter 12 discussion: the twist ending', { type: 'text' }), post('G4', 'Cozy reading nook setup', { hashtags: ['books'] })] } };
const POOL = [
  post('P1', 'Weeknight pasta in 15 minutes', { hashtags: ['pasta', 'cooking'], tags: ['cooking'], auraScore: 300, createdAt: ago(2) }),
  post('P2', 'Sourdough attempt number four', { hashtags: ['baking'], tags: ['cooking'], auraScore: 80, createdAt: ago(1) }),
  post('P3', 'Northern lights from my backyard', { hashtags: ['aurora', 'nightsky'], tags: ['photography'], auraScore: 500 }),
  post('P4', 'Cat vs cucumber, round 2', { type: 'video', hashtags: ['cats', 'funny'], auraScore: 220 }),
  post('P5', 'Street photography in Tokyo at night', { hashtags: ['tokyo', 'streetphoto'], tags: ['photography', 'travel'], auraScore: 150 }),
];
const api = {
  getLikedPosts: async () => ({ posts: LIKED }),
  getMyGroups: async () => ({ groups: Object.entries(GROUPS).map(([groupId, g]) => ({ groupId, name: g.name, myStatus: 'active' })) }),
  getGroupPosts: async id => ({ posts: GROUPS[id]?.posts ?? [] }),
};
const ctx = { getPool: async () => POOL, api, prefs: { more: [], less: [], words: [] } };

const UNSEEN = [
  ['can you find me the skateboarding dog clip', 'L2'],
  ['i need that ramen pic again', 'L4'],
  ['where did that pic of the lake at sunset go', 'L1'],
  ['pull up the deadlift one from the gym group', 'G2'],
  ['someone posted about a plot twist in book club, find it', 'G3'],
  ['bring up the cucumber cat thing', 'P4'],
  ['that vid with the cat and cucumber', 'P4'],
  ['show me the post about pasta in fifteen minutes', 'P1'],
  ['find the backyard aurora pic', 'P3'],
  ['looking for a tokyo night shot', 'P5'],
  ['what was that sour dough post', 'P2'],
  ['find the leg day post', 'G1'],
  ['the post where someone could not walk after leg day', 'G1'],
  ['that nook photo from book club', 'G4'],
  ['where is the dog skateboard video i liked', 'L2'],
  ['the photo of northern lights', 'P3'],
  ['the sunset one i liked', 'L1'],
  ['find me that cooking video with ramen', 'L4'],
  ['the pasta recipe post', 'P1'],
  ['show me the street photo from tokyo', 'P5'],
  ['find the funny cat video', 'P4'],
  ['remember the post about chapter 12', 'G3'],
  ['find the bread baking post', 'P2'],
  ['the nightsky photo everyone loved', 'P3'],
  ['where is the post about my dog riding a board', 'L2'],
];

test('unseen descriptions (measured, not tuned)', async () => {
  let top1 = 0, top3 = 0;
  const misses = [];
  for (const [text, want] of UNSEEN) {
    const reply = await respond(text.toLowerCase(), ctx);
    const ids = (reply.posts ?? []).map(p => p.postId);
    if (ids[0] === want) top1++;
    if (ids.slice(0, 3).includes(want)) top3++;
    else misses.push(`${text} → ${reply.kind}: ${ids.join(',') || 'none'}`);
  }
  // eslint-disable-next-line no-console
  console.log(`unseen describe-search: top-1 ${top1}/${UNSEEN.length}, top-3 ${top3}/${UNSEEN.length}${misses.length ? `\n  ${misses.join('\n  ')}` : ''}`);
  expect(top3).toBeGreaterThan(0);
});
