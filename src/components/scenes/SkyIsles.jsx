import React from 'react';
import seeded from './seeded';
import './dreamscapes.css';

// A floating island: a grassy top, an earthy underside that tapers to a
// point with bands of rock, and roots trailing below. Centred on x = 0 with
// the grass at y = 0; `w` is its width.
function islandPaths(seed, w, depth) {
  const rand = seeded(seed);
  const half = w / 2;
  // underside: lumpy taper to a point, a little off-centre
  const tip = (rand() - 0.5) * w * 0.2;
  const under = `M ${-half} 0 C ${-half + w * 0.05} ${depth * 0.35} ${-w * 0.25} ${depth * 0.55} ${(-w * 0.12 + tip).toFixed(0)} ${(depth * 0.8).toFixed(0)}`
    + ` L ${tip.toFixed(0)} ${depth} L ${(w * 0.1 + tip).toFixed(0)} ${(depth * 0.78).toFixed(0)}`
    + ` C ${w * 0.26} ${depth * 0.55} ${half - w * 0.04} ${depth * 0.32} ${half} 0 Z`;
  const bands = [0.28, 0.5].map(f => `M ${(-half * (1 - f * 0.9)).toFixed(0)} ${(depth * f).toFixed(0)} Q ${tip.toFixed(0)} ${(depth * f + 10).toFixed(0)} ${(half * (1 - f * 0.9)).toFixed(0)} ${(depth * f - 4).toFixed(0)}`).join(' ');
  const grass = `M ${-half - 6} 2 C ${-half + 10} -10 ${-w * 0.2} -14 0 -12 C ${w * 0.2} -14 ${half - 8} -10 ${half + 6} 2 C ${half - 20} 10 ${-half + 20} 10 ${-half - 6} 2 Z`;
  const roots = Array.from({ length: 4 }, (_, i) => {
    const x = -w * 0.18 + i * w * 0.12 + tip * 0.5;
    const y = depth * (0.62 + rand() * 0.15);
    return `M ${x.toFixed(0)} ${y.toFixed(0)} q ${(rand() * 10 - 5).toFixed(0)} 20 ${(rand() * 14 - 7).toFixed(0)} ${(30 + rand() * 30).toFixed(0)}`;
  }).join(' ');
  return { under, bands, grass, roots };
}

function Island({ seed, w, depth, children, className, style }) {
  const p = islandPaths(seed, w, depth);
  return (
    <g className={className} style={style}>
      <path d={p.roots} fill="none" stroke="#8a6f5c" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d={p.under} fill="url(#isle-earth)" />
      <path d={p.bands} fill="none" stroke="#6f5747" strokeOpacity="0.35" strokeWidth="3" />
      <path d={p.grass} fill="url(#isle-grass)" />
      {children}
    </g>
  );
}

// Cloud sea: a band of puffy tops, wider than the screen so it can scroll
function cloudBand(seed, base, puff) {
  const rand = seeded(seed);
  let x = -200;
  let d = `M -200 600 L -200 ${base}`;
  while (x < 3400) {
    const w = puff * (0.6 + rand() * 0.9);
    const lift = (rand() - 0.5) * puff * 0.25;
    d += ` a ${(w / 2).toFixed(0)} ${(w * (0.22 + rand() * 0.16)).toFixed(0)} 0 0 1 ${w.toFixed(0)} ${lift.toFixed(0)}`;
    x += w;
  }
  return `${d} L ${x.toFixed(0)} 600 Z`;
}
const BANDS = [
  { d: cloudBand(3, 420, 70), fill: 'url(#isle-cloud-far)', dur: 140, cls: 'aura-isle-band-1' },
  { d: cloudBand(9, 462, 95), fill: 'url(#isle-cloud-mid)', dur: 100, cls: 'aura-isle-band-2' },
  { d: cloudBand(17, 505, 120), fill: 'url(#isle-cloud-near)', dur: 70, cls: 'aura-isle-band-3' },
];

const SKY_CLOUDS = [
  { top: '9vh', left: '8%', w: '24vw', dur: 120, delay: -30 },
  { top: '20vh', left: '52%', w: '18vw', dur: 150, delay: -90 },
  { top: '5vh', left: '72%', w: '14vw', dur: 170, delay: -10 },
];

// A loose V of birds; each flaps on its own beat
const FLOCK = [[0, 0], [-26, 12], [-50, 22], [-24, -10], [-48, -18], [-70, 30]];

// A bright morning above the clouds: islands of grass and rock drifting up
// and down on their own slow breaths, a waterfall pouring off one into the
// cloud sea, a windmill turning, a flock of birds gliding past, and a sea of
// cloud rolling by below.
export default function SkyIsles({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-isle-sky absolute inset-0" />
      <div className="aura-isle-sun absolute" aria-hidden="true" />
      {SKY_CLOUDS.map((c, i) => (
        <div key={i} className="aura-isle-cloud absolute" aria-hidden="true"
          style={{ top: c.top, left: c.left, width: c.w, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} />
      ))}
      <div className="aura-isle-flock absolute" aria-hidden="true">
        <svg width="120" height="70" viewBox="-90 -30 120 70">
          {FLOCK.map(([x, y], i) => (
            <path key={i} className="aura-isle-bird" style={{ animationDelay: `${-i * 0.17}s`, transformOrigin: `${x}px ${y}px` }}
              d={`M ${x - 8} ${y - 2} Q ${x - 4} ${y - 5} ${x} ${y} Q ${x + 4} ${y - 5} ${x + 8} ${y - 2}`}
              fill="none" stroke="#3b4a6b" strokeWidth="1.6" strokeLinecap="round" />
          ))}
        </svg>
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[62vh] min-h-[320px]' : 'h-[52vh] min-h-[260px]'}`}>
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 1600 560"
          preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="isle-earth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b48c6e" />
              <stop offset="55%" stopColor="#8e6e5b" />
              <stop offset="100%" stopColor="#6b5560" />
            </linearGradient>
            <linearGradient id="isle-grass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8fdc8f" />
              <stop offset="100%" stopColor="#4fae79" />
            </linearGradient>
            <linearGradient id="isle-fall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfe6ff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="isle-cloud-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#e4dcf6" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="isle-cloud-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#ece6f9" />
            </linearGradient>
            <linearGradient id="isle-cloud-near" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#fbf7ff" />
              <stop offset="100%" stopColor="#f3edfb" />
            </linearGradient>
            <radialGradient id="isle-mist">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Far isle with a windmill */}
          <g transform="translate(760 150) scale(0.8)" opacity="0.85">
            <Island seed={21} w={150} depth={110} className="aura-isle-bob" style={{ animationDuration: '11s', animationDelay: '-3s' }}>
              <rect x="-6" y="-48" width="12" height="38" rx="3" fill="#f4ede6" />
              <path d="M -9 -46 L 0 -58 L 9 -46 Z" fill="#c06a5a" />
              <g className="aura-isle-windmill" style={{ transformOrigin: '0px -44px' }}>
                {[0, 90, 180, 270].map(a => (
                  <rect key={a} x="-2" y="-74" width="4" height="30" rx="2" fill="#fbf7f2" transform={`rotate(${a} 0 -44)`} />
                ))}
                <circle cx="0" cy="-44" r="3" fill="#8e6e5b" />
              </g>
            </Island>
          </g>

          {/* Big isle with a tree */}
          <g transform="translate(590 300) scale(0.85)">
            <Island seed={5} w={300} depth={190} className="aura-isle-bob" style={{ animationDuration: '9s' }}>
              <rect x="-6" y="-76" width="12" height="66" rx="4" fill="#7a5a48" />
              <circle cx="-26" cy="-84" r="34" fill="#5fbf7f" />
              <circle cx="20" cy="-96" r="40" fill="#6fcf8a" />
              <circle cx="-2" cy="-118" r="30" fill="#82dd98" />
              <circle cx="34" cy="-70" r="24" fill="#58b277" />
              <circle cx="80" cy="-16" r="4" fill="#fff4c7" />
              <circle cx="-90" cy="-14" r="3" fill="#ffd1dc" />
            </Island>
          </g>

          {/* Mid isle with a waterfall pouring off its edge */}
          <g transform="translate(980 250) scale(0.9)">
            <g className="aura-isle-bob" style={{ animationDuration: '13s', animationDelay: '-6s' }}>
              <rect className="aura-isle-fall" x="58" y="-4" width="16" height="260" fill="url(#isle-fall)" />
              <rect className="aura-isle-fall aura-isle-fall-2" x="62" y="-4" width="6" height="260" fill="#ffffff" opacity="0.7" />
              <ellipse className="aura-isle-mist" cx="66" cy="250" rx="60" ry="22" fill="url(#isle-mist)" />
              <Island seed={13} w={210} depth={150}>
                <path d="M -60 -8 C -40 -14 20 -14 70 -6" stroke="#9fd8ff" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.9" />
                <path d="M -40 -12 L -36 -34 L -30 -12 Z M -20 -12 L -14 -40 L -8 -12 Z" fill="#4fae79" />
              </Island>
            </g>
          </g>

          {/* Two more isles out to the sides, seen on wider screens */}
          <g transform="translate(220 220) scale(0.7)" opacity="0.9">
            <Island seed={31} w={220} depth={150} className="aura-isle-bob" style={{ animationDuration: '12s', animationDelay: '-8s' }}>
              <circle cx="-30" cy="-26" r="20" fill="#6fcf8a" /><circle cx="-8" cy="-34" r="24" fill="#82dd98" />
              <rect x="-22" y="-14" width="5" height="10" fill="#7a5a48" />
            </Island>
          </g>
          <g transform="translate(1390 190) scale(0.75)" opacity="0.9">
            <Island seed={37} w={200} depth={140} className="aura-isle-bob" style={{ animationDuration: '10s', animationDelay: '-2s' }}>
              <path d="M -30 -10 L -30 -40 A 18 18 0 0 1 6 -40 L 6 -10 L -4 -10 L -4 -34 A 8 8 0 0 0 -20 -34 L -20 -10 Z" fill="#efe7df" />
            </Island>
          </g>

          {/* Little stones drifting near the isles */}
          {[[470, 360, 8, 7], [700, 230, 5, 9], [1120, 330, 6, 8], [880, 120, 4, 10], [380, 260, 5, 12]].map(([x, y, r, dur], i) => (
            <path key={i} className="aura-isle-bob" style={{ animationDuration: `${dur}s`, animationDelay: `${-i * 1.7}s` }}
              d={`M ${x - r} ${y} L ${x - r * 0.3} ${y - r * 0.8} L ${x + r} ${y - r * 0.3} L ${x + r * 0.6} ${y + r * 0.7} Z`} fill="#9b7f6c" />
          ))}

          {/* The cloud sea */}
          {BANDS.map((b, i) => (
            <path key={i} className={`aura-isle-band ${b.cls}`} d={b.d} fill={b.fill} style={{ animationDuration: `${b.dur}s` }} />
          ))}
        </svg>
      </div>
    </>
  );
}
