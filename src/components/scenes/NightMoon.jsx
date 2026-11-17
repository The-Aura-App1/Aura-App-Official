import React from 'react';

// Night's moon: the same soft moon as City Skies (.aura-moon-face in
// scenes.css, faint lavender seas and a glow), so the night skies share one
// moon. Night only; Day keeps its pale crescent.
export default function NightMoon({ className = '', style }) {
  return <div className={`aura-night-only aura-moon-face absolute ${className}`} style={style} aria-hidden="true" />;
}
