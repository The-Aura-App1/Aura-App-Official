import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = 'https://7uob369et4.execute-api.us-east-1.amazonaws.com';

async function getToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

async function request(method, path, body = null, requiresAuth = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (requiresAuth) {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();
  // API Gateway's own errors (missing route, failed auth) use `message`, not `error`
  if (!res.ok) throw new Error(data.error ?? data.message ?? 'Request failed');
  return data;
}

// Ids are encoded so a crafted link (an id containing ../ or ?) can't point a request at another route
const id = value => encodeURIComponent(String(value ?? ''));

// ?a=1&b=2 from an object, skipping empty values
function query(params) {
  const pairs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return pairs.length ? `?${new URLSearchParams(pairs.map(([k, v]) => [k, String(v)]))}` : '';
}

export const api = {
  // ─── Suggestions & reviews ────────────────────────────────
  // { stars: 1-5, sort: 'newest' | 'highest' | 'lowest' }
  getPublicReviews:  (params = {})  => request('GET',    `/feedback/reviews${query(params)}`, null, false),
  getMyReview:       ()             => request('GET',    '/feedback/reviews/me'),
  saveMyReview:      (rating, text) => request('PUT',    '/feedback/reviews/me', { rating, text }),
  deleteMyReview:    ()             => request('DELETE', '/feedback/reviews/me'),
  // { sort: 'top' | 'new', status: 'open' | 'planned' | 'done' }
  getSuggestions:    (params = {})  => request('GET',    `/feedback/suggestions${query(params)}`),
  createSuggestion:  (text)         => request('POST',   '/feedback/suggestions', { text }),
  voteSuggestion:    (suggestionId, on) => request(on ? 'POST' : 'DELETE', `/feedback/suggestions/${id(suggestionId)}/vote`),
  getFeedbackQueue:  ()             => request('GET',    '/feedback/admin'),
  moderateFeedback:  (kind, itemId, action) => request('POST', `/feedback/admin/${id(kind)}/${id(itemId)}`, { action }),

  // ─── Users ────────────────────────────────────────────────
  getMe:       ()                        => request('GET',  '/users/me'),
  getUser:     (username)                => request('GET',  `/users/${id(username)}`, null, false),
  createUser:  (userId, email, username) => request('POST', '/users', { userId, email, username }),
  updateProfile:      (data)  => request('PUT',  '/users/me', data),
  getProfileUploadUrls: (files) => request('POST', '/users/me/upload-urls', { files }),

  // ─── Follows ──────────────────────────────────────────────
  // { status: 'none' | 'pending' | 'active' | 'self', followsYou, canSeePosts, followerCount, followingCount }
  getFollowStatus: (username)            => request('GET',    `/follows/user/${id(username)}`),
  follow:          (username)            => request('POST',   `/follows/user/${id(username)}`),
  unfollow:        (username)            => request('DELETE', `/follows/user/${id(username)}`),
  // which: 'followers' | 'following'; returns { users, next }
  getFollowList:   (username, which, cursor = null) =>
    request('GET', `/follows/user/${id(username)}/${id(which)}${query({ cursor })}`),
  getFollowRequests: (cursor = null)     => request('GET',    `/follows/requests${query({ cursor })}`),
  answerFollowRequest: (userId, approve) =>
    request('POST', `/follows/requests/${id(userId)}/${approve ? 'approve' : 'decline'}`),
  removeFollower:  (userId)              => request('DELETE', `/follows/followers/${id(userId)}`),

  // ─── Posts ────────────────────────────────────────────────
  getFeed:       ()                     => request('GET',  '/posts'),
  getPost:        (postId)               => request('GET',  `/posts/${id(postId)}`),
  createPost:     (data)                 => request('POST', '/posts', data),
  deletePost:     (postId)               => request('DELETE', `/posts/${id(postId)}`),
  getUploadUrls:  (files)                => request('POST', '/posts/upload-urls', { files }),
  getUserPosts: (userId, limit = 20) => request('GET', `/users/${id(userId)}/posts?limit=${limit}`),
  fixAuthorNames: (newUsername, newDisplayName, newProfilePicKey) =>
  request('POST', '/posts/fix-author', { newUsername, newDisplayName, newProfilePicKey }),

  // ─── Aura ─────────────────────────────────────────────────
  giveAura:       (postId, amount)       => request('POST', `/posts/${id(postId)}/aura/give`, { amount }),
  takeAura:       (postId, amount)       => request('POST', `/posts/${id(postId)}/aura/take`, { amount }),
  giveCommentAura:(commentId, amount)    => request('POST', `/comments/${id(commentId)}/aura/give`, { amount }),
  takeCommentAura:(commentId, amount)    => request('POST', `/comments/${id(commentId)}/aura/take`, { amount }),
  watchAd:        ()                     => request('POST', '/ads/watch'),
  claimDailyBonus:()                     => request('POST', '/aura/daily-bonus'),

  // ─── Comments ─────────────────────────────────────────────
  getComments:    (postId, limit = 50)   => request('GET',  `/posts/${id(postId)}/comments?limit=${id(limit)}`),
  createComment:  (postId, text, parentCommentId = null) =>
    request('POST', `/posts/${id(postId)}/comments`, { text, parentCommentId }),
  deleteComment:  (commentId)            => request('DELETE', `/comments/${id(commentId)}`),
  setBanned:      (username, banned, reason) => request('POST', '/admin/ban', { username, banned, reason }),
  reportComment:  (commentId, reason)    => request('POST', `/comments/${id(commentId)}/report`, { reason }),

  // ─── Groups ───────────────────────────────────────────────
  listGroups:     (q = '')               => request('GET',  `/groups${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getMyGroups:    ()                     => request('GET',  '/groups/mine'),
  getGroup:       (groupId)              => request('GET',  `/groups/${id(groupId)}`),
  createGroup:    (data)                 => request('POST', '/groups', data),
  updateGroup:    (groupId, data)        => request('PUT',  `/groups/${id(groupId)}`, data),
  deleteGroup:    (groupId)              => request('DELETE', `/groups/${id(groupId)}`),
  joinGroup:      (groupId)              => request('POST', `/groups/${id(groupId)}/join`),
  leaveGroup:     (groupId)              => request('POST', `/groups/${id(groupId)}/leave`),
  inviteToGroup:  (groupId, username)    => request('POST', `/groups/${id(groupId)}/invite`, { username }),
  muteGroup:      (groupId, muted)       => request('POST', `/groups/${id(groupId)}/mute`, { muted }),
  getGroupMembers:(groupId, status = 'active') => request('GET', `/groups/${id(groupId)}/members?status=${status}`),
  getGroupPosts:  (groupId, cursor = null) =>
    request('GET', `/groups/${id(groupId)}/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  kickMember:     (groupId, userId)      => request('POST', `/groups/${id(groupId)}/kick/${id(userId)}`),
  banMember:      (groupId, userId)      => request('POST', `/groups/${id(groupId)}/ban/${id(userId)}`),
  unbanMember:    (groupId, userId)      => request('POST', `/groups/${id(groupId)}/unban/${id(userId)}`),
  appointMod:     (groupId, userId)      => request('POST', `/groups/${id(groupId)}/moderator/${id(userId)}`),
  demoteMod:      (groupId, userId)      => request('POST', `/groups/${id(groupId)}/demote/${id(userId)}`),
  approveRequest: (groupId, userId)      => request('POST', `/groups/${id(groupId)}/approve/${id(userId)}`),
  declineRequest: (groupId, userId)      => request('POST', `/groups/${id(groupId)}/decline/${id(userId)}`),

  // ─── Group games (aura-aura) ──────────────────────────────
  getGroupGames:  (groupId)              => request('GET',  `/games/group/${id(groupId)}`),
  createGame:     (groupId, data)        => request('POST', `/games/group/${id(groupId)}`, data),
  getGame:        (matchId, have)        => request('GET',  `/games/${id(matchId)}${have != null ? `?have=${encodeURIComponent(have)}` : ''}`),
  gameAction:     (matchId, action)      => request('POST', `/games/${id(matchId)}/${id(action)}`, {}),
  gameMove:       (matchId, move)        => request('POST', `/games/${id(matchId)}/move`, { move }),

  // ─── Notifications ────────────────────────────────────────
  getNotifications: (limit = 30)         => request('GET',  `/notifications?limit=${limit}`),
  markRead:         (notificationId)     => request('PUT',  `/notifications/${id(notificationId)}/read`),
  markAllRead:      ()                   => request('PUT',  '/notifications/read-all'),
  deleteNotification: (notificationId)   => request('DELETE', `/notifications/${id(notificationId)}`),

  // ─── Likes ────────────────────────────────────────────────
  likePost:       (postId)               => request('POST', `/posts/${id(postId)}/like`),
  unlikePost:     (postId)               => request('DELETE', `/posts/${id(postId)}/like`),
  likeComment:    (commentId)            => request('POST', `/comments/${id(commentId)}/like`),
  unlikeComment:  (commentId)            => request('DELETE', `/comments/${id(commentId)}/like`),
  getLikedPosts:  (cursor = null)        =>
    request('GET', `/users/me/likes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),

  // ─── Shares ───────────────────────────────────────────────
  shareToGroup:   (postId, groupId)      => request('POST', `/posts/${id(postId)}/share`, { groupId }),
};