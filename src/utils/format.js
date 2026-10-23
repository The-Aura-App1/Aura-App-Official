export function formatAura(n) {
  if (n === null || n === undefined) return '0';
  const abs  = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs}`;
}

export function timeAgo(isoString) {
  if (!isoString) return '';
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days  < 7)  return `${days}d`;
  return `${weeks}w`;
}

// status comes from the usernameStatus field on GET /users/me
export function usernameStatusText(status) {
  if (!status) return '';
  if (status.free)         return 'You can pick your username once without using up your change.';
  if (status.locked)       return 'Your username is locked. Premium members can change it once a day.';
  if (status.nextChangeAt) return `Next change available ${new Date(status.nextChangeAt).toLocaleString()}.`;
  if (status.changesLeft)  return `${status.changesLeft} change left. After that it is locked.`;
  return 'You can change your username once a day.';
}