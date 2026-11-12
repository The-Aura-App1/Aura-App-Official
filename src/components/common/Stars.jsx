import React, { useState } from 'react';
import { Star } from 'lucide-react';

// Star rating. Read-only unless onChange is given, then it's a 1–5 picker.
export default function Stars({ value = 0, onChange, size = 16 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  if (!onChange) {
    return (
      <span className="inline-flex text-amber-400" aria-label={`${value} out of 5 stars`} role="img">
        {[1, 2, 3, 4, 5].map(n => (
          <Star key={n} size={size} fill={n <= Math.round(value) ? 'currentColor' : 'none'} strokeWidth={1.6} />
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex gap-0.5" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)} onMouseEnter={() => setHover(n)}
          className={`p-0.5 rounded-md transition-transform duration-150 hover:scale-110 ${n <= shown ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
          <Star size={size} fill={n <= shown ? 'currentColor' : 'none'} strokeWidth={1.6} />
        </button>
      ))}
    </span>
  );
}
