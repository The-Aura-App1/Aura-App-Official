import React, { useId } from 'react';

// The halo as a single brush stroke: a loop that runs a little past a full
// turn so its ends overlap, swelling in the middle of the stroke and
// tapering to points at both ends, with the loop drifting slightly as it
// goes, the way a quick stroke by hand never quite closes on itself.
function brushLoop({ rx = 44, ry = 11, turns = 1.12, start = -2.5, width = 7.5, drift = 2.2 }) {
  const steps = 96;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const t = start + f * turns * Math.PI * 2;
    const cx = 50 + drift * f;
    const cy = 15 - drift * 0.35 * f;
    const x = cx + rx * Math.cos(t);
    const y = cy + ry * Math.sin(t);
    // Normal to the ellipse at t
    const nx = ry * Math.cos(t);
    const ny = rx * Math.sin(t);
    const len = Math.hypot(nx, ny) || 1;
    // Thick through the middle, a sharp taper at each end, and a touch
    // heavier along the bottom where the brush presses down.
    const w = width * Math.sin(Math.PI * f) ** 0.6 * (1 + 0.35 * Math.max(0, Math.sin(t))) / 2;
    outer.push([x + (nx / len) * w, y + (ny / len) * w]);
    inner.push([x - (nx / len) * w, y - (ny / len) * w]);
  }
  const pts = [...outer, ...inner.reverse()];
  return 'M ' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ') + ' Z';
}

const HALO = brushLoop({});

// The "Aura App" logotype: Fraunces italic with its soft, slightly wonky
// letterforms, in solid ink, with a brush-drawn halo in the theme's colors
// tilted over the "A". `halo={false}` leaves it off, e.g. where the big
// halo already sits above the name.
export default function Wordmark({ className = '', halo = true }) {
  const id = useId();
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="aura-wordmark">Aura<span className="aura-wordmark-app"> App</span></span>
      {halo && (
        <svg className="aura-wordmark-halo" viewBox="0 0 104 32" aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.3">
              <stop offset="0" style={{ stopColor: 'var(--brand-1)' }} />
              <stop offset="0.55" style={{ stopColor: 'var(--brand-2)' }} />
              <stop offset="1" style={{ stopColor: 'var(--brand-3)' }} />
            </linearGradient>
          </defs>
          <path d={HALO} fill={`url(#${id})`} />
        </svg>
      )}
    </span>
  );
}
