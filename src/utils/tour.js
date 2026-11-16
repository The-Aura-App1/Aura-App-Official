// Whether this account has finished or skipped the app tour on this device.
// A per-device convenience only: if storage is blocked the tour simply shows
// again, and it can always be skipped.
const key = userId => `aura.tour.v2.${userId}`;

export function hasSeenTour(userId) {
  if (!userId) return true;
  try { return localStorage.getItem(key(userId)) === 'done'; } catch { return false; }
}

export function markTourSeen(userId) {
  if (!userId) return;
  try { localStorage.setItem(key(userId), 'done'); } catch { /* storage blocked: nothing to remember */ }
}

// Accounts shared by several people (the contest judges all sign in as
// demo_judge): the tour starts again on every fresh sign-in, so each judge
// gets it even on a computer where someone else already used the account
const SHARED_ACCOUNTS = new Set(['b438a438-7091-7082-ef04-75e17974d01a']);
export function resetTourOnSignIn(userId) {
  if (!SHARED_ACCOUNTS.has(userId)) return;
  try { localStorage.removeItem(key(userId)); } catch { /* storage blocked: the tour shows anyway */ }
}
