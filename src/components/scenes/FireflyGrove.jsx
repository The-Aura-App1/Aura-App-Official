import React from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';
import './dreamscapes.css';

const WIDTH = 1600;
const HEIGHT = 560;

// A line of rounded treetops (broadleaf canopy) from left to right
function canopy(seed, base, amp, bump) {
  const rand = seeded(seed);
  let x = -80;
  let d = `M -80 ${HEIGHT + 20} L -80 ${base}`;
  while (x < WIDTH + 80) {
    const w = bump * (0.6 + rand() * 0.9);
    const h = amp * (0.4 + rand() * 0.9);
    d += ` Q ${(x + w / 2).toFixed(0)} ${(base - h * 2).toFixed(0)} ${(x + w).toFixed(0)} ${(base + (rand() - 0.5) * amp * 0.5).toFixed(0)}`;
    x += w;
  }
  return `${d} L ${WIDTH + 80} ${HEIGHT + 20} Z`;
}

// Tall pines poking above the canopy here and there
function spires(seed, count, base, minH, maxH) {
  const rand = seeded(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = rand() * WIDTH;
    const h = minH + rand() * (maxH - minH);
    const w = h * 0.16;
    d += `M ${(x - w).toFixed(0)} ${base} L ${x.toFixed(0)} ${(base - h).toFixed(0)} L ${(x + w).toFixed(0)} ${base} Z `;
  }
  return d;
}

const FAR = canopy(4, 330, 26, 70);
const FAR_SPIRES = spires(8, 40, 330, 50, 110);
const MID = canopy(12, 400, 34, 95);
const MID_SPIRES = spires(15, 22, 400, 80, 160);

// A big old tree at the edge of the clearing: a trunk flaring into roots,
// two limbs, and a crown of leaf clusters that runs off the top of the
// screen. Drawn for the left edge; the right one is mirrored.
const TRUNK = 'M 40 560 C 52 520 58 470 60 400 C 62 330 58 250 70 170 C 76 130 70 90 60 40 L 110 40 C 104 100 108 150 112 200 C 116 260 112 340 118 410 C 122 470 136 520 160 560 Z';
const LIMBS = 'M 104 230 C 140 200 180 190 230 150 L 236 158 C 190 196 150 214 112 248 Z M 70 190 C 46 160 20 150 -10 120 L -4 112 C 26 138 52 150 76 172 Z';
const CROWN = [[-20, 20, 70], [40, -10, 80], [110, 0, 70], [170, 40, 60], [230, 120, 46], [200, 90, 50], [-30, 90, 50], [70, 60, 56], [140, 70, 44]];

function EdgeTree({ side }) {
  const right = side === 'right';
  return (
    <svg className={`absolute bottom-0 ${right ? 'right-0' : 'left-0'} h-full w-[26vw] max-w-[320px] min-w-[120px] overflow-visible`}
      viewBox="-60 -40 320 600" preserveAspectRatio={`${right ? 'xMax' : 'xMin'}YMax meet`} aria-hidden="true">
      <g transform={right ? 'translate(200 0) scale(-1 1)' : undefined} fill="#030a0b">
        <path d={TRUNK} />
        <path d={LIMBS} />
        {CROWN.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
      </g>
    </svg>
  );
}

// Glowing mushrooms in the moss
const MUSHROOMS = [
  { x: 520, s: 1.6, hue: '#5ef2e0', d: 0 }, { x: 556, s: 1.0, hue: '#7cf7ff', d: 1.2 }, { x: 584, s: 1.25, hue: '#5ef2e0', d: 2.1 },
  { x: 1010, s: 1.5, hue: '#b39dff', d: 0.6 }, { x: 1046, s: 0.95, hue: '#c9b5ff', d: 1.8 }, { x: 1190, s: 1.2, hue: '#5ef2e0', d: 2.6 },
  { x: 780, s: 0.9, hue: '#7cf7ff', d: 3.1 }, { x: 250, s: 1.3, hue: '#b39dff', d: 1.4 }, { x: 1380, s: 1.4, hue: '#7cf7ff', d: 0.3 },
];

// Fireflies: each wanders its own loop and blinks on its own rhythm
function makeFlies(seed, count) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    left: rand() * 100,
    top: 40 + rand() * 55,
    size: 3 + rand() * 3,
    x1: (rand() - 0.5) * 120, y1: (rand() - 0.5) * 70,
    x2: (rand() - 0.5) * 120, y2: (rand() - 0.5) * 70,
    x3: (rand() - 0.5) * 120, y3: (rand() - 0.5) * 70,
    wander: 14 + rand() * 16,
    blink: 2.6 + rand() * 4,
    delay: -rand() * 20,
    color: rand() < 0.75 ? '#e8ff8a' : '#ffd36b',
  }));
}
const FLIES = makeFlies(7, 38);

const FOG = [
  { bottom: '22%', dur: 46, delay: -10, opacity: 0.35 },
  { bottom: '8%', dur: 60, delay: -32, opacity: 0.45 },
];

// A moonlit forest clearing: a big soft moon and its beams slanting through
// the trees, layers of forest fading into blue haze, drifting fog, glowing
// mushrooms pulsing in the moss and fireflies wandering and blinking.
export default function FireflyGrove({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-ff-sky absolute inset-0" />
      <div className="absolute inset-0 aura-ff-stars">
        <TwinklingStars seed={61} count={28} />
      </div>
      <div className="aura-ff-moon absolute" aria-hidden="true" />
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {[0, 1, 2].map(i => <div key={i} className={`aura-ff-beam aura-ff-beam-${i}`} />)}
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[58vh] min-h-[300px]' : 'h-[48vh] min-h-[250px]'}`}>
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="ff-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#173a42" />
              <stop offset="100%" stopColor="#112e34" />
            </linearGradient>
            <linearGradient id="ff-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#123236" />
              <stop offset="100%" stopColor="#0b2226" />
            </linearGradient>
            <linearGradient id="ff-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a1c1c" />
              <stop offset="100%" stopColor="#040b0c" />
            </linearGradient>
            <radialGradient id="ff-shroom">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="35%" stopColor="#7cf7ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#7cf7ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ff-haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8fd6d0" stopOpacity="0" />
              <stop offset="100%" stopColor="#8fd6d0" stopOpacity="0.16" />
            </linearGradient>
          </defs>

          <path d={FAR_SPIRES} fill="url(#ff-far)" />
          <path d={FAR} fill="url(#ff-far)" />
          <rect x="-80" y="250" width={WIDTH + 160} height="160" fill="url(#ff-haze)" />
          <path d={MID_SPIRES} fill="url(#ff-mid)" />
          <path d={MID} fill="url(#ff-mid)" />

          {/* The clearing's floor, a gentle rise of moss */}
          <path d={`M -80 ${HEIGHT + 20} L -80 470 C 300 450 600 480 900 462 C 1200 446 1400 470 1680 458 L 1680 ${HEIGHT + 20} Z`} fill="url(#ff-floor)" />
          {/* Grass tufts along the rise */}
          <path d={Array.from({ length: 70 }, (_, i) => {
            const x = -60 + i * 25 + ((i * 37) % 11);
            const y = 466 + Math.sin(i * 0.7) * 8;
            return `M ${x} ${y + 6} Q ${x + 2} ${y - 6} ${x - 4} ${y - 14} Q ${x + 5} ${y - 4} ${x + 5} ${y + 6} Z`;
          }).join(' ')} fill="#071414" className="aura-ff-grass" />

          {MUSHROOMS.map((m, i) => (
            <g key={i} transform={`translate(${m.x} ${468 + Math.sin(m.x) * 5}) scale(${m.s})`}>
              <circle className="aura-ff-shroom-glow" r="26" cy="-14" fill="url(#ff-shroom)" style={{ animationDelay: `${m.d}s` }} />
              <rect x="-2" y="-12" width="4" height="13" rx="2" fill="#dff7f2" opacity="0.8" />
              <path className="aura-ff-shroom" d="M -11 -11 C -10 -22 10 -22 11 -11 Z" fill={m.hue} style={{ animationDelay: `${m.d}s` }} />
            </g>
          ))}

        </svg>

        {/* Two big trees framing the clearing, pinned to the screen's edges */}
        <EdgeTree side="left" />
        <EdgeTree side="right" />
        {FOG.map((f, i) => (
          <div key={i} className="aura-ff-fog absolute" aria-hidden="true"
            style={{ bottom: f.bottom, opacity: f.opacity, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }} />
        ))}
      </div>

      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {FLIES.map((f, i) => (
          <span key={i} className="aura-ff-fly-path absolute"
            style={{
              left: `${f.left}%`, top: `${f.top}%`,
              '--x1': `${f.x1}px`, '--y1': `${f.y1}px`, '--x2': `${f.x2}px`, '--y2': `${f.y2}px`, '--x3': `${f.x3}px`, '--y3': `${f.y3}px`,
              animationDuration: `${f.wander}s`, animationDelay: `${f.delay}s`,
            }}>
            <span className="aura-ff-fly block rounded-full"
              style={{ width: f.size, height: f.size, background: f.color, color: f.color, animationDuration: `${f.blink}s`, animationDelay: `${f.delay / 3}s` }} />
          </span>
        ))}
      </div>
    </>
  );
}
