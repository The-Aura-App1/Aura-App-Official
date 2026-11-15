import React from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';
import { ridgePoints, areaUnder } from './terrain';
import './dreamscapes.css';

// Lantern Lake: an autumn night of the lantern festival. Paper lanterns
// drift up from a still lake into a wine-dark sky, swaying and shrinking as
// they rise; more float on the water, their reflections trembling. A
// village's windows glow on the far shore under layered hills, maples blaze
// crimson on the near banks, lit warm from below, and leaves drift down.

const W = 1600;
const H = 640;
const SHORE = 420;

const HILLS_FAR = ridgePoints(6, { y: 330, amp: 110, rough: 0.5, anchors: [[260, 270], [820, 300], [1300, 250]] });
const HILLS_NEAR = ridgePoints(13, { y: 390, amp: 60, rough: 0.5, anchors: [[500, 360], [1100, 370]] });
const SHORE_LINE = ridgePoints(19, { y: SHORE, amp: 6, rough: 0.6, passes: 6 });

// The village: rows of tiny warm windows along the far shore
const VILLAGE = (() => {
  const rand = seeded(23);
  const out = [];
  for (const [x0, x1] of [[380, 620], [900, 1180], [1320, 1440]]) {
    for (let x = x0; x < x1; x += 7 + rand() * 12) {
      out.push({ x, y: SHORE - 4 - rand() * 18, w: 2 + rand() * 2, flicker: rand() < 0.25, delay: -rand() * 9 });
    }
  }
  return out;
})();
const ROOFS = (() => {
  const rand = seeded(29);
  let d = '';
  for (const [x0, x1] of [[380, 620], [900, 1180], [1320, 1440]]) {
    for (let x = x0; x < x1; x += 18 + rand() * 16) {
      const w = 14 + rand() * 14;
      const h = 10 + rand() * 16;
      d += `M ${x.toFixed(1)} ${SHORE} L ${x.toFixed(1)} ${(SHORE - h).toFixed(1)} L ${(x + w / 2).toFixed(1)} ${(SHORE - h - 8).toFixed(1)} L ${(x + w).toFixed(1)} ${(SHORE - h).toFixed(1)} L ${(x + w).toFixed(1)} ${SHORE} Z `;
    }
  }
  return d;
})();

// A maple: trunk with a couple of limbs and a crown of leaf clumps
function maple(seed, x, base, size) {
  const rand = seeded(seed);
  const clumps = Array.from({ length: 11 }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    return [x + Math.cos(a) * size * 0.55 * r, base - size * 1.15 + Math.sin(a) * size * 0.38 * r, size * (0.2 + rand() * 0.14)];
  });
  const trunk = `M ${x - size * 0.05} ${base} C ${x - size * 0.04} ${base - size * 0.4} ${x - size * 0.1} ${base - size * 0.7} ${x - size * 0.2} ${base - size * 0.95} L ${x - size * 0.16} ${base - size * 0.97} C ${x - size * 0.03} ${base - size * 0.75} ${x + size * 0.03} ${base - size * 0.6} ${x + size * 0.14} ${base - size * 0.9} L ${x + size * 0.17} ${base - size * 0.88} C ${x + size * 0.07} ${base - size * 0.55} ${x + size * 0.06} ${base - size * 0.35} ${x + size * 0.06} ${base} Z`;
  return { trunk, clumps };
}
const MAPLES = [maple(1, 170, 600, 230), maple(2, 420, 610, 160), maple(3, 1260, 612, 180), maple(4, 1480, 600, 240)];

// Lanterns rising into the sky: x (% of width), size, how long a climb takes
function riser(seed, count, { size, dur, sway }) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    left: 4 + rand() * 92, size: size[0] + rand() * (size[1] - size[0]),
    dur: dur[0] + rand() * (dur[1] - dur[0]), delay: -rand() * dur[1], sway: (rand() - 0.5) * sway,
    flick: 1.6 + rand() * 1.8,
  }));
}
const SKY_LANTERNS = [...riser(5, 16, { size: [10, 16], dur: [55, 85], sway: 60 }), ...riser(9, 8, { size: [16, 24], dur: [40, 60], sway: 90 })];
const FAR_LANTERNS = riser(12, 34, { size: [3, 6], dur: [120, 180], sway: 30 });

// Lanterns floating on the water: x, depth (0 far … 1 near)
const FLOATERS = [[560, 0.1], [700, 0.25], [860, 0.05], [980, 0.4], [760, 0.6], [1080, 0.75], [620, 0.85], [920, 0.95], [1180, 0.3], [480, 0.5]];

const LEAVES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100, size: 10 + (i % 4) * 4, dur: 14 + (i % 5) * 4, delay: -i * 2.3,
  color: ['#d1342f', '#e8662c', '#f0a030', '#b8243c'][i % 4], drift: ((i * 29) % 120) - 60,
}));
const LEAF = 'M 0 -10 L 2.5 -4 L 8 -6 L 5 0 L 9 3 L 3 3 L 2 9 L 0 5 L -2 9 L -3 3 L -9 3 L -5 0 L -8 -6 L -2.5 -4 Z';

function Lantern({ size, style, className = '' }) {
  return (
    <span className={`aura-lantern ${className}`} style={{ width: size, height: size * 1.25, ...style }} />
  );
}

export default function LanternLake({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-ll-sky absolute inset-0" />
      <div className="absolute inset-0 aura-ll-stars"><TwinklingStars seed={73} count={40} /></div>
      <div className="aura-ll-moon absolute" aria-hidden="true" />

      {/* Lanterns far away, already high: tiny warm points drifting up */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {FAR_LANTERNS.map((l, i) => (
          <span key={i} className="aura-ll-rise aura-ll-rise-far absolute" style={{ left: `${l.left}%`, '--sway': `${l.sway}px`, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}>
            <span className="aura-lantern-dot block" style={{ width: l.size, height: l.size }} />
          </span>
        ))}
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[60vh] min-h-[320px]' : 'h-[50vh] min-h-[270px]'}`}>
        {/* Hills, the village and the far shore */}
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="ll-hills-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3d1226" />
              <stop offset="100%" stopColor="#2a0b1b" />
            </linearGradient>
            <linearGradient id="ll-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff8a4c" stopOpacity="0" />
              <stop offset="100%" stopColor="#ff8a4c" stopOpacity="0.28" />
            </linearGradient>
            <radialGradient id="ll-pool" cy="20%">
              <stop offset="0%" stopColor="#ffb06b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffb06b" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ll-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a1520" />
              <stop offset="35%" stopColor="#1c0812" />
              <stop offset="100%" stopColor="#0b0308" />
            </linearGradient>
            <filter id="ll-soft" x="-5%" y="-20%" width="110%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="5" />
              <feDisplacementMap in="SourceGraphic" scale="8" />
            </filter>
          </defs>
          <path d={areaUnder(HILLS_FAR, H)} fill="url(#ll-hills-far)" filter="url(#ll-soft)" />
          <rect x="-80" y="250" width={W + 160} height="170" fill="url(#ll-glow)" />
          <path d={areaUnder(HILLS_NEAR, H)} fill="#1d0712" filter="url(#ll-soft)" />
          <path d={ROOFS} fill="#14040c" />
          {VILLAGE.map((v, i) => (
            <rect key={i} className={v.flicker ? 'aura-ll-window' : undefined} x={v.x} y={v.y} width={v.w} height={v.w * 1.2} fill="#ffc46b"
              style={v.flicker ? { animationDelay: `${v.delay}s` } : undefined} />
          ))}
          <path d={areaUnder(SHORE_LINE, H)} fill="url(#ll-water)" />
          {/* the village's light lying on the water */}
          {[[500, 120], [1040, 160], [1380, 70]].map(([x, w], i) => (
            <ellipse key={i} cx={x} cy={SHORE + 30} rx={w * 0.6} ry="34" fill="url(#ll-pool)" />
          ))}
        </svg>

        {/* Lanterns floating on the lake, with their reflections */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <radialGradient id="ll-float-glow">
              <stop offset="0%" stopColor="#ffd28a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ff7a3d" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ll-reflect" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb86b" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#ffb86b" stopOpacity="0" />
            </linearGradient>
          </defs>
          {FLOATERS.map(([x, depth], i) => {
            const y = SHORE + 14 + depth * 170;
            const s = 0.45 + depth * 1.1;
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
                <rect className="aura-ll-reflect" x="-5" y="4" width="10" height="44" rx="5" fill="url(#ll-reflect)" style={{ animationDelay: `${-i * 0.7}s` }} />
                <g className="aura-ll-bob" style={{ animationDelay: `${-i * 0.9}s` }}>
                  <circle r="22" cy="-6" fill="url(#ll-float-glow)" className="aura-ll-flicker" style={{ animationDelay: `${-i * 0.4}s` }} />
                  <path d="M -9 2 L -7 -12 L 7 -12 L 9 2 Z" fill="#ffae55" />
                  <path d="M -9 2 L -7 -12 L -2 -12 L -3 2 Z" fill="#ffd08a" />
                  <path d="M -11 2 L 11 2 L 9 5 L -9 5 Z" fill="#5a1f18" />
                </g>
              </g>
            );
          })}
          {[[300, 560, 120], [900, 600, 160], [1200, 520, 90], [650, 500, 70]].map(([x, y, w], i) => (
            <path key={i} className="aura-ll-ripple" d={`M ${x} ${y} q ${w / 2} -3 ${w} 0`} stroke="#ffb88a" strokeOpacity="0.25" strokeWidth="1.4" fill="none" style={{ animationDelay: `${-i * 1.3}s` }} />
          ))}
        </svg>

        {/* The near banks: maples blazing crimson, a dock and its lantern post */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <radialGradient id="ll-crown" cx="50%" cy="85%" r="75%">
              <stop offset="0%" stopColor="#ff9a3c" />
              <stop offset="45%" stopColor="#d9362e" />
              <stop offset="100%" stopColor="#6a0f22" />
            </radialGradient>
            <filter id="ll-leafy" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="3" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="16" />
            </filter>
            <radialGradient id="ll-post-glow">
              <stop offset="0%" stopColor="#ffd59a" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M -60 640 L -60 580 C 120 560 300 572 520 600 C 560 610 580 626 590 640 Z M 1100 640 C 1130 612 1230 590 1400 584 C 1520 580 1600 586 1660 590 L 1660 640 Z" fill="#0d0308" filter="url(#ll-leafy)" />
          {MAPLES.map((m, i) => (
            <g key={i}>
              <path d={m.trunk} fill="#1a0609" />
              <g filter="url(#ll-leafy)" fill="url(#ll-crown)">
                {m.clumps.map(([cx, cy, r], j) => <circle key={j} cx={cx} cy={cy} r={r} />)}
              </g>
            </g>
          ))}
          {/* the dock */}
          <path d="M 470 604 L 640 596 L 642 602 L 472 610 Z" fill="#2a0e10" />
          <path d="M 500 608 L 500 640 M 560 604 L 560 640 M 620 600 L 620 640" stroke="#1a0609" strokeWidth="5" />
          <rect x="626" y="548" width="4" height="50" fill="#1a0609" />
          <circle className="aura-ll-flicker" cx="628" cy="548" r="34" fill="url(#ll-post-glow)" />
          <rect x="621" y="538" width="14" height="16" rx="3" fill="#ffc27a" />
        </svg>

        {/* Lanterns lifting off the water and rising */}
        <div className="absolute inset-x-0 bottom-0 top-[-120vh] overflow-hidden pointer-events-none" aria-hidden="true">
          {SKY_LANTERNS.map((l, i) => (
            <span key={i} className="aura-ll-rise absolute" style={{ left: `${l.left}%`, '--sway': `${l.sway}px`, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}>
              <Lantern size={l.size} style={{ animationDuration: `${l.flick}s` }} />
            </span>
          ))}
        </div>
      </div>

      {/* Maple leaves drifting down */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {LEAVES.map((l, i) => (
          <span key={i} className="aura-ll-leaf absolute" style={{ left: `${l.left}%`, '--drift': `${l.drift}px`, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}>
            <svg width={l.size} height={l.size} viewBox="-10 -10 20 20" className="aura-ll-leaf-spin block" style={{ animationDuration: `${3 + (i % 3)}s` }}>
              <path d={LEAF} fill={l.color} />
            </svg>
          </span>
        ))}
      </div>
    </>
  );
}
