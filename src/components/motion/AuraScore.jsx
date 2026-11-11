import React, { useEffect, useRef, useState } from 'react';
import useCountUp from '../../hooks/useCountUp';
import { formatAura } from '../../utils/format';

const SPARKS = 10;
const EMBERS = 8;

// Evenly spread angles with a little wobble, so every burst looks a bit different
function spread(count, jitter) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360 + (Math.random() - 0.5) * jitter;
    return { angle, dist: 0.75 + Math.random() * 0.5, delay: Math.random() * 80 };
  });
}

// A post's or comment's aura. A give fires a halo ring and a ring of sparks,
// and the number rolls up and glows. A take shakes it and lets a few embers
// fall. The amount floats clear above the number, never over it.
export default function AuraScore({ value = 0, className = '' }) {
  const shown = useCountUp(value, { duration: 800 });
  const prev = useRef(value);
  const [change, setChange] = useState(null);

  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    if (!delta) return undefined;
    setChange({
      id: Date.now(),
      delta,
      bits: delta > 0 ? spread(SPARKS, 24) : spread(EMBERS, 60).map(b => ({ ...b, x: (Math.random() - 0.5) * 34 })),
    });
    const timer = setTimeout(() => setChange(null), 1500);
    return () => clearTimeout(timer);
  }, [value]);

  const tone = shown > 0 ? 'text-aura-400' : shown < 0 ? 'text-red-400' : 'text-[var(--text-muted)]';
  const up = change?.delta > 0;
  return (
    <span className={`relative inline-flex justify-center min-w-[2ch] font-bold tabular-nums ${tone} ${className}`}>
      {change && up && (
        <span key={`halo-${change.id}`} aria-hidden="true" className="aura-score-fx aura-score-under"><span className="aura-score-halo" /></span>
      )}
      <span key={change?.id ?? 'still'} className={`relative z-[1] ${change ? (up ? 'aura-score-up' : 'aura-score-down') : ''}`}>
        {formatAura(shown)}
      </span>
      {change && (
        <span key={`fx-${change.id}`} aria-hidden="true" className="aura-score-fx">
          {change.bits.map((bit, i) => (
            <span key={i} className={up ? 'aura-score-spark' : 'aura-score-ember'}
              style={{ '--a': `${bit.angle}deg`, '--d': bit.dist, '--x': `${bit.x ?? 0}px`, animationDelay: `${bit.delay}ms` }} />
          ))}
          <span className={`aura-score-chip ${up ? 'is-up text-aura-400' : 'is-down text-red-400'}`}>
            {formatAura(change.delta)}
          </span>
        </span>
      )}
    </span>
  );
}
