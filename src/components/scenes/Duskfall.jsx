import React, { useState } from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';

const WIDTH = 1600;
// The SVG starts a little above the horizon so the headland can rise above it.
const TOP = -70;
const HORIZON = 0;
const SHORE = 290;
const BOTTOM = 520;

// A line centred on 0,0 made of small alternating humps, about one every
// 12 units (at least four). `a` is the hump height; the same command list
// at any height lets the browser morph between them.
function crest(w, a) {
  const count = Math.max(4, Math.round(w / 12));
  const half = w / count;
  let d = `M ${(-w / 2).toFixed(1)} 0 Q ${(-w / 2 + half / 2).toFixed(1)} ${(-2 * a).toFixed(2)} ${(-w / 2 + half).toFixed(1)} 0`;
  for (let k = 2; k <= count; k++) d += ` T ${(-w / 2 + k * half).toFixed(1)} 0`;
  return d;
}

// The shapes a crest ripples through: flat, humped, flat, humps flipped.
const rippleShapes = (w, a) => [0, a, 0, -a, 0].map(h => crest(w, h)).join(';');

// Waves out at sea. Each one forms gradually somewhere out on the water
// (mostly far out), is carried in towards the shore, growing longer and
// thicker as it comes closer, and breaks up partway. Fewer make it far in,
// so they thin out towards the beach. Once a wave fades, the next one forms
// somewhere new. Every wave moves at the same speed (WAVE_SPEED), so none
// ever overtakes another; a wave's lifetime just decides how far it gets.
// The line is drawn once at a base size (BASE_WAVE wide), scaled, and
// ripples the whole time.
//
// Sunlit waves work the same way but catch the afterglow: they're orange,
// form inside the column of light under the sunset, which widens towards
// the shore, and shimmer as they go.
const BASE_WAVE = 60;
const WAVE_SHAPE = crest(BASE_WAVE, 0);
const WAVE_RIPPLE = rippleShapes(BASE_WAVE, 0.8);
const WAVE_SPEED = 0.028;   // depth (horizon 0 to shore 1) per second

// Where a depth (horizon 0 to shore 1) sits on screen.
const depthY = depth => HORIZON + 8 + depth * (SHORE - 40);
// How wide a wave looks at a depth, as a scale of the base line.
const depthScale = depth => (14 + depth * 95) / BASE_WAVE;
// Half the width of the column of sunlight on the water at a depth.
const sunColumn = depth => 30 + depth * 230;

function randomWave(duration, sunlit) {
  const travel = WAVE_SPEED * duration;
  const from = Math.random() ** 1.6 * (1 - travel);
  const x = sunlit
    ? WIDTH / 2 + (Math.random() - 0.5) * 2 * sunColumn(from)
    : -40 + Math.random() * (WIDTH + 80);
  const length = sunlit ? 0.5 + Math.random() * 0.7 : 0.8 + Math.random() * 0.6;
  return { x, from, to: from + travel, length };
}

function Wave({ duration, delay, rippleDur, sunlit }) {
  const [wave, setWave] = useState(() => randomWave(duration, sunlit));
  return (
    <g transform={`translate(${wave.x.toFixed(1)} ${depthY(wave.from).toFixed(1)})`}>
      <g className={sunlit ? 'aura-dusk-glint' : undefined} style={sunlit ? { animationDelay: `${delay}s` } : undefined}>
        <path className="aura-dusk-whitecap" d={WAVE_SHAPE} fill="none" stroke={sunlit ? '#ffc29e' : '#efe6ff'}
          strokeWidth="1.8" strokeLinecap="round"
          onAnimationIteration={e => { if (e.target === e.currentTarget) setWave(randomWave(duration, sunlit)); }}
          style={{
            '--travel': `${(depthY(wave.to) - depthY(wave.from)).toFixed(1)}px`,
            '--s0': (depthScale(wave.from) * wave.length).toFixed(3),
            '--s1': (depthScale(wave.to) * wave.length).toFixed(3),
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}>
          <animate attributeName="d" values={WAVE_RIPPLE} dur={`${rippleDur}s`} repeatCount="indefinite" />
        </path>
      </g>
    </g>
  );
}

// Each wave keeps its own lifetime; the negative delays start them part-way
// through, so the sea is already busy when the scene appears.
const makeWaves = (seed, count, sunlit) => {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => {
    const duration = 9 + rand() * 7;
    return {
      duration: +duration.toFixed(2),
      delay: -(rand() * duration).toFixed(2),
      rippleDur: +(1.1 + rand() * 0.8).toFixed(2),
      sunlit,
    };
  });
};
const WAVES = [...makeWaves(21, 70, false), ...makeWaves(9, 40, true)];

// A small sailboat seen side-on, far out on the horizon (its waterline is
// y = 0): hull, mast, mainsail and jib.
const SAILBOAT_HULL = 'M -15 -3 L 15 -3 L 11 1 L -12 1 Z';
const SAILBOAT_SAILS = 'M -1.5 -30 L -1.5 -4.5 L -15 -4.5 Q -9 -17 -1.5 -30 Z' +
  ' M 0.8 -27 L 0.8 -5 L 13 -4.8 Q 8 -15 0.8 -27 Z';
const SAILBOAT_RIM = 'M -15 -4.5 Q -9 -17 -1.5 -30 M 13 -4.8 Q 8 -15 0.8 -27';

// A bottlenose dolphin in profile, facing right and centred on its middle:
// a short beak, a rounded forehead (melon), a back that arches over and a
// slender tail stock curving down into crescent flukes, with a hooked
// dorsal fin and curved flippers.
const DOLPHIN_BODY = 'M 52 4.2 C 50 2.6 46 1.6 42 1 C 41 -4.5 35 -9 26 -10.6 C 12 -13 -4 -13 -18 -10' +
  ' C -28 -7.6 -35 -3.6 -41 0.2 C -43.5 1.6 -45.5 2.6 -47.5 3' +
  ' C -51.5 0.4 -56 -4 -62.5 -7.4 C -59.5 -2.6 -56.4 1 -53.6 3.6' +
  ' C -57 6.4 -61.6 10.8 -66.5 14.6 C -58.6 13.6 -52 9.6 -47 6' +
  ' C -41 4 -33 5.6 -24 7.6 C -10 10 8 10.4 22 8 C 32 6.4 40 5.6 44 5' +
  ' C 47.5 4.8 50.5 4.8 52 4.2 Z';
const DOLPHIN_FIN = 'M 7 -12.4 C 2 -19 -4 -24.5 -15.5 -26.2 C -11 -22 -10 -16 -12.5 -10.2 Z';
const DOLPHIN_FLIPPER_NEAR = 'M 26 6.8 C 23.5 10.8 19.5 14.6 13 17.4 C 15.5 13.8 18 10.8 19.8 8 Z';
const DOLPHIN_FLIPPER_FAR = 'M 24 6.4 C 21.6 9.8 18.4 12.6 14.6 14.6 C 16.6 11.4 18.8 9 20.2 7.2 Z';
// Sunset light catching the back, the fin's leading edge and the upper fluke
const DOLPHIN_RIM = 'M 42 1 C 41 -4.5 35 -9 26 -10.6 C 12 -13 -4 -13 -18 -10 C -28 -7.6 -35 -3.6 -41 0.2' +
  ' M 7 -12.4 C 2 -19 -4 -24.5 -15.5 -26.2 M -47.5 3 C -51.5 0.4 -56 -4 -62.5 -7.4';

function Dolphin({ timing, onLeapDone }) {
  return (
    <g className="aura-dolphin" style={timing} onAnimationIteration={onLeapDone}>
      <path d={DOLPHIN_FIN} fill="#1b1230" />
      <path d={DOLPHIN_FLIPPER_FAR} fill="#140c24" />
      <path d={DOLPHIN_BODY} fill="url(#dolphin-skin)" />
      <path d={DOLPHIN_FLIPPER_NEAR} fill="#1f1536" />
      <path d="M 51.5 4.3 C 47 4.4 43 4.2 39.5 3.4" fill="none" stroke="#120a20" strokeWidth="0.5" strokeLinecap="round" />
      <circle cx="36" cy="-1.6" r="0.9" fill="#0c0616" />
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
          <rect className="aura-dolphin-splash" x="8" y="-1.6" width="28" height="3.4" rx="1.7" fill="#efe6ff" style={timing(i)} />
          <ellipse className="aura-dolphin-splash aura-dolphin-spray" cx="22" cy="-4" rx="7" ry="5" fill="#efe6ff" style={timing(i)} />
          <rect className="aura-dolphin-splash aura-dolphin-splash-in" x="66" y="-1.6" width="28" height="3.4" rx="1.7" fill="#efe6ff" style={timing(i)} />
          <ellipse className="aura-dolphin-splash aura-dolphin-splash-in aura-dolphin-spray" cx="80" cy="-4" rx="7" ry="5" fill="#efe6ff" style={timing(i)} />
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
// the horizon, early stars twinkling, waves forming out at sea and rolling
// in (some catching the afterglow), the odd dolphin leaping and now and
// then a sailboat passing on the horizon. `page` is the full version for the
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
          {/* Every so often a sailboat drifts slowly along the horizon,
              rocking gently, and passes behind the headland. */}
          <g className="aura-sailboat">
            <g transform={`translate(0 ${HORIZON + 1}) scale(0.75)`}>
              <g className="aura-sailboat-rock">
                <path d={SAILBOAT_SAILS} fill="#1d1230" />
                <path d={SAILBOAT_RIM} fill="none" stroke="#ffb48a" strokeOpacity="0.5" strokeWidth="0.8" strokeLinecap="round" />
                <line x1="-0.4" y1="-31" x2="-0.4" y2="-3" stroke="#140c22" strokeWidth="1" />
                <path d={SAILBOAT_HULL} fill="#140c22" />
              </g>
            </g>
          </g>
          <path d={HEADLAND} fill="#140c22" />
          <rect x="-100" y={HORIZON} width={WIDTH + 200} height={SHORE + 40} fill="url(#dusk-sea)" />
          <line x1="-100" y1={HORIZON} x2={WIDTH + 100} y2={HORIZON} stroke="#ffb48a" strokeOpacity="0.55" strokeWidth="1.5" />

          {WAVES.map((wave, i) => <Wave key={i} {...wave} />)}

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
