import FONT_LIST from './postFonts.json';

// Post customization: fonts, text colors, backgrounds (text posts), and frames
// (any post). A post stores only what its author changed, as `style`:
//   { font, color, bg, size, align, frame }
// aura-posts checks every value against the same lists (backend/lambdas/aura-posts/postStyle.mjs;
// src/backendContract.test.js keeps them equal).

// Free for everyone during the contest. After it, set this to true here AND in
// aura-posts' postStyle.mjs to make styling a Premium feature.
export const STYLE_PREMIUM_ONLY = false;

export const HEX = /^#[0-9a-f]{6}$/;

// ── Fonts ── self-hosted in public/fonts/post/<id>.woff2 (scripts/fetch-post-fonts.mjs)
export const POST_FONTS = FONT_LIST;
export const FONT_BY_ID = Object.fromEntries(POST_FONTS.map(f => [f.id, f]));
export const FONT_CATEGORIES = ['Sans', 'Serif', 'Display', 'Script', 'Handwriting', 'Mono'];
const FALLBACK = {
  Sans: 'system-ui, sans-serif', Serif: 'Georgia, serif', Display: 'system-ui, sans-serif',
  Script: 'cursive', Handwriting: 'cursive', Mono: 'ui-monospace, monospace',
};

const loaded = new Map();
// Fetches a post font the first time something on screen uses it
export function loadPostFont(id) {
  if (!FONT_BY_ID[id] || loaded.has(id) || typeof FontFace === 'undefined' || !document.fonts) return;
  const face = new FontFace(`aura-post-${id}`, `url(/fonts/post/${id}.woff2) format('woff2')`, { display: 'swap' });
  loaded.set(id, face);
  document.fonts.add(face);
  face.load().catch(() => {});
}

export function fontFamily(id) {
  const font = FONT_BY_ID[id];
  return font ? `'aura-post-${id}', ${FALLBACK[font.cat]}` : undefined;
}

// ── Text colors ──
// Without a background the text sits on the viewer's theme, which may be light
// or dark, so only these mid-tone colors (readable on both) are allowed there.
export const SAFE_COLORS = ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#d97706',
  '#65a30d', '#16a34a', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#6366f1', '#64748b'];
// On a background, any color goes; these are the quick picks
export const CARD_COLORS = ['#ffffff', '#f8fafc', '#fde68a', '#fbcfe8', '#c4b5fd', '#a5f3fc', '#bbf7d0', '#111827',
  '#1e1b4b', '#7c2d12', ...SAFE_COLORS.slice(0, 6)];

// ── Backgrounds (text posts) ── ink is the text color used when none is picked
export const POST_BACKGROUNDS = [
  // Solid
  { id: 'midnight', name: 'Midnight', kind: 'Solid', css: '#0f172a', ink: '#f8fafc' },
  { id: 'plum',     name: 'Plum',     kind: 'Solid', css: '#3b0764', ink: '#f5f3ff' },
  { id: 'ocean',    name: 'Deep sea', kind: 'Solid', css: '#0c4a6e', ink: '#f0f9ff' },
  { id: 'forest',   name: 'Forest',   kind: 'Solid', css: '#14532d', ink: '#f0fdf4' },
  { id: 'wine',     name: 'Wine',     kind: 'Solid', css: '#7f1d1d', ink: '#fef2f2' },
  { id: 'slate',    name: 'Slate',    kind: 'Solid', css: '#334155', ink: '#f8fafc' },
  { id: 'cream',    name: 'Cream',    kind: 'Solid', css: '#fdf6e3', ink: '#1f2937' },
  { id: 'blush',    name: 'Blush',    kind: 'Solid', css: '#fce7f3', ink: '#831843' },
  { id: 'sky',      name: 'Sky',      kind: 'Solid', css: '#e0f2fe', ink: '#0c4a6e' },
  { id: 'lemon',    name: 'Lemon',    kind: 'Solid', css: '#fef9c3', ink: '#713f12' },
  // Gradient
  { id: 'aura',     name: 'Aura',     kind: 'Gradient', css: 'linear-gradient(135deg, #7c3aed, #c026d3)', ink: '#ffffff' },
  { id: 'dusk',     name: 'Dusk',     kind: 'Gradient', css: 'linear-gradient(160deg, #1e1b4b, #7c3aed 55%, #f472b6)', ink: '#ffffff' },
  { id: 'sunset',   name: 'Sunset',   kind: 'Gradient', css: 'linear-gradient(135deg, #f97316, #db2777)', ink: '#ffffff' },
  { id: 'tide',     name: 'Tide',     kind: 'Gradient', css: 'linear-gradient(135deg, #0ea5e9, #1e3a8a)', ink: '#ffffff' },
  { id: 'aurora',   name: 'Aurora',   kind: 'Gradient', css: 'linear-gradient(135deg, #0891b2, #7c3aed 50%, #db2777)', ink: '#ffffff' },
  { id: 'nightsky', name: 'Night sky', kind: 'Gradient', css: 'linear-gradient(180deg, #020617, #1e3a8a)', ink: '#e0e7ff' },
  { id: 'rose',     name: 'Rose',     kind: 'Gradient', css: 'linear-gradient(135deg, #fb7185, #9f1239)', ink: '#ffffff' },
  { id: 'lagoon',   name: 'Lagoon',   kind: 'Gradient', css: 'linear-gradient(135deg, #14b8a6, #0f766e)', ink: '#ffffff' },
  { id: 'ember',    name: 'Ember',    kind: 'Gradient', css: 'linear-gradient(135deg, #facc15, #ef4444)', ink: '#ffffff' },
  { id: 'gold',     name: 'Gold',     kind: 'Gradient', css: 'linear-gradient(135deg, #fbbf24, #b45309)', ink: '#ffffff' },
  { id: 'peach',    name: 'Peach',    kind: 'Gradient', css: 'linear-gradient(135deg, #fed7aa, #fbcfe8)', ink: '#7c2d12' },
  { id: 'mint',     name: 'Mint',     kind: 'Gradient', css: 'linear-gradient(135deg, #a7f3d0, #bae6fd)', ink: '#134e4a' },
  { id: 'candy',    name: 'Candy',    kind: 'Gradient', css: 'linear-gradient(135deg, #f9a8d4, #c4b5fd)', ink: '#4c1d95' },
  { id: 'graphite', name: 'Graphite', kind: 'Gradient', css: 'linear-gradient(135deg, #111111, #4b5563)', ink: '#f9fafb' },
  // Pattern
  { id: 'dots',     name: 'Dots',     kind: 'Pattern', css: 'radial-gradient(rgba(255,255,255,.22) 2px, transparent 2.5px) 0 0 / 18px 18px, #6d28d9', ink: '#ffffff' },
  { id: 'grid',     name: 'Grid',     kind: 'Pattern', css: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px) 0 0 / 22px 22px, #1e293b', ink: '#f8fafc' },
  { id: 'stripes',  name: 'Stripes',  kind: 'Pattern', css: 'repeating-linear-gradient(45deg, #db2777 0 14px, #be185d 14px 28px)', ink: '#ffffff' },
  { id: 'checker',  name: 'Checker',  kind: 'Pattern', css: 'conic-gradient(#f5ead6 25%, #fdf6e3 0 50%, #f5ead6 0 75%, #fdf6e3 0) 0 0 / 32px 32px', ink: '#1f2937' },
  { id: 'stars',    name: 'Stars',    kind: 'Pattern', css: 'radial-gradient(#fff 1px, transparent 1.5px) 0 0 / 34px 34px, radial-gradient(rgba(255,255,255,.6) 1px, transparent 1.5px) 17px 11px / 34px 34px, #0b1026', ink: '#e0e7ff' },
  { id: 'notebook', name: 'Notebook', kind: 'Pattern', css: 'linear-gradient(90deg, transparent 38px, rgba(239,68,68,.35) 38px 40px, transparent 40px), repeating-linear-gradient(#fdfcf7 0 27px, #bfdbfe 27px 28px)', ink: '#1e3a8a' },
  { id: 'confetti', name: 'Confetti', kind: 'Pattern', css: 'radial-gradient(#facc15 2px, transparent 2.5px) 0 0 / 40px 40px, radial-gradient(#38bdf8 2px, transparent 2.5px) 20px 12px / 40px 40px, radial-gradient(#f472b6 2px, transparent 2.5px) 8px 26px / 40px 40px, #1e1b4b', ink: '#ffffff' },
  { id: 'plaid',    name: 'Plaid',    kind: 'Pattern', css: 'repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 8px, transparent 8px 28px), repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 8px, transparent 8px 28px), #b91c1c', ink: '#ffffff' },
];
export const BACKGROUND_BY_ID = Object.fromEntries(POST_BACKGROUNDS.map(b => [b.id, b]));
export const BACKGROUND_KINDS = ['Solid', 'Gradient', 'Pattern'];

// ── Frames (any post) ── paint fills the border; glow is an optional shadow
export const POST_FRAMES = [
  { id: 'glow',    name: 'Aura glow', paint: '#a855f7', width: 2, glow: '0 0 18px rgba(168,85,247,.55)' },
  { id: 'gold',    name: 'Gold',      paint: 'linear-gradient(135deg, #fde68a, #b45309, #fde68a, #92400e)', width: 3 },
  { id: 'silver',  name: 'Silver',    paint: 'linear-gradient(135deg, #f8fafc, #94a3b8, #f1f5f9, #64748b)', width: 3 },
  { id: 'neon',    name: 'Neon',      paint: '#ec4899', width: 2, glow: '0 0 14px rgba(236,72,153,.7), 0 0 30px rgba(236,72,153,.35)' },
  { id: 'ice',     name: 'Ice',       paint: '#67e8f9', width: 2, glow: '0 0 16px rgba(103,232,249,.5)' },
  { id: 'rainbow', name: 'Rainbow',   paint: 'linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef)', width: 3 },
  { id: 'aurora',  name: 'Aurora',    paint: 'linear-gradient(135deg, #22d3ee, #a855f7, #ec4899)', width: 3 },
  { id: 'sunset',  name: 'Sunset',    paint: 'linear-gradient(135deg, #f97316, #db2777)', width: 3 },
  { id: 'ocean',   name: 'Ocean',     paint: 'linear-gradient(135deg, #38bdf8, #1e40af)', width: 3 },
  { id: 'ember',   name: 'Ember',     paint: 'linear-gradient(135deg, #facc15, #dc2626)', width: 3, glow: '0 0 16px rgba(239,68,68,.35)' },
  { id: 'mint',    name: 'Mint',      paint: 'linear-gradient(135deg, #6ee7b7, #0d9488)', width: 3 },
  { id: 'thick',   name: 'Bold',      paint: 'var(--text-primary)', width: 4 },
];
export const FRAME_BY_ID = Object.fromEntries(POST_FRAMES.map(f => [f.id, f]));

export const SIZES = ['s', 'm', 'l', 'xl'];
export const ALIGNS = ['left', 'center', 'right'];
const SIZE_REM = { s: 1, m: 1.3, l: 1.7, xl: 2.2 };

// Only the keys a post type may carry: backgrounds, size and alignment are for text posts
export const STYLE_KEYS = { text: ['font', 'color', 'bg', 'size', 'align', 'frame'], media: ['font', 'color', 'frame'] };

// Drops empty values and anything the post type can't use; null when nothing is left
export function cleanStyle(style, type) {
  const keys = STYLE_KEYS[type === 'text' ? 'text' : 'media'];
  const out = {};
  for (const k of keys) if (style?.[k]) out[k] = style[k];
  if (out.color && !out.bg && !SAFE_COLORS.includes(out.color)) delete out.color;
  return Object.keys(out).length ? out : null;
}

const bgCss = bg => (bg ? (BACKGROUND_BY_ID[bg]?.css ?? (HEX.test(bg) ? bg : undefined)) : undefined);

// Black or white, whichever reads better on a custom background color
export function inkFor(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#ffffff';
}

// Styles for a text post's card
export function textCardStyle(style, length = 0) {
  if (!style) return null;
  const bg = style.bg;
  const ink = style.color ?? (bg ? (BACKGROUND_BY_ID[bg]?.ink ?? (HEX.test(bg) ? inkFor(bg) : undefined)) : undefined);
  // Long text steps down so it still fits the card
  let size = SIZE_REM[style.size] ?? (bg ? SIZE_REM.m : undefined);
  if (size && length > 400) size = Math.min(size, SIZE_REM.s);
  else if (size && length > 200) size = Math.min(size, SIZE_REM.m);
  return {
    background: bgCss(bg),
    color: ink,
    fontFamily: fontFamily(style.font),
    fontSize: size ? `${size}rem` : undefined,
    textAlign: style.align ?? (bg ? 'center' : undefined),
  };
}

export function captionStyle(style) {
  if (!style) return null;
  return { fontFamily: fontFamily(style.font), color: style.color };
}

// CSS variables read by .post-frame in index.css
export function frameStyle(style) {
  const frame = style?.frame;
  if (!frame) return null;
  const f = FRAME_BY_ID[frame] ?? (HEX.test(frame) ? { paint: frame, width: 3 } : null);
  if (!f) return null;
  return { '--frame-paint': f.paint, '--frame-w': `${f.width}px`, ...(f.glow && { '--frame-glow': f.glow }) };
}
