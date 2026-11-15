import React from 'react';
import seeded from './seeded';
import BirdFlock from './Birds';
import { FloatingCloud } from './Clouds';
import { ridgePoints, areaUnder, smoothThrough } from './terrain';
import './dreamscapes.css';

// Golden Dunes: a desert in the last hour before sunset. A big low sun
// burns behind hazy mesas; dunes roll toward us in layers, each split along
// its knife-edge crest into a sunlit face and a shadowed one; sand streams
// off the crests in the wind; a caravan of camels plods along a far ridge,
// and birds cross the sky now and then.

const W = 1600;
const H = 640;

// A dune ridge: a few crests joined by smooth saddles. Returns the dune's
// body and, for each crest, the shadowed slope on its far side from the sun
// (the sun sits to the right, so shadows fall to the left of each crest).
function duneLayer(seed, { base, crests, height, spread }) {
  const rand = seeded(seed);
  const pts = [[-100, base]];
  const peaks = [];
  crests.forEach(cx => {
    const h = height * (0.7 + rand() * 0.5);
    const w = spread * (0.8 + rand() * 0.5);
    const trough = [cx - w * 0.9, base - h * 0.22];
    pts.push(trough, [cx, base - h], [cx + w * 0.55, base - h * 0.45]);
    peaks.push({ x: cx, y: base - h, w, h, trough });
  });
  pts.push([W + 100, base]);
  pts.sort((a, b) => a[0] - b[0]);
  const body = smoothThrough(pts, H + 40);
  // The lee face: bounded by the dune's own outline above (the clip) and by
  // the knife-edge curving down from the crest to the trough before it, so
  // the shadow meets the outline exactly and never shows a seam.
  const shades = peaks.map(({ x, y, w, h, trough: [tx, ty] }) => (
    `M ${x.toFixed(1)} ${y.toFixed(1)} C ${(x - w * 0.12).toFixed(1)} ${(y + h * 0.5).toFixed(1)} ${(x - w * 0.62).toFixed(1)} ${ty.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`
    + ` L ${tx.toFixed(1)} ${(y - 80).toFixed(1)} L ${x.toFixed(1)} ${(y - 80).toFixed(1)} Z`
  ));
  return { body, shades, peaks };
}

// Back to front: hazier and pinker far away, richer gold close up
const DUNES = [
  { key: 'd1', ...duneLayer(3, { base: 430, crests: [180, 620, 1060, 1480], height: 90, spread: 160 }), lit: '#f3c79a', shade: '#d9a084', opacity: 0.85 },
  { key: 'd2', ...duneLayer(8, { base: 500, crests: [320, 860, 1320], height: 120, spread: 185 }), lit: '#f2b877', shade: '#c98457' },
  { key: 'd3', ...duneLayer(14, { base: 580, crests: [120, 700, 1240], height: 150, spread: 225 }), lit: '#efab62', shade: '#b56c42' },
  { key: 'd4', ...duneLayer(21, { base: 680, crests: [300, 900, 1520], height: 170, spread: 260 }), lit: '#e99d52', shade: '#a45c37' },
];

// Mesas: flat-topped buttes on the horizon
const MESAS = 'M 40 380 L 70 300 L 230 296 L 262 380 Z M 980 382 L 1006 326 L 1090 322 L 1102 300 L 1190 298 L 1222 382 Z M 1380 384 L 1400 344 L 1470 342 L 1496 384 Z';
const HORIZON = ridgePoints(2, { y: 392, amp: 10, rough: 0.5, passes: 6 });

// Wind ripples across the nearest dune's sunlit face
const RIPPLES = (() => {
  const rand = seeded(31);
  let d = '';
  for (let i = 0; i < 26; i++) {
    const x = 500 + rand() * 1100;
    const y = 560 + rand() * 80;
    const w = 40 + rand() * 90;
    d += `M ${x.toFixed(1)} ${y.toFixed(1)} q ${(w / 2).toFixed(1)} -6 ${w.toFixed(1)} -2 `;
  }
  return d;
})();

// A camel with its rider, walking right; the legs swing in pairs
function Camel({ i }) {
  return (
    <g transform={`translate(${i * 46} 0)`} className="aura-dune-camel" style={{ animationDelay: `${-i * 0.4}s` }}>
      <path d="M -16 -16 C -14 -26 -4 -30 2 -24 C 6 -32 14 -30 16 -22 C 20 -22 24 -26 26 -32 L 30 -34 L 32 -30 C 30 -24 26 -16 18 -14 C 10 -12 -8 -10 -16 -16 Z" fill="#5a3324" />
      <path d="M -2 -30 L 0 -42 L 4 -42 L 5 -30 Z M -1 -42 C -1 -46 5 -46 5 -42 Z" fill="#4a2a1f" />
      <g className="aura-dune-legs"><path d="M -12 -14 L -14 0 M 12 -14 L 14 0" stroke="#5a3324" strokeWidth="2.2" strokeLinecap="round" /></g>
      <g className="aura-dune-legs aura-dune-legs-2"><path d="M -8 -14 L -6 0 M 16 -14 L 12 0" stroke="#4a2a1f" strokeWidth="2.2" strokeLinecap="round" /></g>
    </g>
  );
}

export default function GoldenDunes({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-dune-sky absolute inset-0" />
      <div className="aura-dune-sun absolute" aria-hidden="true" />
      <div className="aura-dune-rays absolute inset-0" aria-hidden="true" />
      <FloatingCloud seed={7} idPrefix="dune-cloud" top="#fff4e6" bottom="#f0b998" className="aura-dune-cloud w-80 sm:w-[28rem] top-[14vh] left-[6%]" style={{ animationDuration: '80s' }} />
      <FloatingCloud seed={19} idPrefix="dune-cloud" top="#fff1e0" bottom="#eeae8e" className="aura-dune-cloud w-64 sm:w-96 top-[26vh] right-[4%] opacity-80" style={{ animationDuration: '96s', animationDirection: 'reverse' }} />
      <BirdFlock className={`aura-flock aura-dune-flock ${page ? 'top-[18vh]' : 'top-[22%]'}`} />

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[62vh] min-h-[320px]' : 'h-[50vh] min-h-[260px]'}`}>
        {/* The horizon: mesas in haze, and a band of shimmering heat */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="dune-mesa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d79a92" />
              <stop offset="100%" stopColor="#e9b9a2" />
            </linearGradient>
            <filter id="dune-rock" x="-5%" y="-20%" width="110%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" />
              <feDisplacementMap in="SourceGraphic" scale="5" />
            </filter>
          </defs>
          <path d={MESAS} fill="url(#dune-mesa)" opacity="0.75" filter="url(#dune-rock)" />
          <path d={areaUnder(HORIZON, H)} fill="#f0c4a2" opacity="0.8" />
        </svg>
        <div className="aura-dune-heat absolute inset-x-0" aria-hidden="true" />
        {/* A caravan plodding along the horizon, tiny with distance */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <g transform="translate(0 392) scale(0.55)">
            <g className="aura-dune-caravan">
              {[0, 1, 2, 3].map(k => <Camel key={k} i={k} />)}
            </g>
          </g>
        </svg>

        {DUNES.map((d, i) => (
          <svg key={d.key} className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" style={{ opacity: d.opacity ?? 1 }}>
            <defs>
              <clipPath id={`dune-clip-${i}`}><path d={d.body} /></clipPath>
              <linearGradient id={`dune-lit-${i}`} x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff0cf" stopOpacity="0.55" />
                <stop offset="40%" stopColor={d.lit} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={d.body} fill={d.lit} />
            <path d={d.body} fill={`url(#dune-lit-${i})`} />
            <g clipPath={`url(#dune-clip-${i})`}>
              {d.shades.map((s, j) => <path key={j} d={s} fill={d.shade} />)}
              {i === 3 && <path d={RIPPLES} fill="none" stroke="#b56c42" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />}
            </g>
            {/* the bright knife-edge where light meets shade */}
            {d.peaks.map((p, j) => (
              <path key={j} d={`M ${p.x - p.w * 0.12} ${p.y + p.h * 0.05} Q ${p.x} ${p.y - 2} ${p.x + p.w * 0.2} ${p.y + p.h * 0.08}`} stroke="#fff3dc" strokeOpacity="0.7" strokeWidth="1.6" fill="none" />
            ))}
          </svg>
        ))}

        {/* Sand streaming off the crests in the wind */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="dune-wisp" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#fff1d6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fff1d6" stopOpacity="0" />
            </linearGradient>
            <filter id="dune-wisp-soft" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="2.5" /></filter>
          </defs>
          {DUNES[2].peaks.concat(DUNES[3].peaks).map((p, i) => (
            <path key={i} className="aura-dune-blow" style={{ animationDelay: `${-i * 1.7}s` }} filter="url(#dune-wisp-soft)"
              d={`M ${p.x} ${p.y} C ${p.x - 40} ${p.y - 10} ${p.x - 90} ${p.y - 6} ${p.x - 150} ${p.y + 6} C ${p.x - 90} ${p.y + 2} ${p.x - 40} ${p.y + 2} ${p.x} ${p.y + 3} Z`}
              fill="url(#dune-wisp)" />
          ))}
        </svg>
      </div>
    </>
  );
}
