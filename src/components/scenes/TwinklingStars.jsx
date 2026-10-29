import React from 'react';
import seeded from './seeded';

// Individual stars that each twinkle now and then on their own slow cycle,
// rather than the whole sky pulsing at once. Each one brightens briefly
// about once every 12–30 seconds, so only a few are ever twinkling at a time.
// The brightest also flash a small four-point flare.
function makeStars(seed, count) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => {
    const size = 1.2 + rand() ** 2 * 2.2;
    return {
      top: rand() * 100,
      left: rand() * 100,
      size,
      base: 0.35 + rand() * 0.45,
      duration: 12 + rand() * 18,
      delay: -rand() * 30,
      tint: rand() < 0.25 ? '#e9d5ff' : '#ffffff',
      flare: size > 2.6,
    };
  });
}

const CACHE = {};

export default function TwinklingStars({ seed = 1, count = 60, className = '' }) {
  const stars = CACHE[`${seed}-${count}`] ??= makeStars(seed, count);
  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden="true">
      {stars.map((s, i) => (
        <span key={i} className={`aura-star ${s.flare ? 'aura-star-flare' : ''}`}
          style={{
            top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, color: s.tint,
            '--star-base': s.base, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s`,
          }} />
      ))}
    </div>
  );
}
