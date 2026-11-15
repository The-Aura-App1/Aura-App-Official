import React from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';
import './dreamscapes.css';

const WIDTH = 1600;
const HEIGHT = 520;
const SHORE = 330;   // where the trees meet the frozen lake

// A ribbon of aurora: a wavy lower edge (the bright hem) with rays rising
// from it to a softer top. Drawn once; the CSS sways and stretches it.
function ribbon(seed, base, amp, height) {
  const rand = seeded(seed);
  const n = 9;
  const pts = Array.from({ length: n }, (_, i) => {
    const x = -150 + (i * (WIDTH + 300)) / (n - 1);
    const y = base + Math.sin(i * 1.3 + seed) * amp + (rand() - 0.5) * amp * 0.6;
    return [x, y, height * (0.7 + rand() * 0.5)];
  });
  const curve = (list, top) => list.map(([x, y, h], i) => {
    const yy = top ? y - h : y;
    if (i === 0) return `M ${x.toFixed(0)} ${yy.toFixed(0)}`;
    const [px, py, ph] = list[i - 1];
    const cx = ((px + x) / 2).toFixed(0);
    const cy = (((top ? py - ph : py) + yy) / 2).toFixed(0);
    return `Q ${px.toFixed(0)} ${(top ? py - ph : py).toFixed(0)} ${cx} ${cy}`;
  }).join(' ');
  const bottom = curve(pts, false);
  const top = curve([...pts].reverse(), true).replace(/^M/, 'L');
  return `${bottom} L ${pts[n - 1][0]} ${pts[n - 1][1]} ${top} Z`;
}

const CURTAINS = [
  { id: 'a', d: ribbon(3, 300, 55, 260), hem: '#7dffc9', mid: '#2fe0a8', top: '#8b5cf6', className: 'aura-nl-curtain-1', opacity: 0.85 },
  { id: 'b', d: ribbon(11, 250, 40, 200), hem: '#9cf6ff', mid: '#38d3c4', top: '#c084fc', className: 'aura-nl-curtain-2', opacity: 0.6 },
  { id: 'c', d: ribbon(23, 170, 30, 160), hem: '#f0abfc', mid: '#a78bfa', top: '#60a5fa', className: 'aura-nl-curtain-3', opacity: 0.3 },
];

function Curtains({ prefix }) {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${WIDTH} 420`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        {CURTAINS.map(c => (
          <linearGradient key={c.id} id={`${prefix}-g-${c.id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={c.hem} stopOpacity="0.95" />
            <stop offset="22%" stopColor={c.mid} stopOpacity="0.55" />
            <stop offset="60%" stopColor={c.top} stopOpacity="0.1" />
            <stop offset="100%" stopColor={c.top} stopOpacity="0" />
          </linearGradient>
        ))}
        {/* Vertical rays: uneven stripes that make the light look like it's
            falling in folds rather than a flat sheet */}
        <pattern id={`${prefix}-rays`} width="173" height="10" patternUnits="userSpaceOnUse">
          <rect width="173" height="10" fill="#fff" fillOpacity="0.72" />
          {[[4, 9, 1], [21, 3, 0.9], [33, 14, 1], [58, 5, 0.85], [71, 2, 1], [86, 18, 0.95], [117, 6, 1], [131, 3, 0.8], [146, 11, 1], [163, 4, 0.9]].map(([x, w, o]) => (
            <rect key={x} x={x} width={w} height="10" fill="#fff" fillOpacity={o} />
          ))}
        </pattern>
        <mask id={`${prefix}-mask`}>
          <rect x="-200" y="-200" width={WIDTH + 400} height="800" fill={`url(#${prefix}-rays)`} />
        </mask>
        <filter id={`${prefix}-soft`} x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      {CURTAINS.map(c => (
        <g key={c.id} className={`aura-nl-curtain ${c.className}`} opacity={c.opacity}>
          <g filter={`url(#${prefix}-soft)`} mask={`url(#${prefix}-mask)`}>
            <path d={c.d} fill={`url(#${prefix}-g-${c.id})`} />
          </g>
        </g>
      ))}
    </svg>
  );
}

// Snowy pines along the far shore, smaller toward the back
function makePines(seed, count, baseY, minH, maxH) {
  const rand = seeded(seed);
  let d = '';
  let snow = '';
  for (let i = 0; i < count; i++) {
    const x = -40 + rand() * (WIDTH + 80);
    const h = minH + rand() * (maxH - minH);
    const w = h * 0.34;
    const y = baseY + rand() * 10;
    // three stacked tiers
    for (let t = 0; t < 3; t++) {
      const ty = y - (h * t) / 3.2;
      const tw = w * (1 - t * 0.26);
      d += `M ${(x - tw).toFixed(1)} ${ty.toFixed(1)} L ${x.toFixed(1)} ${(ty - h * 0.48).toFixed(1)} L ${(x + tw).toFixed(1)} ${ty.toFixed(1)} Z `;
      snow += `M ${(x - tw * 0.45).toFixed(1)} ${(ty - h * 0.26).toFixed(1)} L ${x.toFixed(1)} ${(ty - h * 0.48).toFixed(1)} L ${(x + tw * 0.2).toFixed(1)} ${(ty - h * 0.33).toFixed(1)} Z `;
    }
    d += `M ${(x - 1.5).toFixed(1)} ${y.toFixed(1)} h 3 v 6 h -3 Z `;
  }
  return { d, snow };
}
const FAR_PINES = makePines(5, 110, SHORE - 14, 26, 50);
const NEAR_PINES = makePines(9, 60, SHORE + 8, 60, 110);

const MOUNTAINS = 'M -60 260 L 120 170 L 210 205 L 330 120 L 450 200 L 560 150 L 700 230 L 820 160 L 930 110 L 1060 190 L 1180 140 L 1320 215 L 1430 150 L 1660 240 L 1660 330 L -60 330 Z';
const MOUNTAIN_SNOW = 'M 330 120 L 300 140 L 322 136 L 340 148 L 358 134 Z M 930 110 L 896 136 L 920 130 L 940 144 L 962 128 Z M 1180 140 L 1156 158 L 1176 154 L 1192 164 L 1206 152 Z M 120 170 L 98 184 L 118 180 L 134 188 Z';

// The campfire's sparks
const SPARKS = Array.from({ length: 6 }, (_, i) => ({ dx: (i % 3) * 3 - 3, delay: i * 0.55, dur: 2.6 + (i % 3) * 0.5 }));

// A still, deep-blue night: aurora curtains swaying and stretching over a
// frozen lake that mirrors them, snowy pines on the far shore, a lit tent
// with a campfire, and the odd shooting star. `page` is the full version
// for the public pages; `app` sits lower behind the signed-in app.
export default function NorthernLights({ variant = 'page' }) {
  const page = variant === 'page';
  const ground = page ? 'h-[44vh] min-h-[250px]' : 'h-[36vh] min-h-[210px]';
  return (
    <>
      <div className="aura-nl-sky absolute inset-0" />
      <div className="absolute inset-0 aura-nl-stars">
        <div className="absolute inset-0 aura-stars-1 opacity-60" />
        <TwinklingStars seed={47} count={55} />
      </div>
      <span className="aura-nl-meteor" style={{ top: '12vh', left: '70%' }} aria-hidden="true" />
      <span className="aura-nl-meteor aura-nl-meteor-2" style={{ top: '22vh', left: '35%' }} aria-hidden="true" />

      <div className={`absolute inset-x-0 top-0 ${page ? 'h-[62vh]' : 'h-[66vh]'} aura-nl-sky-lights`}>
        <Curtains prefix="nl" />
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${ground}`}>
        {/* The aurora mirrored in the ice, fainter and softer */}
        <div className="absolute inset-x-0 bottom-0 h-[36%] overflow-hidden aura-nl-reflection">
          {/* same size as the sky's aurora, flipped so its hem sits just under the shore */}
          <div className="absolute inset-x-0 top-0 origin-top"
            style={{ height: page ? '62vh' : '66vh', transform: `translateY(${page ? 46 : 49}vh) scaleY(-1)` }}>
            <Curtains prefix="nlr" />
          </div>
        </div>
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="nl-range" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d3550" />
              <stop offset="100%" stopColor="#0b1a2c" />
            </linearGradient>
            <linearGradient id="nl-ice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f2a3d" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#050f1c" stopOpacity="0.92" />
            </linearGradient>
            <linearGradient id="nl-shore-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5af0bf" stopOpacity="0" />
              <stop offset="100%" stopColor="#5af0bf" stopOpacity="0.16" />
            </linearGradient>
            <radialGradient id="nl-fire">
              <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#ff9a4d" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ff7a3d" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="-60" y="120" width={WIDTH + 120} height={SHORE - 110} fill="url(#nl-shore-glow)" />
          <path d={MOUNTAINS} fill="url(#nl-range)" />
          <path d={MOUNTAIN_SNOW} fill="#cfe6ff" opacity="0.35" />
          <path d={FAR_PINES.d} fill="#0c1d2f" />
          <path d={FAR_PINES.snow} fill="#bcd8f2" opacity="0.28" />

          {/* The frozen lake: a glassy sheet that lets the reflection through */}
          <rect x="-60" y={SHORE} width={WIDTH + 120} height={HEIGHT - SHORE + 40} fill="url(#nl-ice)" />
          <rect x="-60" y={SHORE} width={WIDTH + 120} height="1.5" fill="#a6f5dc" opacity="0.35" />
          {[0, 1, 2, 3].map(i => (
            <rect key={i} className="aura-nl-glint" x={180 + i * 360} y={SHORE + 30 + (i % 2) * 60} width={160 + (i % 3) * 60} height="1.4" rx="0.7"
              fill="#d8fff1" style={{ animationDelay: `${-i * 2.3}s` }} />
          ))}

          {/* Pines on the near shore, left and right, framing the lake */}
          <path d={NEAR_PINES.d} fill="#060f1b" clipPath="url(#nl-sides)" />
          <clipPath id="nl-sides">
            <rect x="-60" y="0" width="600" height={HEIGHT} />
            <rect x="1060" y="0" width="600" height={HEIGHT} />
          </clipPath>

          {/* A tent glowing from inside, and a little fire */}
          <g transform={`translate(930 ${SHORE + 10}) scale(1.3)`}>
            <ellipse cx="-30" cy="4" rx="90" ry="16" fill="url(#nl-fire)" className="aura-nl-fireglow" />
            <path d="M -70 4 L -42 -36 L -14 4 Z" fill="#1a2436" />
            <path d="M -50 4 L -42 -22 L -34 4 Z" fill="#ffb867" className="aura-nl-tent" />
            <path d="M -42 -36 L -44 -42" stroke="#1a2436" strokeWidth="2" />
            <path d="M 2 4 L 14 -1 M 6 -1 L 18 4" stroke="#3a2a22" strokeWidth="2.4" strokeLinecap="round" />
            <path className="aura-nl-flame" d="M 10 0 C 4 -6 8 -12 10 -18 C 12 -12 17 -7 10 0 Z" fill="#ffb24d" />
            <path className="aura-nl-flame aura-nl-flame-2" d="M 10 0 C 7 -4 9 -8 10 -11 C 11 -8 13 -4 10 0 Z" fill="#fff0b8" />
            {SPARKS.map((s, i) => (
              <circle key={i} className="aura-nl-spark" cx={10 + s.dx} cy="-14" r="1.1" fill="#ffd28a"
                style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
            ))}
          </g>
        </svg>
      </div>
    </>
  );
}
