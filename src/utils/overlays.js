// Things placed on top of a post (Instagram style): text, links, @mentions,
// #hashtags and emoji. Limits match backend/lambdas/aura-posts/overlays.mjs
// (a test keeps them equal). Positions are fractions of the media box.
export const MAX_OVERLAYS = 12;
export const OVERLAY_TEXT_MAX = 120;
export const OVERLAY_LABEL_MAX = 40;
export const OVERLAY_URL_MAX = 300;
export const OVERLAY_COLORS = ['#ffffff', '#111827', '#facc15', '#f472b6', '#a78bfa', '#22d3ee', '#4ade80', '#f97316', '#ef4444'];

// A link as typed: adds https:// when it's missing; null if it isn't a web address
export function normalizeUrl(value) {
  let text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  if (text.length > OVERLAY_URL_MAX) return null;
  try {
    const url = new URL(text);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password || !url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

// Black or white text, whichever reads on a solid color
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111827' : '#ffffff';
}

let next = 0;
export const newOverlayId = () => `o${Date.now().toString(36)}${(next++).toString(36)}`;
