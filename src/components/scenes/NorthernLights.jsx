import React from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';
import ShootingStars from './ShootingStars';
import ChimneySmoke from './ChimneySmoke';
import { ridgePoints, areaUnder, lineThrough, spruceRow, smoothThrough } from './terrain';
import { ridge, snowPath, shadePaths, fogPath } from './SnowyPeaks';
import './dreamscapes.css';

// Northern Lights: a polar night over a frozen lake. Aurora curtains fold
// and sway overhead with rays that thin out upward, their light catching
// the mountain ridges and mirrored, softer, in the ice. Spruce forests
// carry snow on every tier; a tent glows on the shore beside a campfire.
//
// Every depth layer is its own <svg> so the browser draws the static ones
// once and only moves what's animated (curtains, smoke, flame, mist, snow).

const W = 1600;
const H = 600;          // the landscape's drawing height (same as Snowy Peaks, whose ridges it shares)
const SHORE = 432;      // where the far shore meets the ice
const AURORA_H = 600;   // the aurora's drawing height

// ── Aurora ──────────────────────────────────────────────────────────

// A curtain: an arc across the sky (its hem rising from `from` on the left
// to `to` on the right) that folds back and forth, with rays rising from
// the hem to a ragged top.
function curtain(seed, { from, to, fold, height }) {
  const rand = seeded(seed);
  const n = 44;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const x = -250 + t * (W + 500);
    const y = from + (to - from) * t + Math.sin(t * 9 + seed) * fold + Math.sin(t * 23 + seed * 2) * fold * 0.3;
    const h = height * (0.45 + 0.55 * Math.abs(Math.sin(t * 5 + seed * 1.7)) + rand() * 0.12);
    return [x, y, h];
  });
  const hem = smoothThrough(pts.map(([x, y]) => [x, y]));
  // Thin slices, so each one's fade starts at its own stretch of hem
  const slices = pts.slice(0, -1).map(([x, y, h], i) => {
    const [x2, y2, h2] = pts[i + 1];
    return `M ${x.toFixed(1)} ${y.toFixed(1)} L ${(x2 + 0.6).toFixed(1)} ${y2.toFixed(1)} L ${(x2 + 0.6).toFixed(1)} ${(y2 - h2).toFixed(1)} L ${x.toFixed(1)} ${(y - h).toFixed(1)} Z`;
  });
  return { slices, hem };
}

const CURTAINS = [
  { key: 'high', ...curtain(17, { from: 180, to: 120, fold: 26, height: 150 }), hemColor: '#f0a8ff', mid: '#a37cff', top: '#5b6dff', className: 'aura-nl-curtain-high', opacity: 0.38, seed: 9 },
  { key: 'side', ...curtain(11, { from: 300, to: 470, fold: 42, height: 230 }), hemColor: '#b4fff0', mid: '#25c7b3', top: '#7b6bff', className: 'aura-nl-curtain-side', opacity: 0.6,  seed: 7 },
  { key: 'main', ...curtain(5,  { from: 540, to: 440, fold: 50, height: 340 }), hemColor: '#c4ffe6', mid: '#2fe0a2', top: '#d06bff', className: 'aura-nl-curtain-main', opacity: 0.95, seed: 5 },
];

// One curtain in its own SVG. The rays are a stretched noise texture cut to
// the curtain's shape, over a soft glow of the same shape, plus a bright hem.
// All static: the wrapper's CSS animation moves the finished picture.
function Curtain({ c, prefix }) {
  const id = `${prefix}-${c.key}`;
  return (
    <div className={`aura-nl-curtain ${c.className}`} style={{ opacity: c.opacity }}>
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${AURORA_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={c.hemColor} stopOpacity="1" />
            <stop offset="18%" stopColor={c.mid} stopOpacity="0.85" />
            <stop offset="55%" stopColor={c.mid} stopOpacity="0.35" />
            <stop offset="80%" stopColor={c.top} stopOpacity="0.18" />
            <stop offset="100%" stopColor={c.top} stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-rays`} x="-5%" y="-25%" width="110%" height="150%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.016 0.0007" numOctaves="2" seed={c.seed} result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.6 0 0 0 -0.75" result="streaks" />
            <feComposite in="SourceGraphic" in2="streaks" operator="in" result="rays" />
            <feGaussianBlur in="rays" stdDeviation="1.2" result="soft" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="glow" />
            <feColorMatrix in="glow" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0" result="glowSoft" />
            <feMerge><feMergeNode in="glowSoft" /><feMergeNode in="soft" /></feMerge>
          </filter>
          <filter id={`${id}-hem`} x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <g fill={`url(#${id}-g)`} filter={`url(#${id}-rays)`}>
          {c.slices.map((d, i) => <path key={i} d={d} />)}
        </g>
        <path d={c.hem} fill="none" stroke={c.hemColor} strokeWidth="9" strokeOpacity="0.2" filter={`url(#${id}-hem)`} />
      </svg>
    </div>
  );
}

function Aurora({ prefix }) {
  return CURTAINS.map(c => <Curtain key={c.key} c={c} prefix={prefix} />);
}

// ── Land ────────────────────────────────────────────────────────────

// Two ranges drawn with Snowy Peaks' ridges, in moonless night colors
const NIGHT_RANGES = [
  { seed: 8,  peaks: 5, top: 150, bottom: 250, valley: 330, rock: '#263f60', snow: '#b4c8e2', depth: 75, shade: 0.55 },
  { seed: 19, peaks: 6, top: 250, bottom: 330, valley: 405, rock: '#15283f', snow: '#7e98bb', depth: 50, shade: 0.6 },
].map(r => {
  const { path, apexes, rand } = ridge(r.seed, r);
  return { ...r, path, snowD: snowPath(apexes, rand, r.depth), shades: shadePaths(apexes, rand), fogD: fogPath(r.seed, r.valley) };
});
const FAR_FOREST = spruceRow(21, { base: SHORE + 4, minH: 18, maxH: 38, step: [5, 8], baseJitter: 4 });
const SHORE_LINE = ridgePoints(33, { y: SHORE, amp: 10, rough: 0.6, passes: 6 });
const NEAR_BANK = ridgePoints(45, { y: 526, amp: 40, rough: 0.55, anchors: [[300, 492], [800, 540], [1300, 498]] });
const NEAR_LEFT = spruceRow(57, { x0: -40, x1: 620, base: 540, minH: 80, maxH: 230, step: [16, 26], gaps: [[380, 470]] });
const NEAR_RIGHT = spruceRow(63, { x0: 1040, x1: 1660, base: 532, minH: 90, maxH: 250, step: [16, 26] });
// The snowbank's height at x, so the tent and fire stand on it, not the ice
function bankAt(x) {
  const i = NEAR_BANK.findIndex(([px]) => px >= x);
  if (i <= 0) return NEAR_BANK[0][1];
  const [[x0, y0], [x1, y1]] = [NEAR_BANK[i - 1], NEAR_BANK[i]];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}
const TENT_X = 900;
// the lowest bank under the tent's footprint, plus a little so it sits in the snow
const TENT_Y = Math.max(...[-46, -20, 0, 30].map(dx => bankAt(TENT_X + dx))) + 8;
const FIRE_Y = TENT_Y + 4; // the fire burns on its logs, beside the tent

const SPARKS = Array.from({ length: 7 }, (_, i) => ({ dx: ((i * 7) % 9) - 4, delay: i * 0.45, dur: 2.4 + (i % 3) * 0.6 }));

function Land({ page }) {
  return (
    <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[56vh] min-h-[300px]' : 'h-[46vh] min-h-[250px]'}`}>
      {/* The ranges, backlit by the aurora, with mist in the valleys */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          {NIGHT_RANGES.map((r, i) => <clipPath key={i} id={`nl-clip-${i}`}><path d={r.path} /></clipPath>)}
          {NIGHT_RANGES.flatMap((r, i) => r.shades.map((sh, j) => (
            <linearGradient key={`${i}-${j}`} id={`nl-shade-${i}-${j}`} gradientUnits="userSpaceOnUse" x1={sh.from} y1="0" x2={sh.to} y2="0">
              <stop offset="0%" stopColor="#050c1c" />
              <stop offset="45%" stopColor="#050c1c" />
              <stop offset="100%" stopColor="#050c1c" stopOpacity="0" />
            </linearGradient>
          )))}
          <linearGradient id="nl-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9fe6d6" stopOpacity="0" />
            <stop offset="55%" stopColor="#9fe6d6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#9fe6d6" stopOpacity="0" />
          </linearGradient>
          <filter id="nl-backlight" x="-5%" y="-20%" width="110%" height="140%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="nl-fog-soft" x="-5%" y="-50%" width="110%" height="200%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>
        {NIGHT_RANGES.map((r, i) => (
          <g key={i}>
            {/* the aurora's glow behind the ridge */}
            <path d={r.path} fill="#5cf0c2" opacity={i ? 0.12 : 0.22} transform="translate(0 -6)" filter="url(#nl-backlight)" />
            <path d={r.path} fill={r.rock} />
            <g clipPath={`url(#nl-clip-${i})`}>
              <path d={r.snowD} fill={r.snow} />
              {r.shades.map((sh, j) => <path key={j} d={sh.d} fill={`url(#nl-shade-${i}-${j})`} opacity={r.shade} />)}
            </g>
            <path d={r.fogD} fill="url(#nl-mist)" filter="url(#nl-fog-soft)" />
          </g>
        ))}
        <path d={FAR_FOREST.d} fill="#071526" />
        <path d={FAR_FOREST.snow} fill="none" stroke="#9db8d6" strokeOpacity="0.45" strokeWidth="1" />
      </svg>

      {/* The frozen lake, with the aurora mirrored in it */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: `${(SHORE / H) * 100}%` }}>
        <div className="aura-nl-reflection absolute inset-x-0 top-0 origin-top" style={{ height: page ? '74vh' : '78vh', transform: `translateY(${page ? 56 : 60}vh) scaleY(-1)` }}>
          <Aurora prefix="nlr" />
        </div>
      </div>
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="nl-ice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c2a3c" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#0a1e30" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#050f1c" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="nl-bank" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dce9f7" />
            <stop offset="35%" stopColor="#8fa9c9" />
            <stop offset="100%" stopColor="#3a5274" />
          </linearGradient>
          <filter id="nl-drift" x="-5%" y="-30%" width="110%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="2" />
            <feDisplacementMap in="SourceGraphic" scale="14" />
          </filter>
          <radialGradient id="nl-firelight">
            <stop offset="0%" stopColor="#ffb766" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#ff8a3d" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ff7a3d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={areaUnder(SHORE_LINE, H)} fill="url(#nl-ice)" />
        {/* a dusting of snow along the far shore */}
        <path d={lineThrough(SHORE_LINE)} fill="none" stroke="#c9dcf0" strokeOpacity="0.55" strokeWidth="2.5" filter="url(#nl-drift)" />
        {/* wind-swept streaks on the ice */}
        {[[220, 470, 260], [760, 458, 180], [1100, 486, 300], [480, 500, 200]].map(([x, y, w], i) => (
          <path key={i} d={`M ${x} ${y} q ${w / 2} -4 ${w} 0`} stroke="#bfe9ff" strokeOpacity="0.16" strokeWidth="1.4" fill="none" />
        ))}
        {/* the near bank, snow lit cool from above and warm by the fire */}
        <path d={areaUnder(NEAR_BANK, H + 20)} fill="url(#nl-bank)" filter="url(#nl-drift)" />
        <ellipse cx={TENT_X + 20} cy={TENT_Y + 8} rx="210" ry="48" fill="url(#nl-firelight)" />
        <path d={NEAR_LEFT.d} fill="#040d18" />
        <path d={NEAR_LEFT.snow} fill="none" stroke="#e3efff" strokeOpacity="0.75" strokeWidth="2.4" strokeLinecap="round" />
        <path d={NEAR_LEFT.lit} fill="none" stroke="#8dffd6" strokeOpacity="0.22" strokeWidth="1.4" />
        <path d={NEAR_RIGHT.d} fill="#040d18" />
        <path d={NEAR_RIGHT.snow} fill="none" stroke="#e3efff" strokeOpacity="0.75" strokeWidth="2.4" strokeLinecap="round" />
        <path d={NEAR_RIGHT.lit} fill="none" stroke="#8dffd6" strokeOpacity="0.22" strokeWidth="1.4" />
        {/* the tent, glowing from the lamp inside */}
        <g transform={`translate(${TENT_X} ${TENT_Y})`}>
          <path d="M -46 6 L -8 -44 L 30 6 Z" fill="#1c2a3d" />
          <path d="M -46 6 L -8 -44 L -20 6 Z" fill="#26384f" />
          <path className="aura-nl-tent" d="M -16 6 L -8 -26 L 0 6 Z" fill="#ffc37a" />
          <path d="M -8 -44 L -11 -52" stroke="#1c2a3d" strokeWidth="2" />
          <path d="M 44 8 L 60 2 M 50 2 L 64 8" stroke="#3a2a22" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>

      {/* Moving bits by the fire, in their own layer */}
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <radialGradient id="nl-flame-glow">
            <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(${TENT_X + 54} ${FIRE_Y})`}>
          <circle className="aura-nl-fireglow" r="30" fill="url(#nl-flame-glow)" />
          <path className="aura-nl-flame" d="M 0 2 C -7 -6 -2 -14 0 -22 C 3 -14 9 -7 0 2 Z" fill="#ffad45" />
          <path className="aura-nl-flame aura-nl-flame-2" d="M 0 2 C -3 -4 -1 -9 0 -13 C 2 -9 4 -4 0 2 Z" fill="#fff1bf" />
          {SPARKS.map((s, i) => (
            <circle key={i} className="aura-nl-spark" cx={s.dx} cy="-16" r="1.2" fill="#ffd28a"
              style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
          ))}
          <ChimneySmoke x={0} y={-26} scale={1.6} className="aura-nl-smoke" />
        </g>
      </svg>

      {/* Mist lying on the ice */}
      {[0, 1].map(i => <div key={i} className={`aura-nl-mist aura-nl-mist-${i}`} aria-hidden="true" />)}
    </div>
  );
}

export default function NorthernLights({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-nl-sky absolute inset-0" />
      <div className="aura-nl-milkyway absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-0 aura-nl-stars">
        <div className="absolute inset-0 aura-stars-1 opacity-70" />
        <div className="absolute inset-0 aura-stars-2 opacity-40" />
        <TwinklingStars seed={47} count={60} />
      </div>
      <ShootingStars className="aura-nl-stars" />
      <div className={`aura-nl-lights absolute inset-x-0 top-0 ${page ? 'h-[74vh]' : 'h-[78vh]'}`} aria-hidden="true">
        <Aurora prefix="nl" />
      </div>
      <Land page={page} />
      <div className="aura-nl-snow absolute inset-0" aria-hidden="true" />
      <div className="aura-nl-snow aura-nl-snow-near absolute inset-0" aria-hidden="true" />
    </>
  );
}
