// Things placed on top of a post, Instagram style: text, links, @mentions,
// #hashtags and emoji, each at a spot on a photo (or the video, or a styled
// text post's card). Positions are fractions of the media box (0..1, the
// center of the item), so they land in the same place on every screen.
//
// Keep the limits in sync with src/utils/overlays.js (a test keeps them equal).
// Links are only http(s) addresses; the app shows their domain, opens them in
// a new tab and marks them nofollow, so a post can't run script or pose as Aura.
import { isReactionEmoji } from './reactions.mjs';
import { FONT_IDS } from './postStyle.mjs';

export const MAX_OVERLAYS = 12;
export const OVERLAY_KINDS = ['text', 'link', 'mention', 'hashtag', 'emoji'];
export const OVERLAY_TEXT_MAX = 120;
export const OVERLAY_LABEL_MAX = 40;
export const OVERLAY_URL_MAX = 300;
export const OVERLAY_BGS = ['none', 'solid', 'soft'];
const HEX = /^#[0-9a-f]{6}$/;
const USERNAME = /^[a-z0-9_]{3,30}$/;
const HASHTAG = /^[\p{L}\p{N}_]{1,30}$/u;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

// A safe link: http or https, a real host, no credentials, not too long
export function cleanUrl(value) {
  if (typeof value !== 'string' || value.length > OVERLAY_URL_MAX) return null;
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || !url.hostname.includes('.')) return null;
  return url.toString();
}

// cleanText: the caller's text cleaner (control and invisible characters out)
export function checkOverlays(list, slides, cleanText) {
  if (list === undefined || list === null) return { overlays: [] };
  if (!Array.isArray(list) || list.length > MAX_OVERLAYS) return { error: `Up to ${MAX_OVERLAYS} things on a post.` };
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || !OVERLAY_KINDS.includes(raw.kind)) return { error: 'Something on the post isn\'t allowed.' };
    if (!Number.isInteger(raw.slide) || raw.slide < 0 || raw.slide >= Math.max(1, slides)) return { error: 'Something is on a photo that isn\'t there.' };
    if (!num(raw.x, 0, 1) || !num(raw.y, 0, 1) || !num(raw.size, 0.5, 3)) return { error: 'Something is placed off the post.' };
    const item = { kind: raw.kind, slide: raw.slide, x: Math.round(raw.x * 1000) / 1000, y: Math.round(raw.y * 1000) / 1000, size: Math.round(raw.size * 100) / 100 };
    const color = raw.color ?? '#ffffff';
    if (!HEX.test(color)) return { error: 'Pick a color from the list.' };
    item.color = color;
    // Any font from the catalog (the same one as post styling); emoji have none
    if (raw.font !== undefined && raw.font !== null && raw.kind !== 'emoji') {
      if (!FONT_IDS.has(raw.font)) return { error: 'Pick a font from the list.' };
      item.font = raw.font;
    }
    if (raw.kind === 'text') {
      const text = cleanText(String(raw.text ?? '')).slice(0, OVERLAY_TEXT_MAX + 1);
      if (!text.trim() || text.length > OVERLAY_TEXT_MAX) return { error: `Text on a post is 1 to ${OVERLAY_TEXT_MAX} characters.` };
      if (!OVERLAY_BGS.includes(raw.bg ?? 'none')) return { error: 'Invalid text style.' };
      item.text = text;
      item.bg = raw.bg ?? 'none';
    } else if (raw.kind === 'link') {
      const url = cleanUrl(raw.url);
      if (!url) return { error: 'Links must be a full web address starting with https://.' };
      item.url = url;
      const label = cleanText(String(raw.label ?? '')).trim();
      if (label.length > OVERLAY_LABEL_MAX) return { error: `Link labels are up to ${OVERLAY_LABEL_MAX} characters.` };
      if (label) item.label = label;
    } else if (raw.kind === 'mention') {
      const username = String(raw.username ?? '').toLowerCase().replace(/^@/, '');
      if (!USERNAME.test(username)) return { error: 'Mention someone by their username.' };
      item.username = username;
    } else if (raw.kind === 'hashtag') {
      const tag = String(raw.tag ?? '').replace(/^#/, '');
      if (!HASHTAG.test(tag)) return { error: 'Hashtags use letters, numbers and _ (30 at most).' };
      item.tag = tag;
    } else if (raw.kind === 'emoji') {
      if (!isReactionEmoji(raw.emoji)) return { error: 'Pick one emoji.' };
      item.emoji = raw.emoji;
    }
    out.push(item);
  }
  return { overlays: out };
}
