import { POST_FONTS } from '../utils/postStyle';
import { cleanCustom, THEME_FONT_CATEGORIES, hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../themes/customTheme';

// Turns a description ("a dark ocean theme with a serif font", "warm and
// cozy, light") into a custom theme (themes/customTheme.js). Pure parsing:
// named colors, moods, light or dark, and a font from the self-hosted
// catalog. Follow-ups tweak the last theme ("darker", "use a mono font").

const COLORS = {
  red: '#d63a3a', crimson: '#b8243c', scarlet: '#e0352b', maroon: '#7a1f2b', burgundy: '#7d2338', wine: '#6e1a35',
  orange: '#e8742c', amber: '#d98b1a', peach: '#f19b76', coral: '#ef6b5a', rust: '#b5502a', terracotta: '#c2501f', copper: '#b8692e',
  yellow: '#e0b421', gold: '#c9971f', golden: '#c9971f', mustard: '#c9a227', lemon: '#e3c936', sand: '#d9b07c', beige: '#cdb594',
  green: '#2f9e5b', emerald: '#109568', forest: '#2f6f45', olive: '#6f7f2f', lime: '#7cb82f', mint: '#22a37f', sage: '#7d9a7c', jade: '#1f8f72',
  teal: '#1d8f8a', turquoise: '#1fb2a6', cyan: '#18a7c9', aqua: '#1fb8c9',
  blue: '#2f6fe0', navy: '#22336b', cobalt: '#2a4fd0', sky: '#3a9be0', azure: '#2f86e8', ocean: '#1e6fa8', sea: '#1e88a8', ice: '#3aa0d8', denim: '#3b5b92',
  indigo: '#4f46c8', violet: '#7c3aed', purple: '#8b3fd6', lavender: '#8b6fd6', lilac: '#a06fd0', plum: '#7a2f6f', grape: '#6a2fa0', amethyst: '#8a4fd6',
  pink: '#e0559b', rose: '#d94b79', magenta: '#c026d3', fuchsia: '#d02fbf', blush: '#e07a96', bubblegum: '#ec6fae', cherry: '#c8203e',
  brown: '#8a5a3c', chocolate: '#6b3f2a', coffee: '#7a5340', mocha: '#7d5a48', tan: '#b58b5e',
  grey: '#6b7280', gray: '#6b7280', silver: '#8a93a3', charcoal: '#3a3f4a', slate: '#4b5a6e', black: '#1f2430', white: '#e9ecf2',
};

// Moods and places that suggest a palette: [accent, background tint, base?]
const MOODS = {
  sunset: ['#e0703a', '#f6c08c'], sunrise: ['#e8742c', '#f8d6b0'], ocean: ['#1e88c8', '#9fd4ea'], beach: ['#1fa3b5', '#f2dcb2', 'light'],
  forest: ['#2f8f5b', '#183a2a', 'dark'], nature: ['#3f9e5b', '#d8ead2'], earthy: ['#a86a3a', '#e8dcc6'], cozy: ['#c2611f', '#f3e3cf'], warm: ['#d9772c', '#f6e1c8'],
  autumn: ['#c2501f', '#f1dcc4'], winter: ['#3aa0d8', '#e6f0fa', 'light'], spring: ['#3faf6b', '#eef8e8', 'light'], summer: ['#e8a12c', '#fff2d6', 'light'],
  calm: ['#4f86c6', '#e7eef8'], cool: ['#2f86c8', '#e4eef8'], chill: ['#4f86c6', '#e7eef8'], dreamy: ['#8b6fd6', '#eee8fb'], royal: ['#5b3fd1', '#1a1440', 'dark'],
  luxury: ['#c9971f', '#15120c', 'dark'], elegant: ['#8a6a3a', '#f4efe6'], neon: ['#c04fd8', '#0b0820', 'dark'], cyber: ['#18c9c9', '#070b18', 'dark'],
  candy: ['#e0559b', '#fde8f2', 'light'], minimal: ['#4b5563', '#f6f6f7', 'light'], space: ['#7c5ce6', '#070616', 'dark'], galaxy: ['#8b5cf6', '#0a0618', 'dark'],
  coffee: ['#8a5a3c', '#f2e8de'], midnight: ['#4f6fe0', '#070b1c', 'dark'], gothic: ['#9b1f3a', '#0b0609', 'dark'], retro: ['#e0703a', '#f4e6c8'],
  matcha: ['#5f8f3a', '#eef3e0', 'light'], lavender: ['#8b6fd6', '#f1ecfb', 'light'], strawberry: ['#d63a5a', '#fde6ea', 'light'],
  halloween: ['#e8742c', '#120a14', 'dark'], spooky: ['#e8742c', '#120a14', 'dark'], christmas: ['#c8203e', '#eef6ee', 'light'], festive: ['#c8203e', '#eef6ee', 'light'],
  valentine: ['#d94b79', '#fde8f0', 'light'], valentines: ['#d94b79', '#fde8f0', 'light'], barbie: ['#e0559b', '#fde8f2', 'light'],
  cyberpunk: ['#e040c0', '#0a0618', 'dark'], vaporwave: ['#d65fd0', '#1a0f2e', 'dark'], synthwave: ['#e0559b', '#140a24', 'dark'], lofi: ['#8b6fd6', '#1a1628', 'dark'],
  sakura: ['#e07a96', '#fdf0f3', 'light'], blossom: ['#e07a96', '#fdf0f3', 'light'], desert: ['#c9971f', '#f6ead2', 'light'], jungle: ['#2f9e5b', '#0f2418', 'dark'],
  rainforest: ['#2f9e5b', '#0f2418', 'dark'], vintage: ['#a86a3a', '#f3e9d6', 'light'], mountain: ['#4f86c6', '#e8eef4'], lake: ['#1e88a8', '#e2f0f4'],
  tropical: ['#1fb2a6', '#fff4dc', 'light'], citrus: ['#e8a12c', '#fff6dc', 'light'], cottagecore: ['#7d9a7c', '#f4efe2', 'light'], academia: ['#7a2f3a', '#efe6d6', 'light'],
  hacker: ['#22c55e', '#050a06', 'dark'], matrix: ['#22c55e', '#050a06', 'dark'], volcano: ['#e0352b', '#140806', 'dark'], fire: ['#e0352b', '#140806', 'dark'],
};

const DARK = /\b(dark|night|black|moody|midnight|deep|dim|gothic|oled|noir|shadowy)\b/;
const LIGHT = /\b(light|bright|white|pastel|airy|soft|day|daytime|clean|fresh)\b/;

const FONT_WORDS = [
  [/\b(serif|elegant|classic|bookish|editorial|fancy|literary)\b/, 'Serif', 'lora'],
  [/\b(mono|monospace|code|coder|techy|typewriter|terminal|hacker)\b/, 'Mono', 'jetbrains-mono'],
  [/\b(bold|display|headline|chunky|loud|poster)\b/, 'Display', 'oswald'],
  [/\b(sans|modern|clean|minimal|simple|neutral|round|rounded|friendly)\b/, 'Sans', 'nunito'],
];
const NOT_ALLOWED_FONT = /\b(script|handwrit|handwriting|cursive|calligraph)\w*\b/;

const tune = (hex, dl = 0, ds = 0) => {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l + dl))]));
};

function colorsIn(text) {
  const found = [];
  for (const m of text.matchAll(/#[0-9a-f]{6}\b/gi)) found.push(m[0].toLowerCase());
  for (const word of text.split(/[^a-z]+/)) if (Object.hasOwn(COLORS, word)) found.push(COLORS[word]);
  return [...new Set(found)];
}

export function describeTheme(text, last = null) {
  const t = text.toLowerCase();
  let spec = last ? { ...last } : null;
  const notes = [];
  const colors = colorsIn(t);
  const mood = Object.keys(MOODS).find(m => new RegExp(`\\b${m}\\b`).test(t));
  const font = POST_FONTS.find(f => THEME_FONT_CATEGORIES.includes(f.cat) && t.includes(f.name.toLowerCase()))
    ?? (() => { const hit = FONT_WORDS.find(([re]) => re.test(t)); return hit ? POST_FONTS.find(f => f.id === hit[2]) : null; })();
  const tweak = /\b(darker|lighter|brighter|more vivid|more muted|softer|bolder|warmer|cooler)\b/.exec(t)?.[1];

  if (!colors.length && !mood && !font && !tweak && !DARK.test(t) && !LIGHT.test(t)) return null;
  if (!spec) spec = { name: 'My theme', base: 'light', background: '#f8f7ff', accent: '#7c3aed', font: null };

  if (mood) {
    const [accent, bg, base] = MOODS[mood];
    spec.accent = accent; spec.background = bg; if (base) spec.base = base;
    spec.name = `${mood[0].toUpperCase()}${mood.slice(1)}`;
  }
  if (colors[0]) spec.accent = colors[0];
  if (colors[1]) spec.background = colors[1];
  else if (colors[0] && !mood) spec.background = colors[0];
  if (DARK.test(t)) spec.base = 'dark';
  else if (LIGHT.test(t) && !/\blight(er)?\s+(blue|green|pink|purple)/.test(t)) spec.base = 'light';
  if (!mood && colors.length) {
    const named = t.split(/[^a-z]+/).find(w => Object.hasOwn(COLORS, w));
    if (named) spec.name = `${named[0].toUpperCase()}${named.slice(1)}${spec.base === 'dark' ? ' night' : ''}`;
  }
  if (tweak === 'darker') { spec.base = 'dark'; spec.accent = tune(spec.accent, -0.06); }
  if (tweak === 'lighter' || tweak === 'brighter') { spec.accent = tune(spec.accent, 0.08); if (tweak === 'lighter') spec.base = 'light'; }
  if (tweak === 'more vivid' || tweak === 'bolder') spec.accent = tune(spec.accent, 0, 0.2);
  if (tweak === 'more muted' || tweak === 'softer') spec.accent = tune(spec.accent, 0.04, -0.25);
  if (tweak === 'warmer') { spec.accent = tune(spec.accent); spec.background = '#f6e3cf'; }
  if (tweak === 'cooler') { spec.accent = tune(spec.accent); spec.background = '#e2ecf8'; }
  if (font) spec.font = font.id;
  if (NOT_ALLOWED_FONT.test(t)) notes.push('For readability, app themes use sans, serif, display or mono fonts. Script and handwriting fonts are still yours to use in posts.');

  const clean = cleanCustom(spec);
  const fontName = clean.font ? POST_FONTS.find(f => f.id === clean.font)?.name : 'the standard font';
  return {
    spec: clean,
    summary: `Here's "${clean.name}": ${clean.base} with ${clean.accent} as the accent, in ${fontName}. Try it on; you can say things like "darker", "more muted" or "use a serif font" to adjust it.`,
    note: notes.join(' ') || 'Your theme stays on this device. Every color is checked so text stays readable.',
  };
}
