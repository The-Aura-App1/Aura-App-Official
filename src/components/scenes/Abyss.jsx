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
// A humpback, swimming right: about 420 long, centred on y 0. Dark back
// lit from above, pale throat with grooves, the long knobbly flippers that
// give humpbacks their name, and flukes that beat slowly.
const WHALE_BODY = 'M 70 -6 C 120 -22 200 -40 290 -40 C 340 -40 382 -32 404 -16 C 416 -8 421 2 415 10 C 398 26 342 40 280 42 C 200 44 122 22 70 6 Z';
const WHALE_BELLY = 'M 415 10 C 398 26 342 40 280 42 C 200 44 122 22 70 6 L 70 2 C 140 10 220 16 290 14 C 340 12 380 8 415 4 Z';
const WHALE_GROOVES = Array.from({ length: 6 }, (_, k) =>
  `M ${404 - k * 5} ${12 + k * 3.4} C ${360 - k * 4} ${26 + k * 2.4} ${300 - k * 6} ${34 + k * 1.6} ${236 - k * 10} ${34 + k * 0.6}`).join(' ');
// the flukes seen at an angle: the near lobe up, the far one smaller and darker below
const WHALE_TAIL = 'M 76 -6 C 56 -4 44 -2 34 -1 C 22 -8 6 -26 -16 -36 C -10 -24 -8 -12 -12 -3 L -4 0 L 34 1 C 44 2 56 4 76 6 Z';
const WHALE_TAIL_FAR = 'M 34 0 C 22 6 8 16 -6 22 C -4 15 -5 8 -8 2 L -4 0 Z';
const WHALE_FLIPPER = 'M 306 18 C 302 30 296 40 288 50 C 284 54 282 58 278 62 C 272 70 264 76 256 84 C 250 90 242 96 234 102 C 228 106 222 104 226 98 C 244 80 262 58 276 36 C 280 28 284 22 286 16 Z';
const WHALE_KNOBS = [[402, -18], [394, -23], [384, -27], [408, -10], [396, -12]];

function Whale() {
  return (
    <svg viewBox="-30 -60 470 180" className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="whale-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6a8f" />
          <stop offset="45%" stopColor="#163d5c" />
          <stop offset="100%" stopColor="#0d2a44" />
        </linearGradient>
        <linearGradient id="whale-belly" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d9fba" />
          <stop offset="100%" stopColor="#3c6d8a" />
        </linearGradient>
        <linearGradient id="whale-fin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7fb0c8" />
          <stop offset="100%" stopColor="#2e5f7e" />
        </linearGradient>
        <clipPath id="whale-clip"><path d={WHALE_BODY} /></clipPath>
      </defs>
      {/* the far flipper, behind the body */}
      <path d={WHALE_FLIPPER} fill="#173f5c" transform="translate(-22 -6) rotate(-10 296 18)" />
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-6 78 0; 6 78 0; -6 78 0" dur="5s" repeatCount="indefinite" />
        <path d={WHALE_TAIL_FAR} fill="#143a58" />
        <path d={WHALE_TAIL} fill="#1d4b6d" />
        <path d="M -16 -36 C 6 -26 22 -8 34 -1" stroke="#5f97b5" strokeOpacity="0.5" strokeWidth="1.2" fill="none" />
      </g>
      <path d={WHALE_BODY} fill="url(#whale-back)" />
      <g clipPath="url(#whale-clip)">
        <path d={WHALE_BELLY} fill="url(#whale-belly)" />
        <path d={WHALE_GROOVES} stroke="#2a5674" strokeOpacity="0.7" strokeWidth="1" fill="none" />
        {/* dappled light from the surface on its back */}
        <ellipse cx="260" cy="-38" rx="120" ry="10" fill="#8fd3ef" opacity="0.18" />
      </g>
      {/* the rim of light along its back */}
      <path d="M 90 -12 C 140 -26 210 -40 290 -40 C 340 -40 382 -32 404 -16" stroke="#9fdcf5" strokeOpacity="0.45" strokeWidth="1.4" fill="none" />
      <path d="M 168 -30 C 174 -36 180 -40 188 -41 C 185 -37 185 -34 188 -31 Z" fill="#163d5c" />
      {/* knobs on the head, mouth line, eye */}
      {WHALE_KNOBS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#4c86a6" opacity="0.8" />)}
      <path d="M 415 8 C 398 11 376 12 352 7" stroke="#0a2034" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="360" cy="2" r="2.6" fill="#06131f" />
      <path d="M 355 -1 C 358 -4 363 -4 365 -1" stroke="#5f97b5" strokeOpacity="0.6" strokeWidth="0.8" fill="none" />
      {/* the near flipper, sweeping slowly */}
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-5 300 18; 6 300 18; -5 300 18" dur="7s" repeatCount="indefinite" />
        <path d={WHALE_FLIPPER} fill="url(#whale-fin)" />
        <path d="M 306 18 C 300 34 290 50 278 62 C 266 76 250 90 234 102" stroke="#b7e2f2" strokeOpacity="0.5" strokeWidth="1" fill="none" />
      </g>
    </svg>
  );
}

// ── The wreck ─────────────────────────────────────────────────────

// A small sailing ship lying tilted in the sand, bow to the right. Local
// coordinates: the keel runs along y 6, the stern at x -20, the bow at 352.
const HULL = 'M -20 -60 L 290 -60 C 318 -60 338 -70 352 -86 C 346 -50 322 -12 282 6 L 12 6 C -4 -10 -14 -34 -20 -60 Z';
const STERN_CASTLE = 'M -24 -60 L -28 -94 L 70 -94 L 72 -60 Z';
const HOLE = 'M 126 -42 L 138 -50 L 148 -44 L 160 -48 L 166 -34 L 158 -22 L 142 -20 L 130 -26 L 122 -34 Z';
const SAIL = 'M 154 -150 C 176 -146 194 -140 210 -136 L 206 -118 L 198 -112 L 202 -100 L 190 -96 L 186 -84 C 176 -96 164 -102 156 -104 Z';
const SAIL_2 = 'M 154 -150 C 178 -142 196 -136 212 -128 L 204 -112 L 200 -108 L 204 -96 L 192 -92 L 186 -82 C 176 -94 164 -100 156 -104 Z';
const GROWTH = (() => {
  const rand = seeded(88);
  return Array.from({ length: 9 }, () => {
    const x = -10 + rand() * 340;
    const h = 8 + rand() * 18;
    return `M ${x.toFixed(1)} -60 q ${((rand() - 0.5) * 8).toFixed(1)} ${(-h / 2).toFixed(1)} ${((rand() - 0.5) * 6).toFixed(1)} ${(-h).toFixed(1)}`;
  }).join(' ');
})();

function Wreck() {
  return (
    <g transform="translate(690 530) rotate(-7)">
      <defs>
        <linearGradient id="wreck-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d4a63" />
          <stop offset="100%" stopColor="#081d2e" />
        </linearGradient>
        <radialGradient id="wreck-glint">
          <stop offset="0%" stopColor="#ffe9a8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffcf6a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="wreck-clip"><path d={HULL} /></clipPath>
      </defs>
      {/* the snapped main mast, its torn sail stirring in the current */}
      <path d="M 148 -60 L 152 -168 L 158 -160 L 156 -150 L 160 -144 L 156 -60 Z" fill="#0c2a3e" />
      <path d="M 134 -136 L 178 -142" stroke="#0c2a3e" strokeWidth="3" strokeLinecap="round" />
      <path d={SAIL} fill="#5a8ea6" opacity="0.32">
        <animate attributeName="d" values={`${SAIL};${SAIL_2};${SAIL}`} dur="9s" repeatCount="indefinite" />
      </path>
      {/* the foremast, fallen across the deck toward the bow */}
      <path d="M 236 -60 L 330 -150 L 336 -146 L 244 -56 Z" fill="#0b2639" />
      <path d="M 352 -86 L 402 -106" stroke="#0c2a3e" strokeWidth="4" strokeLinecap="round" />
      {/* slack rigging */}
      <path d="M 152 -160 Q 230 -110 352 -88 M 152 -160 Q 70 -120 -24 -94 M 330 -150 Q 370 -120 400 -106" stroke="#2b5d78" strokeOpacity="0.55" strokeWidth="1" fill="none" />
      <path d={STERN_CASTLE} fill="url(#wreck-hull)" />
      {[[-12, -84], [14, -84], [40, -84]].map(([x, y], i) => <rect key={i} x={x} y={y} width="14" height="12" rx="2" fill="#04111c" />)}
      <path d={HULL} fill="url(#wreck-hull)" />
      <g clipPath="url(#wreck-clip)">
        {/* planks */}
        <path d="M -30 -46 L 360 -46 M -30 -32 L 360 -32 M -30 -18 L 360 -18 M -30 -4 L 360 -4" stroke="#0a2233" strokeWidth="1.2" fill="none" />
        <path d="M -30 -58 L 360 -58" stroke="#3f7f9f" strokeOpacity="0.45" strokeWidth="2" />
        {/* the hole in the hull, and something glinting inside */}
        <path d={HOLE} fill="#020a12" />
        <circle className="aura-wreck-glint" cx="146" cy="-30" r="9" fill="url(#wreck-glint)" />
        {[30, 62, 196, 226, 256].map(x => <circle key={x} cx={x} cy="-40" r="4.2" fill="#03101b" stroke="#3a7393" strokeOpacity="0.6" strokeWidth="1.4" />)}
      </g>
      {/* rail lit from above */}
      <path d="M -20 -60 L 290 -60 C 318 -60 338 -70 352 -86" stroke="#57a3c4" strokeOpacity="0.55" strokeWidth="1.6" fill="none" />
      {/* weed and small corals that have made it home */}
      <path d={GROWTH} stroke="#1f6b5e" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.8" />
      {[[40, -60], [210, -60], [300, -64]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#e879a6" opacity="0.55" />)}
    </g>
  );
}

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
        <Whale />
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

        {/* A sailing ship, long sunk, settled into the sand */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <Wreck />
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
