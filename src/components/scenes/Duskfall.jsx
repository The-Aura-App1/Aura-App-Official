import React from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';

const WIDTH = 1600;
// The SVG starts a little above the horizon so the headland can rise above it.
const TOP = -70;
const HORIZON = 0;
const SHORE = 290;
const BOTTOM = 520;

// A gently wavy line across the full width. Lines made with the same `step`
// have the same points, so the browser can morph smoothly between them.
function wavyLine(y, { amp = 6, seed = 1, step = 40 } = {}) {
  const rand = seeded(seed);
  const phase = rand() * 6;
  const pts = [];
  for (let x = -100; x <= WIDTH + 100; x += step) {
    pts.push([x, y + amp * Math.sin(x / 95 + phase) + amp * 0.6 * Math.sin(x / 37 + phase * 2)]);
  }
  return pts;
}

const toPath = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

// Several shapes of the same line, looping back to the first, for <animate>.
const morph = make => [0, 1, 2, 0].map(make).join(';');

// Rows of broken wave crests across the sea: small and close together near
// the horizon, bigger and further apart towards the shore. Each row
// undulates between three shapes while its crests travel along it.
const RIPPLES = (() => {
  const rand = seeded(70);
  return Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    const y = HORIZON + 10 + t ** 1.6 * (SHORE - 40);
    const amp = 1 + t * 5;
    const step = Math.round(36 + t * 34);
    const dashes = Array.from({ length: 6 }, () => Math.round((8 + rand() * 50) * (0.5 + t)));
    return {
      shapes: morph(k => toPath(wavyLine(y, { amp, seed: 100 + i * 5 + k, step }))),
      first: toPath(wavyLine(y, { amp, seed: 100 + i * 5, step })),
      width: 0.7 + t * 1.8,
      opacity: 0.3 + t * 0.4,
      dash: dashes.join(' '),
      dashTotal: dashes.reduce((a, b) => a + b, 0),
      morphDur: 5 + rand() * 4,
      travelDur: 9 + rand() * 8,
      flip: rand() < 0.5,
    };
  });
})();

// A sheet of water whose leading edge is the foam line. Above the edge it
// fades to nothing, so out at sea only the foam shows; on the sand the thin
// water tints it. The edge ripples as the wave moves.
function waveSheet(seed) {
  const edge = k => wavyLine(0, { amp: 7, seed: seed + k * 31 });
  const sheet = k => `M -100 -160 L ${WIDTH + 100} -160 ` +
    edge(k).slice().reverse().map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
  const lace = k => toPath(wavyLine(-9, { amp: 5, seed: seed + 7 + k * 31, step: 30 }));
  return {
    sheet: sheet(0), sheets: morph(sheet),
    foam: toPath(edge(0)), foams: morph(k => toPath(edge(k))),
    lace: lace(0), laces: morph(lace),
  };
}

const WAVES = [waveSheet(3), waveSheet(11), waveSheet(23)];

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

const HEADLAND = 'M 1080 0 C 1150 -6 1190 -26 1250 -30 C 1300 -36 1340 -52 1395 -54 C 1450 -56 1480 -40 1530 -36 C 1580 -32 1640 -28 1700 -26 L 1700 0 Z';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A dark beach just after sunset: a violet sky with the last orange glow on
// the horizon, early stars twinkling, the afterglow glinting on a rippling
// sea, and waves rolling in over the sand and slipping back out. `page` is
// the full version for the public pages; `app` sits lower behind the
// signed-in app.
export default function Duskfall({ variant = 'page' }) {
  const page = variant === 'page';
  // SVG <animate> ignores the CSS reduced-motion rules, so leave it out.
  const still = prefersReducedMotion();
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
            <linearGradient id="dusk-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2550" stopOpacity="0" />
              <stop offset="100%" stopColor="#3b3870" stopOpacity="0.7" />
            </linearGradient>
            {/* Crests catch the afterglow in the middle and fade to cool
                lavender towards the edges. */}
            <linearGradient id="dusk-crest" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={WIDTH} y2="0">
              <stop offset="0%" stopColor="#8f80d6" stopOpacity="0.45" />
              <stop offset="35%" stopColor="#d9b4e0" />
              <stop offset="50%" stopColor="#ffcfa8" />
              <stop offset="65%" stopColor="#d9b4e0" />
              <stop offset="100%" stopColor="#8f80d6" stopOpacity="0.45" />
            </linearGradient>
          </defs>

          <rect x="-100" y={HORIZON - 420} width={WIDTH + 200} height="420" fill="url(#dusk-glow-band)" />
          <ellipse cx={WIDTH / 2} cy={HORIZON} rx="520" ry="190" fill="url(#dusk-sun)" />
          <path d={HEADLAND} fill="#140c22" />
          <rect x="-100" y={HORIZON} width={WIDTH + 200} height={SHORE + 40} fill="url(#dusk-sea)" />
          <line x1="-100" y1={HORIZON} x2={WIDTH + 100} y2={HORIZON} stroke="#ffb48a" strokeOpacity="0.55" strokeWidth="1.5" />

          {RIPPLES.map((r, i) => (
            <path key={i} d={r.first} fill="none" stroke="url(#dusk-crest)" strokeOpacity={r.opacity}
              strokeWidth={r.width} strokeLinecap="round" strokeDasharray={r.dash}>
              {!still && (
                <>
                  <animate attributeName="d" values={r.shapes} dur={`${r.morphDur}s`} repeatCount="indefinite"
                    calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />
                  <animate attributeName="stroke-dashoffset" from="0" to={r.flip ? r.dashTotal : -r.dashTotal}
                    dur={`${r.travelDur}s`} repeatCount="indefinite" />
                </>
              )}
            </path>
          ))}

          {GLINTS.map((g, i) => (
            <rect key={i} className="aura-dusk-glint" x={g.x - g.w / 2} y={g.y} width={g.w} height="2.2" rx="1.1"
              fill="#ffc29e" style={{ animationDelay: `${g.delay}s`, animationDuration: `${g.dur}s` }} />
          ))}

          {/* The beach, with a darker damp band where the waves reach */}
          <path d={`M -100 ${SHORE} C 400 ${SHORE - 12} 1100 ${SHORE + 10} ${WIDTH + 100} ${SHORE - 6} L ${WIDTH + 100} ${BOTTOM} L -100 ${BOTTOM} Z`} fill="url(#dusk-sand)" />
          <path d={`M -100 ${SHORE} C 400 ${SHORE - 12} 1100 ${SHORE + 10} ${WIDTH + 100} ${SHORE - 6} L ${WIDTH + 100} ${SHORE + 70} C 1000 ${SHORE + 84} 500 ${SHORE + 60} -100 ${SHORE + 74} Z`}
            fill="#4b3a6a" opacity="0.35" />

          {WAVES.map((w, i) => (
            <g key={i} transform={`translate(0 ${SHORE})`}>
              <g className="aura-dusk-wave" style={{ animationDelay: `${-i * 4}s` }}>
                <path d={w.sheet} fill="url(#dusk-water)">
                  {!still && <animate attributeName="d" values={w.sheets} dur={`${4 + i}s`} repeatCount="indefinite" />}
                </path>
                <path d={w.foam} fill="none" stroke="#efe9ff" strokeOpacity="0.75" strokeWidth="3" strokeLinecap="round">
                  {!still && <animate attributeName="d" values={w.foams} dur={`${4 + i}s`} repeatCount="indefinite" />}
                </path>
                <path d={w.lace} fill="none" stroke="#efe9ff" strokeOpacity="0.35" strokeWidth="1.6" strokeDasharray="10 7 3 9">
                  {!still && (
                    <>
                      <animate attributeName="d" values={w.laces} dur={`${3 + i}s`} repeatCount="indefinite" />
                      <animate attributeName="stroke-dashoffset" from="0" to="-29" dur="2.5s" repeatCount="indefinite" />
                    </>
                  )}
                </path>
              </g>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
