import React from 'react';
import seeded from './seeded';
import BirdFlock from './Birds';
import { FloatingCloud } from './Clouds';
import { ridgePoints, areaUnder, smoothThrough } from './terrain';
import './dreamscapes.css';

// Golden Dunes: a desert in the last hour before sunset. A big low sun
// burns behind hazy mesas; dunes roll toward us in layers, each split along
// its knife-edge crest into a sunlit face and a shadowed lee, rippled by the
// wind and fading into haze with distance. Sand streams off the crests, a
// caravan of camels walks the far ridge (slipping behind the nearer dunes),
// a tumbleweed rolls past now and then, and birds cross the sky.

const W = 1600;
const H = 640;
const f = n => n.toFixed(1);

// A dune ridge: a few crests joined by smooth saddles. Returns the dune's
// body and, for each crest, the shadowed slope on its far side from the sun
// (the sun sits to the right, so shadows fall to the left of each crest).
function duneLayer(seed, { base, crests, height, spread }) {
  const rand = seeded(seed);
  const pts = [[-100, base]];
  const peaks = [];
  crests.forEach(cx => {
    const h = height * (0.7 + rand() * 0.5);
    const w = spread * (0.8 + rand() * 0.5);
    const trough = [cx - w * 0.9, base - h * 0.22];
    pts.push(trough, [cx, base - h], [cx + w * 0.55, base - h * 0.45]);
    peaks.push({ x: cx, y: base - h, w, h, trough });
  });
  pts.push([W + 100, base]);
  pts.sort((a, b) => a[0] - b[0]);
  const body = smoothThrough(pts, H + 40);
  // The lee face: bounded by the dune's own outline above (the clip) and by
  // the knife-edge curving down from the crest to the trough before it, so
  // the shadow meets the outline exactly and never shows a seam.
  const shades = peaks.map(({ x, y, w, h, trough: [tx, ty] }) => (
    `M ${f(x)} ${f(y)} C ${f(x - w * 0.12)} ${f(y + h * 0.5)} ${f(x - w * 0.62)} ${f(ty)} ${f(tx)} ${f(ty)}`
    + ` L ${f(tx)} ${f(y - 80)} L ${f(x)} ${f(y - 80)} Z`
  ));
  const top = Math.min(...peaks.map(p => p.y));
  return { body, shades, peaks, top, base };
}

// Wind ripples: long, gently wavy bands that follow each dune's slope
// below its crest, like contour lines, broken into a few runs. Each is a
// groove with a lit lip just under it, so they read as relief, not lines.
function ripples(seed, layer, rows) {
  const rand = seeded(seed);
  let d = '';
  for (const p of layer.peaks) {
    for (let r = 0; r < rows; r++) {
      const depth = 0.16 + (r / rows) * 1.05 + rand() * 0.05;
      // a row's span widens as it goes down the slope, like the dune itself
      const left = p.x - p.w * (0.15 + depth * 0.7);
      const right = p.x + p.w * (0.12 + depth * 0.5);
      let x = left + rand() * 20;
      while (x < right) {
        const run = 40 + rand() * 120;
        const end = Math.min(right, x + run);
        // sag along the slope: lower the farther from the crest
        const yAt = xx => p.y + p.h * depth + Math.abs(xx - p.x) * 0.18 * (1 - depth * 0.4);
        const mid = (x + end) / 2;
        const wob = (rand() - 0.5) * 6;
        d += `M ${f(x)} ${f(yAt(x))} Q ${f(mid)} ${f(yAt(mid) - 3 + wob)} ${f(end)} ${f(yAt(end))} `;
        x = end + 10 + rand() * 40;
      }
    }
  }
  return d;
}

// Back to front: hazier and pinker far away, richer gold close up. `top`
// and `foot` shade each body from its crests down to its base; `lee` runs
// from the crisp shadow under a crest to the warm light bouncing into it.
const LAYERS = [
  { key: 'd1', seed: 3, shape: { base: 430, crests: [180, 620, 1060, 1480], height: 90, spread: 160 }, crest: '#f6d2aa', foot: '#efbf99', lee: ['#d79c88', '#e7b59c'], haze: 0.55, ripples: 0 },
  { key: 'd2', seed: 8, shape: { base: 500, crests: [320, 860, 1320], height: 120, spread: 185 }, crest: '#f6c486', foot: '#eba872', lee: ['#bf7a5a', '#dc9f7c'], haze: 0.4, ripples: 5 },
  { key: 'd3', seed: 14, shape: { base: 580, crests: [120, 700, 1240], height: 150, spread: 225 }, crest: '#f4b46a', foot: '#e39552', lee: ['#a65d3c', '#cf8558'], haze: 0.22, ripples: 8, grain: true },
  { key: 'd4', seed: 21, shape: { base: 680, crests: [300, 900, 1520], height: 170, spread: 260 }, crest: '#f0a659', foot: '#d98543', lee: ['#8f4a2c', '#c27448'], haze: 0.1, ripples: 11, grain: true },
  { key: 'd5', seed: 34, shape: { base: 760, crests: [560, 1380], height: 190, spread: 330 }, crest: '#eb9a4e', foot: '#cf7a3a', lee: ['#7f3f24', '#b4663e'], haze: 0, ripples: 13, grain: true },
].map(l => {
  const layer = duneLayer(l.seed, l.shape);
  return { ...l, ...layer, ripple: l.ripples ? ripples(l.seed + 100, layer, l.ripples) : '' };
});

// A low, pinkish range of dunes between the mesas and the first full layer
const FAR_RIDGE = ridgePoints(4, { y: 404, amp: 22, rough: 0.55, passes: 6 });
// Mesas: flat-topped buttes on the horizon, each with a lit and a shaded side
const MESAS = [
  { body: 'M 40 392 L 66 318 L 78 300 L 222 296 L 238 316 L 262 392 Z', shade: 'M 40 392 L 66 318 L 78 300 L 112 299 L 104 392 Z' },
  { body: 'M 980 394 L 1006 330 L 1090 324 L 1100 302 L 1190 298 L 1206 330 L 1222 394 Z', shade: 'M 980 394 L 1006 330 L 1040 328 L 1036 394 Z M 1100 302 L 1124 301 L 1118 330 L 1090 330 Z' },
  { body: 'M 1380 396 L 1398 350 L 1472 346 L 1496 396 Z', shade: 'M 1380 396 L 1398 350 L 1416 349 L 1412 396 Z' },
];
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
        <path d="M -24 -28 C -27 -25 -28 -20 -26.5 -16" stroke="#5a2f1d" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <g fill="#6b3a24">
          <Leg x={-13} back phase={delay - 0.55} />
          <Leg x={18} phase={delay} />
        </g>
        {/* a striped saddle blanket catching the light */}
        <path d="M -9 -42 C -4 -46 6 -46 9 -40 L 11 -30 C 4 -27 -6 -27 -12 -30 Z" fill="#a33a26" />
        <path d="M -11 -33 C -4 -30 5 -30 11 -33" stroke="#e8b25c" strokeWidth="1.2" fill="none" />
        {rider && (
          <g fill="#3e1f14">
            {/* robed rider, the end of the headwrap lifting in the wind */}
            <path d="M -3 -44 C -4 -52 -3 -58 1 -60 C 5 -58 6 -52 5 -44 Z" />
            <circle cx="1" cy="-63" r="3.6" />
            <path className="aura-camel-scarf" d="M -2 -63 C -7 -63 -10 -60 -13 -61 C -10 -64 -6 -66 -2 -65 Z" fill="#c9543a" />
            <path d="M 4 -54 L 13 -50" stroke="#3e1f14" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        )}
        {pack && (
          <g>
            <ellipse cx="-6" cy="-41" rx="8" ry="6" fill="#c9905a" />
            <ellipse cx="5" cy="-43" rx="6" ry="5" fill="#b07a48" />
            <path d="M -13 -41 C -6 -46 6 -48 11 -43" stroke="#5a2f1d" strokeWidth="1" fill="none" />
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
          </defs>
          <g opacity="0.8" filter="url(#dune-rock)">
            {MESAS.map((m, i) => (
              <g key={i}>
                <path d={m.body} fill="url(#dune-mesa)" />
                <path d={m.shade} fill="#c98a86" opacity="0.6" />
                {/* strata: faint layered bands across each face */}
                <path d={m.body} fill="none" stroke="#f3c8a8" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="60 14" />
              </g>
            ))}
          </g>
          <path d={areaUnder(HORIZON, H)} fill="#f2c8a6" opacity="0.85" />
          <path d={areaUnder(FAR_RIDGE, H)} fill="url(#dune-far)" opacity="0.9" />
          {/* the caravan walks the far ridge, slipping behind the nearer dunes */}
          <g transform="translate(0 404) scale(0.62)">
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
                <linearGradient key={j} id={`dune-lee-${i}-${j}`} gradientUnits="userSpaceOnUse" x1={p.x} y1={p.y} x2={p.trough[0]} y2={p.trough[1]}>
                  <stop offset="0%" stopColor={d.lee[0]} />
                  <stop offset="55%" stopColor={d.lee[0]} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={d.lee[1]} />
                </linearGradient>
              ))}
              <linearGradient id={`dune-haze-${i}`} gradientUnits="userSpaceOnUse" x1="0" y1={d.base - 70} x2="0" y2={d.base + 10}>
                <stop offset="0%" stopColor="#fbe0c4" stopOpacity="0" />
                <stop offset="100%" stopColor="#fbe0c4" stopOpacity={d.haze} />
              </linearGradient>
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
              {d.shades.map((s, j) => <path key={j} d={s} fill={`url(#dune-lee-${i}-${j})`} />)}
              {d.ripple && (
                <>
                  <path d={d.ripple} fill="none" stroke="#fff0d4" strokeOpacity="0.45" strokeWidth="1.3" strokeLinecap="round" transform="translate(0 1.8)" />
                  <path d={d.ripple} fill="none" stroke={d.lee[0]} strokeOpacity="0.5" strokeWidth="1.3" strokeLinecap="round" />
                </>
              )}
              {d.grain && <rect x="-100" y={d.top - 10} width={W + 200} height={H - d.top + 60} filter={`url(#dune-grain-${i})`} />}
              {d.haze > 0 && <rect x="-100" y={d.base - 70} width={W + 200} height="140" fill={`url(#dune-haze-${i})`} />}
            </g>
            {/* the bright knife-edge where light meets shade */}
            {d.peaks.map((p, j) => (
              <path key={j} d={`M ${f(p.x - p.w * 0.14)} ${f(p.y + p.h * 0.07)} Q ${f(p.x)} ${f(p.y - 2)} ${f(p.x + p.w * 0.22)} ${f(p.y + p.h * 0.09)}`}
                stroke="#fff6e2" strokeOpacity={0.55 + i * 0.1} strokeWidth={1.2 + i * 0.3} fill="none" strokeLinecap="round" />
            ))}
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
          <g transform="translate(0 618)">
            <g className="aura-dune-tumble">
              <g className="aura-dune-tumble-spin">
                <circle r="15" fill="none" stroke="#8a5a34" strokeWidth="1" strokeDasharray="6 4" opacity="0.8" />
                <path d="M -13 -6 Q 0 -16 12 -5 Q 4 10 -10 8 Q -14 0 -5 -12 Q 10 -10 13 5 Q 0 14 -12 3 M -6 -13 L 8 12 M -14 2 L 14 -2 M -9 10 L 10 -10" stroke="#7a4a2a" strokeWidth="1.1" fill="none" strokeLinecap="round" />
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
