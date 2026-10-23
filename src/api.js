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
  createUser:  (userId, email, username) => request('POST', '/users', { userId, email, username }, false),
  updateProfile:      (data)  => request('PUT',  '/users/me', data),
  getProfileUploadUrls: (files) => request('POST', '/users/me/upload-urls', { files }),

  // ─── Posts ────────────────────────────────────────────────
  getFeed:        (limit = 20)           => request('GET',  `/posts?limit=${limit}`, null, false),
  getPost:        (postId)               => request('GET',  `/posts/${postId}`, null, false),
  createPost:     (data)                 => request('POST', '/posts', data),
  deletePost:     (postId)               => request('DELETE', `/posts/${postId}`),
  getUploadUrls:  (files)                => request('POST', '/posts/upload-urls', { files }),
  getUserPosts: (userId, limit = 20) => request('GET', `/users/${userId}/posts?limit=${limit}`, null, false),
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
  getComments:    (postId, limit = 50)   => request('GET',  `/posts/${postId}/comments?limit=${limit}`, null, false),
  createComment:  (postId, text, parentCommentId = null) =>
    request('POST', `/posts/${postId}/comments`, { text, parentCommentId }),
  deleteComment:  (commentId)            => request('DELETE', `/comments/${commentId}`),
  reportComment:  (commentId, reason)    => request('POST', `/comments/${commentId}/report`, { reason }),

  // ─── Groups ───────────────────────────────────────────────
  listGroups:     ()                     => request('GET',  '/groups', null, false),
  getGroup:       (groupId)              => request('GET',  `/groups/${groupId}`, null, false),
  createGroup:    (data)                 => request('POST', '/groups', data),
  deleteGroup:    (groupId)              => request('DELETE', `/groups/${groupId}`),
  joinGroup:      (groupId)              => request('POST', `/groups/${groupId}/join`),
  leaveGroup:     (groupId)              => request('POST', `/groups/${groupId}/leave`),
  kickMember:     (groupId, userId)      => request('POST', `/groups/${groupId}/kick/${userId}`),
  banMember:      (groupId, userId)      => request('POST', `/groups/${groupId}/ban/${userId}`),
  appointMod:     (groupId, userId)      => request('POST', `/groups/${groupId}/moderator/${userId}`),
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
  getLikedPosts:  ()                     => request('GET',  '/users/me/likes'),

  // ─── Shares ───────────────────────────────────────────────
  shareToGroup:   (postId, groupId)      => request('POST', `/posts/${postId}/share`, { groupId }),
};