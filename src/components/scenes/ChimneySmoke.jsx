import React from 'react';

// Puffs of smoke rising from a chimney top at (x, y), each swelling, drifting
// downwind and fading as it climbs, one after another. The color comes from
// `className` (fill: currentColor), so each scene tints its own smoke.
const PUFFS = [0, 1, 2, 3, 4, 5];

export default function ChimneySmoke({ x, y, className = '', scale = 1 }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${scale})`} fill="currentColor">
      {PUFFS.map(i => (
        <circle key={i} className="aura-smoke-puff" r={3 + (i % 3)} cx={(i % 2) * 1.5}
          style={{ animationDelay: `${(-i * 1.6).toFixed(1)}s` }} />
      ))}
    </g>
  );
}
