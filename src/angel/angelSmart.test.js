import { respond } from './angel';

// Angel's grounded feed tuning, conversation memory and newer skills
const pool = [
  { postId: 'c1', authorUsername: 'chef_kim', caption: 'Fresh pasta night 🍝', tags: ['cooking'], hashtags: ['pasta', 'homecooking'], auraScore: 40, type: 'image' },
  { postId: 'c2', authorUsername: 'bakes', caption: 'Sourdough attempt number four', tags: ['cooking', 'food'], hashtags: ['sourdough', 'baking'], auraScore: 25, type: 'image' },
  { postId: 'c3', authorUsername: 'bakes', caption: 'Pasta with brown butter', tags: ['cooking'], hashtags: ['pasta'], auraScore: 12, type: 'text' },
  { postId: 's1', authorUsername: 'sunny', caption: 'Golden hour at the lake', tags: ['photography'], hashtags: ['sunset', 'goldenhour'], auraScore: 60, type: 'image' },
  { postId: 's2', authorUsername: 'sunny', caption: 'Another sunset, sorry not sorry', tags: ['photography', 'outdoors'], hashtags: ['sunset'], auraScore: 30, type: 'image' },
];
const base = { getPool: async () => pool, prefs: { more: [], less: [], words: [] } };

test('the cooking request from testing: the topic, no filler keywords, and what fits today', async () => {
  const reply = await respond('Im starting to become interested in cooking, can you help to populate my feed with cool stuff like that?', base);
  expect(reply.kind).toBe('feed');
  expect(reply.actions[0].payload).toEqual({ topics: ['cooking'], keywords: [], choice: 'more' });
  expect(reply.text).toMatch(/Cooking topic/);
  expect(reply.text).toMatch(/3 of today's popular posts already fit/);
  expect(reply.text).not.toMatch(/populate|cool|help|starting|become/i);
  // and it suggests hashtags people actually use with it
  expect(reply.followUps[0]).toMatch(/^Also more #pasta/);
});

test('only words posts really use become keywords; specific topic words still count', async () => {
  const reply = await respond('more sourdough and cozy vibes please', base);
  expect(reply.actions[0].payload.keywords).toEqual(['sourdough']);
  const nfl = await respond('I want to see more NFL posts in my feed', base);
  expect(nfl.actions[0].payload).toEqual({ topics: ['sports'], keywords: ['nfl'], choice: 'more' });
});

test('"yes" does what she just offered, "no" lets it go, and "that" means the last subject', async () => {
  const offer = await respond('more cooking please', base);
  const yes = await respond('yes', { ...base, pendingActions: offer.actions });
  expect(yes.autoAction).toEqual(offer.actions[0]);
  const no = await respond('nah', { ...base, pendingActions: offer.actions });
  expect(no.autoAction).toBeUndefined();
  expect(no.text).toMatch(/won't change anything/);
  const less = await respond('actually show me less of that', { ...base, lastSubjects: offer.subjects });
  expect(less.actions[0].payload).toEqual({ topics: ['cooking'], keywords: [], choice: 'less' });
  // her "Also more #pasta, #homecooking" suggestion, tapped
  const also = await respond('Also more #pasta, #homecooking', base);
  expect(also.actions[0].payload).toEqual({ topics: [], keywords: ['pasta', 'homecooking'], choice: 'more' });
});

test('finds posts about something, right in the chat', async () => {
  const reply = await respond('show me posts about sunsets', base);
  expect(reply.kind).toBe('find-posts');
  expect(reply.posts.map(p => p.postId)).toEqual(['s1', 's2']);
  expect(reply.links[0].to).toBe('/search?q=sunsets');
  const none = await respond('find posts about knitting', base);
  expect(none.posts).toBeUndefined();
  expect(none.text).toMatch(/Nothing about "knitting"/);
});

test('catches you up on notifications', async () => {
  const api = { getNotifications: async () => ({ notifications: [
    { type: 'aura_given', read: false, data: { fromUsername: 'bo', amount: 20 } },
    { type: 'aura_given', read: false, data: { fromUsername: 'cy', amount: 5 } },
    { type: 'game_challenge', read: false, data: { fromUsername: 'bo', matchId: 'm9' } },
    { type: 'comment', read: true, data: { fromUsername: 'old' } },
  ] }) };
  const reply = await respond('what did I miss?', { ...base, api });
  expect(reply.kind).toBe('catch-up');
  expect(reply.text).toMatch(/3 unread/);
  expect(reply.items[0].rows[0]).toMatch(/@bo, @cy gave you aura \(2\) \(25 aura\)/);
  expect(reply.links.map(l => l.to)).toContain('/games/m9');
  const quiet = await respond('anything new?', { ...base, api: { getNotifications: async () => ({ notifications: [] }) } });
  expect(quiet.text).toMatch(/all caught up/);
});

test('starts a game against a bot', async () => {
  const api = { getMyGroups: async () => ({ groups: [{ groupId: 'g1', myStatus: 'active' }] }) };
  const ask = await respond('I\'m bored, can I play chess against a bot?', { ...base, api });
  expect(ask.kind).toBe('bot');
  expect(ask.actions.map(a => a.payload.level)).toEqual(['easy', 'medium', 'hard']);
  expect(ask.actions[0].payload).toMatchObject({ game: 'chess', groupId: 'g1' });
  const hard = await respond('play a hard game of pool against the computer', { ...base, api });
  expect(hard.actions).toHaveLength(1);
  expect(hard.actions[0].payload).toMatchObject({ game: 'pool', level: 'hard' });
  const which = await respond('play against a bot', { ...base, api });
  expect(which.followUps).toContain('Play Chess against a bot');
  const noGroups = await respond('play chess against a bot', { ...base, api: { getMyGroups: async () => ({ groups: [] }) } });
  expect(noGroups.links[0].to).toBe('/groups');
});

test('suggests groups that match your interests', async () => {
  const api = { listGroups: async () => ({ groups: [
    { groupId: 'a', name: 'Weeknight Cooking Club', description: 'Easy recipes', memberCount: 12 },
    { groupId: 'b', name: 'Chess Nerds', description: '', memberCount: 40 },
    { groupId: 'c', name: 'Mine', myStatus: 'active', memberCount: 3 },
  ] }) };
  const reply = await respond('which groups should I join?', { ...base, api, prefs: { more: ['cooking'], less: [], words: [] } });
  expect(reply.kind).toBe('groups');
  expect(reply.items[0].rows[0]).toMatch(/^Weeknight Cooking Club/);
  expect(reply.links.map(l => l.to)).not.toContain('/groups/c');
});
