import React, { useState } from 'react';
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

// A short line centred on 0,0 with three small humps. `a` is the hump
// height; the same command list at any height lets the browser morph it.
const crest = (w, a) =>
  `M ${-w / 2} 0 Q ${(-3 * w) / 8} ${-2 * a} ${-w / 4} 0 T 0 0 T ${w / 4} 0 T ${w / 2} 0`;

// Small waves breaking out at sea: short pale crests scattered across the
// water. Each one appears, rolls forward a little towards the shore with a
// ripple running through it, then fades, and rests before breaking again.
// Tiny and close together near the horizon, bigger towards the shore.
const WHITECAPS = (() => {
  const rand = seeded(21);
  return Array.from({ length: 95 }, () => {
    const depth = rand() ** 1.3;
    const w = 6 + depth * 38 + rand() * 12;
    const h = 1.3 + depth * 1.6;
    const a = h * 0.3;
    return {
      x: -40 + rand() * (WIDTH + 80),
      y: HORIZON + 8 + depth * (SHORE - 40),
      h,
      flat: crest(w, 0),
      ripple: [crest(w, 0), crest(w, a), crest(w, 0), crest(w, -a), crest(w, 0)].join(';'),
      rippleDur: 1.2 + rand() * 0.8,
      roll: 2 + depth * 9,
      dur: 4.5 + rand() * 4,
      delay: -rand() * 8,
    };
  });
})();

// A bottlenose dolphin in profile, facing right and centred on its middle:
// a short beak, a rounded forehead (melon), a long tapering body and a
// forked tail, with a swept-back dorsal fin and two flippers.
const DOLPHIN_BODY = 'M 51 1.6 C 49 0.2 45 -0.4 41 -0.6 C 39.5 -5.5 34 -9 26 -9.8 C 12 -10.8 -8 -9.6 -22 -6.4' +
  ' C -30 -4.6 -37 -2.6 -44 -1.2 C -48 -3.6 -52.5 -7.6 -59 -10.2 C -57 -5.6 -55.2 -2.4 -53 0' +
  ' C -55.2 2.4 -57 6 -59 10 C -52.5 7.2 -48 3.8 -44 1.6 C -36 3.4 -24 7.2 -8 7.8 C 8 8.4 22 7 32 4.4' +
  ' C 39 3 46 2.8 51 1.6 Z';
const DOLPHIN_FIN = 'M 8 -10.2 C 3 -14 -2 -20 -11 -23.5 C -8.5 -19 -8.8 -13.5 -12 -8.6 Z';
const DOLPHIN_FLIPPER_NEAR = 'M 25 4.8 C 22 9.5 17 13 11.5 15 C 14 10.5 17 7.5 19 5.8 Z';
const DOLPHIN_FLIPPER_FAR = 'M 23 4.6 C 20.5 8.5 17 11.4 13 13 C 15 9.6 17.4 7 18.6 5.6 Z';
// Sunset light catching the back and the fin's leading edge
const DOLPHIN_RIM = 'M 41 -0.6 C 39.5 -5.5 34 -9 26 -9.8 C 12 -10.8 -8 -9.6 -22 -6.4 C -30 -4.6 -37 -2.6 -44 -1.2' +
  ' M 8 -10.2 C 3 -14 -2 -20 -11 -23.5';

function Dolphin({ timing, onLeapDone }) {
  return (
    <g className="aura-dolphin" style={timing} onAnimationIteration={onLeapDone}>
      <path d={DOLPHIN_FIN} fill="#1b1230" />
      <path d={DOLPHIN_FLIPPER_FAR} fill="#140c24" />
      <path d={DOLPHIN_BODY} fill="url(#dolphin-skin)" />
      <path d={DOLPHIN_FLIPPER_NEAR} fill="#1f1536" />
      <path d="M 50 1.8 C 46 2.2 42 2.5 39 2.3" fill="none" stroke="#120a20" strokeWidth="0.5" strokeLinecap="round" />
      <circle cx="35.5" cy="-2.4" r="0.9" fill="#0c0616" />
      <path d={DOLPHIN_RIM} fill="none" stroke="#ffb48a" strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  );
}

// Somewhere new for a pod to surface: anywhere across the sea from just
// below the horizon to about halfway to the shore, smaller further away,
// leaping either way.
function randomSpot() {
  const depth = Math.random();
  return {
    x: 150 + Math.random() * (WIDTH - 300),
    y: HORIZON + 25 + depth * 130,
    scale: 0.3 + depth * 0.3,
    flip: Math.random() < 0.5,
  };
}

// A few dolphins leaping together, each a beat behind the last. They arc up
// and over with a splash where they leave and re-enter the water, then stay
// under (clipped at the surface) for the rest of the cycle. Every time the
// lead dolphin's cycle starts over, while they're all underwater, the pod
// moves somewhere new.
function DolphinPod({ size, dur, delay }) {
  const [spot, setSpot] = useState(randomSpot);
  const timing = i => ({ animationDuration: `${dur}s`, animationDelay: `${delay + i * 0.45}s` });
  return (
    <g transform={`translate(${spot.x.toFixed(1)} ${spot.y.toFixed(1)}) scale(${spot.flip ? -spot.scale : spot.scale} ${spot.scale})`}>
      {Array.from({ length: size }, (_, i) => (
        <g key={i} transform={`translate(${-i * 55} ${i * 7})`}>
          <g clipPath="url(#dusk-above-water)">
            <Dolphin timing={timing(i)} onLeapDone={i === 0 ? () => setSpot(randomSpot()) : undefined} />
          </g>
          <rect className="aura-dolphin-splash" x="-2" y="-1.6" width="28" height="3.4" rx="1.7" fill="#efe6ff" style={timing(i)} />
          <ellipse className="aura-dolphin-splash aura-dolphin-spray" cx="12" cy="-4" rx="7" ry="5" fill="#efe6ff" style={timing(i)} />
          <rect className="aura-dolphin-splash aura-dolphin-splash-in" x="76" y="-1.6" width="28" height="3.4" rx="1.7" fill="#efe6ff" style={timing(i)} />
          <ellipse className="aura-dolphin-splash aura-dolphin-splash-in aura-dolphin-spray" cx="90" cy="-4" rx="7" ry="5" fill="#efe6ff" style={timing(i)} />
        </g>
      ))}
    </g>
  );
}

const PODS = [
  { size: 2, dur: 15, delay: 2 },
  { size: 1, dur: 19, delay: 8 },
  { size: 3, dur: 26, delay: 14 },
];

const HEADLAND = 'M 1080 0 C 1150 -6 1190 -26 1250 -30 C 1300 -36 1340 -52 1395 -54 C 1450 -56 1480 -40 1530 -36 C 1580 -32 1640 -28 1700 -26 L 1700 0 Z';

// A dark beach just after sunset: a violet sky with the last orange glow on
// the horizon, early stars twinkling, the afterglow glinting on the water,
// small waves breaking out at sea and the odd dolphin leaping. `page` is the full version for the
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
            <clipPath id="dusk-above-water">
              <rect x="-200" y="-200" width="500" height="200" />
            </clipPath>
            {/* Dark back, lighter belly */}
            <linearGradient id="dolphin-skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1b1230" />
              <stop offset="55%" stopColor="#2a1d44" />
              <stop offset="100%" stopColor="#5a4a78" />
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
            <g key={i} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>
              <path className="aura-dusk-whitecap" d={c.flat} fill="none" stroke="#efe6ff" strokeWidth={c.h} strokeLinecap="round"
                style={{ '--roll': `${c.roll.toFixed(1)}px`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}>
                <animate attributeName="d" values={c.ripple} dur={`${c.rippleDur.toFixed(2)}s`} repeatCount="indefinite" />
              </path>
            </g>
          ))}

          {GLINTS.map((g, i) => (
            <rect key={i} className="aura-dusk-glint" x={g.x - g.w / 2} y={g.y} width={g.w} height="2.2" rx="1.1"
              fill="#ffc29e" style={{ animationDelay: `${g.delay}s`, animationDuration: `${g.dur}s` }} />
          ))}

          {/* The water's surface is y = 0 in each dolphin's own space, so
              the clip hides whatever part of it is still underwater. */}
          {PODS.map((pod, i) => <DolphinPod key={i} {...pod} />)}

          {/* The beach, with a darker damp band along the water's edge */}
          <path d={`M -100 ${SHORE} C 400 ${SHORE - 12} 1100 ${SHORE + 10} ${WIDTH + 100} ${SHORE - 6} L ${WIDTH + 100} ${BOTTOM} L -100 ${BOTTOM} Z`} fill="url(#dusk-sand)" />
          <path d={`M -100 ${SHORE} C 400 ${SHORE - 12} 1100 ${SHORE + 10} ${WIDTH + 100} ${SHORE - 6} L ${WIDTH + 100} ${SHORE + 40} C 1000 ${SHORE + 50} 500 ${SHORE + 34} -100 ${SHORE + 44} Z`}
            fill="#4b3a6a" opacity="0.35" />
        </svg>
      </div>
    </>
  );
}
