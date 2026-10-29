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
  { seed: 5,  peaks: 5, top: 150, bottom: 260, valley: 330, rock: '#c9d5ef', snow: '#f7f9ff', depth: 70,  shade: 0.08 },
  { seed: 17, peaks: 6, top: 270, bottom: 350, valley: 420, rock: '#a5b7de', snow: '#f2f6ff', depth: 60,  shade: 0.12 },
  { seed: 29, peaks: 4, top: 360, bottom: 430, valley: 500, rock: '#7f95c6', snow: '#eef3ff', depth: 55,  shade: 0.16 },
];

// A row of snowy pines along the bottom edge.
function pines(seed) {
  const rand = seeded(seed);
  const trees = [];
  for (let x = -20; x < WIDTH + 20; x += 18 + rand() * 26) {
    const h = 50 + rand() * 70;
    const w = h * (0.42 + rand() * 0.1);
    const top = HEIGHT - 10 - h + rand() * 18;
    const tier = (f, spread) => [x - w * spread, top + h * f];
    const [l1, l2, l3] = [tier(0.36, 0.28), tier(0.66, 0.4), tier(1, 0.52)];
    trees.push(
      `M ${x} ${top} L ${l1[0]} ${l1[1]} L ${x - w * 0.12} ${l1[1] - 2} L ${l2[0]} ${l2[1]} L ${x - w * 0.18} ${l2[1] - 3}` +
      ` L ${l3[0]} ${l3[1]} L ${2 * x - l3[0]} ${l3[1]} L ${x + w * 0.18} ${l2[1] - 3} L ${2 * x - l2[0]} ${l2[1]}` +
      ` L ${x + w * 0.12} ${l1[1] - 2} L ${2 * x - l1[0]} ${l1[1]} Z`
    );
  }
  return trees.join(' ');
}

const RIDGES = RANGES.map(r => {
  const { path, apexes, rand } = ridge(r.seed, r);
  return { ...r, path, snow: snowPath(apexes, rand, r.depth), snowColor: r.snow, shadeD: shadePath(apexes, rand) };
});
const PINES = pines(41);

// Layered mountain ranges with snowcaps, a pine treeline and gently falling
// snow under a pale winter sky. `page` is the full version for the public
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
                <path d={r.snow} fill={r.snowColor} />
                <path d={r.shadeD} fill="#2a3f78" opacity={r.shade} />
              </g>
              {/* Mist settling in the valleys in front of each range */}
              <rect x="-60" y={r.valley - 90} width={WIDTH + 120} height="140" fill="url(#peaks-mist)" opacity="0.7" />
            </g>
          ))}
          <path d={PINES} fill="#4a5f93" />
          <rect x="-60" y={HEIGHT - 14} width={WIDTH + 120} height="14" fill="#f4f7ff" />
        </svg>
      </div>
      <div className="aura-snow aura-snow-far absolute inset-x-0" />
      <div className="aura-snow aura-snow-near absolute inset-x-0" />
    </>
  );
}
