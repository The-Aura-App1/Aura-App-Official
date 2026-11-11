import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

const ORBS = 8;

// Little orbs of light that float from one element (a Claim button) into
// another (a balance), then call onDone so the balance can glow.
export default function OrbBurst({ from, to, onDone }) {
  const orbs = useMemo(() => {
    const rand = Math.random;
    const sx = from.left + from.width / 2;
    const sy = from.top + from.height / 2;
    const tx = to.left + to.width / 2;
    const ty = to.top + to.height / 2;
    return Array.from({ length: ORBS }, (_, i) => ({
      x: sx + (rand() - 0.5) * from.width * 0.6,
      y: sy + (rand() - 0.5) * from.height * 0.4,
      jx: (rand() - 0.5) * 90,
      jy: -30 - rand() * 50,
      dx: tx - sx + (rand() - 0.5) * 40,
      dy: ty - sy + (rand() - 0.5) * 16,
      size: 6 + rand() * 6,
      delay: i * 55,
    }));
  }, [from, to]);

  useEffect(() => {
    const timer = setTimeout(onDone, 900 + ORBS * 55);
    return () => clearTimeout(timer);
  }, [onDone]);

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
      {orbs.map((o, i) => (
        <span key={i} className="aura-orb"
          style={{
            left: o.x, top: o.y, width: o.size, height: o.size,
            '--jx': `${o.jx}px`, '--jy': `${o.jy}px`, '--dx': `${o.dx}px`, '--dy': `${o.dy}px`,
            animationDelay: `${o.delay}ms`,
          }} />
      ))}
    </div>,
    document.body,
  );
}
