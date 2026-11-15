import React from 'react';
import seeded from './seeded';
import { ridgePoints, areaUnder } from './terrain';
import './dreamscapes.css';

// Abyss: deep under the sea. Shafts of sunlight sway down from a rippling
// surface; the reef falls away in layers of blue haze, arches and all; the
// light's ripples (caustics) wander over the sand. Jellyfish pulse their
// way up, a school of fish turns past, a manta glides through and, now and
// then, a whale crosses far off. Kelp sways at two depths, plankton sparks,
// and bubbles wobble to the surface.

const W = 1600;
const H = 600;

// ── Jellyfish ─────────────────────────────────────────────────────

// A bell with a scalloped rim, centred on the rim at (0, 0)
const BELL = (() => {
  let d = 'M -34 0 C -36 -30 -20 -46 0 -46 C 20 -46 36 -30 34 0';
  for (let i = 0; i < 8; i++) {
    const x0 = 34 - i * 8.5;
    d += ` Q ${(x0 - 4.25).toFixed(2)} 7 ${(x0 - 8.5).toFixed(2)} 0`;
  }
  return `${d} Z`;
})();

const sway = (x, len, k, wiggle) => {
  const a = `M ${x} 2 C ${x + wiggle} ${len * 0.3} ${x - wiggle} ${len * 0.65} ${x + wiggle * 0.4} ${len}`;
  const b = `M ${x} 2 C ${x - wiggle} ${len * 0.3} ${x + wiggle} ${len * 0.65} ${x - wiggle * 0.4} ${len}`;
  return k ? `${a};${b};${a}` : `${b};${a};${b}`;
};

function Jelly({ id, hue, glow, scale }) {
  return (
    <svg width={100 * scale} height={240 * scale} viewBox="-50 -56 100 240" className="overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id={`jelly-${id}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="40%" stopColor={hue} stopOpacity="0.55" />
          <stop offset="100%" stopColor={hue} stopOpacity="0.12" />
        </radialGradient>
      </defs>
      {/* long thin tentacles */}
      <g stroke={hue} strokeOpacity="0.45" strokeWidth="1" fill="none" strokeLinecap="round">
        {[-26, -15, -5, 6, 16, 27].map((x, i) => (
          <path key={x} d={sway(x, 150 + (i % 3) * 22, i % 2, 9).split(';')[0]}>
            <animate attributeName="d" values={sway(x, 150 + (i % 3) * 22, i % 2, 9)} dur={`${3.4 + i * 0.3}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>
      {/* frilly oral arms */}
      <g stroke={hue} strokeOpacity="0.5" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeDasharray="3 2">
        {[-8, 0, 8].map((x, i) => (
          <path key={x} d={sway(x, 70 + i * 8, i % 2, 6).split(';')[0]}>
            <animate attributeName="d" values={sway(x, 70 + i * 8, i % 2, 6)} dur={`${2.8 + i * 0.4}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>
      <g className="aura-abyss-bell" style={{ filter: `drop-shadow(0 0 12px ${glow})` }}>
        <path d={BELL} fill={`url(#jelly-${id})`} />
        <ellipse cx="0" cy="-16" rx="13" ry="9" fill="#ffffff" opacity="0.25" />
        {[-12, 0, 12].map(x => <circle key={x} cx={x} cy="-8" r="3.5" fill={glow} opacity="0.6" />)}
        <path d="M -24 -8 C -22 -28 -10 -38 0 -38" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const JELLIES = [
  { id: 'a', left: '16%', hue: '#c084fc', glow: '#d8b4fe', scale: 1,    dur: 66, delay: -12, sway: 28 },
  { id: 'b', left: '70%', hue: '#67e8f9', glow: '#a5f3fc', scale: 0.78, dur: 82, delay: -50, sway: 40 },
  { id: 'c', left: '46%', hue: '#f9a8d4', glow: '#fbcfe8', scale: 0.55, dur: 94, delay: -72, sway: 30 },
  { id: 'd', left: '86%', hue: '#a5b4fc', glow: '#c7d2fe', scale: 0.42, dur: 110, delay: -25, sway: 22 },
];

// ── Fish, manta and whale ─────────────────────────────────────────

const FISH = 'M 0 0 C 4 -3.4 11 -3.6 15 0 C 11 3.6 4 3.4 0 0 Z M 1 0 L -5 -3.4 L -3.6 0 L -5 3.4 Z';
const SCHOOL = (() => {
  const rand = seeded(19);
  return Array.from({ length: 30 }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    return { x: Math.cos(a) * r * 90, y: Math.sin(a) * r * 34, s: 0.7 + rand() * 0.5, d: -rand() * 2 };
  });
})();

const MANTA = 'M 46 0 C 36 -8 14 -52 -26 -76 C -14 -44 -22 -16 -38 -6 L -100 -1 L -100 1 L -38 6 C -22 16 -14 44 -26 76 C 14 52 36 8 46 0 Z M 46 -6 L 54 -10 L 50 -2 Z M 46 6 L 54 10 L 50 2 Z';
const WHALE = 'M 0 0 C 30 -24 110 -30 190 -20 C 240 -14 280 -2 310 10 C 330 4 346 -10 362 -14 C 356 0 352 8 350 16 C 356 26 362 36 370 44 C 352 40 336 30 320 22 C 290 30 240 34 190 32 C 140 30 90 26 50 20 C 26 16 8 10 0 0 Z M 120 24 C 112 46 94 66 70 78 C 86 60 96 42 100 26 Z';

// ── Reef ──────────────────────────────────────────────────────────

const FAR_REEF = ridgePoints(5, { y: 330, amp: 120, rough: 0.55, anchors: [[300, 250], [900, 300], [1350, 240]] });
const MID_REEF = ridgePoints(17, { y: 430, amp: 80, rough: 0.55, anchors: [[200, 380], [700, 440], [1200, 370]] });
const FLOOR = ridgePoints(29, { y: 520, amp: 24, rough: 0.5, passes: 6 });
// A rock arch in the far reef
const ARCH = 'M 1040 360 C 1040 250 1090 200 1150 200 C 1210 200 1260 250 1260 360 L 1225 360 C 1225 285 1195 250 1150 250 C 1105 250 1075 285 1075 360 Z';

// Sea fans: branching, like fine coral trees
function seaFan(seed, x, y, size) {
  const rand = seeded(seed);
  let d = '';
  const branch = (bx, by, angle, len, depth) => {
    const ex = bx + Math.sin(angle) * len;
    const ey = by - Math.cos(angle) * len;
    d += `M ${bx.toFixed(1)} ${by.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)} `;
    if (depth > 0) {
      branch(ex, ey, angle - 0.35 - rand() * 0.25, len * 0.72, depth - 1);
      branch(ex, ey, angle + 0.35 + rand() * 0.25, len * 0.72, depth - 1);
    }
  };
  branch(x, y, (rand() - 0.5) * 0.3, size * 0.35, 5);
  return d;
}
const FANS = [seaFan(3, 260, 470, 180), seaFan(4, 1330, 450, 200), seaFan(6, 620, 500, 110), seaFan(7, 1010, 495, 120)];

// Kelp: a wavy stem with leaf blades along it, swaying from its holdfast
function kelp(rand, x, base, h) {
  let stem = `M ${x.toFixed(1)} ${base}`;
  let leaves = '';
  let cx = x;
  for (let y = 0; y < h; y += 34) {
    const nx = x + Math.sin(y / 60 + x) * 10;
    stem += ` Q ${(cx + (rand() - 0.5) * 16).toFixed(1)} ${(base - y - 17).toFixed(1)} ${nx.toFixed(1)} ${(base - y - 34).toFixed(1)}`;
    const side = (y / 34) % 2 ? 1 : -1;
    const ly = base - y - 26;
    leaves += `M ${nx.toFixed(1)} ${ly.toFixed(1)} C ${(nx + side * 14).toFixed(1)} ${(ly - 10).toFixed(1)} ${(nx + side * 26).toFixed(1)} ${(ly - 2).toFixed(1)} ${(nx + side * 30).toFixed(1)} ${(ly + 6).toFixed(1)} C ${(nx + side * 18).toFixed(1)} ${(ly + 4).toFixed(1)} ${(nx + side * 8).toFixed(1)} ${(ly + 2).toFixed(1)} ${nx.toFixed(1)} ${ly.toFixed(1)} Z `;
    cx = nx;
  }
  return { stem, leaves };
}
function kelpBed(seed, count, { base, minH, maxH, spots }) {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = spots[i % spots.length] + (rand() - 0.5) * 120;
    const k = kelp(rand, x, base + rand() * 12, minH + rand() * (maxH - minH));
    return { ...k, x, dur: 5 + rand() * 4, delay: -rand() * 6 };
  });
}
const KELP_MID = kelpBed(41, 12, { base: 500, minH: 140, maxH: 260, spots: [150, 420, 1150, 1450, 820] });
const KELP_NEAR = kelpBed(43, 7, { base: 610, minH: 260, maxH: 420, spots: [40, 260, 1360, 1570] });
const TIPS = [[180, 452], [236, 446], [1290, 446], [1350, 438], [1420, 450], [640, 476], [960, 482], [560, 470], [720, 478], [1040, 470]];

// ── Particles ─────────────────────────────────────────────────────

function makeBubbles(seed, count) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({ left: rand() * 100, size: 3 + rand() ** 2 * 11, dur: 9 + rand() * 12, delay: -rand() * 20, wobble: 1.6 + rand() * 1.6 }));
}
const BUBBLES = makeBubbles(17, 22);
function makePlankton(seed, count) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    left: rand() * 100, top: 20 + rand() * 75, size: 1.5 + rand() * 2.5,
    dur: 3 + rand() * 5, delay: -rand() * 8, color: rand() < 0.6 ? '#67e8f9' : '#a5b4fc',
  }));
}
const PLANKTON = makePlankton(29, 40);
const BOKEH = Array.from({ length: 7 }, (_, i) => ({ left: (i * 31 + 7) % 100, top: 15 + ((i * 47) % 70), size: 14 + (i % 3) * 10, dur: 30 + i * 6, delay: -i * 7 }));

function Kelp({ bed, fill, leafFill }) {
  return bed.map((k, i) => (
    <g key={i} className="aura-abyss-kelp" style={{ transformOrigin: `${k.x.toFixed(0)}px ${H}px`, animationDuration: `${k.dur}s`, animationDelay: `${k.delay}s` }}>
      <path d={k.stem} fill="none" stroke={fill} strokeWidth="4" strokeLinecap="round" />
      <path d={k.leaves} fill={leafFill} />
    </g>
  ));
}

export default function Abyss({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-abyss-water absolute inset-0" />
      <div className="aura-abyss-surface absolute inset-x-0 top-0" aria-hidden="true" />
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className={`aura-abyss-ray aura-abyss-ray-${i}`} />)}
      </div>
      <div className="aura-abyss-snow absolute inset-0" aria-hidden="true" />

      <div className="aura-abyss-whale absolute" aria-hidden="true">
        <svg viewBox="-10 -40 390 130" className="w-full h-full" style={{ transform: 'scaleX(-1)' }}>
          <path d={WHALE} fill="#0b2a46" />
        </svg>
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[58vh] min-h-[300px]' : 'h-[48vh] min-h-[250px]'}`}>
        {/* The far reef and its arch, deep in blue haze */}
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="abyss-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14466a" />
              <stop offset="100%" stopColor="#0b2f4f" />
            </linearGradient>
            <linearGradient id="abyss-haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3aa0c0" stopOpacity="0" />
              <stop offset="100%" stopColor="#3aa0c0" stopOpacity="0.32" />
            </linearGradient>
            <filter id="abyss-rock" x="-5%" y="-10%" width="110%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="6" />
              <feDisplacementMap in="SourceGraphic" scale="12" />
            </filter>
          </defs>
          <g filter="url(#abyss-rock)" opacity="0.78">
            <path d={areaUnder(FAR_REEF, H)} fill="url(#abyss-far)" />
            <path d={ARCH} fill="url(#abyss-far)" />
          </g>
          <rect x="-80" y="200" width={W + 160} height="300" fill="url(#abyss-haze)" />
        </svg>

        {/* The manta, gliding through the middle distance */}
        <div className="aura-abyss-manta absolute" aria-hidden="true">
          <svg viewBox="-110 -80 170 160" className="w-full h-full overflow-visible">
            <g className="aura-abyss-manta-flap"><path d={MANTA} fill="#0a2c49" /></g>
          </svg>
        </div>

        {/* The mid reef: rocks, sea fans and kelp */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="abyss-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0c3352" />
              <stop offset="100%" stopColor="#061a2e" />
            </linearGradient>
            <filter id="abyss-rock2" x="-5%" y="-10%" width="110%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="9" />
              <feDisplacementMap in="SourceGraphic" scale="10" />
            </filter>
          </defs>
          <path d={areaUnder(MID_REEF, H)} fill="url(#abyss-mid)" filter="url(#abyss-rock2)" />
          <Kelp bed={KELP_MID} fill="#0f4440" leafFill="#0f4a44" />
          <path d={FANS.join(' ')} stroke="#0e3d56" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>

        {/* The sea floor, with light rippling over the sand */}
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="abyss-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a4a63" />
              <stop offset="100%" stopColor="#06182a" />
            </linearGradient>
            <clipPath id="abyss-floor-clip"><path d={areaUnder(FLOOR, H)} /></clipPath>
          </defs>
          <path d={areaUnder(FLOOR, H)} fill="url(#abyss-floor)" />
        </svg>
        <div className="absolute inset-0 overflow-hidden aura-abyss-caustic-wrap" aria-hidden="true">
          <svg className="aura-abyss-caustics absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
            <defs>
              <filter id="abyss-caustic" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="turbulence" baseFrequency="0.012 0.03" numOctaves="2" seed="4" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.75  0 0 0 0 0.97  0 0 0 0 1  -4.5 0 0 0 1.05" />
              </filter>
            </defs>
            <g clipPath="url(#abyss-floor-clip)">
              <rect x="-200" y="440" width={W + 400} height="200" filter="url(#abyss-caustic)" />
            </g>
          </svg>
        </div>

        {/* The near reef: dark rocks, glowing coral tips and tall kelp */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <radialGradient id="abyss-tip">
              <stop offset="0%" stopColor="#a5f3fc" stopOpacity="1" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M -40 600 L -40 470 C 60 430 150 420 240 460 C 300 440 360 470 380 520 C 400 560 420 580 430 600 Z M 1190 600 C 1210 540 1260 470 1340 456 C 1420 440 1500 430 1640 470 L 1640 600 Z M 560 600 C 590 560 650 548 700 566 C 740 556 780 580 790 600 Z"
            fill="#030e1a" filter="url(#abyss-rock2)" />
          {TIPS.map(([x, y], i) => (
            <circle key={i} className="aura-abyss-tip" cx={x} cy={y} r="9" fill="url(#abyss-tip)" style={{ animationDelay: `${-i * 0.9}s` }} />
          ))}
          <Kelp bed={KELP_NEAR} fill="#06221f" leafFill="#082a26" />
        </svg>
      </div>

      {/* Life in open water */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="aura-abyss-school absolute">
          <svg viewBox="-110 -50 220 100" className="w-full h-full overflow-visible">
            {SCHOOL.map((f, i) => (
              <g key={i} transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${f.s.toFixed(2)})`}>
                <path className="aura-abyss-fish" d={FISH} fill="#1f5c80" style={{ animationDelay: `${f.d.toFixed(2)}s` }} />
              </g>
            ))}
          </svg>
        </div>
        {PLANKTON.map((p, i) => (
          <span key={i} className="aura-abyss-plankton absolute rounded-full"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, background: p.color, color: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
        ))}
        {JELLIES.map(j => (
          <div key={j.id} className="aura-abyss-jelly absolute" style={{ left: j.left, '--sway': `${j.sway}px`, animationDuration: `${j.dur}s`, animationDelay: `${j.delay}s` }}>
            <Jelly {...j} />
          </div>
        ))}
        {BUBBLES.map((b, i) => (
          <span key={i} className="aura-abyss-bubble-rise absolute bottom-0" style={{ left: `${b.left}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}>
            <span className="aura-abyss-bubble block rounded-full" style={{ width: b.size, height: b.size, animationDuration: `${b.wobble}s` }} />
          </span>
        ))}
        {BOKEH.map((b, i) => (
          <span key={i} className="aura-abyss-bokeh absolute rounded-full"
            style={{ left: `${b.left}%`, top: `${b.top}%`, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
        ))}
      </div>
    </>
  );
}
