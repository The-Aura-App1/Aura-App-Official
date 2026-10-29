import React from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';

const WIDTH = 1600;
// The SVG starts a little above the horizon so the headland can rise above it.
const TOP = -70;
const HORIZON = 0;
const SHORE = 290;
const BOTTOM = 520;

// Glints of the afterglow on the water, in a column under the sunset that
// widens towards the shore.
const GLINTS = (() => {
  const rand = seeded(9);
  return Array.from({ length: 40 }, () => {
    const y = HORIZON + 6 + rand() ** 1.4 * (SHORE - 30);
    const spread = 30 + (y / SHORE) * 220;
    return {
      x: WIDTH / 2 + (rand() - 0.5) * spread * 2,
      y,
      w: 10 + rand() * (20 + (y / SHORE) * 70),
      delay: rand() * 4,
      dur: 2.5 + rand() * 2.5,
    };
  });
})();

// Small waves breaking out at sea: short pale dashes scattered across the
// water that each appear, stretch as the wave tips over, and fade away, then
// rest a while before breaking again. Tiny and close together near the
// horizon, a little bigger towards the shore.
const WHITECAPS = (() => {
  const rand = seeded(21);
  return Array.from({ length: 46 }, () => {
    const depth = rand() ** 1.3;
    return {
      x: -40 + rand() * (WIDTH + 80),
      y: HORIZON + 8 + depth * (SHORE - 40),
      w: 6 + depth * 34 + rand() * 10,
      h: 1.2 + depth * 1.4,
      dur: 6 + rand() * 6,
      delay: -rand() * 12,
    };
  });
})();

const HEADLAND = 'M 1080 0 C 1150 -6 1190 -26 1250 -30 C 1300 -36 1340 -52 1395 -54 C 1450 -56 1480 -40 1530 -36 C 1580 -32 1640 -28 1700 -26 L 1700 0 Z';

// A dark beach just after sunset: a violet sky with the last orange glow on
// the horizon, early stars twinkling, the afterglow glinting on the water
// and small waves breaking out at sea. `page` is the full version for the
// public pages; `app` sits lower behind the signed-in app.
export default function Duskfall({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-dusk-sky absolute inset-0" />
      <div className="aura-dusk-stars absolute inset-0">
        <div className="absolute inset-0 aura-stars-1 opacity-60" />
        <TwinklingStars seed={13} count={45} />
      </div>
      <div className={`aura-dusk-sea absolute inset-x-0 bottom-0 ${page ? 'h-[46vh] min-h-[260px]' : 'h-[38vh] min-h-[220px]'}`}>
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 ${TOP} ${WIDTH} ${BOTTOM - TOP}`}
          preserveAspectRatio="xMidYMin slice" aria-hidden="true">
          <defs>
            <linearGradient id="dusk-sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a2a5c" />
              <stop offset="35%" stopColor="#24183f" />
              <stop offset="100%" stopColor="#120e2a" />
            </linearGradient>
            <linearGradient id="dusk-sand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a2738" />
              <stop offset="100%" stopColor="#170f1c" />
            </linearGradient>
            {/* The afterglow lives in the SVG, not the CSS sky, so it always
                sits right on the horizon whatever the screen shape. */}
            <linearGradient id="dusk-glow-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c2574b" stopOpacity="0" />
              <stop offset="70%" stopColor="#a8456b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ff8a5c" stopOpacity="0.7" />
            </linearGradient>
            <radialGradient id="dusk-sun">
              <stop offset="0%" stopColor="#ffd2a8" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#ff9a6a" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#d9466e" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="-100" y={HORIZON - 420} width={WIDTH + 200} height="420" fill="url(#dusk-glow-band)" />
          <ellipse cx={WIDTH / 2} cy={HORIZON} rx="520" ry="190" fill="url(#dusk-sun)" />
          <path d={HEADLAND} fill="#140c22" />
          <rect x="-100" y={HORIZON} width={WIDTH + 200} height={SHORE + 40} fill="url(#dusk-sea)" />
          <line x1="-100" y1={HORIZON} x2={WIDTH + 100} y2={HORIZON} stroke="#ffb48a" strokeOpacity="0.55" strokeWidth="1.5" />

          {WHITECAPS.map((c, i) => (
            <rect key={i} className="aura-dusk-whitecap" x={c.x - c.w / 2} y={c.y} width={c.w} height={c.h} rx={c.h / 2}
              fill="#efe6ff" style={{ animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} />
          ))}

          {GLINTS.map((g, i) => (
            <rect key={i} className="aura-dusk-glint" x={g.x - g.w / 2} y={g.y} width={g.w} height="2.2" rx="1.1"
              fill="#ffc29e" style={{ animationDelay: `${g.delay}s`, animationDuration: `${g.dur}s` }} />
          ))}

          {/* The beach, with a darker damp band along the water's edge */}
          <path d={`M -100 ${SHORE} C 400 ${SHORE - 12} 1100 ${SHORE + 10} ${WIDTH + 100} ${SHORE - 6} L ${WIDTH + 100} ${BOTTOM} L -100 ${BOTTOM} Z`} fill="url(#dusk-sand)" />
          <path d={`M -100 ${SHORE} C 400 ${SHORE - 12} 1100 ${SHORE + 10} ${WIDTH + 100} ${SHORE - 6} L ${WIDTH + 100} ${SHORE + 40} C 1000 ${SHORE + 50} 500 ${SHORE + 34} -100 ${SHORE + 44} Z`}
            fill="#4b3a6a" opacity="0.35" />
        </svg>
      </div>
    </>
  );
}
