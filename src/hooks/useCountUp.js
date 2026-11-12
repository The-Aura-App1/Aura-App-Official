import { useEffect, useRef, useState } from 'react';

const easeOut = t => 1 - Math.pow(1 - t, 3);

// Rolls a number from its last value to the new one. With fromZero the first
// value also rolls up from 0 (wallet balances); otherwise it appears as is.
// Plays even with reduced motion on: it's small feedback (user's decision).
export default function useCountUp(target, { duration = 700, fromZero = false } = {}) {
  const value = Number(target) || 0;
  const [shown, setShown] = useState(fromZero ? 0 : value);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return undefined;
    let frame;
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      setShown(t < 1 ? Math.round(from + (value - from) * easeOut(t)) : value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}
