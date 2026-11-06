import React, { useId } from 'react';

// The "Aura App" name in the heading serif and the theme's gradient, with a
// small tilted halo floating over the "A". `halo={false}` leaves it off,
// e.g. where the big halo already sits above the name.
export default function Wordmark({ className = '', halo = true }) {
  const id = useId();
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="aura-wordmark">Aura App</span>
      {halo && (
        <svg className="aura-wordmark-halo" viewBox="0 0 100 30" aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: 'var(--brand-1)' }} />
              <stop offset="0.5" style={{ stopColor: 'var(--brand-2)' }} />
              <stop offset="1" style={{ stopColor: 'var(--brand-3)' }} />
            </linearGradient>
          </defs>
          <ellipse cx="50" cy="15" rx="44" ry="10" fill="none" stroke={`url(#${id})`} strokeWidth="6" />
        </svg>
      )}
    </span>
  );
}
