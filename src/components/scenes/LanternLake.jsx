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
    flick: 1.6 + rand() * 1.8, tilt: (rand() - 0.5) * 10,
  }));
}
const SKY_LANTERNS = [...riser(5, 16, { size: [12, 18], dur: [55, 85], sway: 60 }), ...riser(9, 8, { size: [20, 30], dur: [40, 60], sway: 90 })];
const FAR_LANTERNS = riser(12, 34, { size: [3, 6], dur: [120, 180], sway: 30 });

// The moon's reflection: glints scattered down the water, wider and looser
// toward us, each trembling at its own pace
const MOON_PATH = (() => {
  const rand = seeded(41);
  return Array.from({ length: 16 }, (_, k) => {
    const t = k / 15;
    return {
      top: t * 92 + rand() * 3, width: 18 + t * 55 + rand() * 25, shift: (rand() - 0.5) * (8 + t * 30),
      opacity: 0.65 - t * 0.4 + rand() * 0.1, height: 1.5 + t * 2.5, dur: 2.2 + rand() * 2.4, delay: -rand() * 4,
    };
  });
})();

// Lanterns floating on the water: x, depth (0 far … 1 near)
const FLOATERS = [[560, 0.1], [700, 0.25], [860, 0.05], [980, 0.4], [760, 0.6], [1080, 0.75], [620, 0.85], [920, 0.95], [1180, 0.3], [480, 0.5]];

const LEAVES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100, size: 10 + (i % 4) * 4, dur: 14 + (i % 5) * 4, delay: -i * 2.3,
  color: ['#d1342f', '#e8662c', '#f0a030', '#b8243c'][i % 4], drift: ((i * 29) % 120) - 60,
}));
const LEAF = 'M 0 -10 L 2.5 -4 L 8 -6 L 5 0 L 9 3 L 3 3 L 2 9 L 0 5 L -2 9 L -3 3 L -9 3 L -5 0 L -8 -6 L -2.5 -4 Z';

// A paper sky lantern: wider at the top, open at the bottom where the
// flame hangs, so it glows brightest low down; bamboo ribs show through the
// paper, and a halo spills around it. Colors are shared gradients (LanternDefs).
const SKY_LANTERN = 'M -9.5 -13 Q -10 -16.5 0 -16.5 Q 10 -16.5 9.5 -13 L 6.8 10 Q 0 11.8 -6.8 10 Z';
function SkyLantern({ size, flick, tilt }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="-12 -17 24 34" className="aura-sky-lantern block overflow-visible"
      style={{ animationDuration: `${flick}s`, '--tilt': `${tilt}deg` }}>
      <ellipse cy="4" rx="22" ry="24" fill="url(#ll-sl-halo)" />
      <path d={SKY_LANTERN} fill="url(#ll-sl-paper)" />
      <path d={SKY_LANTERN} fill="url(#ll-sl-shade)" />
      <path d="M -4.6 -16.2 Q -4 -3 -3.4 10.9 M 0 -16.5 L 0 11.4 M 4.6 -16.2 Q 4 -3 3.4 10.9" stroke="#a8381c" strokeOpacity="0.3" strokeWidth="0.45" fill="none" />
      <path d="M -9.6 -12 Q 0 -13.6 9.6 -12" stroke="#8a2a16" strokeOpacity="0.35" strokeWidth="0.6" fill="none" />
      <path d="M -6.8 10 Q 0 11.8 6.8 10" stroke="#6e1f10" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M -6 10.3 L 0 6.5 L 6 10.3" stroke="#5a1a0e" strokeWidth="0.4" fill="none" opacity="0.7" />
      <ellipse cy="7" rx="2.6" ry="1.8" fill="#fff8d8" className="aura-sky-lantern-flame" />
    </svg>
  );
}

// The gradients every lantern (and the moon) share, defined once on the page
function LanternDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ll-sl-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d2482a" />
          <stop offset="35%" stopColor="#f2783a" />
          <stop offset="70%" stopColor="#ffb257" />
          <stop offset="100%" stopColor="#ffe7a6" />
        </linearGradient>
        {/* rounded sides: darker at the edges, glowing through the middle */}
        <linearGradient id="ll-sl-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6e1a12" stopOpacity="0.5" />
          <stop offset="28%" stopColor="#6e1a12" stopOpacity="0" />
          <stop offset="62%" stopColor="#fff2c8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6e1a12" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="ll-sl-halo" cy="62%">
          <stop offset="0%" stopColor="#ffb760" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#ff8a45" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ff7a3d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ll-box" cx="50%" cy="68%" r="70%">
          <stop offset="0%" stopColor="#fff4cc" />
          <stop offset="45%" stopColor="#ffb85c" />
          <stop offset="100%" stopColor="#d9522a" />
        </radialGradient>
        <radialGradient id="ll-moon-face" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#fff9ea" />
          <stop offset="60%" stopColor="#fbe7c2" />
          <stop offset="100%" stopColor="#efc994" />
        </radialGradient>
        <radialGradient id="ll-moon-halo">
          <stop offset="30%" stopColor="#ffe2b0" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#ffb98a" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#ff9a7a" stopOpacity="0" />
        </radialGradient>
        <filter id="ll-moon-tex" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="11" />
          <feColorMatrix values="0 0 0 0 0.62  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.9 -0.42" />
        </filter>
        <filter id="ll-moon-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <clipPath id="ll-moon-clip"><circle r="30" /></clipPath>
      </defs>
    </svg>
  );
}

// A full harvest moon: warm and textured, with darker seas, a few craters,
// a soft halo, and thin cloud drifting across it
function Moon() {
  return (
    <div className="aura-ll-moon absolute" aria-hidden="true">
      <svg viewBox="-70 -70 140 140" className="w-full h-full overflow-visible">
        <circle r="70" fill="url(#ll-moon-halo)" className="aura-ll-moon-halo" />
        <circle r="30" fill="url(#ll-moon-face)" />
        <g clipPath="url(#ll-moon-clip)">
          <g fill="#d6aa78" opacity="0.5" filter="url(#ll-moon-blur)">
            <ellipse cx="-9" cy="-8" rx="10" ry="7" transform="rotate(-20)" />
            <ellipse cx="6" cy="-12" rx="7" ry="5" />
            <ellipse cx="9" cy="4" rx="9" ry="6.5" transform="rotate(25)" />
            <ellipse cx="-4" cy="9" rx="6" ry="4" />
            <ellipse cx="-17" cy="6" rx="4" ry="6" />
          </g>
          <rect x="-30" y="-30" width="60" height="60" filter="url(#ll-moon-tex)" />
          {/* craters: a shaded hollow with a lit rim on the side away from the light */}
          {[[-2, 20, 3.2], [15, -18, 2], [-20, -12, 1.6], [18, 14, 2.4], [-12, 22, 1.3]].map(([cx, cy, r], k) => (
            <g key={k}>
              <circle cx={cx} cy={cy} r={r} fill="#c4935f" opacity="0.38" />
              <circle cx={cx + r * 0.35} cy={cy + r * 0.35} r={r * 0.8} fill="#fff6e2" opacity="0.3" />
            </g>
          ))}
          {/* the limb darkens toward the edge */}
          <circle r="30" fill="none" stroke="#c8925c" strokeOpacity="0.35" strokeWidth="6" filter="url(#ll-moon-blur)" />
        </g>
      </svg>
      <div className="aura-ll-moon-cloud absolute" />
      <div className="aura-ll-moon-cloud aura-ll-moon-cloud-2 absolute" />
    </div>
  );
}

export default function LanternLake({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-ll-sky absolute inset-0" />
      <div className="absolute inset-0 aura-ll-stars"><TwinklingStars seed={73} count={40} /></div>
      <LanternDefs />
      <Moon />

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
          <path d={areaUnder(HILLS_FAR, H)} fill="#341021" filter="url(#ll-soft)" />
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
          </defs>
          {FLOATERS.map(([x, depth], i) => {
            const y = SHORE + 14 + depth * 170;
            const s = 0.45 + depth * 1.1;
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
                {/* light pooling on the water around it */}
                <ellipse cy="6" rx="34" ry="7" fill="url(#ll-float-glow)" opacity="0.55" />
                {/* its reflection: broken, trembling strokes of light */}
                <g className="aura-ll-reflect" style={{ animationDelay: `${-i * 0.7}s` }}>
                  {[[10, 15, 0.6], [16, 12, 0.45], [23, 9, 0.32], [31, 7, 0.2], [40, 4, 0.12]].map(([ry, rw, o], k) => (
                    <rect key={k} x={-rw / 2 + (k % 2 ? 1.5 : -1.5)} y={ry} width={rw} height="2.2" rx="1.1" fill="#ffc47a" opacity={o} />
                  ))}
                </g>
                <g className="aura-ll-bob" style={{ animationDelay: `${-i * 0.9}s` }}>
                  <circle r="24" cy="-7" fill="url(#ll-float-glow)" className="aura-ll-flicker" style={{ animationDelay: `${-i * 0.4}s` }} />
                  {/* a little wooden raft */}
                  <path d="M -12 3 L 12 3 L 10.5 6.5 L -10.5 6.5 Z" fill="#3b1510" />
                  <path d="M -12 3 L 12 3" stroke="#7a3a22" strokeWidth="0.8" />
                  {/* the paper box, lit from inside, in its wooden frame */}
                  <path d="M -8.5 3 L -7.5 -14 L 7.5 -14 L 8.5 3 Z" fill="url(#ll-box)" />
                  <path d="M -8.5 3 L -7.5 -14 L -3.5 -14 L -4 3 Z" fill="#7a2014" opacity="0.18" />
                  <path d="M -8.5 3 L -7.5 -14 L 7.5 -14 L 8.5 3 Z M 0 -14 L 0 3" stroke="#4a160e" strokeWidth="0.9" fill="none" />
                  <path d="M -8.8 -14.6 L 8.8 -14.6" stroke="#4a160e" strokeWidth="1.6" strokeLinecap="round" />
                  <ellipse cy="-2" rx="2.4" ry="3.4" fill="#fffae0" opacity="0.85" />
                </g>
              </g>
            );
          })}
          {[[300, 560, 120], [900, 600, 160], [1200, 520, 90], [650, 500, 70]].map(([x, y, w], i) => (
            <path key={i} className="aura-ll-ripple" d={`M ${x} ${y} q ${w / 2} -3 ${w} 0`} stroke="#ffb88a" strokeOpacity="0.25" strokeWidth="1.4" fill="none" style={{ animationDelay: `${-i * 1.3}s` }} />
          ))}
        </svg>

        {/* The moon's road of light, trembling across the lake */}
        <div className="aura-ll-moonpath absolute" aria-hidden="true">
          {MOON_PATH.map((b, k) => (
            <span key={k} className="aura-ll-moonpath-bar absolute"
              style={{ top: `${b.top}%`, width: `${b.width}%`, marginLeft: `${b.shift}%`, opacity: b.opacity, height: b.height, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
          ))}
        </div>

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
              <SkyLantern size={l.size} flick={l.flick} tilt={l.tilt} />
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
