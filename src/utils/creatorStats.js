// The Creator page's numbers, worked out from the creator's own posts
// (GET /users/{me}/posts?scope=mine: every active post, group posts too, with
// the author-only view and like counts). Nothing here is sent anywhere.

export const PERIODS = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: 'all', label: 'All time', days: null },
];

export const SORTS = [
  { id: 'views', label: 'Views' },
  { id: 'aura', label: 'Aura' },
  { id: 'likes', label: 'Likes' },
  { id: 'comments', label: 'Comments' },
  { id: 'rate', label: 'Aura per view' },
  { id: 'new', label: 'Newest' },
];

const n = v => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);

// One post's numbers
export function postStats(post) {
  const reactions = Object.values(post.reactions ?? {}).reduce((sum, c) => sum + n(c), 0);
  const views = n(post.viewCount);
  const aura = n(post.auraReceived);
  return {
    postId: post.postId,
    caption: post.caption ?? '',
    type: post.type ?? 'text',
    createdAt: post.createdAt ?? '',
    inGroup: !!post.groupId,
    views,
    aura,
    taken: n(post.auraTaken),
    likes: n(post.likeCount),
    comments: n(post.commentCount),
    reactions,
    // aura per 100 views, once there are enough views to mean something
    rate: views >= 10 ? (aura / views) * 100 : null,
  };
}

// Posts made in the period (all of them for 'all')
export function inPeriod(posts, periodId, now = Date.now()) {
  const days = PERIODS.find(p => p.id === periodId)?.days;
  if (!days) return posts;
  const since = now - days * 86_400_000;
  return posts.filter(p => Date.parse(p.createdAt) >= since);
}

export function totals(stats) {
  const sum = key => stats.reduce((s, p) => s + p[key], 0);
  const views = sum('views');
  const aura = sum('aura');
  return {
    posts: stats.length,
    views,
    aura,
    likes: sum('likes'),
    comments: sum('comments'),
    reactions: sum('reactions'),
    rate: views >= 10 ? (aura / views) * 100 : null,
  };
}

export function sortStats(stats, sortId) {
  const by = {
    views: p => p.views, aura: p => p.aura, likes: p => p.likes, comments: p => p.comments,
    rate: p => (p.rate ?? -1), new: p => Date.parse(p.createdAt) || 0,
  }[sortId] ?? (p => p.views);
  return [...stats].sort((a, b) => by(b) - by(a) || (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

// The post that did best in the period: most aura, then most views
export function topPost(stats) {
  return stats.reduce((best, p) => (!best || p.aura > best.aura || (p.aura === best.aura && p.views > best.views) ? p : best), null);
}

// Who may open the Creator page: creator accounts (and admins, to check it)
export const canUseCreator = profile => !!(profile?.isCreator || profile?.isAdmin);
