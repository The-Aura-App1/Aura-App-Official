import React from 'react';
import seeded from './seeded';
import BirdFlock from './Birds';
import { FloatingCloud } from './Clouds';
import { ridgePoints, areaUnder, smoothThrough } from './terrain';
import './dreamscapes.css';

// Golden Dunes: a desert in the last hour before sunset. A big low sun
// burns behind hazy mesas; dunes roll toward us in layers, each with a long
// sunlit windward slope and a steep slip face in shadow, split by a crest
// line that snakes down toward us. Wind ripples comb the sand, streamers
// blow off the crests, a caravan walks the far ridge, a tumbleweed rolls
// past now and then, and birds cross the sky.

const W = 1600;
const H = 640;
const f = n => n.toFixed(1);

// A band of dunes. Each crest has a steep slip face on its left (away from
// the sun, which sits to the right) and a long windward slope on its right.
// Returns the band's outline and, per crest, its shadowed slip face: bounded
// by the outline (via the clip) and by the crest line curving down toward us.
function duneLayer(seed, { base, crests, height, spread }) {
  const rand = seeded(seed);
  const pts = [[-140, base - height * 0.12]];
  const peaks = [];
  crests.forEach(c => {
    const x = c + (rand() - 0.5) * spread * 0.25;
    const h = height * (0.38 + rand() * 0.3);
    const w = spread * (0.9 + rand() * 0.45);
    const y = base - h;
    // a rounded summit, a steeper fall to the left and a long slope right
    pts.push([x - w * 0.55, base - h * 0.08], [x - w * 0.2, y + h * 0.2], [x, y], [x + w * 0.35, y + h * 0.16], [x + w * 1.05, base - h * 0.08]);
    // The crest line sweeps from the summit down and toward us in a long S;
    // the slip face lies to its left, down to a soft foot curve
    const dx = w * (0.35 + rand() * 0.45);
    const crestLine = `M ${f(x)} ${f(y)} C ${f(x + w * 0.22)} ${f(y + h * 0.3)} ${f(x + dx * 0.45)} ${f(base - h * 0.2)} ${f(x + dx)} ${f(base + 50)}`;
    const footX = x + dx - w * 0.55;
    const left = x - w * 0.6;
    const shade = `${crestLine} L ${f(footX)} ${f(base + 50)} C ${f(x - w * 0.15)} ${f(base - h * 0.05)} ${f(x - w * 0.4)} ${f(base - h * 0.15)} ${f(left)} ${f(base - h * 0.06)} L ${f(left)} ${f(y - 60)} L ${f(x)} ${f(y - 60)} Z`;
    // the windward face, lit along the crest and fading down the slope
    const lit = `${crestLine} L ${f(x + w * 1.2)} ${f(base + 50)} L ${f(x + w * 1.2)} ${f(y - 60)} L ${f(x)} ${f(y - 60)} Z`;
    peaks.push({ x, y, w, h, left, dx, crestLine, shade, lit });
  });
  pts.push([W + 140, base - height * 0.12]);
  pts.sort((a, b) => a[0] - b[0]);
  const body = smoothThrough(pts, H + 40);
  const top = Math.min(...peaks.map(p => p.y));
  return { body, peaks, top, base };
}

// Back to front: hazier and pinker far away, richer gold close up. `crest`
// and `foot` shade each band from its crests down to its base; `lee` runs
// from the deep shadow along a crest line to the warm light bouncing into it.
const LAYERS = [
  { key: 'd1', seed: 3, shape: { base: 432, crests: [200, 640, 1080, 1480], height: 90, spread: 170 }, crest: '#f6d2aa', foot: '#efbf99', lee: ['#d9a08c', '#ebbea4'], haze: 0.55 },
  { key: 'd2', seed: 8, shape: { base: 504, crests: [330, 880, 1340], height: 140, spread: 210 }, crest: '#f7c88c', foot: '#eba872', lee: ['#c27d5c', '#e0a582'], haze: 0.38, ripples: 0.22 },
  { key: 'd3', seed: 14, shape: { base: 584, crests: [90, 700, 1270], height: 190, spread: 260 }, crest: '#f5b76e', foot: '#e39552', lee: ['#a8603f', '#d58c5f'], haze: 0.2, ripples: 0.3, grain: true },
  { key: 'd4', seed: 21, shape: { base: 676, crests: [1180], height: 330, spread: 420 }, crest: '#f1a85c', foot: '#d98543', lee: ['#904b2d', '#c4774a'], haze: 0.08, ripples: 0.38, grain: true },
  { key: 'd5', seed: 34, shape: { base: 760, crests: [330], height: 520, spread: 640 }, crest: '#eb9b50', foot: '#cf7a3a', lee: ['#7d3e24', '#b6683f'], haze: 0, ripples: 0.45, grain: true },
].map(l => ({ ...l, ...duneLayer(l.seed, l.shape) }));

// A low, pinkish range between the mesas and the first full band, flat
// enough for the caravan to walk along its top
const FAR_RIDGE = ridgePoints(4, { y: 404, amp: 9, rough: 0.5, passes: 6 });
// Mesas: flat-topped buttes on the horizon, each with a lit and a shaded side
const MESAS = [
  { body: 'M 40 392 L 66 318 L 78 300 L 222 296 L 238 316 L 262 392 Z', shade: 'M 40 392 L 66 318 L 78 300 L 112 299 L 104 392 Z', top: 296 },
  { body: 'M 980 394 L 1006 330 L 1090 324 L 1100 302 L 1190 298 L 1206 330 L 1222 394 Z', shade: 'M 980 394 L 1006 330 L 1040 328 L 1036 394 Z M 1100 302 L 1124 301 L 1118 330 L 1090 330 Z', top: 298 },
  { body: 'M 1380 396 L 1398 350 L 1472 346 L 1496 396 Z', shade: 'M 1380 396 L 1398 350 L 1416 349 L 1412 396 Z', top: 346 },
];
// Rock strata: gently wavering bands across each mesa
const STRATA = MESAS.map((m, i) => {
  const rand = seeded(60 + i);
  let light = '';
  let dark = '';
  for (let y = m.top + 9; y < 392; y += 9 + rand() * 9) {
    const line = `M 0 ${f(y)} Q 400 ${f(y + (rand() - 0.5) * 4)} 800 ${f(y + (rand() - 0.5) * 3)} T 1600 ${f(y)} `;
    if (rand() < 0.5) light += line; else dark += line;
  }
  return { light, dark };
});
const HORIZON = ridgePoints(2, { y: 396, amp: 8, rough: 0.5, passes: 6 });

// Scrub and stones on the nearest sand, with long shadows away from the sun
function shrub(seed, x, y, s) {
  const rand = seeded(seed);
  let d = '';
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.4;
    const len = s * (0.5 + rand() * 0.6);
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len * 0.8;
    const mx = x + Math.cos(a) * len * 0.5 + (rand() - 0.5) * s * 0.2;
    const my = y + Math.sin(a) * len * 0.4;
    d += `M ${f(x + (rand() - 0.5) * s * 0.15)} ${f(y)} Q ${f(mx)} ${f(my)} ${f(ex)} ${f(ey)} `;
    // a twig off each branch
    d += `M ${f(mx)} ${f(my)} l ${f((rand() - 0.5) * s * 0.4)} ${f(-rand() * s * 0.3)} `;
  }
  return d;
}
const SHRUBS = [[700, 628, 54, 1], [236, 624, 40, 2], [1440, 626, 62, 3], [950, 634, 30, 4]];
const STONES = [[772, 636, 22], [912, 640, 13], [1500, 632, 18], [300, 634, 12]];

// A tumbleweed: a loose ball of tangled stems
const TUMBLE = (() => {
  const rand = seeded(77);
  let d = '';
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = 9 + rand() * 6;
    const x1 = Math.cos(a) * r;
    const y1 = Math.sin(a) * r;
    const b = a + Math.PI * (0.6 + rand() * 0.6);
    d += `M ${f(x1)} ${f(y1)} Q ${f((rand() - 0.5) * 10)} ${f((rand() - 0.5) * 10)} ${f(Math.cos(b) * r)} ${f(Math.sin(b) * r)} `;
  }
  return d;
})();

// A camel walking right, about 66 units long, ground at y 0. Legs are
// nested groups so each swings from its own hip while the outer group
// keeps its place in the line.
const CAMEL_BODY = 'M -24 -27 C -25 -33 -19 -36 -13 -36 C -8 -47 5 -49 10 -38 C 13 -34 16 -32 19 -31 C 22 -30 24 -34 25 -40 '
  + 'C 26 -46 29 -51 34 -51 C 38 -51 42 -49 42 -46 C 42 -44 39 -43.5 36 -44.5 C 32 -45 31 -42 30 -38 C 28 -31 25 -24 18 -22 L -17 -22 C -22 -22 -24 -24 -24 -27 Z';
function Leg({ x, back, phase }) {
  return (
    <g transform={`translate(${x} -24)`}>
      <g className="aura-camel-leg" style={{ animationDelay: `${phase}s` }}>
        <path d={back ? 'M -2 0 C -1 6 1 9 0 12 L -1 23 L 2 23 L 2.5 12 C 4 8 3 3 3 0 Z' : 'M -2 0 L -1.5 12 L -1.5 23 L 1.5 23 L 1.8 12 L 2.4 0 Z'} />
      </g>
    </g>
  );
}
function Camel({ x, rider, pack, delay }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {/* its long shadow, stretched away from the sun */}
      <ellipse cx="-34" cy="0.5" rx="44" ry="2.6" fill="#8a4a2c" opacity="0.28" />
      <g className="aura-camel-walk" style={{ animationDelay: `${delay}s` }}>
        <g fill="#4a2618">
          <Leg x={-18} back phase={delay} />
          <Leg x={13} phase={delay - 0.55} />
        </g>
        <path d={CAMEL_BODY} fill="#6b3a24" />
        {/* rim light from the low sun along its back and neck */}
        <path d="M -13 -36 C -8 -47 5 -49 10 -38 C 13 -34 16 -32 19 -31 C 22 -30 24 -34 25 -40 C 26 -46 29 -51 34 -51" stroke="#e9a46a" strokeOpacity="0.55" strokeWidth="1.1" fill="none" />
        <path d="M -24 -28 C -27 -25 -28 -20 -26.5 -16" stroke="#5a2f1d" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <circle cx="37" cy="-48" r="0.9" fill="#2a140c" />
        <g fill="#6b3a24">
          <Leg x={-13} back phase={delay - 0.55} />
          <Leg x={18} phase={delay} />
        </g>
        {/* a saddle blanket with a woven stripe and tassels */}
        <path d="M -9 -42 C -4 -46 6 -46 9 -40 L 11 -30 C 4 -27 -6 -27 -12 -30 Z" fill="#9c3524" />
        <path d="M -11 -33 C -4 -30 5 -30 11 -33" stroke="#e8b25c" strokeWidth="1.2" fill="none" />
        <path d="M -10 -29.5 l 0 3 M -4 -28 l 0 3 M 2 -28 l 0 3 M 8 -29.5 l 0 3" stroke="#e8b25c" strokeWidth="0.8" />
        {rider && (
          <g>
            {/* a robed rider in a cloth head wrap, holding the rein */}
            <path d="M -5 -41 C -6.5 -49 -4.5 -56 0.5 -58.5 C 5 -57 7.5 -51 7 -41 Z" fill="#3c2c3a" />
            <path d="M 1.5 -44 L 5.5 -33" stroke="#3c2c3a" strokeWidth="3" strokeLinecap="round" />
            <path d="M 4.5 -53 Q 9 -50 13 -49.5" stroke="#3c2c3a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M 13 -49.5 Q 24 -47 35 -46" stroke="#2a140c" strokeWidth="0.6" fill="none" />
            <circle cx="1.6" cy="-61.6" r="3.3" fill="#5a3526" />
            <path d="M -2 -62 C -2.6 -66.6 5.8 -67.4 5.3 -62.4 C 4.4 -63.6 -0.8 -63.8 -2 -62 Z" fill="#efe2c8" />
            <path d="M -1.8 -62.4 C -3.4 -60 -3.4 -57.6 -2.4 -55.8" stroke="#efe2c8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>
        )}
        {pack && (
          <g>
            <ellipse cx="-6" cy="-41" rx="8" ry="6" fill="#c9905a" />
            <ellipse cx="5" cy="-43" rx="6" ry="5" fill="#b07a48" />
            <path d="M -13 -41 C -6 -46 6 -48 11 -43" stroke="#5a2f1d" strokeWidth="1" fill="none" />
            <path d="M -9 -45 L -6 -36 M 3 -47 L 6 -39" stroke="#7a4a2a" strokeWidth="0.8" />
          </g>
        )}
      </g>
    </g>
  );
}
// Lead, rider, then pack camels roped head to tail
const CARAVAN = [
  { x: 210, rider: true, delay: 0 },
  { x: 130, pack: true, delay: -0.35 },
  { x: 50, rider: true, delay: -0.7 },
  { x: -30, pack: true, delay: -0.2 },
];
const ROPES = CARAVAN.slice(1).map(c => `M ${c.x + 41} -45 C ${c.x + 46} -36 ${c.x + 52} -31 ${c.x + 56} -28`).join(' ');

export default function GoldenDunes({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-dune-sky absolute inset-0" />
      <div className="aura-dune-sun absolute" aria-hidden="true" />
      <div className="aura-dune-rays absolute inset-0" aria-hidden="true" />
      <div className="aura-dune-streaks absolute inset-x-0" aria-hidden="true" />
      <FloatingCloud seed={7} idPrefix="dune-cloud" top="#fff4e6" bottom="#f0b998" className="aura-dune-cloud w-80 sm:w-[28rem] top-[14vh] left-[6%]" style={{ animationDuration: '80s' }} />
      <FloatingCloud seed={19} idPrefix="dune-cloud" top="#fff1e0" bottom="#eeae8e" className="aura-dune-cloud w-64 sm:w-96 top-[26vh] right-[4%] opacity-80" style={{ animationDuration: '96s', animationDirection: 'reverse' }} />
      <BirdFlock className={`aura-flock aura-dune-flock ${page ? 'top-[18vh]' : 'top-[22%]'}`} />

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[62vh] min-h-[320px]' : 'h-[50vh] min-h-[260px]'}`}>
        {/* The horizon: mesas lit from the right, a low pink range, and the caravan */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="dune-mesa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dc9d8c" />
              <stop offset="100%" stopColor="#ecc0a6" />
            </linearGradient>
            <linearGradient id="dune-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#efc2a6" />
              <stop offset="100%" stopColor="#f4d0b0" />
            </linearGradient>
            <filter id="dune-rock" x="-5%" y="-20%" width="110%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" />
              <feDisplacementMap in="SourceGraphic" scale="5" />
            </filter>
            {MESAS.map((m, i) => <clipPath key={i} id={`dune-mesa-clip-${i}`}><path d={m.body} /></clipPath>)}
          </defs>
          <g opacity="0.8" filter="url(#dune-rock)">
            {MESAS.map((m, i) => (
              <g key={i}>
                <path d={m.body} fill="url(#dune-mesa)" />
                <g clipPath={`url(#dune-mesa-clip-${i})`}>
                  <path d={STRATA[i].dark} fill="none" stroke="#c4857c" strokeOpacity="0.35" strokeWidth="1.6" />
                  <path d={STRATA[i].light} fill="none" stroke="#f6d3b8" strokeOpacity="0.45" strokeWidth="1.2" />
                  <path d={m.shade} fill="#c98a86" opacity="0.55" />
                </g>
              </g>
            ))}
          </g>
          <path d={areaUnder(HORIZON, H)} fill="#f2c8a6" opacity="0.85" />
          <path d={areaUnder(FAR_RIDGE, H)} fill="url(#dune-far)" opacity="0.9" />
          {/* the caravan walks the far ridge, slipping behind the nearer dunes */}
          <g transform="translate(0 405)">
            <g className="aura-dune-caravan">
              <path d={ROPES} stroke="#4a2618" strokeWidth="0.9" fill="none" opacity="0.8" />
              {CARAVAN.map((c, i) => <Camel key={i} {...c} />)}
            </g>
          </g>
        </svg>
        <div className="aura-dune-heat absolute inset-x-0" aria-hidden="true" />

        {LAYERS.map((d, i) => (
          <svg key={d.key} className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <defs>
              <clipPath id={`dune-clip-${i}`}><path d={d.body} /></clipPath>
              <linearGradient id={`dune-body-${i}`} gradientUnits="userSpaceOnUse" x1="0" y1={d.top} x2="0" y2={Math.min(H, d.base + 20)}>
                <stop offset="0%" stopColor={d.crest} />
                <stop offset="100%" stopColor={d.foot} />
              </linearGradient>
              {/* warm light raking across from the sun on the right */}
              <linearGradient id={`dune-sun-${i}`} x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff2d2" stopOpacity="0.5" />
                <stop offset="45%" stopColor="#fff2d2" stopOpacity="0" />
              </linearGradient>
              {d.peaks.map((p, j) => (
                <linearGradient key={j} id={`dune-lee-${i}-${j}`} gradientUnits="userSpaceOnUse" x1={p.x + p.dx * 0.5} y1={p.y + p.h * 0.3} x2={p.x - p.w * 0.35} y2={p.y + p.h * 1.1}>
                  <stop offset="0%" stopColor={d.lee[0]} stopOpacity="0.95" />
                  <stop offset="30%" stopColor={d.lee[0]} stopOpacity="0.75" />
                  <stop offset="70%" stopColor={d.lee[1]} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={d.lee[1]} stopOpacity="0" />
                </linearGradient>
              ))}
              {d.peaks.map((p, j) => (
                <linearGradient key={j} id={`dune-face-${i}-${j}`} gradientUnits="userSpaceOnUse" x1={p.x + p.dx * 0.3} y1={p.y + p.h * 0.2} x2={p.x + p.w * 0.8} y2={p.y + p.h * 0.6}>
                  <stop offset="0%" stopColor="#fff4d8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#fff4d8" stopOpacity="0" />
                </linearGradient>
              ))}
              {/* the crest catches the light, fading down the line */}
              <linearGradient id={`dune-rim-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff6e2" stopOpacity={0.6 + i * 0.08} />
                <stop offset="70%" stopColor="#fff6e2" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`dune-haze-${i}`} gradientUnits="userSpaceOnUse" x1="0" y1={d.base - 70} x2="0" y2={d.base + 10}>
                <stop offset="0%" stopColor="#fbe0c4" stopOpacity="0" />
                <stop offset="100%" stopColor="#fbe0c4" stopOpacity={d.haze} />
              </linearGradient>
              {d.ripples && (
                // wind ripples: long, thin, wavering grooves stretched along the wind
                <filter id={`dune-ripple-${i}`} x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="turbulence" baseFrequency={`${0.003 + i * 0.0006} ${0.07 + i * 0.012}`} numOctaves="2" seed={i * 11 + 5} />
                  <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.22  0 0 0 0 0.1  3.2 0 0 0 -0.6" />
                </filter>
              )}
              {d.grain && (
                <filter id={`dune-grain-${i}`} x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed={i * 7} />
                  <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.24  0 0 0 0 0.12  0 0 0 0.5 -0.18" />
                </filter>
              )}
            </defs>
            <path d={d.body} fill={`url(#dune-body-${i})`} />
            <path d={d.body} fill={`url(#dune-sun-${i})`} />
            <g clipPath={`url(#dune-clip-${i})`}>
              {d.ripples && <rect x="-100" y={d.top - 10} width={W + 200} height={H - d.top + 60} filter={`url(#dune-ripple-${i})`} opacity={d.ripples} />}
              {d.peaks.map((p, j) => <path key={`l${j}`} d={p.lit} fill={`url(#dune-face-${i}-${j})`} />)}
              {d.peaks.map((p, j) => <path key={j} d={p.shade} fill={`url(#dune-lee-${i}-${j})`} />)}
              {d.grain && <rect x="-100" y={d.top - 10} width={W + 200} height={H - d.top + 60} filter={`url(#dune-grain-${i})`} />}
              {d.peaks.map((p, j) => <path key={j} d={p.crestLine} stroke={`url(#dune-rim-${i})`} strokeWidth={1.2 + i * 0.35} fill="none" strokeLinecap="round" />)}
              {d.haze > 0 && <rect x="-100" y={d.base - 70} width={W + 200} height="140" fill={`url(#dune-haze-${i})`} />}
            </g>
          </svg>
        ))}

        {/* Scrub, stones and the odd tumbleweed on the nearest sand */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <radialGradient id="dune-stone" cx="70%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#c89067" />
              <stop offset="60%" stopColor="#8a5534" />
              <stop offset="100%" stopColor="#5e3420" />
            </radialGradient>
          </defs>
          {SHRUBS.map(([x, y, s, seed]) => (
            <g key={seed}>
              <ellipse cx={x - s * 1.1} cy={y + 1} rx={s * 1.3} ry={s * 0.12} fill="#7a3f22" opacity="0.3" />
              <path d={shrub(seed, x, y, s)} stroke="#6b4329" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <path d={shrub(seed + 10, x + 3, y, s * 0.8)} stroke="#9a6a3c" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
            </g>
          ))}
          {STONES.map(([x, y, r], i) => (
            <g key={i}>
              <ellipse cx={x - r * 1.6} cy={y} rx={r * 2} ry={r * 0.22} fill="#7a3f22" opacity="0.32" />
              <path d={`M ${x - r} ${y} C ${x - r} ${y - r * 0.7} ${x - r * 0.3} ${y - r * 0.9} ${x + r * 0.2} ${y - r * 0.8} C ${x + r * 0.8} ${y - r * 0.6} ${x + r} ${y - r * 0.3} ${x + r} ${y} Z`} fill="url(#dune-stone)" />
            </g>
          ))}
          <g transform="translate(0 616)">
            <g className="aura-dune-tumble">
              <ellipse cx="-16" cy="15" rx="18" ry="2" fill="#7a3f22" opacity="0.25" />
              <g className="aura-dune-tumble-spin">
                <circle r="14" fill="#b07b47" opacity="0.18" />
                <path d={TUMBLE} stroke="#7a4a2a" strokeWidth="1" fill="none" strokeLinecap="round" />
                <path d={TUMBLE} stroke="#c8935a" strokeWidth="0.6" fill="none" strokeLinecap="round" transform="rotate(70) scale(0.8)" />
              </g>
            </g>
          </g>
        </svg>

        {/* Sand streaming off the crests, and grains skittering low over the ground */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="dune-wisp" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#fff1d6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fff1d6" stopOpacity="0" />
            </linearGradient>
            <filter id="dune-wisp-soft" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="2.5" /></filter>
          </defs>
          {LAYERS[2].peaks.concat(LAYERS[3].peaks).map((p, i) => (
            <path key={i} className="aura-dune-blow" style={{ animationDelay: `${-i * 1.7}s` }} filter="url(#dune-wisp-soft)"
              d={`M ${p.x} ${p.y} C ${p.x - 40} ${p.y - 10} ${p.x - 90} ${p.y - 6} ${p.x - 150} ${p.y + 6} C ${p.x - 90} ${p.y + 2} ${p.x - 40} ${p.y + 2} ${p.x} ${p.y + 3} Z`}
              fill="url(#dune-wisp)" />
          ))}
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-1/4 overflow-hidden pointer-events-none" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="aura-dune-grain absolute"
              style={{ left: `${(i * 53) % 100}%`, bottom: `${8 + ((i * 37) % 70)}%`, animationDuration: `${5 + (i % 5) * 1.3}s`, animationDelay: `${-i * 0.9}s` }} />
          ))}
        </div>
      </div>
    </>
  );
}
