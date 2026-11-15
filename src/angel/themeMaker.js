import { POST_FONTS } from '../utils/postStyle';
import { cleanCustom, THEME_FONT_CATEGORIES, hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../themes/customTheme';

// Turns a description ("a dark ocean theme with a serif font", "fall leaf
// colors", "pure black") into a custom theme (themes/customTheme.js), and
// follow-ups into changes to the last one ("that's too grey", "darker",
// "make the accent green", "a different one"). Pure parsing: named colors,
// moods and seasons, light or dark, and a font from the self-hosted catalog.

const COLORS = {
  red: '#d63a3a', crimson: '#b8243c', scarlet: '#e0352b', maroon: '#7a1f2b', burgundy: '#7d2338', wine: '#6e1a35',
  orange: '#e8742c', amber: '#d98b1a', peach: '#f19b76', coral: '#ef6b5a', rust: '#b5502a', terracotta: '#c2501f', copper: '#b8692e', pumpkin: '#e0701e',
  yellow: '#e0b421', gold: '#c9971f', golden: '#c9971f', mustard: '#c9a227', lemon: '#e3c936', sand: '#d9b07c', beige: '#cdb594',
  green: '#2f9e5b', emerald: '#109568', forest: '#2f6f45', olive: '#6f7f2f', lime: '#7cb82f', mint: '#22a37f', sage: '#7d9a7c', jade: '#1f8f72',
  teal: '#1d8f8a', turquoise: '#1fb2a6', cyan: '#18a7c9', aqua: '#1fb8c9',
  blue: '#2f6fe0', navy: '#22336b', cobalt: '#2a4fd0', sky: '#3a9be0', azure: '#2f86e8', ocean: '#1e6fa8', sea: '#1e88a8', ice: '#3aa0d8', denim: '#3b5b92',
  indigo: '#4f46c8', violet: '#7c3aed', purple: '#8b3fd6', lavender: '#8b6fd6', lilac: '#a06fd0', plum: '#7a2f6f', grape: '#6a2fa0', amethyst: '#8a4fd6',
  pink: '#e0559b', rose: '#d94b79', magenta: '#c026d3', fuchsia: '#d02fbf', blush: '#e07a96', bubblegum: '#ec6fae', cherry: '#c8203e',
  brown: '#8a5a3c', chocolate: '#6b3f2a', coffee: '#7a5340', mocha: '#7d5a48', tan: '#b58b5e',
  grey: '#6b7280', gray: '#6b7280', silver: '#8a93a3', charcoal: '#3a3f4a', slate: '#4b5a6e', black: '#1f2430', white: '#e9ecf2', cream: '#f3e9d2', ivory: '#f6f1e3',
};
// Colors that describe the background rather than an accent: "a black
// theme" means a black background, not black buttons
const NEUTRALS = {
  black: { base: 'dark', background: '#000000', accent: '#c9ced8' },
  charcoal: { base: 'dark', background: '#15171c', accent: '#c9ced8' },
  grey: { background: '#1c1d21', light: '#eceef1', accent: '#8a93a3' },
  gray: { background: '#1c1d21', light: '#eceef1', accent: '#8a93a3' },
  silver: { background: '#1c1d21', light: '#eef0f3', accent: '#8a93a3' },
  slate: { background: '#151a22', light: '#e9edf2', accent: '#64748b' },
  white: { base: 'light', background: '#ffffff', accent: '#4b5563' },
  cream: { base: 'light', background: '#fbf6ea', accent: '#a86a3a' },
  ivory: { base: 'light', background: '#fbf8ef', accent: '#8a6a3a' },
};

// Moods, seasons and places that suggest a palette: [accent, background tint, base?]
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
  rainy: ['#5b7f9e', '#1a2129', 'dark'], rain: ['#5b7f9e', '#1a2129', 'dark'], storm: ['#6a7fb0', '#12151d', 'dark'], snow: ['#5aa7d8', '#f3f7fb', 'light'],
  arctic: ['#3aa0d8', '#eef6fb', 'light'], harvest: ['#c86a1f', '#f4e2c6', 'light'], thanksgiving: ['#b8561f', '#f2e0c8', 'light'],
  berry: ['#a3245a', '#fbe9f0', 'light'], peachy: ['#ef8a5f', '#fff0e6', 'light'], sunflower: ['#d9a21a', '#fff7dc', 'light'], lemonade: ['#d9b51a', '#fffbe0', 'light'],
  rosegold: ['#c97a6a', '#fbefea', 'light'], wine: ['#8a1f3d', '#140609', 'dark'], emo: ['#b8243c', '#050405', 'dark'], grunge: ['#7a6a4a', '#121110', 'dark'],
  pastel: ['#a68ae0', '#f6f0ff', 'light'], kawaii: ['#ec6fae', '#fff0f7', 'light'], zen: ['#6f8f6a', '#f1f2ea', 'light'], noir: ['#b8b8b8', '#050505', 'dark'],
};
// Other ways people say the same mood
const MOOD_WORDS = {
  fall: 'autumn', leaf: 'autumn', leaves: 'autumn', maple: 'autumn', pumpkins: 'autumn', foliage: 'autumn', october: 'halloween', spooky: 'spooky',
  xmas: 'christmas', holiday: 'christmas', holidays: 'christmas', winter: 'winter', snowy: 'snow', icy: 'arctic', beachy: 'beach', seaside: 'beach',
  woods: 'forest', woodland: 'forest', trees: 'forest', 'cherry blossom': 'sakura', japan: 'sakura', retrowave: 'synthwave', '80s': 'synthwave', 'y2k': 'vaporwave',
  'coffee shop': 'coffee', coffeeshop: 'coffee', cafe: 'coffee', latte: 'coffee', library: 'academia', 'dark academia': 'academia', vampire: 'gothic', goth: 'gothic',
  'rose gold': 'rosegold', monochrome: 'noir', grayscale: 'noir', greyscale: 'noir', 'black and white': 'noir',
  stormy: 'storm', cloudy: 'rain', hygge: 'cozy', candle: 'cozy', fireplace: 'cozy',
};

const DARK = /\b(dark|night|nights|nighttime|black|moody|midnight|deep|dim|gothic|oled|amoled|noir|shadowy)\b/;
const LIGHT = /\b(light|bright|white|pastel|airy|soft|day|daytime|clean|fresh)\b/;

const FONT_WORDS = [
  [/\b(serif|elegant|classic|bookish|editorial|fancy|literary)\b/, 'Serif', 'lora'],
  [/\b(mono|monospace|code|coder|techy|typewriter|terminal|hacker)\b/, 'Mono', 'jetbrains-mono'],
  [/\b(bold|display|headline|chunky|loud|poster)\b/, 'Display', 'oswald'],
  [/\b(sans|modern|clean|minimal|simple|neutral|round|rounded|friendly)\b/, 'Sans', 'nunito'],
];
const NOT_ALLOWED_FONT = /\b(script|handwrit|handwriting|cursive|calligraph)\w*\b/;

const hsl = hex => rgbToHsl(hexToRgb(hex));
const tune = (hex, dl = 0, ds = 0, dh = 0) => {
  const [h, s, l] = hsl(hex);
  return rgbToHex(hslToRgb([h + dh, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l + dl))]));
};
const cap = w => `${w[0].toUpperCase()}${w.slice(1)}`;

// Named colors in the order they appear, hex codes too
function colorsIn(text) {
  const found = [];
  for (const m of text.matchAll(/#[0-9a-f]{6}\b/gi)) found.push({ word: null, hex: m[0].toLowerCase() });
  for (const word of text.split(/[^a-z]+/)) {
    if (Object.hasOwn(COLORS, word) && !found.some(f => f.word === word)) found.push({ word, hex: COLORS[word] });
  }
  return found;
}

function moodIn(text) {
  for (const [phrase, mood] of Object.entries(MOOD_WORDS)) {
    if (phrase.includes(' ') ? text.includes(phrase) : new RegExp(`\\b${phrase}\\b`).test(text)) return mood;
  }
  return Object.keys(MOODS).find(m => new RegExp(`\\b${m}\\b`).test(text)) ?? null;
}

// The nearest everyday name for a color, so replies say "magenta", not "#e040c0"
export function colorName(hex) {
  const [h, s, l] = hsl(hex);
  if (l < 0.08) return 'black';
  if (l > 0.95 && s < 0.5) return 'white';
  if (s < 0.2 || (s < 0.3 && l > 0.75)) return l < 0.3 ? 'charcoal' : l < 0.7 ? 'grey' : 'silver';
  const [r, g, b] = hexToRgb(hex);
  let best = null;
  for (const [name, value] of Object.entries(COLORS)) {
    if (NEUTRALS[name] || ['golden', 'sky', 'ocean', 'sea', 'forest', 'coffee', 'ice', 'pumpkin'].includes(name)) continue;
    const [r2, g2, b2] = hexToRgb(value);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (!best || d < best.d) best = { name, d };
  }
  return h >= 0 && best ? best.name : 'colorful';
}

function describeBackground(spec) {
  const [, s, l] = hsl(spec.background);
  if (spec.base === 'dark') {
    if (l < 0.03) return 'a pure black background';
    if (s < 0.12) return 'a near-black background';
    return `a deep ${colorName(tune(spec.background, 0.3))} background`;
  }
  if (l > 0.985) return 'a white background';
  return `a soft ${colorName(tune(spec.background, -0.35))} background`;
}

const ASKS_VARIATION = /\b(different|another|something else|other one|other option|try again|new one|not (that|this|it|quite)|don'?t like|dont like|surprise me|again|alternative|redo|another one)\b/;
const MORE_BLACK = /\b(blacker|more black|pure black|true black|real black|jet black|pitch black|too gr[ae]y|gr[ae]yish|gr[ae]y\w* (than|thank|then|instead of) black|not black enough|oled|amoled)\b/;
// Asking for a new theme, rather than changing the last one
const NEW_THEME = /\b(make|give|create|build|design|new|want|try|show)\b.{0,30}\btheme\b|\btheme (of|in|with|like|that)\b/;
// Words that say nothing about the look, for telling "make me a theme" from "make me a cozy theme"
const PLAIN = new Set('a an the me my i you can could would please pls make give create build design new want try show theme themes app look like with for of in that this some something one it to and be is'.split(' '));
export const describesNothing = text => text.toLowerCase().split(/[^a-z]+/).filter(w => w && !PLAIN.has(w)).length === 0;

// Keeps the background on the right side of light and dark
function settle(spec) {
  const [h, s, l] = hsl(spec.background);
  if (spec.base === 'light' && l < 0.6) spec.background = rgbToHex(hslToRgb([h, Math.min(s, 0.4), 0.95]));
  if (spec.base === 'dark' && l > 0.4) spec.background = rgbToHex(hslToRgb([h, Math.min(s, 0.5), 0.09]));
  return spec;
}

/**
 * @param text the person's words
 * @param last the theme she made last in this conversation, for follow-ups
 * @returns { spec, summary, note, changed } or null when nothing in the words describes a theme
 */
export function describeTheme(text, previous = null) {
  const t = text.toLowerCase().replace(/[’]/g, "'");
  // A new request starts fresh (keeping the font they chose); anything else changes the last theme
  const fresh = !!previous && (NEW_THEME.test(t) || !!moodIn(t));
  const last = fresh ? null : previous;
  let spec = last ? { ...last } : previous?.font ? { name: 'My theme', base: 'light', background: '#f8f7ff', accent: '#7c3aed', font: previous.font } : null;
  const notes = [];
  const changed = [];
  const colors = colorsIn(t);
  const mood = moodIn(t);
  const font = POST_FONTS.find(f => THEME_FONT_CATEGORIES.includes(f.cat) && new RegExp(`\\b${f.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t))
    ?? (() => { const hit = FONT_WORDS.find(([re]) => re.test(t)); return hit ? POST_FONTS.find(f => f.id === hit[2]) : null; })();
  const tweak = /\b(darker|lighter|brighter|more vivid|more muted|muted|softer|bolder|warmer|cooler|more saturated|less saturated|duller)\b/.exec(t)?.[1];
  const variation = !!last && ASKS_VARIATION.test(t);
  const blacker = MORE_BLACK.test(t);

  if (!colors.length && !mood && !font && !tweak && !variation && !blacker && !DARK.test(t) && !LIGHT.test(t)) return null;
  if (!spec) spec = { name: 'My theme', base: 'light', background: '#f8f7ff', accent: '#7c3aed', font: null };

  // Which part a single color is meant for, when they say
  const wantsAccent = /\b(accent|buttons?|highlights?|links?|icons?)\b/.test(t);
  const wantsBackground = /\b(background|bg|backdrop|base colou?r)\b/.test(t);

  if (mood) {
    const [accent, bg, base] = MOODS[mood];
    spec.accent = accent; spec.background = bg;
    spec.base = base ?? (hsl(bg)[2] > 0.5 ? 'light' : 'dark');
    spec.name = cap(mood === 'rosegold' ? 'rose gold' : mood);
    changed.push('mood');
  }

  const hues = colors.filter(c => !c.word || !NEUTRALS[c.word]);
  // "too grey, more black" is about black, not a request for grey
  const neutrals = colors.filter(c => c.word && NEUTRALS[c.word] && !(blacker && c.word !== 'black'));
  if (colors.length && wantsAccent && !wantsBackground) {
    spec.accent = colors[0].hex; changed.push('accent');
  } else if (colors.length && wantsBackground && !wantsAccent) {
    const n = colors[0].word && NEUTRALS[colors[0].word];
    spec.background = n ? (spec.base === 'light' && n.light ? n.light : n.background) : colors[0].hex;
    if (n?.base) spec.base = n.base;
    changed.push('background');
  } else {
    if (hues[0]) { spec.accent = hues[0].hex; changed.push('accent'); }
    if (hues[1]) { spec.background = hues[1].hex; changed.push('background'); }
    else if (hues[0] && !mood && !last && !neutrals.length) spec.background = hues[0].hex;
    // a neutral sets the background (and light or dark), never the accent
    if (neutrals[0]) {
      const n = NEUTRALS[neutrals[0].word];
      if (n.base) spec.base = n.base;
      spec.background = spec.base === 'light' && n.light ? n.light : n.background;
      if (!hues.length && !mood && !last) spec.accent = n.accent;
      changed.push('background');
    }
  }
  if (DARK.test(t) && !/\bdark(er)? (blue|green|pink|purple|red|orange|teal|navy)\b/.test(t)) spec.base = 'dark';
  else if (LIGHT.test(t) && !/\blight(er)?\s+(blue|green|pink|purple|grey|gray)/.test(t)) spec.base = 'light';

  if (!mood && !last && colors.length) {
    const named = (hues[0] ?? neutrals[0])?.word;
    if (named) spec.name = neutrals[0] && !hues.length ? cap(named) : `${cap(named)}${spec.base === 'dark' ? ' night' : ''}`;
  }

  if (blacker) { spec.base = 'dark'; spec.background = '#000000'; changed.push('black'); }
  if (tweak === 'darker') {
    // already dark: a deeper background; light: switch to dark
    if (last && last.base === 'dark') spec.background = tune(spec.background, -0.06);
    spec.base = 'dark';
    spec.accent = tune(spec.accent, -0.05);
    changed.push('darker');
  }
  if (tweak === 'lighter' || tweak === 'brighter') {
    spec.accent = tune(spec.accent, 0.08);
    if (tweak === 'lighter') spec.base = 'light';
    changed.push(tweak);
  }
  if (tweak === 'more vivid' || tweak === 'bolder' || tweak === 'more saturated') { spec.accent = tune(spec.accent, 0, 0.2); changed.push('vivid'); }
  if (tweak === 'more muted' || tweak === 'muted' || tweak === 'softer' || tweak === 'less saturated' || tweak === 'duller') { spec.accent = tune(spec.accent, 0.04, -0.25); changed.push('muted'); }
  if (tweak === 'warmer') { spec.accent = tune(spec.accent, 0, 0, -18); spec.background = spec.base === 'dark' ? '#1a0f0a' : '#f6e3cf'; changed.push('warmer'); }
  if (tweak === 'cooler') { spec.accent = tune(spec.accent, 0, 0, 18); spec.background = spec.base === 'dark' ? '#0a1018' : '#e2ecf8'; changed.push('cooler'); }
  if (font) { spec.font = font.id; changed.push('font'); }

  // "A different one": keep its feel, try another accent around the color wheel
  // (also when what they asked for is already what they have)
  const nothingNew = last && spec.accent === last.accent && spec.background === last.background && spec.base === last.base && spec.font === last.font;
  if (variation && (!changed.length || nothingNew)) {
    const turns = (last.turns ?? 0) + 1;
    // a grey accent has no hue to turn, so it tries real colors instead
    spec.accent = hsl(last.accent)[1] < 0.2
      ? ['#2fb8b0', '#8b5cf6', '#e0559b', '#e8a12c', '#3a9be0'][turns % 5]
      : tune(last.accent, 0, 0, [55, 150, -70, 200, 100][turns % 5]);
    spec.turns = turns;
    changed.push('variation');
  }
  if (NOT_ALLOWED_FONT.test(t)) notes.push('For readability, app themes use sans, serif, display or mono fonts. Script and handwriting fonts are still yours to use in posts.');

  // Asking again for the same thing gets a fresh take on it, not a repeat
  if (previous && fresh && spec.accent === previous.accent && spec.background === previous.background) {
    spec.accent = tune(spec.accent, 0.04, 0, 32);
    changed.push('variation');
  }
  const clean = { ...cleanCustom(settle(spec)), turns: spec.turns ?? 0 };
  const fontName = clean.font ? POST_FONTS.find(f => f.id === clean.font)?.name : 'the standard font';
  const look = `a ${clean.base} theme with ${colorName(clean.accent)} accents on ${describeBackground(clean)}, in ${fontName}`;
  const opener = changed.includes('variation') ? `How about this: ${look}.`
    : !last ? `Here's "${clean.name}": ${look}.`
    : changed.includes('black') ? `Pure black it is: ${look}.`
    : changed.includes('darker') ? `Darker: ${look}.`
    : changed.length ? `Updated: ${look}.`
    : `Here it is: ${look}.`;
  return {
    spec: clean,
    changed,
    summary: `${opener} Try it on, or keep adjusting: "darker", "pure black", "make the accent teal", "a different one" or "use a serif font".`,
    note: notes.join(' ') || 'Your theme stays on this device. Every color is checked so text stays readable.',
  };
}

// Every mood she knows, for matching unfamiliar descriptions by meaning
export const MOOD_NAMES = Object.keys(MOODS);
