import React from 'react';
import seeded from './seeded';

// Soft, billowing clouds shared by the scenes (first drawn for Day).

// Overlapping circles along a baseline. The SVG filter below roughens their
// edges with noise, which turns the blobs into soft, billowing clouds.
export function cloudPuffs(seed, { width, baseline, minR, maxR, step }) {
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
// Room above the bank for the tallest cloud tops. Without it, wide screens
// (which scale the drawing up) cut them off in a flat line.
const BANK_HEADROOM = 200;

// Back to front: hazier, lavender-tinted clouds behind, brightest in front.
export const CLOUD_LAYERS = [
  { seed: 7,  baseline: 230, minR: 70, maxR: 150, step: 120, top: '#ffffff', bottom: '#d9ccff', opacity: 0.7,  drift: 'cloudDriftA 40s' },
  { seed: 21, baseline: 290, minR: 60, maxR: 130, step: 105, top: '#ffffff', bottom: '#eadfff', opacity: 0.85, drift: 'cloudDriftB 32s' },
  { seed: 42, baseline: 350, minR: 55, maxR: 115, step: 95,  top: '#ffffff', bottom: '#f6f0ff', opacity: 1,    drift: 'cloudDriftA 26s reverse' },
];

// A bank of cloud along the bottom of the scene. Day's by default; other
// scenes pass their own `layers` (colors, heights, drift) and `idPrefix`.
export function CloudBank({ layers = CLOUD_LAYERS, className = 'aura-cloud-bank absolute inset-x-0 bottom-0 h-[42vh] min-h-[220px]', idPrefix = 'cloud' }) {
  return (
    <div className={className}>
      {layers.map((layer, i) => {
        const puffs = cloudPuffs(layer.seed, { width: BANK_WIDTH, ...layer });
        return (
          <svg key={layer.seed} className="aura-cloud-layer absolute -inset-x-16 bottom-0 w-[calc(100%+8rem)]"
            viewBox={`0 ${-BANK_HEADROOM} ${BANK_WIDTH} ${BANK_HEIGHT + BANK_HEADROOM}`} preserveAspectRatio="xMidYMax slice"
            style={{
              height: `${((BANK_HEIGHT + BANK_HEADROOM) / BANK_HEIGHT) * 100}%`,
              opacity: layer.opacity,
              animation: `${layer.drift} ease-in-out infinite`,
            }}>
            <defs>
              <linearGradient id={`${idPrefix}-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={layer.top} />
                <stop offset="100%" stopColor={layer.bottom} />
              </linearGradient>
              <filter id={`${idPrefix}-edge-${i}`} x="-10%" y="-40%" width="120%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="4" seed={layer.seed} />
                <feDisplacementMap in="SourceGraphic" scale="70" />
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <g filter={`url(#${idPrefix}-edge-${i})`} fill={`url(#${idPrefix}-fill-${i})`}>
              {puffs.map((p, j) => <circle key={j} cx={p.cx} cy={p.cy} r={p.r} />)}
              <rect x={-200} y={layer.baseline - 20} width={BANK_WIDTH + 400} height={BANK_HEIGHT} />
            </g>
          </svg>
        );
      })}
    </div>
  );
}

// A single small cloud drifting high in the sky. `top`/`bottom` tint it
// (Day's white-to-lavender by default).
export function FloatingCloud({ seed, className, style, top = '#ffffff', bottom = '#e4d9ff', idPrefix = 'float' }) {
  const puffs = cloudPuffs(seed, { width: 260, baseline: 90, minR: 26, maxR: 52, step: 42 });
  return (
    <svg className={`absolute overflow-visible ${className}`} style={style} viewBox="0 0 260 150" aria-hidden="true">
      <defs>
        <linearGradient id={`${idPrefix}-fill-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
        <filter id={`${idPrefix}-edge-${seed}`} x="-20%" y="-40%" width="140%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed={seed} />
          <feDisplacementMap in="SourceGraphic" scale="22" />
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <g filter={`url(#${idPrefix}-edge-${seed})`} fill={`url(#${idPrefix}-fill-${seed})`}>
        {puffs.filter(p => p.cx > 30 && p.cx < 230).map((p, j) => <circle key={j} cx={p.cx} cy={p.cy} r={p.r} />)}
        <ellipse cx="130" cy="95" rx="100" ry="22" />
      </g>
    </svg>
  );
}
