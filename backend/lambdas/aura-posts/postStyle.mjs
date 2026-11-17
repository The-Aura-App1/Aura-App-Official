// Checks a post's `style` (fonts, colors, backgrounds, frames). The lists
// match src/utils/postStyle.js; src/backendContract.test.js keeps them equal.
// postFonts.json is an identical copy of src/utils/postFonts.json.
import fs from 'node:fs';
import { cleanPattern, cleanGradient, cleanFrame, surfaceColors, inkReads } from './postDesign.mjs';

// Free for everyone during the contest. After it, set this to true here AND in
// src/utils/postStyle.js to make styling a Premium feature.
export const STYLE_PREMIUM_ONLY = false;

// The font catalog: post styling and text on photos use the same one
export const FONT_IDS = new Set(JSON.parse(fs.readFileSync(new URL('./postFonts.json', import.meta.url), 'utf8')).map(f => f.id));
export const BACKGROUND_IDS = ['midnight', 'plum', 'ocean', 'forest', 'wine', 'slate', 'cream', 'blush', 'sky', 'lemon', 'aura', 'dusk', 'sunset', 'tide', 'aurora', 'nightsky', 'rose', 'lagoon', 'ember', 'gold', 'peach', 'mint', 'candy', 'graphite', 'dots', 'grid', 'stripes', 'checker', 'stars', 'notebook', 'confetti', 'plaid'];
export const FRAME_IDS = ['glow', 'gold', 'silver', 'neon', 'ice', 'rainbow', 'aurora', 'sunset', 'ocean', 'ember', 'mint', 'thick', 'bronze', 'rosegold', 'platinum', 'holo', 'glass', 'neontube', 'emerald', 'sapphire', 'ruby', 'amethyst', 'opal', 'double', 'dashed', 'dotted', 'film', 'ticket'];
export const SAFE_COLORS = ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#d97706', '#65a30d', '#16a34a', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#6366f1', '#64748b'];
const SIZES = ['s', 'm', 'l', 'xl'];
const ALIGNS = ['left', 'center', 'right'];
const HEX = /^#[0-9a-f]{6}$/;
const TEXT_KEYS = ['font', 'color', 'bg', 'size', 'align', 'frame', 'pat', 'grad', 'fr'];
const MEDIA_KEYS = ['font', 'color', 'frame', 'fr'];
// Patterns, gradients and custom frames are objects of checked parameters (postDesign.mjs)
const DESIGN = { pat: cleanPattern, grad: cleanGradient, fr: cleanFrame };

// Returns { style } (null when there's nothing to store) or { error }
// groupBgs: the 'grp:<id>' backgrounds this post may use (a level-10 group's own)
export function checkStyle(style, type, author, groupBgs = []) {
  if (style === undefined || style === null) return { style: null };
  if (typeof style !== 'object' || Array.isArray(style)) return { error: 'Invalid style.' };
  const allowed = type === 'text' ? TEXT_KEYS : MEDIA_KEYS;
  const out = {};
  for (const [key, value] of Object.entries(style)) {
    if (!allowed.includes(key)) return { error: type === 'text' ? `Unknown style setting: ${key}.` : 'Photo and video posts can change the font, the text color and the frame.' };
    if (value === null || value === undefined || value === '') continue;
    if (DESIGN[key]) {
      const clean = DESIGN[key](value);
      if (!clean) return { error: `That ${key === 'fr' ? 'frame' : key === 'pat' ? 'pattern' : 'gradient'} isn't valid.` };
      out[key] = clean;
      continue;
    }
    if (typeof value !== 'string') return { error: 'Invalid style.' };
    const ok = {
      font:  () => FONT_IDS.has(value),
      color: () => HEX.test(value),
      bg:    () => BACKGROUND_IDS.includes(value) || HEX.test(value) || groupBgs.includes(value),
      size:  () => SIZES.includes(value),
      align: () => ALIGNS.includes(value),
      frame: () => FRAME_IDS.includes(value) || HEX.test(value),
    }[key]();
    if (!ok) return { error: `That ${key === 'bg' ? 'background' : key} isn't available.` };
    out[key] = value;
  }
  // One background and one frame at most
  if ([out.bg, out.pat, out.grad].filter(Boolean).length > 1) return { error: 'Pick one background.' };
  if (out.frame && out.fr) return { error: 'Pick one frame.' };
  // On a pattern or gradient, a chosen text color has to read on every color under it
  const under = surfaceColors(out);
  if (out.color && under.length && !inkReads(out.color, under)) return { error: 'That text color is hard to read on this background. Pick another, or leave it automatic.' };
  // Without a background, text sits on the viewer's theme (light or dark): mid-tone colors only
  if (out.color && !out.bg && !under.length && !SAFE_COLORS.includes(out.color)) {
    return { error: 'Without a background, pick one of the text colors that reads on light and dark themes.' };
  }
  if (!Object.keys(out).length) return { style: null };
  if (STYLE_PREMIUM_ONLY && !author.isPremium) return { error: 'Styling posts is a Premium feature.', status: 403 };
  return { style: out };
}
