// Whether this account has finished or skipped the app tour on this device.
// A per-device convenience only: if storage is blocked the tour simply shows
// again, and it can always be skipped.
const key = userId => `aura.tour.v1.${userId}`;

export function hasSeenTour(userId) {
  if (!userId) return true;
  try { return localStorage.getItem(key(userId)) === 'done'; } catch { return false; }
}

export function markTourSeen(userId) {
  if (!userId) return;
  try { localStorage.setItem(key(userId), 'done'); } catch { /* storage blocked: nothing to remember */ }
}
