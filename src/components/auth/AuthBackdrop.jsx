import React from 'react';
import { Link } from 'react-router-dom';

// Fixed positions so the sparkles don't jump around between renders.
const SPARKLES = [
  { top: '12%', left: '14%', size: 14, delay: '0s'   },
  { top: '22%', left: '82%', size: 18, delay: '1.2s' },
  { top: '48%', left: '6%',  size: 10, delay: '2.1s' },
  { top: '38%', left: '90%', size: 12, delay: '0.6s' },
  { top: '6%',  left: '62%', size: 8,  delay: '1.7s' },
  { top: '30%', left: '28%', size: 9,  delay: '2.8s' },
  { top: '8%',  left: '38%', size: 8,  delay: '3.3s' },
];

function Sparkle({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" />
    </svg>
  );
}

// Small seeded random generator, so every visit draws the same clouds.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Overlapping circles along a baseline. The SVG filter below roughens their
// edges with noise, which turns the blobs into soft, billowing clouds.
function cloudPuffs(seed, { width, baseline, minR, maxR, step }) {
  const rand = seeded(seed);
  const puffs = [];
  for (let x = -maxR; x < width + maxR; x += step * (0.6 + rand() * 0.8)) {
    const r = minR + rand() * (maxR - minR);
    puffs.push({ cx: x, cy: baseline - rand() * r * 0.6, r });
  }
  return puffs;
}

const BANK_WIDTH = 1600;
const BANK_HEIGHT = 420;

// Back to front: hazier, lavender-tinted clouds behind, brightest in front.
const CLOUD_LAYERS = [
  { seed: 7,  baseline: 230, minR: 70, maxR: 150, step: 120, top: '#ffffff', bottom: '#d9ccff', opacity: 0.7,  drift: 'cloudDriftA 40s' },
  { seed: 21, baseline: 290, minR: 60, maxR: 130, step: 105, top: '#ffffff', bottom: '#eadfff', opacity: 0.85, drift: 'cloudDriftB 32s' },
  { seed: 42, baseline: 350, minR: 55, maxR: 115, step: 95,  top: '#ffffff', bottom: '#f6f0ff', opacity: 1,    drift: 'cloudDriftA 26s reverse' },
];

function CloudBank() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[42vh] min-h-[220px]">
      {CLOUD_LAYERS.map((layer, i) => {
        const puffs = cloudPuffs(layer.seed, { width: BANK_WIDTH, ...layer });
        return (
          <svg key={layer.seed} className="aura-cloud-layer absolute -inset-x-16 bottom-0 h-full w-[calc(100%+8rem)]"
            viewBox={`0 0 ${BANK_WIDTH} ${BANK_HEIGHT}`} preserveAspectRatio="xMidYMax slice"
            style={{ opacity: layer.opacity, animation: `${layer.drift} ease-in-out infinite` }}>
            <defs>
              <linearGradient id={`cloud-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={layer.top} />
                <stop offset="100%" stopColor={layer.bottom} />
              </linearGradient>
              <filter id={`cloud-edge-${i}`} x="-10%" y="-40%" width="120%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="4" seed={layer.seed} />
                <feDisplacementMap in="SourceGraphic" scale="70" />
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <g filter={`url(#cloud-edge-${i})`} fill={`url(#cloud-fill-${i})`}>
              {puffs.map((p, j) => <circle key={j} cx={p.cx} cy={p.cy} r={p.r} />)}
              <rect x={-200} y={layer.baseline - 20} width={BANK_WIDTH + 400} height={BANK_HEIGHT} />
            </g>
          </svg>
        );
      })}
    </div>
  );
}

// A single small cloud drifting high in the sky.
function FloatingCloud({ seed, className, style }) {
  const puffs = cloudPuffs(seed, { width: 260, baseline: 90, minR: 26, maxR: 52, step: 42 });
  return (
    <svg className={`absolute overflow-visible ${className}`} style={style} viewBox="0 0 260 150" aria-hidden="true">
      <defs>
        <linearGradient id={`float-fill-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e4d9ff" />
        </linearGradient>
        <filter id={`float-edge-${seed}`} x="-20%" y="-40%" width="140%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed={seed} />
          <feDisplacementMap in="SourceGraphic" scale="22" />
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <g filter={`url(#float-edge-${seed})`} fill={`url(#float-fill-${seed})`}>
        {puffs.filter(p => p.cx > 30 && p.cx < 230).map((p, j) => <circle key={j} cx={p.cx} cy={p.cy} r={p.r} />)}
        <ellipse cx="130" cy="95" rx="100" ry="22" />
      </g>
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

// Heavenly dawn sky shared by the landing page and the auth pages: light rays
// from above, drifting clouds below. The `aura-heaven` class pins the light
// theme variables, so these pages look the same whatever theme the user picked
// inside the app.
export default function AuthBackdrop({ children }) {
  return (
    <div className="aura-heaven relative min-h-screen overflow-hidden text-[var(--text-primary)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="aura-sky absolute inset-0" />
        <div className="aura-rays absolute inset-0" />
        <div className="aura-sun absolute left-1/2 top-[-18rem] w-[46rem] h-[46rem] -ml-[23rem]" />
        <FloatingCloud seed={3}  className="aura-float-cloud w-48 sm:w-72 top-[16%] -left-10 sm:left-[6%]" style={{ animationDuration: '34s' }} />
        <FloatingCloud seed={11} className="aura-float-cloud w-40 sm:w-60 top-[30%] -right-12 sm:right-[8%] opacity-80" style={{ animationDuration: '41s', animationDirection: 'reverse' }} />
        {SPARKLES.map((s, i) => (
          <span key={i} className="aura-twinkle absolute text-amber-200"
            style={{ top: s.top, left: s.left, animationDelay: s.delay }}>
            <Sparkle size={s.size} />
          </span>
        ))}
        <CloudBank />
      </div>
      <div className="relative z-10 min-h-screen flex flex-col">{children}</div>
    </div>
  );
}
