import React from 'react';
import seeded from './seeded';
import ChimneySmoke from './ChimneySmoke';

const WIDTH  = 1600;
const HEIGHT = 600;

// A jagged ridgeline: peaks spread across the width with valleys between,
// and small bumps along each slope so it reads as rock, not a zigzag.
function ridge(seed, { peaks, top, bottom, valley }) {
  const rand = seeded(seed);
  const step = WIDTH / peaks;
  const keys = [{ x: -60, y: valley + rand() * 40 }];
  const apexes = [];
  for (let i = 0; i < peaks; i++) {
    const x = step * (i + 0.2 + rand() * 0.6);
    const y = top + rand() * (bottom - top);
    keys.push({ x, y });
    apexes.push({ x, y, half: step * (0.45 + rand() * 0.25) });
    keys.push({ x: x + step * (0.35 + rand() * 0.3), y: valley - rand() * (valley - bottom) * 0.6 });
  }
  keys.push({ x: WIDTH + 60, y: valley });

  const points = [];
  keys.forEach((k, i) => {
    points.push(k);
    const next = keys[i + 1];
    if (!next) return;
    for (const t of [0.33, 0.66]) {
      points.push({
        x: k.x + (next.x - k.x) * t + (rand() - 0.5) * 18,
        y: k.y + (next.y - k.y) * t + (rand() - 0.5) * 22,
      });
    }
  });
  const path = `M -60 ${HEIGHT} ` + points.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ` L ${WIDTH + 60} ${HEIGHT} Z`;
  return { path, apexes, rand };
}

// Snow above a jagged snowline that dips lowest under each peak. It's
// clipped to the mountain, so it only ever covers rock.
function snowPath(apexes, rand, depth) {
  const pts = [];
  for (let x = -60; x <= WIDTH + 60; x += 14) {
    let y = 0;
    for (const a of apexes) {
      const d = Math.abs(x - a.x) / a.half;
      if (d < 1) y = Math.max(y, a.y + depth * (1 - d) * (1 - d * 0.4));
    }
    pts.push(`L ${x} ${(y + (y ? (rand() - 0.5) * 14 : 0)).toFixed(1)}`);
  }
  return `M -60 0 ${pts.join(' ')} L ${WIDTH + 60} 0 Z`;
}

// Shade the right face of each peak, as if lit from the upper left. The
// shadow's edge runs down from the summit as a crooked ridge crest, angled
// down the slope so it doesn't read as a vertical stripe. Each shadow fades
// out towards its far side (`from`/`to`), so where it reaches into the next
// peak it doesn't end in a hard vertical edge.
function shadePaths(apexes, rand) {
  return apexes.map(a => {
    const crest = [];
    for (let t = 0; t <= 1.001; t += 0.125) {
      const x = a.x + a.half * 0.55 * t + (t > 0 && t < 1 ? (rand() - 0.5) * 16 : 0);
      crest.push(`L ${x.toFixed(1)} ${(a.y + (HEIGHT - a.y) * t).toFixed(1)}`);
    }
    return {
      d: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} ${crest.join(' ')} L ${(a.x + a.half * 1.6).toFixed(1)} ${HEIGHT} L ${(a.x + a.half * 1.6).toFixed(1)} ${a.y.toFixed(1)} Z`,
      from: a.x,
      to: a.x + a.half * 1.6,
    };
  });
}

// Back to front: hazy and pale far away, deeper blue up close.
const RANGES = [
  { seed: 5,  peaks: 5, top: 150, bottom: 260, valley: 330, rock: '#c9d5ef', snow: '#f7f9ff', depth: 70, shade: 0.08 },
  { seed: 17, peaks: 6, top: 270, bottom: 350, valley: 420, rock: '#a5b7de', snow: '#f2f6ff', depth: 60, shade: 0.12 },
  { seed: 29, peaks: 4, top: 360, bottom: 430, valley: 500, rock: '#7f95c6', snow: '#eef3ff', depth: 55, shade: 0.16 },
];

// A row of pines along the bottom. Each has three tiers, a lit left half,
// and snow resting along the bottom edge of every tier. `clearing` leaves a
// stretch of the row empty.
function pines(seed, { base, minH, maxH, gap, clearing = [0, 0] }) {
  const rand = seeded(seed);
  let bodies = '';
  let lit = '';
  let snow = '';
  for (let x = -20; x < WIDTH + 20; x += gap[0] + rand() * gap[1]) {
    const h = minH + rand() * (maxH - minH);
    if (x > clearing[0] && x < clearing[1]) continue;
    const w = h * (0.42 + rand() * 0.1);
    const top = base - h + rand() * 18;
    const tiers = [[0.36, 0.28, 0.12, 2], [0.66, 0.4, 0.18, 3], [1, 0.52, 0, 0]];
    const left = tiers.map(([f, spread, inner, lift]) => [[x - w * spread, top + h * f], [x - w * inner, top + h * f - lift]]);
    const outline = [`M ${x} ${top}`];
    left.forEach(([tip, notch], i) => {
      outline.push(`L ${tip[0]} ${tip[1]}`);
      if (i < 2) outline.push(`L ${notch[0]} ${notch[1]}`);
    });
    const right = left.map(([tip, notch]) => [[2 * x - tip[0], tip[1]], [2 * x - notch[0], notch[1]]]).reverse();
    right.forEach(([tip, notch], i) => {
      if (i > 0) outline.push(`L ${notch[0]} ${notch[1]}`);
      outline.push(`L ${tip[0]} ${tip[1]}`);
    });
    bodies += outline.join(' ') + ' Z ';
    // The lit left half: the same tiers, cut down the middle
    lit += `M ${x} ${top} ` + left.map(([tip, notch], i) => `L ${tip[0]} ${tip[1]}` + (i < 2 ? ` L ${notch[0]} ${notch[1]}` : '')).join(' ') + ` L ${x} ${left[2][0][1]} Z `;
    // Snow along each tier's lower edge, heavier on the outer tips
    left.forEach(([tip], i) => {
      const y = tip[1];
      const reach = (x - tip[0]) * (i === 2 ? 0.75 : 0.9);
      snow += `M ${(x - reach).toFixed(1)} ${(y - 1).toFixed(1)} Q ${x} ${(y - 6).toFixed(1)} ${(x + reach).toFixed(1)} ${(y - 1).toFixed(1)} `;
    });
  }
  return { bodies, lit, snow };
}

// A bank of valley fog: a band with rolling top and bottom edges, so it
// never reads as a straight stripe across the mountains.
function fogPath(seed, valley) {
  const rand = seeded(seed * 7 + 3);
  const top = [];
  const bottom = [];
  for (let x = -120; x <= WIDTH + 120; x += 80) {
    top.push(`${x} ${(valley - 90 + Math.sin(x / 170 + seed) * 14 + (rand() - 0.5) * 10).toFixed(1)}`);
    bottom.push(`${x} ${(valley + 64 + Math.sin(x / 230 + seed * 2) * 16 + (rand() - 0.5) * 10).toFixed(1)}`);
  }
  return `M ${top.join(' L ')} L ${bottom.reverse().join(' L ')} Z`;
}

const RIDGES = RANGES.map(r => {
  const { path, apexes, rand } = ridge(r.seed, r);
  return { ...r, path, snowD: snowPath(apexes, rand, r.depth), shades: shadePaths(apexes, rand), fogD: fogPath(r.seed, r.valley) };
});
const BACK_PINES  = pines(57, { base: HEIGHT - 26, minH: 34, maxH: 60, gap: [12, 16] });
const CABIN_X = 1190;
const FRONT_PINES = pines(41, { base: HEIGHT - 10, minH: 50, maxH: 120, gap: [18, 26], clearing: [CABIN_X - 70, CABIN_X + 66] });

// A small log cabin in a clearing among the pines: snow heaped on the roof
// and drifted against the walls, warm light in the windows and smoke from
// the chimney. The one warm thing in a cold scene.
const LOGS = [-28, -22, -16, -10, -4].map(y => `M -36 ${y} L 36 ${y}`).join(' ');

function Cabin() {
  return (
    <g transform={`translate(${CABIN_X} ${HEIGHT - 10})`}>
      <ChimneySmoke x={22} y={-66} className="aura-cabin-smoke" scale={1.3} />
      <rect x="17" y="-64" width="10" height="24" fill="#5b6482" />
      <rect x="15.5" y="-67" width="13" height="5" rx="2.5" fill="#f7f9ff" />
      <rect x="-36" y="-34" width="72" height="34" fill="#6d5562" />
      <path d={LOGS} stroke="#56404e" strokeWidth="1.2" />
      <path d="M -45 -31 L 0 -60 L 45 -31 Z" fill="#4b3a4a" />
      <path d="M -48 -31 L 0 -63 L 48 -31" fill="none" stroke="#f7f9ff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M -40 -29 q 3 5 6 0 q 2 3 5 0 M 30 -29 q 3 4 6 0" fill="#f7f9ff" stroke="#f7f9ff" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="-6" y="-24" width="12" height="24" fill="#4b3a4a" />
      <g className="aura-cabin-window">
        <rect x="-29" y="-25" width="14" height="12" fill="#ffcf7d" />
        <rect x="15" y="-25" width="14" height="12" fill="#ffcf7d" />
      </g>
      <path d="M -22 -25 L -22 -13 M -29 -19 L -15 -19 M 22 -25 L 22 -13 M 15 -19 L 29 -19" stroke="#6d5562" strokeWidth="1.4" />
      <path d="M -52 2 C -40 -10 -30 -4 -20 -2 L 20 -2 C 32 -6 42 -10 54 2 Z" fill="#f4f7ff" />
    </g>
  );
}

// Falling snow is drawn as tiles of flakes scattered at random (seeded, so
// every visit matches), sized and faded at random too, so the repeat never
// reads as a grid. The tiles are taller than they are wide, and each layer
// slides exactly one tile across and one tile down per cycle, so it loops
// seamlessly while the wind blows the snow in at a slant. Gusts push it
// further now and then (scenes.css).
function snowTile(seed, { w, h, count, minR, maxR }) {
  const rand = seeded(seed);
  let flakes = '';
  for (let i = 0; i < count; i++) {
    const r = minR + rand() ** 1.5 * (maxR - minR);
    flakes += `<circle cx='${(rand() * w).toFixed(0)}' cy='${(rand() * h).toFixed(0)}' r='${r.toFixed(2)}' fill-opacity='${(0.55 + rand() * 0.45).toFixed(2)}'/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' fill='white'>${flakes}</svg>`)}")`;
}
const SNOW = {
  flurry: snowTile(31, { w: 300, h: 420,  count: 46, minR: 0.6, maxR: 1.1 }),
  far:    snowTile(3,  { w: 300, h: 560,  count: 40, minR: 0.9, maxR: 1.8 }),
  near:   snowTile(8,  { w: 420, h: 840,  count: 26, minR: 1.8, maxR: 3.2 }),
  close:  snowTile(19, { w: 560, h: 1200, count: 10, minR: 3.2, maxR: 5.5 }),
};

// Gusts of wind: faint streaks of blown snow that sweep across the sky now
// and then, each on its own rhythm.
const GUSTS = (() => {
  const rand = seeded(47);
  return Array.from({ length: 7 }, () => ({
    top: 12 + rand() * 62,
    width: 18 + rand() * 22,
    duration: 7 + rand() * 6,
    delay: -rand() * 14,
    tilt: 2 + rand() * 4,
  }));
})();

function Gusts() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {GUSTS.map((g, i) => (
        <span key={i} className="aura-peaks-gust absolute"
          style={{ top: `${g.top}%`, width: `${g.width}vw`, '--tilt': `${g.tilt}deg`, animationDuration: `${g.duration}s`, animationDelay: `${g.delay}s` }} />
      ))}
    </div>
  );
}

// ── The winter sky ────────────────────────────────────────────────────
// High wisps of cirrus drifting on the wind, and "diamond dust", tiny ice
// crystals glinting in the air.

// Streaky noise stretched sideways reads as feathery cirrus. It's kept to
// bands high in the sky, in two layers on different winds.
function Cirrus({ seed = 11, layer = 'high' }) {
  return (
    <div className={`aura-peaks-cirrus aura-peaks-cirrus-${layer} absolute inset-x-0 top-0 overflow-hidden`} aria-hidden="true">
      <svg className="aura-peaks-cirrus-drift absolute top-0 h-full" viewBox="0 0 1600 500" preserveAspectRatio="none">
        <defs>
          <filter id={`cirrus-fibers-${layer}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.0021 0.03" numOctaves="4" seed={seed} />
            {/* White, with only the noise's brightest streaks showing */}
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.2 0 0 0 -1.85" />
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <linearGradient id={`cirrus-bands-${layer}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="14%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="26%" stopColor="#fff" stopOpacity="0.15" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="58%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`cirrus-mask-${layer}`}><rect width="1600" height="500" fill={`url(#cirrus-bands-${layer})`} /></mask>
        </defs>
        <rect width="1600" height="500" fill="#fff" filter={`url(#cirrus-fibers-${layer})`} mask={`url(#cirrus-mask-${layer})`} />
      </svg>
    </div>
  );
}

// Diamond dust: small four-point glints in soft prism colors, mostly on the
// sun's side of the sky, each catching the light on its own rhythm.
const GLINT_TINTS = ['#ffffff', '#ffe4f1', '#dbe8ff', '#fff3d6', '#ffffff'];
const GLINTS = (() => {
  const rand = seeded(23);
  return Array.from({ length: 26 }, () => ({
    left: 30 + rand() * 68,
    top: 4 + rand() * 54,
    size: 5 + rand() ** 2 * 7,
    tint: GLINT_TINTS[Math.floor(rand() * GLINT_TINTS.length)],
    duration: 3.5 + rand() * 4,
    delay: -rand() * 8,
  }));
})();

function DiamondDust() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {GLINTS.map((g, i) => (
        <svg key={i} className="aura-peaks-glint absolute" viewBox="0 0 24 24" width={g.size} height={g.size}
          style={{ left: `${g.left}%`, top: `${g.top}%`, color: g.tint, animationDuration: `${g.duration}s`, animationDelay: `${g.delay}s` }}>
          <path d="M12 0c.5 5.6 6.4 11.5 12 12-5.6.5-11.5 6.4-12 12-.5-5.6-6.4-11.5-12-12C5.6 11.5 11.5 5.6 12 0z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

// Layered mountain ranges with snowcaps, a two-row treeline with a lit
// cabin in a clearing, and snow blowing in on the wind in four layers (fine
// and slow far away, large up close) under a pale winter sky with drifting
// cirrus, gusts of blown snow and glinting ice crystals. `page` is the full version for the public
// pages; `app` sits lower and quieter behind the signed-in app.
export default function SnowyPeaks({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-peaks-sky absolute inset-0" />
      <Cirrus />
      <Cirrus seed={4} layer="low" />
      <div className="aura-peaks-sun absolute" />
      <DiamondDust />
      <div className={`aura-peaks-range absolute inset-x-0 bottom-0 ${page ? 'h-[70vh] min-h-[340px]' : 'h-[46vh] min-h-[240px]'}`}>
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            {RIDGES.map((r, i) => (
              <clipPath key={i} id={`peaks-clip-${i}`}><path d={r.path} /></clipPath>
            ))}
            {/* Mist that thickens towards the valley floor and thins out again
                below it, so neither edge of the band shows */}
            <linearGradient id="peaks-mist" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="35%" stopColor="#ffffff" stopOpacity="0.3" />
              <stop offset="62%" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="82%" stopColor="#ffffff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id="peaks-fog-soft" x="-5%" y="-50%" width="110%" height="200%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            {RIDGES.flatMap((r, i) => r.shades.map((s, j) => (
              <linearGradient key={`${i}-${j}`} id={`peaks-shade-${i}-${j}`} gradientUnits="userSpaceOnUse"
                x1={s.from} y1="0" x2={s.to} y2="0">
                <stop offset="0%" stopColor="#2a3f78" />
                <stop offset="45%" stopColor="#2a3f78" />
                <stop offset="100%" stopColor="#2a3f78" stopOpacity="0" />
              </linearGradient>
            )))}
          </defs>

          {RIDGES.map((r, i) => (
            <g key={i}>
              <path d={r.path} fill={r.rock} />
              <g clipPath={`url(#peaks-clip-${i})`}>
                <path d={r.snowD} fill={r.snow} />
                {r.shades.map((s, j) => <path key={j} d={s.d} fill={`url(#peaks-shade-${i}-${j})`} opacity={r.shade} />)}
              </g>
              {/* Mist settling in the valleys in front of each range */}
              <path className="aura-peaks-fog" d={r.fogD} fill="url(#peaks-mist)" filter="url(#peaks-fog-soft)" opacity="0.7"
                style={{ animationDuration: `${34 + i * 9}s`, animationDelay: `${-i * 11}s` }} />
            </g>
          ))}

          <g>
            <path d={BACK_PINES.bodies} fill="#6c80b3" />
            <path d={BACK_PINES.lit} fill="#7d91c2" />
            <path d={BACK_PINES.snow} fill="none" stroke="#f4f7ff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          </g>
          <rect x="-60" y={HEIGHT - 30} width={WIDTH + 120} height="30" fill="#e8eefb" />
          <g>
            <path d={FRONT_PINES.bodies} fill="#3f5288" />
            <path d={FRONT_PINES.lit} fill="#51669c" />
            <path d={FRONT_PINES.snow} fill="none" stroke="#f7f9ff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          </g>
          <Cabin />
          <rect x="-60" y={HEIGHT - 12} width={WIDTH + 120} height="12" fill="#f4f7ff" />
        </svg>
      </div>
      <Gusts />
      <div className="aura-snow aura-snow-flurry absolute" style={{ backgroundImage: SNOW.flurry }} />
      <div className="aura-snow aura-snow-far absolute" style={{ backgroundImage: SNOW.far }} />
      <div className="aura-snow aura-snow-near absolute" style={{ backgroundImage: SNOW.near }} />
      <div className="aura-snow aura-snow-close absolute" style={{ backgroundImage: SNOW.close }} />
    </>
  );
}
