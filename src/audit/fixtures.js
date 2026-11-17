// Sample data for the phone audit (scripts/phone-audit.mjs). Only used when
// the app runs with REACT_APP_PHONE_AUDIT=1 (never in a real build): the app
// is signed in as a made-up account and every API call is answered from here,
// so every page can be opened and measured without touching the real server.
// The content is awkward on purpose: very long names and captions, big aura
// numbers, many comments, a post with every styling option.
import GAME_VIEWS from './gameViews.json';

const now = Date.now();
const ago = mins => new Date(now - mins * 60_000).toISOString();
const LONG_NAME = 'Ana Lights-Montgomery of the Very Long Display Name';
const LONG_USER = 'ana_lights_with_a_long_handle';
const LONG_CAPTION = 'Watched the sunrise from the ridge today after a three hour climb in the dark. Worth the early alarm, the cold coffee and the blisters. The light hit the valley and everything turned gold for about four minutes. #sunrise #hiking #mountains #goldenhour #worthit #nofilter #autumn #outdoors #photography #peaks';

export const ME = {
  userId: 'audit-me', username: LONG_USER, displayName: LONG_NAME, bio: 'Chasing light on ridgelines, collecting sunsets, and drinking far too much coffee for one person. Say hi!',
  tags: ['hiking', 'photography', 'coffee', 'mountains', 'travel', 'sunsets', 'film', 'climbing', 'books', 'jazz'],
  isPremium: true, isCreator: true, isAdmin: true, theme: 'night', auraVersion: 2,
  auraBalance: 12_345_678, auraSpendable: 345_678, auraEarned: 12_000_000, followerCount: 1_234_567, followingCount: 4321,
  lifetimeEarned: 15_000_000, lifetimeReceived: 15_200_000, lifetimeGiven: 2_345_678, lifetimeTaken: 12_345, lifetimeLost: 6789,
  createdAt: '2025-06-01T00:00:00Z', notificationPrefs: {}, commentVisibilityDefault: 'anyone', usernameStatus: { canChange: true },
  today: { bonus: { amount: 800, claimed: false }, freeGive: { used: 50, limit: 200 }, walletGive: { used: 1200, limit: 2000 }, take: { used: 0, limit: 1000 }, nextAdAt: null },
};

const author = (n, extra = {}) => ({ authorId: `u${n}`, authorUsername: n === 0 ? LONG_USER : `person_number_${n}_long_name`, authorDisplay: n === 0 ? LONG_NAME : `Person ${n} With A Long Display Name`, authorPicKey: '', ...extra });
const reactions = { '🔥': 12345, '😂': 987, '❤️': 4321, '👀': 56, '🎉': 7, '🇺🇸': 3, '💯': 999 };

export const POSTS = [
  { postId: 'p1', ...author(1), type: 'text', caption: LONG_CAPTION, hashtags: ['sunrise', 'hiking', 'mountains'], tags: ['photography', 'travel'], auraScore: 123456, auraReceived: 123456, likeCount: 4567, commentCount: 321, viewCount: 99999, createdAt: ago(5), reactions, myReactions: ['🔥'],
    style: { font: 'playfair-display', color: '#ffffff', bg: 'nightsky', size: 'l', align: 'center', frame: 'neon' } },
  { postId: 'p2', ...author(2), type: 'photo', caption: 'Lake day with the whole crew 🌊', mediaKeys: ['posts/u2/demo-1.jpg', 'posts/u2/demo-2.jpg'], hashtags: ['lake'], tags: ['travel'], auraScore: 42, auraReceived: 42, createdAt: ago(60), reactions: { '🔥': 2 },
    overlays: [{ kind: 'text', slide: 0, x: 0.5, y: 0.2, size: 1.4, color: '#ffffff', bg: 'soft', text: 'Best day of the summer by far', font: 'pacifico' }, { kind: 'link', slide: 0, x: 0.3, y: 0.8, size: 1, color: '#7c3aed', url: 'https://example.com/a-very-long-link-address/that-goes-on' }] },
  { postId: 'p3', ...author(0), type: 'text', caption: 'Short one.', auraScore: 0, createdAt: ago(600), reactions: {} },
  { postId: 'p4', ...author(3), type: 'video', caption: 'Timelapse of the storm rolling in', mediaKeys: ['posts/u3/demo.mp4'], auraScore: 9_999_999, createdAt: ago(3000), reactions: {} },
  { postId: 'p5', ...author(4), type: 'text', caption: 'Supercalifragilisticexpialidocious_without_any_spaces_at_all_to_see_if_it_breaks_the_layout_on_small_phones_or_not', createdAt: ago(5000), groupId: 'g1', groupName: 'The Extremely Long Group Name For Testing Phones', reactions: {} },
];

const comment = (i, replies = []) => ({ commentId: `c${i}`, postId: 'p1', ...author(i % 5), text: i % 3 ? 'Absolutely stunning, the colours here are unreal and I need to go there next year with everyone' : 'Nice', createdAt: ago(i * 7), likeCount: i * 3, reactions: i % 2 ? { '🔥': i } : {}, replies });

export const GROUPS = [
  { groupId: 'g1', name: 'The Extremely Long Group Name For Testing Phones', description: 'A place for people who love long walks, longer names and the longest descriptions you have ever seen on a group card.', joinType: 'open', memberCount: 123456, level: 12, myStatus: 'active', myRole: 'owner', isOwner: true, canModerate: true, canPost: true, canSeePosts: true, canSeeMembers: true, momentsEnabled: true, powerUpsEnabled: true, allowTakes: true, ownerId: 'audit-me', createdAt: ago(99999) },
  { groupId: 'g2', name: 'Night Owls', description: 'Late night chats.', joinType: 'request', memberCount: 42, level: 3, myStatus: 'active', myRole: 'member', canPost: true, canSeePosts: true, canSeeMembers: true, createdAt: ago(9999) },
  { groupId: 'g3', name: 'Chess Club', description: '', joinType: 'open', memberCount: 7, level: 1, myStatus: null, canSeePosts: true, createdAt: ago(999) },
];

const players = [
  { userId: 'audit-me', username: LONG_USER, displayName: LONG_NAME },
  { userId: 'u1', username: 'person_number_1_long_name', displayName: 'Person 1 With A Long Display Name' },
  { userId: 'u2', username: 'person_number_2_long_name', displayName: 'Person 2' },
];
const GAME_NAMES = { connect4: 'Connect 4', pool: '8-Ball Pool', chess: 'Chess', gofish: 'Go Fish', crazy8: 'Crazy 8', poker: 'Poker', golf: 'Mini Golf', dice: 'Dice Duel', coinflip: 'Coin flip' };
function match(game) {
  const g = GAME_VIEWS[game];
  return {
    match: { matchId: `m-${game}`, groupId: 'g1', game, gameName: GAME_NAMES[game], stake: 2000, seats: g.players, status: 'active', players: players.slice(0, g.players),
      turnUserId: 'audit-me', deadline: now + 90_000, createdAt: ago(10), time: game === 'chess' ? 'c10+0' : 'm120', clocks: game === 'chess' ? [600000, 600000] : null, turnStartedAt: now, outUserIds: [], winnerUserIds: [] },
    seat: 0, view: { ...g.view, turn: 0 }, version: 3, now,
  };
}

const NOTIFICATIONS = [
  { notificationId: 'n1', type: 'auraGiven', data: { fromUsername: 'person_number_1_long_name', amount: 123456, postId: 'p1' }, read: false, createdAt: ago(1) },
  { notificationId: 'n2', type: 'comment', data: { fromUsername: 'person_number_2_long_name', postId: 'p1', preview: LONG_CAPTION }, read: false, starred: true, createdAt: ago(30) },
  { notificationId: 'n3', type: 'follow', data: { fromUsername: 'someone' }, read: true, createdAt: ago(3000) },
  { notificationId: 'n4', type: 'groupInvite', data: { fromUsername: 'person_number_3_long_name', groupId: 'g2', groupName: 'The Extremely Long Group Name For Testing Phones' }, read: false, createdAt: ago(9000) },
  { notificationId: 'n5', type: 'games', data: { fromUsername: 'person_number_1_long_name', matchId: 'm-chess', game: 'chess', groupId: 'g1' }, read: true, createdAt: ago(20000) },
];

const profile = username => ({
  userId: username === LONG_USER ? 'audit-me' : 'u1', username, displayName: username === LONG_USER ? LONG_NAME : 'Person 1 With A Long Display Name',
  bio: ME.bio, tags: ME.tags, auraBalance: 9_876_543, followerCount: 1_234_567, followingCount: 89, createdAt: '2025-06-01T00:00:00Z', badges: [], isPremium: true,
});

const history = range => {
  const unit = range === 'all' || range === '1y' ? 'month' : 'day';
  const n = { '1w': 7, '1m': 30, '3m': 90, '1y': 12, all: 18 }[range] ?? 30;
  return { balance: ME.auraBalance, unit, points: Array.from({ length: n }, (_, i) => ({ date: unit === 'month' ? `2026-${String((i % 12) + 1).padStart(2, '0')}` : ago((n - i) * 1440).slice(0, 10), net: Math.round(Math.sin(i) * 40000 + 20000) })) };
};

// One answer per route; anything else is logged so the audit can report it
export function respond(method, path) {
  const [route, qs] = path.split('?');
  const q = new URLSearchParams(qs ?? '');
  const seg = route.split('/').filter(Boolean).map(decodeURIComponent);
  if (method !== 'GET') return { ok: true, message: 'Done.', post: POSTS[0], match: { matchId: 'm-chess' } };

  if (route === '/users/me') return ME;
  if (route === '/posts') return { posts: POSTS };
  if (seg[0] === 'posts' && seg.length === 2) return POSTS.find(p => p.postId === seg[1]) ?? POSTS[0];
  if (seg[0] === 'posts' && seg[2] === 'comments') return { total: 40, comments: Array.from({ length: 12 }, (_, i) => comment(i + 1, i % 4 === 0 ? [comment(100 + i), comment(200 + i)] : [])) };
  if (seg[0] === 'users' && seg[2] === 'posts') return { posts: POSTS };
  if (seg[0] === 'users' && seg[1] === 'me' && seg[2] === 'likes') return { posts: POSTS.slice(0, 3) };
  if (seg[0] === 'users' && seg.length === 2) return profile(seg[1]);
  if (seg[0] === 'aura' && seg[1] === 'history') return history(q.get('range'));
  if (route === '/groups/mine') return { groups: GROUPS.filter(g => g.myStatus) };
  if (route === '/groups/leaderboard') return { by: q.get('by') ?? 'level', groups: GROUPS.map((g, i) => ({ rank: i + 1, ...g, xp: 123456 - i, aura: 9_876_543 - i, ...(i === 2 && { memberCount: undefined }) })) };
  if (route === '/groups') return { groups: GROUPS };
  if (seg[0] === 'groups' && seg[2] === 'members') return { members: players.map((p, i) => ({ ...p, role: i === 0 ? 'owner' : 'member', status: 'active', joinedAt: ago(i * 1000) })) };
  if (seg[0] === 'groups' && seg[2] === 'posts') return { posts: POSTS };
  if (seg[0] === 'groups' && seg.length === 2) return GROUPS.find(g => g.groupId === seg[1]) ?? GROUPS[0];
  if (seg[0] === 'games' && seg[1] === 'group' && seg[3] === 'champions') return { overall: players.map((p, i) => ({ rank: i + 1, ...p, wins: 100 - i })), byGame: {} };
  if (seg[0] === 'games' && seg[1] === 'group') return { games: Object.keys(GAME_NAMES).map(g => match(g).match), now };
  if (seg[0] === 'games' && seg.length === 2) return match(seg[1].replace(/^m-/, '')) ;
  if (seg[0] === 'power-ups') {
    return { enabled: true, canManage: true, level: { level: 12, xp: 7000, floor: 6600, next: 7800, max: false, aura: 1_234_567 }, boost: { active: 2, multiplier: 1.5, mine: null, premium: true, left: 3 },
      spotlight: { postId: 'p1', until: now + 3_600_000, byUsername: LONG_USER, byUserId: 'audit-me' }, rain: null, lastRain: null,
      board: { week: '2026-W46', top: players.map((p, i) => ({ rank: i + 1, ...p, given: 99999 - i })), me: { given: 99999, rank: 1, hidden: false } }, now };
  }
  if (seg[0] === 'notifications') return { notifications: NOTIFICATIONS, unreadCount: 3 };
  if (seg[0] === 'follows' && seg[1] === 'requests') return { users: players.slice(1), next: null };
  if (seg[0] === 'follows' && seg[1] === 'blocked') return { users: [] };
  if (seg[0] === 'follows' && seg[1] === 'search') return { users: players };
  if (seg[0] === 'follows' && seg[1] === 'user' && seg.length === 4) return { users: players, next: null };
  if (seg[0] === 'follows' && seg[1] === 'user') return { status: 'following', followsYou: true, blocked: false };
  if (route === '/feedback/suggestions') return { sort: 'top', status: 'all', counts: { all: 3, open: 2, planned: 1, done: 0 }, suggestionBonus: 'offer',
    suggestions: [{ suggestionId: 's1', text: LONG_CAPTION, votes: 12345, status: 'planned', createdAt: ago(100), votedByMe: true, isMine: false, authorUsername: 'person_number_1_long_name', authorDisplay: LONG_NAME }] };
  if (route === '/feedback/reviews/me') return { review: null };
  if (route === '/feedback/reviews') return { count: 2, average: 4.5, breakdown: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 }, stars: null, sort: 'newest', matching: 2,
    reviews: [{ rating: 5, text: LONG_CAPTION, createdAt: ago(50), authorUsername: LONG_USER, authorDisplay: LONG_NAME }, { rating: 4, text: 'Good', createdAt: ago(500), authorUsername: 'x', authorDisplay: 'X' }] };
  if (route === '/feedback/admin') return { reviews: [], suggestions: [] };
  if (route === '/admin/reports') return { posts: [{ ...POSTS[0], kind: 'post', id: 'p1', reasons: ['spam', 'harassment'], reportCount: 3, hidden: false }], comments: [{ ...comment(1), kind: 'comment', id: 'c1', reasons: ['hate'], reportCount: 1, hidden: true }], users: [{ ...profile('person_number_1_long_name'), kind: 'user', id: 'u1', reasons: ['spam'], reportCount: 2, hidden: false }] };
  // eslint-disable-next-line no-console
  console.warn(`[audit] no fixture for GET ${path}`);
  return {};
}
