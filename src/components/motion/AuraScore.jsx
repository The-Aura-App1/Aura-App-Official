import React, { useEffect, useRef, useState } from 'react';
import useCountUp from '../../hooks/useCountUp';
import { formatAura } from '../../utils/format';

// A post's or comment's aura. When it changes, the number rolls to the new
// value, gives a small pop (or dip, for a take) and floats the difference.
export default function AuraScore({ value = 0, className = '' }) {
  const shown = useCountUp(value, { duration: 650 });
  const prev = useRef(value);
  const [change, setChange] = useState(null);

  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    if (!delta) return undefined;
    setChange({ id: Date.now(), delta });
    const timer = setTimeout(() => setChange(null), 1200);
    return () => clearTimeout(timer);
  }, [value]);

  const tone = shown > 0 ? 'text-aura-400' : shown < 0 ? 'text-red-400' : 'text-[var(--text-muted)]';
  const up = change?.delta > 0;
  return (
    <span className={`relative inline-flex font-bold tabular-nums ${tone} ${className}`}>
      <span key={change?.id ?? 'still'} className={change ? (up ? 'aura-score-up' : 'aura-score-down') : ''}>
        {formatAura(shown)}
      </span>
      {change && (
        <span key={`chip-${change.id}`} aria-hidden="true"
          className={`aura-score-chip ${up ? 'is-up text-aura-400' : 'is-down text-red-400'}`}>
          {formatAura(change.delta)}
        </span>
      )}
    </span>
  );
}
