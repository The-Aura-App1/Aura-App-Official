import React from 'react';
import seeded from './seeded';
import ChimneySmoke from './ChimneySmoke';

const WIDTH = 1600;
const HEIGHT = 420;

// Each hill line is a sum of slow waves, so the crest height is known at
// any x and things (the farmhouse, the tree, the fence) can sit right on it.
const far  = x => 172 + 20 * Math.sin(x / 170 + 1.1) + 9 * Math.sin(x / 61 + 2.3) + 6 * Math.sin(x / 23 + 0.4);
const mid  = x => 236 + 24 * Math.sin(x / 240 + 0.4) + 8 * Math.sin(x / 88 + 1.6) + 3 * Math.sin(x / 31);
const near = x => 292 + 46 * (x / WIDTH) ** 1.4 + 10 * Math.sin(x / 150 + 2.2) + 3 * Math.sin(x / 37 + 1);

function crestPoints(fn) {
  const pts = [];
  for (let x = -40; x <= WIDTH + 40; x += 16) pts.push([x, fn(x)]);
  return pts;
}
const line = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y.toFixed(1)}`).join(' ');
const hill = fn => `${line(crestPoints(fn))} L ${WIDTH + 40} ${HEIGHT} L -40 ${HEIGHT} Z`;

const FAR_D  = hill(far);
const MID_D  = hill(mid);
const NEAR_D = hill(near);
// The crests alone, for the thin line of light along each one.
const FAR_RIM  = line(crestPoints(far));
const MID_RIM  = line(crestPoints(mid));
const NEAR_RIM = line(crestPoints(near));

// Grass tufts along the front hill: three blades each, leaning a little.
const TUFTS = (() => {
  const rand = seeded(31);
  let d = '';
  for (let x = 10; x < WIDTH; x += 22 + rand() * 46) {
    const y = near(x) + 1;
    const h = 5 + rand() * 6;
    const lean = (rand() - 0.5) * 4;
    d += `M ${(x - 3).toFixed(1)} ${y.toFixed(1)} q ${(-1 + lean).toFixed(1)} ${(-h * 0.6).toFixed(1)} ${(-3 + lean).toFixed(1)} ${(-h).toFixed(1)} `;
    d += `M ${x.toFixed(1)} ${y.toFixed(1)} q ${(0.5 + lean).toFixed(1)} ${(-h * 0.7).toFixed(1)} ${lean.toFixed(1)} ${(-h * 1.25).toFixed(1)} `;
    d += `M ${(x + 3).toFixed(1)} ${y.toFixed(1)} q ${(1.5 + lean).toFixed(1)} ${(-h * 0.5).toFixed(1)} ${(3.5 + lean).toFixed(1)} ${(-h * 0.85).toFixed(1)} `;
  }
  return d;
})();

// A split-rail fence running down the front hill, its posts a little uneven.
const FENCE = (() => {
  const rand = seeded(12);
  const posts = [];
  for (let x = 1010; x < WIDTH + 30; x += 40 + rand() * 12) {
    posts.push({ x, y: near(x) + 2, h: 17 + rand() * 4, tilt: (rand() - 0.5) * 6 });
  }
  const rail = k => posts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${(p.y - p.h * k).toFixed(1)}`).join(' ');
  return { posts, rails: `${rail(0.78)} ${rail(0.4)}` };
})();

// Fireflies over the front hill on summer nights, each blinking on its own
// slow rhythm and wandering a little.
const FIREFLIES = (() => {
  const rand = seeded(77);
  return Array.from({ length: 16 }, () => {
    const x = 60 + rand() * (WIDTH - 120);
    return {
      x, y: near(x) - 8 - rand() * 46, r: 1.3 + rand() * 1.1,
      dur: (5 + rand() * 6).toFixed(2), delay: (-rand() * 11).toFixed(2), drift: (rand() * 2 - 1).toFixed(2),
    };
  });
})();

const HOUSE_X = 380;
const TREE_X = 1180;

function Farmhouse() {
  const y = mid(HOUSE_X) + 5;
  return (
    <g transform={`translate(${HOUSE_X} ${y.toFixed(1)})`}>
      <ChimneySmoke x={16} y={-52} className="aura-meadow-smoke" />
      {/* Barn */}
      <path className="aura-meadow-building" d="M 26 0 L 26 -22 L 47 -40 L 72 -22 L 72 0 Z" />
      {/* House, with its chimney */}
      <path className="aura-meadow-building" d="M -28 0 L -28 -29 L 0 -50 L 28 -29 L 28 0 Z M 12 -40 L 12 -54 L 20 -54 L 20 -34 Z" />
      <path className="aura-meadow-roofline" d="M -31 -28 L 0 -51 L 31 -28 M 24 -21 L 47 -41 L 75 -21" />
      <rect className="aura-meadow-window" x="-17" y="-21" width="8" height="9" rx="0.8" />
      <rect className="aura-meadow-window aura-meadow-window-late" x="6" y="-21" width="8" height="9" rx="0.8" />
      <rect className="aura-meadow-window aura-meadow-window-dim" x="-3" y="-41" width="6" height="7" rx="0.8" />
    </g>
  );
}

// A broad old oak alone on the crest, in front of the rising sun, its
// crown swaying very slightly.
function LoneTree() {
  const y = mid(TREE_X) + 3;
  return (
    <g transform={`translate(${TREE_X} ${y.toFixed(1)})`}>
      <path className="aura-meadow-tree" d="M -4 0 C -3 -14 -6 -22 -12 -30 L -9 -31 C -4 -25 -1 -21 0 -17 C 2 -24 6 -30 13 -34 L 15 -31 C 9 -27 5 -20 4 -12 C 4 -7 5 -3 6 0 Z" />
      <g className="aura-meadow-crown">
        {[[0, -50, 22], [-20, -40, 17], [19, -42, 18], [-9, -64, 16], [11, -62, 15], [-30, -32, 11], [30, -34, 11], [1, -36, 18]].map(([cx, cy, r], i) => (
          <circle key={i} className="aura-meadow-tree" cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </g>
  );
}

// The ground for Day and Night: one place, rolling hills with a farmhouse,
// a lone oak and a fence, seen at dawn (mist in the valleys, the sun just
// up behind the far hills) or at night (lit windows, fireflies). Colors
// come from CSS (.aura-meadow in index.css), so the `dark` class flips it.
export default function Meadow({ className = '' }) {
  return (
    <div className={`aura-meadow absolute inset-x-0 bottom-0 ${className}`}>
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <radialGradient id="meadow-sun">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset="35%" stopColor="#ffe9c9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd2a6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="meadow-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="aura-meadow-mist-stop" stopOpacity="0" />
            <stop offset="60%" className="aura-meadow-mist-stop" stopOpacity="0.85" />
            <stop offset="100%" className="aura-meadow-mist-stop" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g className="aura-meadow-sun">
          <circle cx="1105" cy="176" r="150" fill="url(#meadow-sun)" />
          <circle cx="1105" cy="176" r="30" fill="#fffaf0" />
        </g>
        <path className="aura-meadow-far" d={FAR_D} />
        <path className="aura-meadow-rim aura-meadow-rim-far" d={FAR_RIM} />
        <rect className="aura-meadow-mist" x="-40" y="170" width={WIDTH + 80} height="100" fill="url(#meadow-mist)" />
        <Farmhouse />
        <LoneTree />
        <path className="aura-meadow-mid" d={MID_D} />
        <path className="aura-meadow-rim" d={MID_RIM} />
        <rect className="aura-meadow-mist" x="-40" y="226" width={WIDTH + 80} height="64" fill="url(#meadow-mist)" opacity="0.5" />
        <path className="aura-meadow-near" d={NEAR_D} />
        <path className="aura-meadow-rim" d={NEAR_RIM} />
        <path className="aura-meadow-tufts" d={TUFTS} />
        <g className="aura-meadow-fence">
          {FENCE.posts.map((p, i) => (
            <rect key={i} x={p.x - 1.6} y={p.y - p.h} width="3.2" height={p.h} rx="0.8"
              transform={`rotate(${p.tilt.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`} />
          ))}
          <path d={FENCE.rails} fill="none" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="aura-meadow-fireflies">
          {FIREFLIES.map((f, i) => (
            <circle key={i} className="aura-firefly" cx={f.x.toFixed(1)} cy={f.y.toFixed(1)} r={f.r.toFixed(2)}
              style={{ animationDuration: `${f.dur}s, ${(f.dur * 2.3).toFixed(2)}s`, animationDelay: `${f.delay}s`, '--drift': f.drift }} />
          ))}
        </g>
      </svg>
    </div>
  );
}
