import { FONT_BY_ID, fontFamily, loadPostFont } from '../utils/postStyle';

// A custom theme: a person's own colors and font, kept on this device
// (localStorage). Their account only stores the id 'custom'; the palette
// itself never leaves the device. Angel (src/angel) builds these from a
// description; the theme builder will use the same shape.
//
//   { name, base: 'light' | 'dark', background: '#rrggbb', accent: '#rrggbb', font: postFont id | null }
//
// Every color the app needs is worked out from those, with contrast checked
// so text always reads on the backgrounds.

export const CUSTOM_KEY = 'aura-custom-theme';
const HEX = /^#[0-9a-f]{6}$/i;
// Fonts a theme may use for the app's own text: easy-reading families only,
// never script or handwriting (the app's look never uses those)
export const THEME_FONT_CATEGORIES = ['Sans', 'Serif', 'Display', 'Mono'];

// ── Color math ───────────────────────────────────────────────────────

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]) => `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = t => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const hsl = (h, s, l) => rgbToHex(hslToRgb([h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))]));

export function luminance(hex) {
  const c = hexToRgb(hex).map(v => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Darkens or lightens `hex` until it has at least `ratio` contrast on `bg`
function readable(hex, bg, ratio) {
  let [h, s, l] = rgbToHsl(hexToRgb(hex));
  const darker = luminance(bg) > 0.4;
  for (let i = 0; i < 40 && contrast(hsl(h, s, l), bg) < ratio; i++) l += darker ? -0.02 : 0.02;
  return hsl(h, s, l);
}

// ── Building and keeping a theme ─────────────────────────────────────

export function cleanCustom(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = raw.base === 'dark' ? 'dark' : 'light';
  const background = HEX.test(raw.background ?? '') ? raw.background.toLowerCase() : (base === 'dark' ? '#0f0d1a' : '#f8f7ff');
  const accent = HEX.test(raw.accent ?? '') ? raw.accent.toLowerCase() : '#7c3aed';
  const font = typeof raw.font === 'string' && Object.hasOwn(FONT_BY_ID, raw.font) && THEME_FONT_CATEGORIES.includes(FONT_BY_ID[raw.font].cat) ? raw.font : null;
  const name = typeof raw.name === 'string' ? raw.name.slice(0, 30) : 'My theme';
  return { name, base, background, accent, font };
}

// Every CSS variable a theme defines (see index.css), from the custom spec
export function customVars(spec) {
  const t = cleanCustom(spec);
  const dark = t.base === 'dark';
  const [bh, bs] = rgbToHsl(hexToRgb(t.background));
  const [ah, as] = rgbToHsl(hexToRgb(t.accent));
  // keep the background on its side of light/dark whatever was asked for
  const bgL = dark ? Math.min(rgbToHsl(hexToRgb(t.background))[2], 0.12) : Math.max(rgbToHsl(hexToRgb(t.background))[2], 0.94);
  const bg = hsl(bh, Math.min(bs, 0.5), bgL);
  const step = dark ? 0.04 : -0.035;
  const card = dark ? hsl(bh, Math.min(bs, 0.45), bgL + 0.04) : hsl(bh, Math.min(bs, 0.3), Math.min(1, bgL + 0.04));
  const elevated = hsl(bh, Math.min(bs, 0.45), bgL + step * 1.6);
  const border = hsl(bh, Math.min(bs, 0.4), bgL + step * 3);
  const text = dark ? hsl(bh, 0.3, 0.96) : hsl(bh, 0.4, 0.1);
  const accent = readable(t.accent, card, 3.2);
  const secondary = readable(hsl(ah, as, dark ? 0.75 : 0.38), card, 4.5);
  const muted = readable(hsl(bh, 0.12, dark ? 0.65 : 0.45), card, 4.5);
  // the signature gradient: the accent, with its neighbours on the color wheel
  const brand = [hsl(ah - 22, as, dark ? 0.55 : 0.45), hsl(ah, as, dark ? 0.58 : 0.46), hsl(ah + 28, as, dark ? 0.55 : 0.45)]
    .map(c => readable(c, '#ffffff', 3.1 + (dark ? 0 : 0)));
  const ink = [ah - 22, ah, ah + 28].map(h => readable(hsl(h, as, dark ? 0.75 : 0.38), card, 4.5));
  // the aura-* palette (Tailwind's aura colors) from the accent's hue
  const levels = { 950: 0.07, 900: 0.13, 850: 0.17, 800: 0.23, 700: 0.33, 600: 0.43, 500: 0.52, 400: 0.68, 300: 0.8, 200: 0.88, 100: 0.94, 50: 0.97 };
  const aura = Object.fromEntries(Object.entries(levels).map(([k, l]) => [`--aura-${k}`, hexToRgb(hsl(ah, as, l)).map(Math.round).join(' ')]));
  return {
    ...aura,
    '--bg-primary': bg, '--bg-secondary': card, '--bg-elevated': elevated, '--bg-card': card, '--border': border,
    '--text-primary': text, '--text-secondary': secondary, '--text-muted': muted,
    '--accent': accent, '--accent-hover': readable(hsl(ah, as, dark ? 0.66 : 0.38), card, 3.2), '--accent-subtle': hsl(ah, Math.min(as, 0.5), dark ? 0.16 : 0.94),
    '--brand-1': brand[0], '--brand-2': brand[1], '--brand-3': brand[2],
    '--brand-ink-1': ink[0], '--brand-ink-2': ink[1], '--brand-ink-3': ink[2],
    '--wordmark-ink': text,
  };
}

export function loadCustom() {
  try { return cleanCustom(JSON.parse(localStorage.getItem(CUSTOM_KEY))); } catch { return null; }
}
export function saveCustom(spec) {
  const clean = cleanCustom(spec);
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(clean)); } catch { /* private mode */ }
  return clean;
}

// The picker entry for the custom theme, when one exists
export function customThemeInfo() {
  const t = loadCustom();
  if (!t) return null;
  const vars = customVars(t);
  return {
    id: 'custom', name: t.name || 'My theme', base: t.base, scene: null, bar: vars['--bg-primary'], custom: true,
    description: 'Your own colors and font, on this device.',
    preview: { background: vars['--bg-primary'], card: vars['--bg-card'], text: vars['--text-primary'], muted: vars['--border'], accent: vars['--accent'] },
  };
}

// Puts the custom theme's variables (and font) on the page, or clears them
export function applyCustomVars(on) {
  const root = document.documentElement;
  const t = on ? loadCustom() : null;
  const vars = t ? customVars(t) : null;
  const all = Object.keys(customVars({ base: 'light' }));
  for (const key of all) {
    if (vars) root.style.setProperty(key, vars[key]);
    else root.style.removeProperty(key);
  }
  if (t?.font) {
    loadPostFont(t.font);
    root.style.setProperty('--custom-font', `${fontFamily(t.font)}, 'Plus Jakarta Sans Variable', system-ui, sans-serif`);
  } else {
    root.style.removeProperty('--custom-font');
  }
}
