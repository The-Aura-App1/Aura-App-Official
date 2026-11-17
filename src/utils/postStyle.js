import FONT_LIST from './postFonts.json';
import { cleanPattern, cleanGradient, cleanFrame, patternCss, gradientCss, customFrameVars, surfaceColors, autoInk, inkReads } from './postDesign';

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
  // 2026-11-16: metals, gems, glass, holographic and line styles
  { id: 'bronze',   name: 'Bronze',      paint: 'linear-gradient(135deg, #f3c08a, #8a4b1f, #e8a86a, #5c3110)', width: 3 },
  { id: 'rosegold', name: 'Rose gold',   paint: 'linear-gradient(135deg, #ffd6cc, #c97b6b, #f5c0b0, #8f4d43)', width: 3 },
  { id: 'platinum', name: 'Platinum',    paint: 'linear-gradient(135deg, #ffffff, #b8c2cc, #eef2f5, #7d8893)', width: 3, glow: '0 0 12px rgba(220,230,240,.35)' },
  { id: 'holo',     name: 'Holographic', paint: 'conic-gradient(from 30deg, #ff9ad5, #a6f0ff, #c8ffb0, #fff3a6, #ffb3a7, #d3a6ff, #ff9ad5)', width: 3, glow: '0 0 16px rgba(200,170,255,.4)' },
  { id: 'glass',    name: 'Glass',       paint: 'linear-gradient(160deg, rgba(255,255,255,.85), rgba(255,255,255,.15) 45%, rgba(255,255,255,.6))', width: 3, glow: '0 8px 24px rgba(255,255,255,.12)' },
  { id: 'neontube', name: 'Neon tube',   paint: '#38f2ff', width: 3, glow: '0 0 6px #38f2ff, 0 0 18px rgba(56,242,255,.7), 0 0 40px rgba(56,242,255,.35)' },
  { id: 'emerald',  name: 'Emerald',     paint: 'linear-gradient(135deg, #a7f3d0, #047857, #34d399, #064e3b)', width: 3, glow: '0 0 14px rgba(16,185,129,.35)' },
  { id: 'sapphire', name: 'Sapphire',    paint: 'linear-gradient(135deg, #bfdbfe, #1d4ed8, #60a5fa, #1e3a8a)', width: 3, glow: '0 0 14px rgba(59,130,246,.35)' },
  { id: 'ruby',     name: 'Ruby',        paint: 'linear-gradient(135deg, #fecdd3, #be123c, #fb7185, #881337)', width: 3, glow: '0 0 14px rgba(225,29,72,.35)' },
  { id: 'amethyst', name: 'Amethyst',    paint: 'linear-gradient(135deg, #e9d5ff, #7e22ce, #c084fc, #581c87)', width: 3, glow: '0 0 14px rgba(147,51,234,.35)' },
  { id: 'opal',     name: 'Opal',        paint: 'linear-gradient(135deg, #f0fdff, #fbcfe8, #c7d2fe, #bbf7d0, #fef9c3)', width: 4 },
  { id: 'double',   name: 'Double line', paint: 'var(--text-primary)', lineColor: 'var(--text-primary)', line: 'double', width: 6 },
  { id: 'dashed',   name: 'Dashed',      paint: '#a855f7', lineColor: '#a855f7', line: 'dashed', width: 3 },
  { id: 'dotted',   name: 'Dotted',      paint: '#f472b6', lineColor: '#f472b6', line: 'dotted', width: 4 },
  { id: 'film',     name: 'Film strip',  paint: '#111827', lineColor: '#111827', line: 'dashed', width: 9 },
  { id: 'ticket',   name: 'Ticket',      paint: '#f59e0b', lineColor: '#f59e0b', line: 'dotted', width: 6 },
];
export const FRAME_BY_ID = Object.fromEntries(POST_FRAMES.map(f => [f.id, f]));

export const SIZES = ['s', 'm', 'l', 'xl'];
export const ALIGNS = ['left', 'center', 'right'];
const SIZE_REM = { s: 1, m: 1.3, l: 1.7, xl: 2.2 };

// Only the keys a post type may carry: backgrounds, size and alignment are for text posts
export const STYLE_KEYS = { text: ['font', 'color', 'bg', 'size', 'align', 'frame', 'pat', 'grad', 'fr'], media: ['font', 'color', 'frame', 'fr'] };
const DESIGN = { pat: cleanPattern, grad: cleanGradient, fr: cleanFrame };

// Whether a text post is drawn as a designed card: any background, a tinted
// pattern (pat) or a custom gradient (grad)
export const hasCard = style => !!(style?.bg || style?.pat || style?.grad);

// Drops empty values and anything the post type can't use; null when nothing is left
export function cleanStyle(style, type) {
  const keys = STYLE_KEYS[type === 'text' ? 'text' : 'media'];
  const out = {};
  for (const k of keys) {
    if (!style?.[k]) continue;
    if (DESIGN[k]) { const clean = DESIGN[k](style[k]); if (clean) out[k] = clean; } else out[k] = style[k];
  }
  // one background and one frame (the newest choice wins)
  if (out.pat) { delete out.grad; delete out.bg; } else if (out.grad) delete out.bg;
  if (out.fr) delete out.frame;
  const under = surfaceColors(out);
  if (out.color && under.length && !inkReads(out.color, under)) delete out.color;
  if (out.color && !hasCard(out) && !SAFE_COLORS.includes(out.color)) delete out.color;
  return Object.keys(out).length ? out : null;
}

const bgCss = bg => (bg ? (BACKGROUND_BY_ID[bg]?.css ?? (HEX.test(bg) ? bg : undefined)) : undefined);

// Black or white, whichever reads better on a custom background color
export function inkFor(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#ffffff';
}

const MEDIA_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com/';
// A level-10 group's own background ('grp:<id>'): its picture, softly darkened, and the text color its owner picked
export const groupBgCss = groupBg => (groupBg?.key
  ? `linear-gradient(rgba(0,0,0,.16), rgba(0,0,0,.16)), url("${MEDIA_URL}${groupBg.key}") center / cover no-repeat` : undefined);

// Styles for a text post's card (groupBg: the post's copy of its group background)
export function textCardStyle(style, length = 0, groupBg = null) {
  if (!style) return null;
  const bg = style.bg;
  const card = hasCard(style);
  const fromGroup = bg?.startsWith('grp:');
  const designed = style.pat ? patternCss(style.pat) : style.grad ? gradientCss(style.grad) : undefined;
  const ink = style.color ?? (designed ? autoInk(surfaceColors(style)) : fromGroup ? groupBg?.ink ?? '#ffffff'
    : bg ? (BACKGROUND_BY_ID[bg]?.ink ?? (HEX.test(bg) ? inkFor(bg) : undefined)) : undefined);
  // Long text steps down so it still fits the card
  let size = SIZE_REM[style.size] ?? (card ? SIZE_REM.m : undefined);
  if (size && length > 400) size = Math.min(size, SIZE_REM.s);
  else if (size && length > 200) size = Math.min(size, SIZE_REM.m);
  return {
    background: designed ?? (fromGroup ? groupBgCss(groupBg) ?? '#334155' : bgCss(bg)),
    color: ink,
    fontFamily: fontFamily(style.font),
    fontSize: size ? `${size}rem` : undefined,
    textAlign: style.align ?? (card ? 'center' : undefined),
  };
}

export function captionStyle(style) {
  if (!style) return null;
  return { fontFamily: fontFamily(style.font), color: style.color };
}

// CSS variables read by .post-frame in index.css
export function frameStyle(style) {
  if (style?.fr) return customFrameVars(style.fr);
  const frame = style?.frame;
  if (!frame) return null;
  const f = FRAME_BY_ID[frame] ?? (HEX.test(frame) ? { paint: frame, width: 3 } : null);
  if (!f) return null;
  return { '--frame-paint': f.paint, '--frame-w': `${f.width}px`, ...(f.glow && { '--frame-glow': f.glow }),
    ...(f.line && { '--frame-line': f.line, '--frame-line-color': f.lineColor ?? f.paint }) };
}
