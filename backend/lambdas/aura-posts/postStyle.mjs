// Checks a post's `style` (fonts, colors, backgrounds, frames). The lists
// match src/utils/postStyle.js; src/backendContract.test.js keeps them equal.
// postFonts.json is an identical copy of src/utils/postFonts.json.
import fs from 'node:fs';

// Free for everyone during the contest. After it, set this to true here AND in
// src/utils/postStyle.js to make styling a Premium feature.
export const STYLE_PREMIUM_ONLY = false;

const FONT_IDS = new Set(JSON.parse(fs.readFileSync(new URL('./postFonts.json', import.meta.url), 'utf8')).map(f => f.id));
export const BACKGROUND_IDS = ['midnight', 'plum', 'ocean', 'forest', 'wine', 'slate', 'cream', 'blush', 'sky', 'lemon', 'aura', 'dusk', 'sunset', 'tide', 'aurora', 'nightsky', 'rose', 'lagoon', 'ember', 'gold', 'peach', 'mint', 'candy', 'graphite', 'dots', 'grid', 'stripes', 'checker', 'stars', 'notebook', 'confetti', 'plaid'];
export const FRAME_IDS = ['glow', 'gold', 'silver', 'neon', 'ice', 'rainbow', 'aurora', 'sunset', 'ocean', 'ember', 'mint', 'thick'];
export const SAFE_COLORS = ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#d97706', '#65a30d', '#16a34a', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#6366f1', '#64748b'];
const SIZES = ['s', 'm', 'l', 'xl'];
const ALIGNS = ['left', 'center', 'right'];
const HEX = /^#[0-9a-f]{6}$/;
const TEXT_KEYS = ['font', 'color', 'bg', 'size', 'align', 'frame'];
const MEDIA_KEYS = ['font', 'color', 'frame'];

// Returns { style } (null when there's nothing to store) or { error }
export function checkStyle(style, type, author) {
  if (style === undefined || style === null) return { style: null };
  if (typeof style !== 'object' || Array.isArray(style)) return { error: 'Invalid style.' };
  const allowed = type === 'text' ? TEXT_KEYS : MEDIA_KEYS;
  const out = {};
  for (const [key, value] of Object.entries(style)) {
    if (!allowed.includes(key)) return { error: type === 'text' ? `Unknown style setting: ${key}.` : 'Photo and video posts can change the font, the text color and the frame.' };
    if (value === null || value === undefined || value === '') continue;
    if (typeof value !== 'string') return { error: 'Invalid style.' };
    const ok = {
      font:  () => FONT_IDS.has(value),
      color: () => HEX.test(value),
      bg:    () => BACKGROUND_IDS.includes(value) || HEX.test(value),
      size:  () => SIZES.includes(value),
      align: () => ALIGNS.includes(value),
      frame: () => FRAME_IDS.includes(value) || HEX.test(value),
    }[key]();
    if (!ok) return { error: `That ${key === 'bg' ? 'background' : key} isn't available.` };
    out[key] = value;
  }
  // Without a background, text sits on the viewer's theme (light or dark): mid-tone colors only
  if (out.color && !out.bg && !SAFE_COLORS.includes(out.color)) {
    return { error: 'Without a background, pick one of the text colors that reads on light and dark themes.' };
  }
  if (!Object.keys(out).length) return { style: null };
  if (STYLE_PREMIUM_ONLY && !author.isPremium) return { error: 'Styling posts is a Premium feature.', status: 403 };
  return { style: out };
}
