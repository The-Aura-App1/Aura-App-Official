import React from 'react';
import seeded from './seeded';
import './dreamscapes.css';

// A jellyfish: a soft glowing bell that pulses, frills under its rim and
// trailing tentacles that sway. Centred on the bell's rim at 0,0.
const BELL = 'M -30 0 C -32 -26 -18 -40 0 -40 C 18 -40 32 -26 30 0 C 22 5 14 -1 8 3 C 2 6 -4 0 -10 4 C -16 6 -24 3 -30 0 Z';
const tentacle = (x, len, k) => {
  const a = `M ${x} 2 C ${x + 8} ${len * 0.3} ${x - 8} ${len * 0.6} ${x + 3} ${len}`;
  const b = `M ${x} 2 C ${x - 8} ${len * 0.3} ${x + 8} ${len * 0.6} ${x - 3} ${len}`;
  return k ? `${a};${b};${a}` : `${b};${a};${b}`;
};

function Jelly({ hue, glow, scale }) {
  return (
    <svg width={90 * scale} height={190 * scale} viewBox="-45 -50 90 190" className="overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id={`jelly-${hue.slice(1)}`} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="45%" stopColor={hue} stopOpacity="0.55" />
          <stop offset="100%" stopColor={hue} stopOpacity="0.15" />
        </radialGradient>
      </defs>
      <g className="aura-abyss-tentacles" stroke={hue} strokeOpacity="0.55" strokeWidth="1.3" fill="none" strokeLinecap="round">
        {[-18, -9, 0, 9, 18].map((x, i) => (
          <path key={x} d={tentacle(x, 110 + (i % 2) * 25, i % 2).split(';')[0]}>
            <animate attributeName="d" values={tentacle(x, 110 + (i % 2) * 25, i % 2)} dur={`${3.2 + i * 0.35}s`} repeatCount="indefinite" />
          </path>
        ))}
        {[-12, 4, 14].map((x, i) => (
          <path key={`f${x}`} d={`M ${x} 2 q 4 14 -2 28 q -5 12 2 22`} strokeWidth="3" strokeOpacity="0.35" />
        ))}
      </g>
      <g className="aura-abyss-bell" style={{ filter: `drop-shadow(0 0 10px ${glow})` }}>
        <path d={BELL} fill={`url(#jelly-${hue.slice(1)})`} />
        <path d="M -22 -6 C -20 -24 -8 -32 0 -32" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const JELLIES = [
  { left: '14%', hue: '#c084fc', glow: '#c084fc', scale: 1, dur: 64, delay: -10, sway: 26 },
  { left: '72%', hue: '#67e8f9', glow: '#22d3ee', scale: 0.75, dur: 80, delay: -48, sway: 40 },
  { left: '46%', hue: '#f9a8d4', glow: '#f472b6', scale: 0.55, dur: 92, delay: -70, sway: 30 },
];

function makeBubbles(seed, count) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    left: rand() * 100,
    size: 3 + rand() ** 2 * 11,
    dur: 9 + rand() * 12,
    delay: -rand() * 20,
    wobble: 1.6 + rand() * 1.6,
  }));
}
const BUBBLES = makeBubbles(17, 22);

function makePlankton(seed, count) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    left: rand() * 100, top: 20 + rand() * 75, size: 1.5 + rand() * 2.5,
    dur: 3 + rand() * 5, delay: -rand() * 8, color: rand() < 0.6 ? '#67e8f9' : '#a5b4fc',
  }));
}
const PLANKTON = makePlankton(29, 40);

// Kelp: tall wavy strands rising from the floor, each swaying from its base
function makeKelp(seed, count) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => {
    const x = rand() * 1600;
    const h = 160 + rand() * 200;
    let d = `M ${x.toFixed(0)} 560`;
    for (let y = 0; y < h; y += 40) d += ` q ${(rand() * 26 - 13).toFixed(0)} -20 0 -40`;
    return { x, d, dur: 5 + rand() * 4, delay: -rand() * 6, width: 5 + rand() * 4 };
  });
}
const KELP = makeKelp(41, 22);

const FLOOR = 'M -80 600 L -80 470 C 80 450 160 480 300 462 C 420 446 520 490 700 480 C 900 470 1000 500 1180 470 C 1320 448 1460 478 1680 456 L 1680 600 Z';
const CORAL_TIPS = [[180, 452], [236, 446], [1290, 446], [1350, 438], [1420, 450], [640, 476], [960, 482], [560, 470], [720, 478], [1040, 470]];

// A whale, far off, in silhouette
const WHALE = 'M 0 0 C 30 -24 110 -30 190 -20 C 240 -14 280 -2 310 10 C 330 4 346 -10 362 -14 C 356 0 352 8 350 16 C 356 26 362 36 370 44 C 352 40 336 30 320 22 C 290 30 240 34 190 32 C 140 30 90 26 50 20 C 26 16 8 10 0 0 Z M 120 24 C 112 46 94 66 70 78 C 86 60 96 42 100 26 Z';

// Deep under the sea: shafts of light swaying down from the surface,
// glowing jellyfish drifting up and pulsing, bubbles wobbling to the top,
// sparks of plankton, kelp swaying and, now and then, a whale gliding past.
export default function Abyss({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-abyss-water absolute inset-0" />
      <div className="aura-abyss-surface absolute inset-x-0 top-0" aria-hidden="true" />
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className={`aura-abyss-ray aura-abyss-ray-${i}`} />)}
      </div>
      <div className="aura-abyss-snow absolute inset-0" aria-hidden="true" />

      <div className="aura-abyss-whale absolute" aria-hidden="true">
        <svg viewBox="-10 -40 390 130" className="w-full h-full" style={{ transform: 'scaleX(-1)' }}>
          <path d={WHALE} fill="#0b2a46" />
        </svg>
      </div>

      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {PLANKTON.map((p, i) => (
          <span key={i} className="aura-abyss-plankton absolute rounded-full"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, background: p.color, color: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
        ))}
        {JELLIES.map((j, i) => (
          <div key={i} className="aura-abyss-jelly absolute" style={{ left: j.left, '--sway': `${j.sway}px`, animationDuration: `${j.dur}s`, animationDelay: `${j.delay}s` }}>
            <Jelly hue={j.hue} glow={j.glow} scale={j.scale} />
          </div>
        ))}
        {BUBBLES.map((b, i) => (
          <span key={i} className="aura-abyss-bubble-rise absolute bottom-0" style={{ left: `${b.left}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}>
            <span className="aura-abyss-bubble block rounded-full" style={{ width: b.size, height: b.size, animationDuration: `${b.wobble}s` }} />
          </span>
        ))}
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[46vh] min-h-[260px]' : 'h-[38vh] min-h-[220px]'}`}>
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 1600 560"
          preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="abyss-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a2238" />
              <stop offset="100%" stopColor="#020812" />
            </linearGradient>
            <radialGradient id="abyss-tip">
              <stop offset="0%" stopColor="#a5f3fc" stopOpacity="1" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </radialGradient>
          </defs>
          {KELP.map((k, i) => (
            <path key={i} className="aura-abyss-kelp" d={k.d} fill="none" stroke="#0f3b3a" strokeWidth={k.width} strokeLinecap="round"
              style={{ transformOrigin: `${k.x}px 560px`, animationDuration: `${k.dur}s`, animationDelay: `${k.delay}s` }} />
          ))}
          <path d={FLOOR} fill="url(#abyss-floor)" />
          {/* Rocks and coral fans */}
          <path d="M 120 470 C 130 420 170 400 210 420 C 240 400 280 420 270 466 Z M 1260 462 C 1270 418 1320 402 1360 424 C 1390 408 1440 426 1430 458 Z M 600 480 C 610 446 650 436 680 452 C 700 440 740 450 730 482 Z M 980 486 C 990 456 1030 448 1056 462 C 1076 452 1100 462 1094 488 Z" fill="#071827" />
          {CORAL_TIPS.map(([x, y], i) => (
            <circle key={i} className="aura-abyss-tip" cx={x} cy={y} r="9" fill="url(#abyss-tip)" style={{ animationDelay: `${-i * 0.9}s` }} />
          ))}
        </svg>
      </div>
    </>
  );
}
