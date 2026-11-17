// A Theme Studio design (Premium): everything about a custom theme beyond
// its name, base, background, accent and font. The same file is in the app
// (src/themes/themeDesign.js) and in aura-users (themeDesign.mjs), which
// checks every design saved to an account; a test keeps the two equal.
//
//   {
//     colors:   { background, surface, elevated, border, text, textSecondary, muted, brand1, brand2, brand3 }
//               each '#rrggbb', or missing for "worked out from the basics"
//     backdrop: { kind: 'glow' | 'none' | 'gradient' | 'scene' | 'image' | 'video',
//                 type: 'linear' | 'radial' | 'conic', angle: 0..360, stops: 2-4 colors,
//                 scene: a built-in scene id, mediaId (image or video kept on this device),
//                 dim: 0..0.85, blur: 0..24 (px), animate: boolean }
//     fonts:    { heading: font id | null, scale: 0.85..1.2, weight: 400..700 }
//     shape:    { radius: 0..2, cardOpacity: 0.35..1, cardBlur: 0..24, shadow: 0..2, border: 0..3 }
//   }

export const DESIGN_COLOR_KEYS = ['background', 'surface', 'elevated', 'border', 'text', 'textSecondary', 'muted', 'brand1', 'brand2', 'brand3'];
export const BACKDROP_KINDS = ['glow', 'none', 'gradient', 'scene', 'image', 'video'];
export const GRADIENT_TYPES = ['linear', 'radial', 'conic'];
export const DESIGN_SCENES = ['sky', 'peaks', 'beach', 'city', 'aurora', 'grove', 'isles', 'deep', 'dunes', 'lanterns'];
export const DESIGN_MAX_CHARS = 4000;
const COLOR = /^#[0-9a-f]{6}$/i;
const FONT_ID = /^[a-z0-9-]{1,40}$/;
const MEDIA_ID = /^m[a-z0-9]{6,24}$/;

function clamp(value, min, max, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;
const color = value => (typeof value === 'string' && COLOR.test(value) ? value.toLowerCase() : null);

export function cleanDesign(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const colors = {};
  for (const key of DESIGN_COLOR_KEYS) {
    const c = color(raw.colors?.[key]);
    if (c) colors[key] = c;
  }

  const b = raw.backdrop && typeof raw.backdrop === 'object' ? raw.backdrop : {};
  const stops = (Array.isArray(b.stops) ? b.stops : []).map(color).filter(Boolean).slice(0, 4);
  let kind = BACKDROP_KINDS.includes(b.kind) ? b.kind : 'glow';
  if (kind === 'gradient' && stops.length < 2) kind = 'glow';
  const backdrop = {
    kind,
    type:    GRADIENT_TYPES.includes(b.type) ? b.type : 'linear',
    angle:   Math.round(clamp(b.angle, 0, 360, 160)),
    stops,
    scene:   DESIGN_SCENES.includes(b.scene) ? b.scene : 'sky',
    dim:     round(clamp(b.dim, 0, 0.85, 0.25), 2),
    blur:    Math.round(clamp(b.blur, 0, 24, 0)),
    animate: b.animate !== false,
  };
  if (typeof b.mediaId === 'string' && MEDIA_ID.test(b.mediaId)) backdrop.mediaId = b.mediaId;

  const f = raw.fonts && typeof raw.fonts === 'object' ? raw.fonts : {};
  const fonts = {
    heading: typeof f.heading === 'string' && FONT_ID.test(f.heading) ? f.heading : null,
    scale:   round(clamp(f.scale, 0.85, 1.2, 1), 2),
    weight:  Math.round(clamp(f.weight, 400, 700, 400) / 100) * 100,
  };

  const s = raw.shape && typeof raw.shape === 'object' ? raw.shape : {};
  const shape = {
    radius:      round(clamp(s.radius, 0, 2, 1), 2),
    cardOpacity: round(clamp(s.cardOpacity, 0.35, 1, 1), 2),
    cardBlur:    Math.round(clamp(s.cardBlur, 0, 24, 0)),
    shadow:      round(clamp(s.shadow, 0, 2, 1), 2),
    border:      round(clamp(s.border, 0, 3, 1), 1),
  };
  return { colors, backdrop, fonts, shape };
}

// The whole custom theme as an account stores it: the basics plus the design.
// → the cleaned theme, or null when it isn't one
export function cleanAccountTheme(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const design = cleanDesign(raw.design);
  if (!design) return null;
  // eslint-disable-next-line no-control-regex -- strips invisible and control characters on purpose
  const name = typeof raw.name === 'string' ? raw.name.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  const theme = {
    name: name || 'My theme',
    base: raw.base === 'dark' ? 'dark' : 'light',
    background: color(raw.background) ?? (raw.base === 'dark' ? '#0f0d1a' : '#f8f7ff'),
    accent: color(raw.accent) ?? '#7c3aed',
    font: typeof raw.font === 'string' && FONT_ID.test(raw.font) ? raw.font : null,
    design,
  };
  return JSON.stringify(theme).length <= DESIGN_MAX_CHARS ? theme : null;
}
