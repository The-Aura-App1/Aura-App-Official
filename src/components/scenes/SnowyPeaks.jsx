import React from 'react';
import seeded from './seeded';

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
// down the slope so it doesn't read as a vertical stripe.
function shadePath(apexes, rand) {
  return apexes.map(a => {
    const crest = [];
    for (let t = 0; t <= 1.001; t += 0.125) {
      const x = a.x + a.half * 0.55 * t + (t > 0 && t < 1 ? (rand() - 0.5) * 16 : 0);
      crest.push(`L ${x.toFixed(1)} ${(a.y + (HEIGHT - a.y) * t).toFixed(1)}`);
    }
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} ${crest.join(' ')} L ${(a.x + a.half * 1.6).toFixed(1)} ${HEIGHT} L ${(a.x + a.half * 1.6).toFixed(1)} ${a.y.toFixed(1)} Z`;
  }).join(' ');
}

// Back to front: hazy and pale far away, deeper blue up close.
const RANGES = [
  { seed: 5,  peaks: 5, top: 150, bottom: 260, valley: 330, rock: '#c9d5ef', snow: '#f7f9ff', depth: 70, shade: 0.08 },
  { seed: 17, peaks: 6, top: 270, bottom: 350, valley: 420, rock: '#a5b7de', snow: '#f2f6ff', depth: 60, shade: 0.12 },
  { seed: 29, peaks: 4, top: 360, bottom: 430, valley: 500, rock: '#7f95c6', snow: '#eef3ff', depth: 55, shade: 0.16 },
];

// A row of pines along the bottom. Each has three tiers, a lit left half,
// and snow resting along the bottom edge of every tier.
function pines(seed, { base, minH, maxH, gap }) {
  const rand = seeded(seed);
  let bodies = '';
  let lit = '';
  let snow = '';
  for (let x = -20; x < WIDTH + 20; x += gap[0] + rand() * gap[1]) {
    const h = minH + rand() * (maxH - minH);
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

const RIDGES = RANGES.map(r => {
  const { path, apexes, rand } = ridge(r.seed, r);
  return { ...r, path, snowD: snowPath(apexes, rand, r.depth), shadeD: shadePath(apexes, rand) };
});
const BACK_PINES  = pines(57, { base: HEIGHT - 26, minH: 34, maxH: 60, gap: [12, 16] });
const FRONT_PINES = pines(41, { base: HEIGHT - 10, minH: 50, maxH: 120, gap: [18, 26] });

// Layered mountain ranges with snowcaps, a two-row treeline and snow
// falling in three layers (small and slow far away, large and drifting up
// close) under a pale winter sky. `page` is the full version for the public
// pages; `app` sits lower and quieter behind the signed-in app.
export default function SnowyPeaks({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-peaks-sky absolute inset-0" />
      <div className="aura-peaks-sun absolute" />
      <div className={`aura-peaks-range absolute inset-x-0 bottom-0 ${page ? 'h-[58vh] min-h-[300px]' : 'h-[46vh] min-h-[240px]'}`}>
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            {RIDGES.map((r, i) => (
              <clipPath key={i} id={`peaks-clip-${i}`}><path d={r.path} /></clipPath>
            ))}
            <linearGradient id="peaks-mist" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {RIDGES.map((r, i) => (
            <g key={i}>
              <path d={r.path} fill={r.rock} />
              <g clipPath={`url(#peaks-clip-${i})`}>
                <path d={r.snowD} fill={r.snow} />
                <path d={r.shadeD} fill="#2a3f78" opacity={r.shade} />
              </g>
              {/* Mist settling in the valleys in front of each range */}
              <rect x="-60" y={r.valley - 90} width={WIDTH + 120} height="140" fill="url(#peaks-mist)" opacity="0.7" />
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
          <rect x="-60" y={HEIGHT - 12} width={WIDTH + 120} height="12" fill="#f4f7ff" />
        </svg>
      </div>
      <div className="aura-snow aura-snow-far absolute inset-x-0" />
      <div className="aura-snow aura-snow-near absolute inset-x-0" />
      <div className="aura-snow aura-snow-close absolute inset-x-0" />
    </>
  );
}
