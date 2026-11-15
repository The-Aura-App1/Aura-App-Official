import React from 'react';
import seeded from './seeded';
import { CloudBank, FloatingCloud } from './Clouds';
import BirdFlock from './Birds';
import Balloon from './Balloon';
import './dreamscapes.css';

// Sky Isles: a bright morning above the clouds. Islands of grass and rock
// float at every distance (the far ones blue with haze), each breathing up
// and down on its own; their undersides are rugged, lit warm on the sun's
// side, trailing roots and vines. A waterfall pours off one into a sea of
// billowing cloud. Day's flock and balloon pass through now and then.
//
// Each island is its own <svg>, so its bob is a cheap whole-layer move.

const W = 1600;
const H = 700;

// An island centred on (0, 0) at the top of its grass: a slightly domed
// cap that overhangs the rock, a jagged rock underside tapering to a few
// points, strata, and roots hanging below.
function island(seed, w, depth) {
  const rand = seeded(seed);
  const half = w / 2;
  // underside: a taper with jagged spikes
  const under = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = -half + t * w;
    const core = 1 - Math.pow(Math.abs(2 * t - 1), 1.5);
    const spike = rand() < 0.3 ? 0.25 + rand() * 0.35 : rand() * 0.12;
    under.push([x + (rand() - 0.5) * w * 0.02, depth * core * (0.75 + spike) + 4]);
  }
  const rock = `M ${-half} 4 ` + under.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ` L ${half} 4 Z`;
  // grass cap: a gentle dome with small drips over the edge
  const cap = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    cap.push([-half - 6 + t * (w + 12), -Math.sin(Math.PI * t) * w * 0.045 - rand() * 2]);
  }
  const drips = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    drips.push([half + 6 - t * (w + 12), 6 + rand() * 7]);
  }
  const grass = 'M ' + [...cap, ...drips].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ') + ' Z';
  const strata = [0.22, 0.4, 0.6].map(f => {
    const y = depth * f;
    const span = half * (1 - f * 0.8);
    return `M ${(-span).toFixed(1)} ${y.toFixed(1)} Q ${((rand() - 0.5) * span).toFixed(1)} ${(y + 8 + rand() * 6).toFixed(1)} ${span.toFixed(1)} ${(y - 3).toFixed(1)}`;
  }).join(' ');
  const roots = Array.from({ length: 6 }, () => {
    const x = (rand() - 0.5) * w * 0.5;
    const y = depth * (0.35 + rand() * 0.3);
    const len = 30 + rand() * 60;
    return `M ${x.toFixed(1)} ${y.toFixed(1)} q ${(rand() * 14 - 7).toFixed(1)} ${(len / 2).toFixed(1)} ${(rand() * 18 - 9).toFixed(1)} ${len.toFixed(1)}`;
  }).join(' ');
  const tufts = Array.from({ length: Math.round(w / 14) }, () => {
    const x = (rand() - 0.5) * w * 0.95;
    const y = -Math.sin(Math.PI * (x / w + 0.5)) * w * 0.045;
    return `M ${x.toFixed(1)} ${y.toFixed(1)} l ${(rand() * 4 - 2).toFixed(1)} ${(-5 - rand() * 6).toFixed(1)}`;
  }).join(' ');
  return { rock, grass, strata, roots, tufts };
}

// A leafy tree: trunk and a crown of clumps, lit on the sun's side
function tree(seed, x, y, size) {
  const rand = seeded(seed);
  const clumps = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2;
    return [x + Math.cos(a) * size * 0.45 + (rand() - 0.5) * size * 0.2, y - size * 1.1 + Math.sin(a) * size * 0.32, size * (0.32 + rand() * 0.16)];
  });
  return { trunk: `M ${x - size * 0.06} ${y} L ${x - size * 0.03} ${y - size * 0.9} L ${x + size * 0.04} ${y - size * 0.9} L ${x + size * 0.07} ${y} Z`, clumps };
}

// Islands back to front: haze = how much the sky's blue washes them out
const ISLES = [
  { id: 'a', x: 440,  y: 110, w: 130, depth: 90,  haze: 0.62, bob: 11, delay: -2,  extras: 'arch' },
  { id: 'b', x: 1290, y: 120, w: 170, depth: 120, haze: 0.55, bob: 13, delay: -6,  extras: 'trees-small' },
  { id: 'c', x: 210,  y: 200, w: 210, depth: 150, haze: 0.4,  bob: 12, delay: -9,  extras: 'windmill' },
  { id: 'd', x: 1010, y: 270, w: 250, depth: 190, haze: 0.18, bob: 10, delay: -4,  extras: 'falls' },
  { id: 'e', x: 720,  y: 330, w: 360, depth: 250, haze: 0,    bob: 9,  delay: 0,   extras: 'trees' },
];

function Isle({ isle }) {
  const s = island(isle.id.charCodeAt(0) * 7, isle.w, isle.depth);
  const p = `isle-${isle.id}`;
  const k = isle.w / 360;
  const trees = isle.extras === 'trees' ? [tree(1, -70, -12, 110), tree(2, 40, -14, 80), tree(3, 120, -8, 58)]
    : isle.extras === 'trees-small' ? [tree(4, -30, -6, 60), tree(5, 30, -6, 44)] : [];
  return (
    <svg className="aura-isle-bob absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice"
      style={{ animationDuration: `${isle.bob}s`, animationDelay: `${isle.delay}s` }} aria-hidden="true">
      <defs>
        <linearGradient id={`${p}-rock`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d9a77c" />
          <stop offset="45%" stopColor="#a87b62" />
          <stop offset="100%" stopColor="#6a4f5c" />
        </linearGradient>
        <linearGradient id={`${p}-deep`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b2a3a" stopOpacity="0" />
          <stop offset="100%" stopColor="#3b2a3a" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${p}-grass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a6e38f" />
          <stop offset="60%" stopColor="#6cc27d" />
          <stop offset="100%" stopColor="#3f9471" />
        </linearGradient>
        <filter id={`${p}-rugged`} x="-10%" y="-10%" width="120%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed={isle.id.charCodeAt(0)} />
          <feDisplacementMap in="SourceGraphic" scale={8 * k + 3} />
        </filter>
        <radialGradient id={`${p}-crown`} cx="32%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#a6e79a" />
          <stop offset="45%" stopColor="#5fb879" />
          <stop offset="100%" stopColor="#2d7a5a" />
        </radialGradient>
        <filter id={`${p}-leafy`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed={isle.id.charCodeAt(0) + 3} />
          <feDisplacementMap in="SourceGraphic" scale="10" />
        </filter>
      </defs>
      <g transform={`translate(${isle.x} ${isle.y})`}>
        <path d={s.roots} fill="none" stroke="#7a5c55" strokeWidth={1.6 * k + 0.6} strokeLinecap="round" opacity="0.8" />
        <g filter={`url(#${p}-rugged)`}>
          <path d={s.rock} fill={`url(#${p}-rock)`} />
          <path d={s.rock} fill={`url(#${p}-deep)`} />
          <path d={s.strata} fill="none" stroke="#5e4250" strokeOpacity="0.35" strokeWidth={2.5 * k + 0.5} />
        </g>
        <path d={s.grass} fill={`url(#${p}-grass)`} />
        <path d={s.tufts} stroke="#4f9d6c" strokeWidth="1.4" strokeLinecap="round" />
        {/* vines spilling over the sunny edge */}
        <path d={`M ${-isle.w * 0.45} 8 q -4 ${30 * k} 2 ${70 * k} M ${-isle.w * 0.38} 9 q 5 ${22 * k} -1 ${48 * k}`} stroke="#4f9d6c" strokeWidth={2 * k + 0.5} fill="none" strokeLinecap="round" />
        {isle.extras === 'arch' && (
          <path d="M -18 -2 L -18 -34 A 15 15 0 0 1 12 -34 L 12 -2 L 4 -2 L 4 -30 A 7 7 0 0 0 -10 -30 L -10 -2 Z" fill="#efe4d8" />
        )}
        {isle.extras === 'windmill' && (
          <g>
            <path d="M -9 -4 L -6 -58 L 6 -58 L 9 -4 Z" fill="#f2e9df" />
            <path d="M -9 -4 L -6 -58 L -1 -58 L -2 -4 Z" fill="#fff8ef" />
            <path d="M -10 -58 L 0 -72 L 10 -58 Z" fill="#b65d4c" />
            <rect x="-3" y="-22" width="6" height="10" rx="3" fill="#7a5c55" />
            <g className="aura-isle-windmill" style={{ transformOrigin: '0px -56px', transformBox: 'view-box' }}>
              {[0, 90, 180, 270].map(a => (
                <g key={a} transform={`rotate(${a} 0 -56)`}>
                  <rect x="-1.2" y="-96" width="2.4" height="40" fill="#8a6a58" />
                  <rect x="1.2" y="-94" width="9" height="30" fill="#fbf4ea" stroke="#d6c4b2" strokeWidth="0.8" />
                </g>
              ))}
              <circle cx="0" cy="-56" r="3.5" fill="#6a4f5c" />
            </g>
          </g>
        )}
        {trees.map((t, i) => (
          <g key={i}>
            <path d={t.trunk} fill="#7a5747" />
            <g filter={`url(#${p}-leafy)`} fill={`url(#${p}-crown)`}>
              {t.clumps.map(([cx, cy, r], j) => <circle key={j} cx={cx} cy={cy} r={r * 1.15} />)}
            </g>
            <g filter={`url(#${p}-leafy)`} fill="#2d7a5a" opacity="0.35">
              {t.clumps.slice(3).map(([cx, cy, r], j) => <circle key={j} cx={cx + r * 0.2} cy={cy + r * 0.35} r={r * 0.6} />)}
            </g>
          </g>
        ))}
      </g>
      {/* the haze between us and the farther islands */}
      {isle.haze > 0 && (
        <g transform={`translate(${isle.x} ${isle.y})`} opacity={isle.haze}>
          <path d={s.rock} fill="#bcd3f0" />
          <path d={s.grass} fill="#c6dcf2" />
          {trees.map((t, i) => <g key={i}>{t.clumps.map(([cx, cy, r], j) => <circle key={j} cx={cx} cy={cy} r={r} fill="#c6dcf2" />)}</g>)}
        </g>
      )}
    </svg>
  );
}

// The waterfall off island d's sunny edge, in its own moving layer
const FALL_X = 1010 - 250 / 2 + 22;
const FALL_Y = 276;

// Day's cloud bank, in warm sunrise tints
const CLOUD_SEA = [
  { seed: 9,  baseline: 230, minR: 70, maxR: 150, step: 120, top: '#ffffff', bottom: '#f3d7cf', opacity: 0.8,  drift: 'cloudDriftA 46s' },
  { seed: 27, baseline: 290, minR: 60, maxR: 130, step: 105, top: '#fffaf3', bottom: '#f6e2da', opacity: 0.92, drift: 'cloudDriftB 36s' },
  { seed: 53, baseline: 350, minR: 55, maxR: 115, step: 95,  top: '#ffffff', bottom: '#fbf0ea', opacity: 1,    drift: 'cloudDriftA 28s reverse' },
];

const STONES = [[470, 380, 9, 7], [600, 250, 6, 9], [1180, 360, 7, 8], [880, 170, 5, 10], [380, 300, 6, 12], [1400, 280, 5, 9]];

export default function SkyIsles({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-isle-sky absolute inset-0" />
      <div className="aura-isle-rays absolute inset-0" aria-hidden="true" />
      <div className="aura-isle-sun absolute" aria-hidden="true" />
      <FloatingCloud seed={3} idPrefix="isle-cloud" top="#ffffff" bottom="#f1dfe6" className="aura-float-cloud w-56 sm:w-72 top-[12%] left-[46%]" style={{ animationDuration: '44s' }} />
      <FloatingCloud seed={11} idPrefix="isle-cloud" top="#ffffff" bottom="#e5e3f6" className="aura-float-cloud w-44 sm:w-60 top-[26%] -right-10 sm:right-[6%] opacity-80" style={{ animationDuration: '52s', animationDirection: 'reverse' }} />
      <BirdFlock className={`aura-flock aura-isle-flock ${page ? 'top-[20vh]' : 'top-[24%]'}`} />
      <Balloon id="isle-balloon" stripes={['#f4ead8', '#3f8fb5', '#f4ead8', '#e0a43c', '#f4ead8', '#3f8fb5']} className={`aura-balloon ${page ? 'top-[30%]' : 'top-[36%]'}`} />

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[72vh] min-h-[360px]' : 'h-[60vh] min-h-[300px]'}`}>
        {ISLES.slice(0, 4).map(isle => <Isle key={isle.id} isle={isle} />)}
        <svg className="aura-isle-bob absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice"
          style={{ animationDuration: '10s', animationDelay: '-4s' }} aria-hidden="true">
          <defs>
            <linearGradient id="isle-fall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d9f1ff" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="isle-mist">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect className="aura-isle-fall" x={FALL_X - 10} y={FALL_Y} width="20" height="300" fill="url(#isle-fall)" />
          <rect className="aura-isle-fall aura-isle-fall-2" x={FALL_X - 4} y={FALL_Y} width="7" height="300" fill="#ffffff" opacity="0.8" />
          <ellipse className="aura-isle-mist" cx={FALL_X} cy={FALL_Y + 270} rx="70" ry="26" fill="url(#isle-mist)" />
        </svg>
        <Isle isle={ISLES[4]} />
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          {STONES.map(([x, y, r, dur], i) => (
            <path key={i} className="aura-isle-stone" style={{ animationDuration: `${dur}s`, animationDelay: `${-i * 1.7}s` }}
              d={`M ${x - r} ${y} L ${x - r * 0.3} ${y - r * 0.8} L ${x + r} ${y - r * 0.3} L ${x + r * 0.6} ${y + r * 0.7} Z`} fill="#a98269" />
          ))}
        </svg>
        <CloudBank layers={CLOUD_SEA} idPrefix="isle-sea" className="aura-isle-sea absolute inset-x-0 bottom-0 h-[30%] min-h-[140px]" />
      </div>
    </>
  );
}
