import React from 'react';
import { Link } from 'react-router-dom';

// Fixed positions so the sparkles don't jump around between renders.
const SPARKLES = [
  { top: '12%', left: '14%', size: 14, delay: '0s'   },
  { top: '22%', left: '82%', size: 18, delay: '1.2s' },
  { top: '68%', left: '8%',  size: 10, delay: '2.1s' },
  { top: '78%', left: '88%', size: 12, delay: '0.6s' },
  { top: '44%', left: '93%', size: 8,  delay: '1.7s' },
  { top: '88%', left: '36%', size: 9,  delay: '2.8s' },
  { top: '6%',  left: '52%', size: 8,  delay: '3.3s' },
];

function Sparkle({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" />
    </svg>
  );
}

// The "Aura App" name in the display font. `size` picks the landing-page or
// compact version used above the auth forms.
export function Wordmark({ size = 'lg', linked = false }) {
  const text = (
    <span className={`aura-wordmark ${size === 'lg' ? 'text-5xl sm:text-7xl md:text-8xl' : 'text-2xl sm:text-3xl'}`}>
      Aura App
    </span>
  );
  return linked ? <Link to="/welcome" aria-label="Aura App home">{text}</Link> : text;
}

// Dark, glowing backdrop shared by the landing page and the auth pages. The
// `dark` class scopes the dark theme variables to these pages, so they look
// the same whatever theme the user picked inside the app.
export default function AuthBackdrop({ children }) {
  return (
    <div className="dark">
      <div className="relative min-h-screen overflow-hidden bg-[#07030f] text-[var(--text-primary)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="aura-orb aura-orb-1" />
          <div className="aura-orb aura-orb-2" />
          <div className="aura-orb aura-orb-3" />
          <div className="absolute inset-0 aura-grid" />
          {SPARKLES.map((s, i) => (
            <span key={i} className="aura-twinkle absolute text-aura-300"
              style={{ top: s.top, left: s.left, animationDelay: s.delay }}>
              <Sparkle size={s.size} />
            </span>
          ))}
        </div>
        <div className="relative z-10 min-h-screen flex flex-col">{children}</div>
      </div>
    </div>
  );
}
