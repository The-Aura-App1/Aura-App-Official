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

export const api = {
  // ─── Users ────────────────────────────────────────────────
  getMe:       ()                        => request('GET',  '/users/me'),
  getUser:     (username)                => request('GET',  `/users/${username}`, null, false),
  createUser:  (userId, email, username) => request('POST', '/users', { userId, email, username }),
  updateProfile:      (data)  => request('PUT',  '/users/me', data),
  getProfileUploadUrls: (files) => request('POST', '/users/me/upload-urls', { files }),

  // ─── Posts ────────────────────────────────────────────────
  getFeed:        ()                     => request('GET',  '/posts'),
  getPost:        (postId)               => request('GET',  `/posts/${postId}`),
  createPost:     (data)                 => request('POST', '/posts', data),
  deletePost:     (postId)               => request('DELETE', `/posts/${postId}`),
  getUploadUrls:  (files)                => request('POST', '/posts/upload-urls', { files }),
  getUserPosts: (userId, limit = 20) => request('GET', `/users/${userId}/posts?limit=${limit}`),
  fixAuthorNames: (newUsername, newDisplayName, newProfilePicKey) =>
  request('POST', '/posts/fix-author', { newUsername, newDisplayName, newProfilePicKey }),

  // ─── Aura ─────────────────────────────────────────────────
  giveAura:       (postId, amount)       => request('POST', `/posts/${postId}/aura/give`, { amount }),
  takeAura:       (postId, amount)       => request('POST', `/posts/${postId}/aura/take`, { amount }),
  giveCommentAura:(commentId, amount)    => request('POST', `/comments/${commentId}/aura/give`, { amount }),
  takeCommentAura:(commentId, amount)    => request('POST', `/comments/${commentId}/aura/take`, { amount }),
  watchAd:        ()                     => request('POST', '/ads/watch'),
  claimDailyBonus:()                     => request('POST', '/aura/daily-bonus'),

  // ─── Comments ─────────────────────────────────────────────
  getComments:    (postId, limit = 50)   => request('GET',  `/posts/${postId}/comments?limit=${limit}`),
  createComment:  (postId, text, parentCommentId = null) =>
    request('POST', `/posts/${postId}/comments`, { text, parentCommentId }),
  deleteComment:  (commentId)            => request('DELETE', `/comments/${commentId}`),
  reportComment:  (commentId, reason)    => request('POST', `/comments/${commentId}/report`, { reason }),

  // ─── Groups ───────────────────────────────────────────────
  listGroups:     (q = '')               => request('GET',  `/groups${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getMyGroups:    ()                     => request('GET',  '/groups/mine'),
  getGroup:       (groupId)              => request('GET',  `/groups/${groupId}`),
  createGroup:    (data)                 => request('POST', '/groups', data),
  updateGroup:    (groupId, data)        => request('PUT',  `/groups/${groupId}`, data),
  deleteGroup:    (groupId)              => request('DELETE', `/groups/${groupId}`),
  joinGroup:      (groupId)              => request('POST', `/groups/${groupId}/join`),
  leaveGroup:     (groupId)              => request('POST', `/groups/${groupId}/leave`),
  inviteToGroup:  (groupId, username)    => request('POST', `/groups/${groupId}/invite`, { username }),
  muteGroup:      (groupId, muted)       => request('POST', `/groups/${groupId}/mute`, { muted }),
  getGroupMembers:(groupId, status = 'active') => request('GET', `/groups/${groupId}/members?status=${status}`),
  getGroupPosts:  (groupId, cursor = null) =>
    request('GET', `/groups/${groupId}/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  kickMember:     (groupId, userId)      => request('POST', `/groups/${groupId}/kick/${userId}`),
  banMember:      (groupId, userId)      => request('POST', `/groups/${groupId}/ban/${userId}`),
  unbanMember:    (groupId, userId)      => request('POST', `/groups/${groupId}/unban/${userId}`),
  appointMod:     (groupId, userId)      => request('POST', `/groups/${groupId}/moderator/${userId}`),
  demoteMod:      (groupId, userId)      => request('POST', `/groups/${groupId}/demote/${userId}`),
  approveRequest: (groupId, userId)      => request('POST', `/groups/${groupId}/approve/${userId}`),
  declineRequest: (groupId, userId)      => request('POST', `/groups/${groupId}/decline/${userId}`),

  // ─── Notifications ────────────────────────────────────────
  getNotifications: (limit = 30)         => request('GET',  `/notifications?limit=${limit}`),
  markRead:         (notificationId)     => request('PUT',  `/notifications/${notificationId}/read`),
  markAllRead:      ()                   => request('PUT',  '/notifications/read-all'),
  deleteNotification: (notificationId)   => request('DELETE', `/notifications/${notificationId}`),

  // ─── Likes ────────────────────────────────────────────────
  likePost:       (postId)               => request('POST', `/posts/${postId}/like`),
  unlikePost:     (postId)               => request('DELETE', `/posts/${postId}/like`),
  likeComment:    (commentId)            => request('POST', `/comments/${commentId}/like`),
  unlikeComment:  (commentId)            => request('DELETE', `/comments/${commentId}/like`),
  getLikedPosts:  (cursor = null)        =>
    request('GET', `/users/me/likes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),

  // ─── Shares ───────────────────────────────────────────────
  shareToGroup:   (postId, groupId)      => request('POST', `/posts/${postId}/share`, { groupId }),
};