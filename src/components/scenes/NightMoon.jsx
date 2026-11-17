import React from 'react';

// Night's moon: a bright waxing gibbous with soft grey seas, a few craters
// catching the light on their rims, the unlit side fading into the sky, and
// a wide pale halo that breathes very slowly (index.css, .aura-night-moon).
// Night only; Day keeps its pale crescent.
const MARIA = [
  { cx: 38, cy: 36, rx: 13, ry: 9, r: -20, o: 0.32 },
  { cx: 55, cy: 30, rx: 9, ry: 7, r: 10, o: 0.26 },
  { cx: 46, cy: 52, rx: 15, ry: 8, r: 25, o: 0.28 },
  { cx: 30, cy: 58, rx: 8, ry: 10, r: 0, o: 0.22 },
  { cx: 62, cy: 48, rx: 7, ry: 5, r: -30, o: 0.2 },
];
const CRATERS = [
  { cx: 58, cy: 68, r: 4.2 }, { cx: 34, cy: 26, r: 2.4 }, { cx: 70, cy: 36, r: 2 },
  { cx: 42, cy: 72, r: 2.6 }, { cx: 24, cy: 44, r: 1.8 }, { cx: 64, cy: 58, r: 1.6 },
];

export default function NightMoon({ className = '', style }) {
  return (
    <div className={`aura-night-only aura-night-moon absolute ${className}`} style={style} aria-hidden="true">
      <div className="aura-night-moon-halo" />
      <svg viewBox="0 0 100 100" className="relative w-full h-full overflow-visible">
        <defs>
          <radialGradient id="nm-body" cx="38%" cy="36%" r="70%">
            <stop offset="0" stopColor="#fffdf6" />
            <stop offset="0.55" stopColor="#f1ecdf" />
            <stop offset="1" stopColor="#d6cfc0" />
          </radialGradient>
          <radialGradient id="nm-shade" cx="18%" cy="42%" r="95%">
            <stop offset="0.62" stopColor="#0b0a1f" stopOpacity="0" />
            <stop offset="0.86" stopColor="#0b0a1f" stopOpacity="0.55" />
            <stop offset="1" stopColor="#0b0a1f" stopOpacity="0.8" />
          </radialGradient>
          <filter id="nm-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
          <clipPath id="nm-disk"><circle cx="50" cy="50" r="40" /></clipPath>
        </defs>
        <circle cx="50" cy="50" r="40" fill="url(#nm-body)" />
        <g clipPath="url(#nm-disk)">
          <g filter="url(#nm-soft)">
            {MARIA.map((m, i) => (
              <ellipse key={i} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} transform={`rotate(${m.r} ${m.cx} ${m.cy})`} fill="#9c96a6" opacity={m.o} />
            ))}
          </g>
          {CRATERS.map((c, i) => (
            <g key={i}>
              <circle cx={c.cx} cy={c.cy} r={c.r} fill="#b9b2a6" opacity="0.45" />
              <path d={`M ${c.cx - c.r} ${c.cy} A ${c.r} ${c.r} 0 0 1 ${c.cx + c.r} ${c.cy}`} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.6" fill="none"
                transform={`rotate(-35 ${c.cx} ${c.cy})`} />
            </g>
          ))}
          {/* the unlit side: a gibbous terminator, softened */}
          <circle cx="50" cy="50" r="40" fill="url(#nm-shade)" />
        </g>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#fffaf0" strokeOpacity="0.35" strokeWidth="0.6" />
      </svg>
    </div>
  );
}
