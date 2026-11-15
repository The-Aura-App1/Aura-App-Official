import React from 'react';

// Wing positions for one flap, drawn as a filled silhouette (wing tips, body
// in the middle). Every frame uses the same commands, so the browser can
// morph smoothly between them.
export const WINGS_UP   = 'M-12 -7 C-8 -4 -4 -1 0 1 C4 -1 8 -4 12 -7 C8 -2.5 4 0.5 0 3 C-4 0.5 -8 -2.5 -12 -7 Z';
export const WINGS_MID  = 'M-12 0 C-8 -2 -4 -1 0 1 C4 -1 8 -2 12 0 C8 0.5 4 1.5 0 3 C-4 1.5 -8 0.5 -12 0 Z';
export const WINGS_DOWN = 'M-11 5 C-8 1 -4 0 0 1 C4 0 8 1 11 5 C8 2.5 4 2 0 3 C-4 2 -8 2.5 -11 5 Z';
export const FLAP = [WINGS_UP, WINGS_MID, WINGS_DOWN, WINGS_MID, WINGS_UP].join(';');

// A loose flock seen from far away: smaller, hazier birds read as further
// back. Each one flaps at its own speed and bobs a little on its own.
export const BIRDS = [
  { x: 0,   y: 22, scale: 1,    flap: 0.62, begin: 0,    opacity: 0.85 },
  { x: 26,  y: 10, scale: 0.85, flap: 0.7,  begin: 0.2,  opacity: 0.75 },
  { x: 30,  y: 36, scale: 0.9,  flap: 0.58, begin: 0.35, opacity: 0.8  },
  { x: 54,  y: 2,  scale: 0.7,  flap: 0.75, begin: 0.1,  opacity: 0.6  },
  { x: 58,  y: 46, scale: 0.75, flap: 0.66, begin: 0.45, opacity: 0.65 },
  { x: 84,  y: 18, scale: 0.6,  flap: 0.8,  begin: 0.3,  opacity: 0.5  },
  { x: 100, y: 34, scale: 0.55, flap: 0.72, begin: 0.15, opacity: 0.45 },
];

// `className` places it and sets when it shows (Day: aura-day-only aura-flock);
// the birds take the text color (currentColor), so each scene tints its own.
export default function BirdFlock({ className = '', birds = BIRDS, size = 'w-32 sm:w-40' }) {
  return (
    <div className={`absolute left-0 ${className}`} aria-hidden="true">
      <svg viewBox="-14 -10 130 66" className={`${size} overflow-visible`}>
        {birds.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y})`}>
            <g className="aura-bird-bob" style={{ animationDelay: `${-i * 0.7}s`, animationDuration: `${2.6 + (i % 3) * 0.5}s` }}>
              <path transform={`scale(${b.scale})`} d={WINGS_MID} fill="currentColor" opacity={b.opacity}>
                <animate attributeName="d" values={FLAP} dur={`${b.flap}s`} begin={`${b.begin}s`}
                  repeatCount="indefinite" calcMode="spline"
                  keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
              </path>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
