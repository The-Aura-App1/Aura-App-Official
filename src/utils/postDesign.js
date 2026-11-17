// Tinted patterns, custom gradients and custom frames for posts (part 7).
// The same file is in the app (src/utils/postDesign.js) and in aura-posts
// (postDesign.mjs); a test keeps the two equal. Posts store only checked
// parameters, never CSS: the app builds the CSS from them, and aura-posts
// refuses anything outside the bounds below (fail closed).
//
//   style.pat  = { id, c: ['#base', '#ink'], s: 's' | 'm' | 'l' }          a pattern, tinted
//   style.grad = { t: 'linear' | 'radial' | 'conic' | 'mesh', stops: [['#hex', 0..100], ...2-4], a: 0..360, grain: bool }
//   style.fr   = { w: 2..12, c: ['#hex', ...1-3], line: 'solid' | 'double' | 'dashed' | 'dotted', corner: 'round' | 'square', glow: 0..3 }

const HEX = /^#[0-9a-f]{6}$/;
const svg = body => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' ${body}</svg>`)}")`;
const SCALE = { s: 0.7, m: 1, l: 1.45 };

// Each pattern: a name and a builder from (base, ink, scale) to CSS. All are
// CSS gradients or small inline SVGs, cheap to draw on phones.
export const PATTERNS = [
  ['dots', 'Dots', (b, k, z) => `radial-gradient(${k} ${2.2 * z}px, transparent ${2.7 * z}px) 0 0 / ${18 * z}px ${18 * z}px, ${b}`],
  ['halftone', 'Halftone', (b, k, z) => `radial-gradient(${k} 22%, transparent 24%) 0 0 / ${14 * z}px ${14 * z}px, radial-gradient(${k} 12%, transparent 14%) ${7 * z}px ${7 * z}px / ${14 * z}px ${14 * z}px, ${b}`],
  ['graph', 'Graph paper', (b, k, z) => `linear-gradient(${k}55 1px, transparent 1px) 0 0 / ${20 * z}px ${20 * z}px, linear-gradient(90deg, ${k}55 1px, transparent 1px) 0 0 / ${20 * z}px ${20 * z}px, linear-gradient(${k}22 1px, transparent 1px) 0 0 / ${5 * z}px ${5 * z}px, ${b}`],
  ['stripes', 'Stripes', (b, k, z) => `repeating-linear-gradient(45deg, ${b} 0 ${12 * z}px, ${k} ${12 * z}px ${24 * z}px)`],
  ['pinstripe', 'Pinstripe', (b, k, z) => `repeating-linear-gradient(90deg, ${b} 0 ${14 * z}px, ${k}88 ${14 * z}px ${15.5 * z}px)`],
  ['waves', 'Waves', (b, k, z) => `${svg(`width='${40 * z}' height='${20 * z}' viewBox='0 0 40 20'><path d='M0 10 Q10 0 20 10 T40 10' fill='none' stroke='${k}' stroke-width='2.2' opacity='.7'/>`)} 0 0 / ${40 * z}px ${20 * z}px, ${b}`],
  ['topo', 'Topographic', (b, k, z) => `${svg(`width='${120 * z}' height='${120 * z}' viewBox='0 0 120 120'><g fill='none' stroke='${k}' stroke-width='1.3' opacity='.55'><path d='M10 60c10-30 50-40 70-20s30 50 10 60-60 10-75-10S0 80 10 60z'/><path d='M28 60c6-18 32-24 44-12s18 30 6 36-36 6-45-6-11-6-5-18z'/><path d='M44 60c3-8 14-11 20-5s8 14 2 16-16 3-20-3-4-2-2-8z'/></g>`)} 0 0 / ${120 * z}px ${120 * z}px, ${b}`],
  ['hexagons', 'Hexagons', (b, k, z) => `${svg(`width='${28 * z}' height='${49 * z}' viewBox='0 0 28 49'><g fill='none' stroke='${k}' stroke-width='1.4' opacity='.6'><path d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15z'/><path d='M14 0v9.25M14 40v9'/></g>`)} 0 0 / ${28 * z}px ${49 * z}px, ${b}`],
  ['sparkles', 'Sparkles', (b, k, z) => `${svg(`width='${60 * z}' height='${60 * z}' viewBox='0 0 60 60'><g fill='${k}'><path d='M15 8l1.6 4.4L21 14l-4.4 1.6L15 20l-1.6-4.4L9 14l4.4-1.6z' opacity='.9'/><path d='M44 34l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z' opacity='.7'/><circle cx='42' cy='12' r='1.2' opacity='.6'/><circle cx='12' cy='44' r='1' opacity='.5'/></g>`)} 0 0 / ${60 * z}px ${60 * z}px, ${b}`],
  ['halos', 'Halos', (b, k, z) => `${svg(`width='${56 * z}' height='${56 * z}' viewBox='0 0 56 56'><ellipse cx='28' cy='28' rx='14' ry='6' transform='rotate(-16 28 28)' fill='none' stroke='${k}' stroke-width='2' opacity='.55'/>`)} 0 0 / ${56 * z}px ${56 * z}px, ${b}`],
  ['grain', 'Grain', (b, k, z) => `${svg(`width='${160 * z}' height='${160 * z}'><filter id='n'><feTurbulence baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='.6'/>`)} 0 0 / ${160 * z}px ${160 * z}px, linear-gradient(135deg, ${b}, ${k}66)`],
  ['checker', 'Checker', (b, k, z) => `conic-gradient(${b} 25%, ${k} 0 50%, ${b} 0 75%, ${k} 0) 0 0 / ${32 * z}px ${32 * z}px`],
  ['confetti', 'Confetti', (b, k, z) => `radial-gradient(${k} ${2 * z}px, transparent ${2.5 * z}px) 0 0 / ${40 * z}px ${40 * z}px, radial-gradient(${k}aa ${2 * z}px, transparent ${2.5 * z}px) ${20 * z}px ${12 * z}px / ${40 * z}px ${40 * z}px, radial-gradient(${k}77 ${1.6 * z}px, transparent ${2 * z}px) ${8 * z}px ${26 * z}px / ${40 * z}px ${40 * z}px, ${b}`],
  ['chevrons', 'Chevrons', (b, k, z) => `linear-gradient(135deg, ${k} 25%, transparent 25%) -${10 * z}px 0 / ${20 * z}px ${20 * z}px, linear-gradient(225deg, ${k} 25%, transparent 25%) -${10 * z}px 0 / ${20 * z}px ${20 * z}px, linear-gradient(315deg, ${k} 25%, transparent 25%) 0 0 / ${20 * z}px ${20 * z}px, linear-gradient(45deg, ${k} 25%, ${b} 25%) 0 0 / ${20 * z}px ${20 * z}px`],
  ['crosshatch', 'Cross-hatch', (b, k, z) => `repeating-linear-gradient(45deg, ${k}55 0 1px, transparent 1px ${10 * z}px), repeating-linear-gradient(-45deg, ${k}55 0 1px, transparent 1px ${10 * z}px), ${b}`],
  ['aurora', 'Aurora blobs', (b, k) => `radial-gradient(60% 50% at 20% 30%, ${k}aa, transparent 70%), radial-gradient(50% 60% at 80% 70%, ${k}77, transparent 70%), radial-gradient(40% 40% at 70% 20%, #ffffff33, transparent 70%), ${b}`],
  ['polka', 'Polka', (b, k, z) => `radial-gradient(${k} ${6 * z}px, transparent ${6.5 * z}px) 0 0 / ${32 * z}px ${32 * z}px, radial-gradient(${k} ${6 * z}px, transparent ${6.5 * z}px) ${16 * z}px ${16 * z}px / ${32 * z}px ${32 * z}px, ${b}`],
  ['diamonds', 'Diamonds', (b, k, z) => `linear-gradient(45deg, ${k}66 25%, transparent 25% 75%, ${k}66 75%) 0 0 / ${24 * z}px ${24 * z}px, linear-gradient(-45deg, ${k}66 25%, transparent 25% 75%, ${k}66 75%) 0 0 / ${24 * z}px ${24 * z}px, ${b}`],
  ['zigzag', 'Zigzag', (b, k, z) => `${svg(`width='${24 * z}' height='${12 * z}' viewBox='0 0 24 12'><path d='M0 9 L6 3 L12 9 L18 3 L24 9' fill='none' stroke='${k}' stroke-width='2' opacity='.75'/>`)} 0 0 / ${24 * z}px ${12 * z}px, ${b}`],
  ['triangles', 'Triangles', (b, k, z) => `linear-gradient(60deg, ${k}55 25%, transparent 25.5%, transparent 75%, ${k}55 75%) 0 0 / ${24 * z}px ${42 * z}px, linear-gradient(120deg, ${k}55 25%, transparent 25.5%, transparent 75%, ${k}55 75%) 0 0 / ${24 * z}px ${42 * z}px, ${b}`],
  ['scales', 'Scales', (b, k, z) => `radial-gradient(circle at 50% 0, transparent ${9 * z}px, ${k}66 ${9.5 * z}px ${10.5 * z}px, transparent ${11 * z}px) 0 0 / ${20 * z}px ${10 * z}px, ${b}`],
  ['bricks', 'Bricks', (b, k, z) => `linear-gradient(${k}66 1.5px, transparent 1.5px) 0 0 / ${36 * z}px ${18 * z}px, linear-gradient(90deg, ${k}66 1.5px, transparent 1.5px) 0 0 / ${36 * z}px ${36 * z}px, linear-gradient(90deg, ${k}66 1.5px, transparent 1.5px) ${18 * z}px ${18 * z}px / ${36 * z}px ${36 * z}px, ${b}`],
  ['rings', 'Rings', (b, k, z) => `repeating-radial-gradient(circle at 30% 40%, ${b} 0 ${10 * z}px, ${k}55 ${10 * z}px ${12 * z}px)`],
  ['plus', 'Plus', (b, k, z) => `${svg(`width='${24 * z}' height='${24 * z}' viewBox='0 0 24 24'><path d='M12 8v8M8 12h8' stroke='${k}' stroke-width='2' stroke-linecap='round' opacity='.65'/>`)} 0 0 / ${24 * z}px ${24 * z}px, ${b}`],
  ['stars', 'Starfield', (b, k, z) => `radial-gradient(${k} 1px, transparent 1.5px) 0 0 / ${34 * z}px ${34 * z}px, radial-gradient(${k}99 1px, transparent 1.5px) ${17 * z}px ${11 * z}px / ${34 * z}px ${34 * z}px, radial-gradient(${k}66 0.8px, transparent 1.2px) ${7 * z}px ${23 * z}px / ${34 * z}px ${34 * z}px, ${b}`],
  ['rays', 'Sunburst', (b, k) => `repeating-conic-gradient(from 0deg at 50% 110%, ${b} 0 6deg, ${k}44 6deg 12deg)`],
  ['plaid', 'Plaid', (b, k, z) => `repeating-linear-gradient(0deg, ${k}44 0 ${8 * z}px, transparent ${8 * z}px ${28 * z}px), repeating-linear-gradient(90deg, ${k}44 0 ${8 * z}px, transparent ${8 * z}px ${28 * z}px), ${b}`],
];
export const PATTERN_IDS = PATTERNS.map(([id]) => id);
const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map(p => [p[0], p]));

export const GRADIENT_TYPES = ['linear', 'radial', 'conic', 'mesh'];
export const FRAME_LINES = ['solid', 'double', 'dashed', 'dotted'];
export const FRAME_CORNERS = ['round', 'square'];
const color = v => (typeof v === 'string' && HEX.test(v) ? v : null);
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const plain = v => v && typeof v === 'object' && !Array.isArray(v);

// ── Checking (the server's rules; the app uses the same ones) ──
// Each returns the cleaned value, or null when it isn't valid

export function cleanPattern(p) {
  if (!plain(p) || !PATTERN_BY_ID[p.id] || !Array.isArray(p.c) || p.c.length !== 2) return null;
  const c = p.c.map(color);
  if (c.some(x => !x)) return null;
  const s = p.s ?? 'm';
  if (!SCALE[s]) return null;
  return { id: p.id, c, s };
}

export function cleanGradient(g) {
  if (!plain(g) || !GRADIENT_TYPES.includes(g.t) || !Array.isArray(g.stops) || g.stops.length < 2 || g.stops.length > 4) return null;
  const stops = [];
  for (const st of g.stops) {
    if (!Array.isArray(st) || st.length !== 2) return null;
    const c = color(st[0]);
    const at = int(st[1], 0, 100);
    if (!c || at === null) return null;
    stops.push([c, at]);
  }
  for (let i = 1; i < stops.length; i++) if (stops[i][1] < stops[i - 1][1]) return null;
  const a = g.a === undefined ? 135 : int(g.a, 0, 360);
  if (a === null) return null;
  if (g.grain !== undefined && typeof g.grain !== 'boolean') return null;
  return { t: g.t, stops, a, grain: !!g.grain };
}

export function cleanFrame(f) {
  if (!plain(f) || !Array.isArray(f.c) || f.c.length < 1 || f.c.length > 3) return null;
  const c = f.c.map(color);
  const w = int(f.w ?? 3, 2, 12);
  const glow = int(f.glow ?? 0, 0, 3);
  const line = f.line ?? 'solid';
  const corner = f.corner ?? 'round';
  if (c.some(x => !x) || w === null || glow === null || !FRAME_LINES.includes(line) || !FRAME_CORNERS.includes(corner)) return null;
  return { w, c, line, corner, glow };
}

// ── Drawing (the app) ──

export function patternCss(p) {
  const clean = cleanPattern(p);
  return clean ? PATTERN_BY_ID[clean.id][2](clean.c[0], clean.c[1], SCALE[clean.s]) : undefined;
}

export function gradientCss(g) {
  const clean = cleanGradient(g);
  if (!clean) return undefined;
  const stops = clean.stops.map(([c, at]) => `${c} ${at}%`).join(', ');
  const grain = clean.grain ? `${svg(`width='160' height='160'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .14 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>`)} 0 0 / 160px 160px, ` : '';
  if (clean.t === 'radial') return `${grain}radial-gradient(circle at 50% 40%, ${stops})`;
  if (clean.t === 'conic') return `${grain}conic-gradient(from ${clean.a}deg at 50% 50%, ${stops}, ${clean.stops[0][0]})`;
  if (clean.t === 'mesh') {
    // soft blurred blobs of each color over the first one
    const spots = ['15% 20%', '85% 25%', '25% 85%', '80% 80%'];
    const blobs = clean.stops.slice(1).map(([c], i) => `radial-gradient(55% 55% at ${spots[i]}, ${c}, transparent 70%)`).join(', ');
    return `${grain}${blobs}, ${clean.stops[0][0]}`;
  }
  return `${grain}linear-gradient(${clean.a}deg, ${stops})`;
}

// The CSS variables read by .post-frame in index.css
export function customFrameVars(f) {
  const clean = cleanFrame(f);
  if (!clean) return null;
  const paint = clean.c.length === 1 ? clean.c[0] : `linear-gradient(135deg, ${clean.c.join(', ')})`;
  const glows = ['', `0 0 10px ${clean.c[0]}66`, `0 0 16px ${clean.c[0]}88, 0 0 30px ${clean.c[0]}44`, `0 0 22px ${clean.c[0]}aa, 0 0 44px ${clean.c[0]}66`];
  return {
    '--frame-paint': paint, '--frame-w': `${clean.w}px`, '--frame-line': clean.line, '--frame-line-color': clean.c[0],
    ...(clean.glow && { '--frame-glow': glows[clean.glow] }),
    ...(clean.corner === 'square' && { borderRadius: '4px' }),
  };
}

// ── Readability ──
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrastOf = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
// The colors text actually sits on, for a pattern or gradient
export const surfaceColors = style => (style?.pat ? [style.pat.c[0]] : style?.grad ? style.grad.stops.map(([c]) => c) : []);
// Black or white, whichever reads on every one of those colors
export function autoInk(colors) {
  if (!colors.length) return undefined;
  const worst = ink => Math.min(...colors.map(c => contrastOf(ink, c)));
  return worst('#ffffff') >= worst('#111827') ? '#ffffff' : '#111827';
}
// A chosen text color must read on every color under it
export const MIN_TEXT_CONTRAST = 3;
export const inkReads = (ink, colors) => colors.every(c => contrastOf(ink, c) >= MIN_TEXT_CONTRAST);
