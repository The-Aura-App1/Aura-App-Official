import React from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';

// City Skies: a dreamy city at night, seen from a rooftop. A big soft moon
// and stars over a violet sky that glows magenta towards the horizon, slow
// clouds lit from below, searchlights sweeping, an airship drifting past,
// and a monorail gliding through the city. On a hill in the distance, on the
// left, the AURA sign stands floodlit. In front, the rooftop's parapet with
// strings of warm lights and a water tower.

const WIDTH = 1600;
const HEIGHT = 560;
const ROOF = 505;          // top of the parapet

// ── The skyline ───────────────────────────────────────────────────────

// A row of buildings standing on `base`, packed side by side. Each gets a
// top: flat, stepped back (art deco), a spire with an antenna, a dome, or a
// slanted roof. `heightAt(x)` scales heights across the row, so the city can
// stay low under the hill on the left. Returns the outline, the boxes that
// can hold windows, and the antenna tips (for blinking lights).
function skyline(seed, { base, minW, maxW, minH, maxH, heightAt = () => 1 }) {
  const rand = seeded(seed);
  let d = '';
  const bodies = [];
  const tips = [];
  for (let x = -40; x < WIDTH + 40;) {
    const w = minW + rand() * (maxW - minW);
    const h = (minH + rand() ** 1.3 * (maxH - minH)) * heightAt(x + w / 2);
    const top = base - h;
    const kind = rand();
    const rect = (x0, y0, w0) => `M ${x0.toFixed(1)} ${base} V ${y0.toFixed(1)} H ${(x0 + w0).toFixed(1)} V ${base} Z `;
    d += rect(x, top, w);
    if (kind < 0.25) {
      // Setbacks
      const s1 = h * (0.08 + rand() * 0.06);
      d += rect(x + w * 0.15, top - s1, w * 0.7);
      d += rect(x + w * 0.32, top - s1 * 2, w * 0.36);
      if (rand() < 0.5) {
        d += rect(x + w / 2 - 1, top - s1 * 2 - 18, 2);
        tips.push({ x: x + w / 2, y: top - s1 * 2 - 18 });
      }
    } else if (kind < 0.42) {
      // Spire
      const sp = h * (0.25 + rand() * 0.2);
      d += `M ${(x + w * 0.2).toFixed(1)} ${top.toFixed(1)} L ${(x + w / 2).toFixed(1)} ${(top - sp).toFixed(1)} L ${(x + w * 0.8).toFixed(1)} ${top.toFixed(1)} Z `;
      d += rect(x + w / 2 - 0.8, top - sp - 16, 1.6);
      tips.push({ x: x + w / 2, y: top - sp - 16 });
    } else if (kind < 0.56) {
      // Dome
      const r = w * 0.36;
      d += `M ${(x + w / 2 - r).toFixed(1)} ${top.toFixed(1)} A ${r.toFixed(1)} ${(r * 0.8).toFixed(1)} 0 0 1 ${(x + w / 2 + r).toFixed(1)} ${top.toFixed(1)} Z `;
    } else if (kind < 0.68) {
      // Slanted roof
      d += `M ${x.toFixed(1)} ${top.toFixed(1)} L ${(x + w).toFixed(1)} ${(top - w * 0.4).toFixed(1)} L ${(x + w).toFixed(1)} ${top.toFixed(1)} Z `;
    }
    bodies.push({ x, top, w, h });
    x += w + (rand() < 0.3 ? rand() * 8 : 0);
  }
  return { d, bodies, tips, rand };
}

// Lit windows on a grid over each building, merged into one path per color
// so thousands of them cost almost nothing. Some buildings are busy, some
// nearly dark. A few lit windows are kept apart to switch off and on now
// and then.
const WINDOW_COLORS = ['#ffd894', '#ffd894', '#ffd894', '#ff9fd6', '#9fe6ff'];
function windows(bodies, rand, { cell = [7, 9], size = [3, 4], minLit = 0.1, maxLit = 0.55, flickers = 0 }) {
  const paths = WINDOW_COLORS.map(() => '');
  const lit = [];
  for (const b of bodies) {
    const odds = minLit + rand() * (maxLit - minLit);
    const cols = Math.floor((b.w - 6) / cell[0]);
    const rows = Math.floor((b.h - 12) / cell[1]);
    if (cols < 1 || rows < 1) continue;
    const ox = b.x + (b.w - cols * cell[0]) / 2 + (cell[0] - size[0]) / 2;
    const tint = Math.floor(rand() * WINDOW_COLORS.length);
    for (let r = 0; r < rows; r++) {
      const floorLit = rand() < 0.08;   // now and then a whole floor's lights are on
      for (let c = 0; c < cols; c++) {
        if (!floorLit && rand() > odds) continue;
        const color = rand() < 0.7 ? tint : Math.floor(rand() * WINDOW_COLORS.length);
        const x = ox + c * cell[0];
        const y = b.top + 8 + r * cell[1];
        paths[color] += `M ${x.toFixed(1)} ${y.toFixed(1)} h ${size[0]} v ${size[1]} h ${-size[0]} Z `;
        lit.push({ x, y, color: WINDOW_COLORS[color] });
      }
    }
  }
  const flicker = Array.from({ length: Math.min(flickers, lit.length) }, () => {
    const w = lit[Math.floor(rand() * lit.length)];
    return { ...w, duration: 14 + rand() * 26, delay: -rand() * 40 };
  });
  return { paths, flicker };
}

// The left of the city stays low so the hill and its sign show above it.
const lowOnLeft = x => (x < 520 ? 0.62 : x < 760 ? 0.62 + (x - 520) / 240 * 0.38 : 1);

const FAR = skyline(3, { base: 470, minW: 28, maxW: 74, minH: 70, maxH: 200, heightAt: lowOnLeft });
const FAR_WINDOWS = windows(FAR.bodies, FAR.rand, { cell: [6, 8], size: [1.6, 2], minLit: 0.04, maxLit: 0.2 });
const MID = skyline(9, { base: 540, minW: 40, maxW: 104, minH: 70, maxH: 190, heightAt: x => 0.8 + 0.2 * lowOnLeft(x) });
const MID_WINDOWS = windows(MID.bodies, MID.rand, { flickers: 36 });

// One dreamlike needle of a tower, far taller than the rest, with a soft
// light breathing at its tip.
const NEEDLE_X = 990;
const NEEDLE = `M ${NEEDLE_X - 22} 470 L ${NEEDLE_X - 12} 250 L ${NEEDLE_X - 5} 150 L ${NEEDLE_X - 1.2} 60 L ${NEEDLE_X + 1.2} 60 L ${NEEDLE_X + 5} 150 L ${NEEDLE_X + 12} 250 L ${NEEDLE_X + 22} 470 Z`
  + ` M ${NEEDLE_X - 16} 250 h 32 v 8 h -32 Z M ${NEEDLE_X - 9} 150 h 18 v 6 h -18 Z`;
const NEEDLE_LIGHTS = Array.from({ length: 22 }, (_, i) => {
  const y = 262 + i * 9.5;
  const half = 12 + (y - 250) / 220 * 10 - 4;
  return `M ${(NEEDLE_X - half).toFixed(1)} ${y.toFixed(1)} h ${(half * 2).toFixed(1)} v 1.6 h ${(-half * 2).toFixed(1)} Z`;
}).join(' ');

// Red aircraft lights on the tallest antennas, each on its own beat.
const BEACONS = [...FAR.tips, ...MID.tips]
  .sort((a, b) => a.y - b.y).slice(0, 7)
  .map((t, i) => ({ ...t, delay: -(i * 0.7) }));

// The monorail: a track on slim pillars through the middle of the city.
const RAIL_Y = 478;
const PILLARS = Array.from({ length: 13 }, (_, i) => `M ${-20 + i * 136} ${RAIL_Y + 4} h 5 v 60 h -5 Z`).join(' ');
const TRAIN_CARS = [0, 1, 2, 3, 4];

// ── The rooftop ───────────────────────────────────────────────────────

// Strings of lights draped between posts along the parapet. Each sags in a
// curve; bulbs sit along it, split into three sets that twinkle in turn.
const POSTS = [70, 420, 770, 1120, 1470];
const POST_TOP = 404;
function quad(p0, c, p1, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
}
const STRINGS = POSTS.slice(0, -1).map((x, i) => {
  const p0 = { x, y: POST_TOP + 4 };
  const p1 = { x: POSTS[i + 1], y: POST_TOP + 4 };
  const c = { x: (x + p1.x) / 2, y: POST_TOP + 70 };
  const bulbs = Array.from({ length: 14 }, (_, k) => quad(p0, c, p1, (k + 0.5) / 14));
  return { d: `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`, bulbs };
});
const BULB_SETS = [0, 1, 2].map(set => STRINGS.flatMap(s => s.bulbs.filter((_, k) => k % 3 === set)));

// A water tower standing on the roof, off to the right.
const TOWER_X = 1330;
function WaterTower() {
  return (
    <g>
      <path d={`M ${TOWER_X - 30} ${ROOF} L ${TOWER_X - 24} 380 M ${TOWER_X + 30} ${ROOF} L ${TOWER_X + 24} 380 M ${TOWER_X} ${ROOF} L ${TOWER_X} 380 M ${TOWER_X - 28} 470 L ${TOWER_X + 28} 430 M ${TOWER_X + 28} 470 L ${TOWER_X - 28} 430`}
        stroke="#0b0719" strokeWidth="4" />
      <rect x={TOWER_X - 44} y="376" width="88" height="6" fill="#0b0719" />
      <path d={`M ${TOWER_X - 38} 376 V 300 Q ${TOWER_X} 294 ${TOWER_X + 38} 300 V 376 Z`} fill="#0d0820" />
      <path d={`M ${TOWER_X - 42} 302 L ${TOWER_X} 262 L ${TOWER_X + 42} 302 Z`} fill="#0b0719" />
      {/* Moonlight on the right side, city glow along the rim */}
      <path d={`M ${TOWER_X + 38} 300 V 376 M ${TOWER_X} 262 L ${TOWER_X + 42} 302`} stroke="#b9a4ff" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
      <path d={`M ${TOWER_X - 30} 320 v 50 M ${TOWER_X - 15} 318 v 54 M ${TOWER_X} 317 v 56 M ${TOWER_X + 15} 318 v 54 M ${TOWER_X + 30} 320 v 50`} stroke="#160f30" strokeWidth="1.2" />
    </g>
  );
}

// ── The AURA sign on its hill ─────────────────────────────────────────

// Plain block letters, drawn in a 100-tall box; holes cut with evenodd.
const LETTERS = {
  A: 'M 0 100 L 36 0 L 64 0 L 100 100 L 74 100 L 67 80 L 33 80 L 26 100 Z M 40 60 L 60 60 L 50 30 Z',
  U: 'M 0 0 L 26 0 L 26 64 Q 26 78 50 78 Q 74 78 74 64 L 74 0 L 100 0 L 100 66 Q 100 100 50 100 Q 0 100 0 66 Z',
  R: 'M 0 0 L 62 0 Q 98 0 98 31 Q 98 55 74 62 L 100 100 L 71 100 L 49 65 L 26 65 L 26 100 L 0 100 Z M 26 21 L 26 45 L 58 45 Q 72 45 72 33 Q 72 21 58 21 Z',
};
// Where each letter stands on the slope (x, the foot's y, a slight lean).
const SIGN = [
  { ch: 'A', x: 84,  y: 106, lean: -2 },
  { ch: 'U', x: 126, y: 95,  lean: 1.5 },
  { ch: 'R', x: 168, y: 84,  lean: -1 },
  { ch: 'A', x: 210, y: 75,  lean: 2 },
];
const LETTER_H = 44;
const HILL = 'M 0 200 L 0 118 C 60 104 110 84 170 70 C 220 58 262 50 300 52 C 360 56 420 82 480 112 C 530 138 570 158 600 166 L 600 200 Z';
const FAR_RIDGE = 'M 0 200 L 0 96 C 70 86 120 92 180 98 C 260 104 330 86 410 80 C 480 76 540 92 600 110 L 600 200 Z';

function SignHill() {
  return (
    <div className="aura-city-hill absolute left-0" aria-hidden="true">
      <svg className="block w-full h-auto" viewBox="0 0 600 200">
        <defs>
          <radialGradient id="city-floodlight" cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor="#ffe9f6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffe9f6" stopOpacity="0" />
          </radialGradient>
          <filter id="city-sign-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={FAR_RIDGE} fill="#1f1748" />
        <path d={HILL} fill="#170f36" />
        <path d="M 0 118 C 60 104 110 84 170 70 C 220 58 262 50 300 52 C 360 56 420 82 480 112" fill="none" stroke="#9d86ff" strokeOpacity="0.35" strokeWidth="1.2" />
        {/* Floodlight washing up the slope under the letters */}
        <ellipse cx="166" cy="92" rx="120" ry="40" fill="url(#city-floodlight)" />
        {/* The scaffolding behind each letter */}
        {SIGN.map((l, i) => (
          <path key={`s${i}`} d={`M ${l.x + 7} ${l.y - 8} v 14 M ${l.x + 29} ${l.y - 8} v 14 M ${l.x + 7} ${l.y + 4} L ${l.x + 29} ${l.y - 6}`}
            stroke="#6d5fa8" strokeOpacity="0.7" strokeWidth="0.9" />
        ))}
        <g className="aura-city-sign" filter="url(#city-sign-glow)">
          {SIGN.map((l, i) => (
            <path key={i} d={LETTERS[l.ch]} fill="#f6f0ff" fillRule="evenodd"
              transform={`translate(${l.x} ${l.y - LETTER_H}) rotate(${l.lean} 16 ${LETTER_H}) scale(${(LETTER_H * 0.82) / 100} ${LETTER_H / 100})`} />
          ))}
        </g>
        {/* A few homes' lights scattered on the hillside */}
        {[[40, 132], [66, 126], [330, 92], [372, 104], [410, 116], [452, 132], [500, 150], [118, 120]].map(([x, y], i) => (
          <circle key={`h${i}`} cx={x} cy={y} r="1.3" fill="#ffd894" opacity="0.8" />
        ))}
      </svg>
      {/* The hill carries on down behind the city */}
      <div className="aura-city-hill-base" />
    </div>
  );
}

// ── The sky ───────────────────────────────────────────────────────────

function Airship() {
  return (
    <div className="aura-city-airship absolute" aria-hidden="true">
      <svg className="aura-city-airship-bob block" viewBox="0 0 120 50" width="96" height="40">
        <ellipse cx="60" cy="20" rx="46" ry="15" fill="#2a1f55" />
        <path d="M 14 20 A 46 15 0 0 1 106 20" fill="none" stroke="#c7b5ff" strokeOpacity="0.45" strokeWidth="1.4" />
        <path d="M 10 20 L 2 10 L 2 30 Z" fill="#221a48" />
        <rect x="48" y="34" width="24" height="7" rx="3" fill="#1d1640" />
        <rect x="52" y="36" width="3" height="3" fill="#ffd894" />
        <rect x="58" y="36" width="3" height="3" fill="#ffd894" />
        <rect x="64" y="36" width="3" height="3" fill="#ffd894" />
        <circle className="aura-city-beacon" cx="106" cy="20" r="1.8" fill="#ff5d7a" />
      </svg>
    </div>
  );
}

const CLOUDS = [
  { top: '14vh', left: '-10%', w: '38vw', dur: 160, delay: -40 },
  { top: '26vh', left: '30%',  w: '30vw', dur: 210, delay: -120 },
  { top: '8vh',  left: '55%',  w: '26vw', dur: 190, delay: -70 },
];

export default function CitySkies({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-city-sky absolute inset-0" />
      <div className="aura-city-stars absolute inset-0">
        <div className="absolute inset-0 aura-stars-1 opacity-70" />
        <div className="absolute inset-0 aura-stars-2 opacity-50" />
        <TwinklingStars seed={31} count={50} />
      </div>
      <div className="aura-city-moon absolute" aria-hidden="true" />
      {CLOUDS.map((c, i) => (
        <div key={i} className="aura-city-cloud absolute" aria-hidden="true"
          style={{ top: c.top, left: c.left, width: c.w, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} />
      ))}
      <Airship />

      <div className={`aura-city absolute inset-x-0 bottom-0 ${page ? 'h-[52vh] min-h-[300px]' : 'h-[40vh] min-h-[230px]'}`}>
        <SignHill />
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="city-horizon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c0479a" stopOpacity="0" />
              <stop offset="60%" stopColor="#c0479a" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ff8a7a" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="city-haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d35aa8" stopOpacity="0" />
              <stop offset="100%" stopColor="#d35aa8" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="city-beam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#e9e2ff" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#e9e2ff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="city-glow">
              <stop offset="0%" stopColor="#ffe6c4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffb86b" stopOpacity="0" />
            </radialGradient>
            <filter id="city-beam-soft" x="-50%" y="-10%" width="200%" height="120%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          {/* The city's glow on the sky, always right behind the skyline */}
          <rect x="-200" y="120" width={WIDTH + 400} height="400" fill="url(#city-horizon)" />

          {/* Searchlights sweeping slowly from somewhere in the city */}
          <g filter="url(#city-beam-soft)">
            <path className="aura-city-beam" d="M 780 470 L 742 -60 L 818 -60 Z" fill="url(#city-beam)" />
            <path className="aura-city-beam aura-city-beam-2" d="M 1210 470 L 1172 -60 L 1248 -60 Z" fill="url(#city-beam)" />
          </g>

          <path d={FAR.d} fill="#2b2160" />
          <path d={FAR_WINDOWS.paths.join(' ')} fill="#f3c4ec" opacity="0.55" />
          <path d={NEEDLE} fill="#251c58" />
          <path d={NEEDLE_LIGHTS} fill="#bfe9ff" opacity="0.55" />
          <circle className="aura-city-needle-tip" cx={NEEDLE_X} cy="58" r="14" fill="url(#city-glow)" />
          <circle cx={NEEDLE_X} cy="58" r="2" fill="#fff4e6" />
          {/* Haze of light rising from the streets */}
          <rect x="-200" y="330" width={WIDTH + 400} height="200" fill="url(#city-haze)" />

          <path d={MID.d} fill="#150e33" />
          {MID_WINDOWS.paths.map((d, i) => d && <path key={i} d={d} fill={WINDOW_COLORS[i]} opacity="0.85" />)}
          {MID_WINDOWS.flicker.map((w, i) => (
            <rect key={i} className="aura-city-flicker" x={w.x} y={w.y} width="3" height="4" fill="#150e33"
              style={{ animationDuration: `${w.duration.toFixed(1)}s`, animationDelay: `${w.delay.toFixed(1)}s` }} />
          ))}
          {BEACONS.map((b, i) => (
            <circle key={i} className="aura-city-beacon" cx={b.x} cy={b.y} r="2" fill="#ff5d7a" style={{ animationDelay: `${b.delay}s` }} />
          ))}

          {/* The monorail, and a train gliding along it now and then */}
          <path d={PILLARS} fill="#0f0a26" />
          <g className="aura-city-train">
            {TRAIN_CARS.map(i => (
              <g key={i} transform={`translate(${i * 38} ${RAIL_Y - 11})`}>
                <rect width="35" height="10" rx={i === 0 ? 5 : 2} fill="#2a2063" />
                <rect x="4" y="3" width="27" height="3" rx="1.5" fill="#bff3ff" opacity="0.9" />
              </g>
            ))}
          </g>
          <rect x="-40" y={RAIL_Y - 1} width={WIDTH + 80} height="5" fill="#0f0a26" />
          <rect x="-40" y={RAIL_Y - 1} width={WIDTH + 80} height="1" fill="#ff9fd6" opacity="0.3" />

          {/* The rooftop */}
          <WaterTower />
          {POSTS.map(x => <rect key={x} x={x - 2} y={POST_TOP} width="4" height={ROOF - POST_TOP} fill="#0b0719" />)}
          {STRINGS.map((s, i) => <path key={i} d={s.d} fill="none" stroke="#0b0719" strokeWidth="1.2" />)}
          {BULB_SETS.map((bulbs, set) => (
            <g key={set} className={`aura-city-bulbs aura-city-bulbs-${set}`}>
              {bulbs.map((b, k) => <circle key={k} cx={b.x} cy={b.y + 3} r="9" fill="url(#city-glow)" opacity="0.6" />)}
              {bulbs.map((b, k) => <circle key={`c${k}`} cx={b.x} cy={b.y + 3} r="2.4" fill="#fff0d2" />)}
            </g>
          ))}
          <rect x="-40" y={ROOF} width={WIDTH + 80} height={HEIGHT - ROOF + 20} fill="#0a0618" />
          <rect x="-40" y={ROOF - 6} width={WIDTH + 80} height="8" rx="2" fill="#1a1236" />
          <rect x="-40" y={ROOF - 6} width={WIDTH + 80} height="1.2" fill="#ff9fd6" opacity="0.35" />
          {/* Warm light from the bulbs pooling on the parapet */}
          {STRINGS.map((s, i) => (
            <ellipse key={i} cx={(POSTS[i] + POSTS[i + 1]) / 2} cy={ROOF} rx="150" ry="14" fill="url(#city-glow)" opacity="0.25" />
          ))}
        </svg>
      </div>
    </>
  );
}
