import React, { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A shooting star now and then. Each one starts somewhere new in the part of
// the sky that's on screen, at its own angle, length and direction. Only
// runs while the night sky is showing (in the day sky this layer is hidden,
// so it measures zero and skips).
// `className` decides when it shows (Day/Night show it only in the night sky)
export default function ShootingStars({ className = 'aura-night-only aura-above-clouds' }) {
  const ref = useRef(null);
  const [shot, setShot] = useState(null);

  useEffect(() => {
    const rand = (a, b) => a + Math.random() * (b - a);
    let timer;
    function schedule(wait) {
      timer = setTimeout(() => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && !document.hidden) {
          const visibleTop = Math.max(0, -rect.top);
          const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.height - visibleTop));
          setShot({
            id: Date.now(),
            top: visibleTop + rand(0.05, 0.6) * visibleHeight,
            left: rand(0.1, 0.9) * rect.width,
            length: rand(110, 190),
            angle: rand(15, 42),
            dir: Math.random() < 0.5 ? 1 : -1,
          });
        }
        schedule(rand(5000, 14000));
      }, wait);
    }
    schedule(rand(2000, 5000));
    return () => clearTimeout(timer);
  }, []);

  return (
    <span ref={ref} className={`${className} absolute inset-0`}>
      {shot && (
        <span key={shot.id} className="aura-shooting-star"
          style={{
            top: shot.top, left: shot.left, width: shot.length,
            '--angle': `${shot.angle}deg`, '--dir': shot.dir,
            // Devices that ask for less motion get the same slower pace as the rest of the scenery
            animationDuration: prefersReducedMotion() ? '2.2s' : '1.3s',
          }} />
      )}
    </span>
  );
}
