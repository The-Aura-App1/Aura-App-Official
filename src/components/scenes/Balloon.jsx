import React, { useMemo } from 'react';

// A hot-air balloon far off, drifting slowly across the sky now and then.
// The envelope is drawn as a real round balloon: its gores (the panels) are
// curved meridians that follow the outline, a decorative band with little
// pennants circles its widest part, and soft shading with a highlight gives
// it volume, the sun catching its left side. Below: the fabric skirt, the
// burner (its flame flickers now and then), load lines and a wicker basket
// with a padded rim.
export const BALLOON_STRIPES = ['#efe1cc', '#c9705a', '#efe1cc', '#7d5a8c', '#efe1cc', '#c9705a'];

// The envelope's right edge, top to mouth (two cubic curves)
const EDGE = [
  [[0, -38], [22, -38], [30, -20], [26, -6]],
  [[26, -6], [23, 6], [12, 14], [6, 20]],
];
const cubic = ([a, b, c, d], t) => {
  const u = 1 - t;
  return [0, 1].map(k => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
};
// Points down the right edge, from the crown to the mouth
const EDGE_POINTS = EDGE.flatMap((seg, i) => Array.from({ length: 13 }, (_, j) => cubic(seg, (j + (i ? 1 : 0)) / 13))).concat([[6, 20]]);
const ENVELOPE = 'M 0 -38 C 22 -38 30 -20 26 -6 C 23 6 12 14 6 20 L -6 20 C -12 14 -23 6 -26 -6 C -30 -20 -22 -38 0 -38 Z';
const halfWidthAt = y => {
  for (let i = 1; i < EDGE_POINTS.length; i++) {
    const [x0, y0] = EDGE_POINTS[i - 1];
    const [x1, y1] = EDGE_POINTS[i];
    if (y >= y0 && y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
  }
  return 0;
};

// The panels facing us: meridians at evenly spaced angles round the balloon
function gores(count) {
  const step = 180 / count;
  const meridian = deg => EDGE_POINTS.map(([w, y]) => [w * Math.sin((deg * Math.PI) / 180), y]);
  return Array.from({ length: count }, (_, i) => {
    const left = meridian(-90 + i * step);
    const right = meridian(-90 + (i + 1) * step).reverse();
    return `M ${[...left, ...right].map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`;
  });
}

// The band round the widest part, curved as seen from a little below
function band(top, bottom, sag) {
  const row = (y, dir) => Array.from({ length: 21 }, (_, i) => {
    const f = -1 + (i * 2) / 20;
    const w = halfWidthAt(y);
    return [f * w, y + sag * Math.sqrt(Math.max(0, 1 - f * f))];
  });
  const upper = row(top);
  const lower = row(bottom).reverse();
  return { path: `M ${[...upper, ...lower].map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`, lower: row(bottom) };
}

export default function Balloon({ className = '', stripes = BALLOON_STRIPES, id = 'balloon', size = 'w-12 sm:w-16', bandColor }) {
  const art = useMemo(() => {
    const panels = gores(stripes.length * 2);
    const b = band(-8, -4, 2.2);
    // pennants hang from the band's lower edge
    const pennants = b.lower.filter((_, i) => i % 3 === 1 && i > 1 && i < 19).map(([x, y]) => `M ${(x - 1.6).toFixed(2)} ${y.toFixed(2)} L ${(x + 1.6).toFixed(2)} ${y.toFixed(2)} L ${x.toFixed(2)} ${(y + 3).toFixed(2)} Z`);
    return { panels, band: b.path, pennants };
  }, [stripes.length]);
  const accent = bandColor ?? stripes[3] ?? stripes[1];

  return (
    <div className={`absolute left-0 ${className}`} aria-hidden="true">
      <svg viewBox="-32 -42 64 86" className={`${size} overflow-visible aura-balloon-bob`}>
        <defs>
          <clipPath id={`${id}-envelope`}><path d={ENVELOPE} /></clipPath>
          {/* round shading: lit from the upper left, darker towards the right and the mouth */}
          <radialGradient id={`${id}-shade`} cx="34%" cy="30%" r="78%">
            <stop offset="0" stopColor="#fffaf0" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#fffaf0" stopOpacity="0.08" />
            <stop offset="0.75" stopColor="#2a1e3a" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1c1428" stopOpacity="0.45" />
          </radialGradient>
          <linearGradient id={`${id}-basket`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a37a52" />
            <stop offset="0.45" stopColor="#8a6340" />
            <stop offset="1" stopColor="#5e4029" />
          </linearGradient>
          <radialGradient id={`${id}-flame`} cx="50%" cy="70%" r="60%">
            <stop offset="0" stopColor="#fff4c2" />
            <stop offset="0.5" stopColor="#ffb347" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ff6a2b" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g clipPath={`url(#${id}-envelope)`}>
          {art.panels.map((d, i) => <path key={i} d={d} fill={stripes[i % stripes.length]} />)}
          {/* seams between the panels */}
          {art.panels.map((d, i) => <path key={`s${i}`} d={d} fill="none" stroke="#3a2a40" strokeOpacity="0.16" strokeWidth="0.35" />)}
          <path d={art.band} fill={accent} />
          <path d={art.band} fill="none" stroke="#fff6e8" strokeOpacity="0.55" strokeWidth="0.4" />
          {art.pennants.map((d, i) => <path key={`p${i}`} d={d} fill={i % 2 ? '#f6e7c8' : accent} />)}
          {/* crown cap */}
          <ellipse cx="0" cy="-37" rx="7" ry="2.2" fill="#3a2a40" opacity="0.18" />
          <rect x="-32" y="-42" width="64" height="66" fill={`url(#${id}-shade)`} />
          {/* a bright glint on the lit shoulder */}
          <ellipse cx="-12" cy="-24" rx="4" ry="8" transform="rotate(28 -12 -24)" fill="#ffffff" opacity="0.28" />
        </g>
        <path d={ENVELOPE} fill="none" stroke="#2a1e3a" strokeOpacity="0.2" strokeWidth="0.5" />

        {/* the skirt (scoop) below the mouth */}
        <path d="M -6 20 L 6 20 L 5 24.5 Q 0 25.6 -5 24.5 Z" fill={stripes[1]} />
        <path d="M -6 20 L 6 20 L 5 24.5 Q 0 25.6 -5 24.5 Z" fill="#1c1428" opacity="0.28" />
        {/* load lines and burner frame */}
        <path d="M -5 24.5 L -4.4 32 M 5 24.5 L 4.4 32 M -1.8 25 L -1.6 32 M 1.8 25 L 1.6 32" stroke="#4a3a4c" strokeWidth="0.45" />
        <rect x="-2.4" y="26.6" width="4.8" height="1.6" rx="0.5" fill="#6f6a72" />
        <ellipse className="aura-balloon-flame" cx="0" cy="24.6" rx="2.2" ry="3.4" fill={`url(#${id}-flame)`} />
        {/* wicker basket: padded rim, weave, and its shaded side */}
        <path d="M -5.2 32 L 5.2 32 L 4.4 40 Q 0 40.8 -4.4 40 Z" fill={`url(#${id}-basket)`} />
        <path d="M -4.9 34.6 L 4.9 34.6 M -4.7 37.2 L 4.7 37.2" stroke="#4d3320" strokeOpacity="0.55" strokeWidth="0.35" />
        <path d="M -2.6 32.3 L -2.3 40.2 M 0 32.3 L 0 40.5 M 2.6 32.3 L 2.3 40.2" stroke="#c49a6c" strokeOpacity="0.45" strokeWidth="0.3" />
        <rect x="-5.6" y="31.2" width="11.2" height="1.6" rx="0.8" fill="#5a3b26" />
      </svg>
    </div>
  );
}
