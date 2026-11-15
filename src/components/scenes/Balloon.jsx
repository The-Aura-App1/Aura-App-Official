import React from 'react';

// A hot-air balloon far off, drifting slowly across the dawn sky now and
// then: a striped envelope in faded canvas colors, the basket hanging
// below on four lines, the sun catching its left side.
export const BALLOON_STRIPES = ['#e9d8c4', '#c9705a', '#e9d8c4', '#7d5a8c', '#e9d8c4', '#c9705a'];

// `className` places it and sets when it shows (Day: aura-day-only aura-balloon);
// `stripes` recolors the envelope, `id` keeps two balloons' clip paths apart.
export default function Balloon({ className = '', stripes = BALLOON_STRIPES, id = 'balloon', size = 'w-9 sm:w-11' }) {
  // The envelope: a round top narrowing to a mouth, split into gores.
  const envelope = 'M 0 -38 C 22 -38 30 -20 26 -6 C 23 6 12 14 6 20 L -6 20 C -12 14 -23 6 -26 -6 C -30 -20 -22 -38 0 -38 Z';
  return (
    <div className={`absolute left-0 ${className}`} aria-hidden="true">
      <svg viewBox="-32 -42 64 82" className={`${size} overflow-visible aura-balloon-bob`}>
        <defs>
          <clipPath id={`${id}-envelope`}><path d={envelope} /></clipPath>
          <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff6e8" stopOpacity="0.45" />
            <stop offset="0.45" stopColor="#fff6e8" stopOpacity="0" />
            <stop offset="1" stopColor="#3a2a4a" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${id}-envelope)`}>
          {stripes.map((c, i) => (
            <rect key={i} x={-30 + i * 10} y="-40" width="10.5" height="62" fill={c} />
          ))}
          <rect x="-30" y="-40" width="60" height="62" fill={`url(#${id}-light)`} />
        </g>
        <path d="M -6 20 L -4.5 29 M 6 20 L 4.5 29 M -2 20 L -2 29 M 2 20 L 2 29" stroke="#5a4660" strokeWidth="0.6" />
        <path d="M -5 29 L 5 29 L 4 36 L -4 36 Z" fill="#6b4d3c" />
      </svg>
    </div>
  );
}
