import React from 'react';
import seeded from './seeded';
import TwinklingStars from './TwinklingStars';
import { FloatingCloud } from './Clouds';
import { spruceRow, ridgePoints, areaUnder } from './terrain';
import './dreamscapes.css';

// Firefly Grove: a clearing deep in an old forest on a moonlit night. Rows
// of trunks recede into blue mist; moonbeams slant down through the gaps,
// dust drifting in them; a still pond holds the moon's reflection; ferns,
// reeds and a mossy log with glowing mushrooms fill the foreground, and
// fireflies blink at every depth (the nearest ones big and soft, out of focus).

const W = 1600;
const H = 640;
const POND_Y = 545;

// A tall trunk: tapered, slightly crooked, flaring into roots at the base,
// with a broken branch or two. Returns its outline and a lit edge on the
// moon's side (the right).
function trunk(rand, x, base, top, w) {
  const steps = 8;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = top + (base - top) * t;
    const half = w * (0.42 + t * 0.18) + (t > 0.85 ? (t - 0.85) * w * 4 : 0);
    const wob = Math.sin(t * 7 + x) * w * 0.12;
    left.push([x - half + wob, y]);
    right.push([x + half + wob, y]);
  }
  const outline = [...left, ...right.reverse()];
  let d = 'M ' + outline.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L ') + ' Z';
  // a broken branch reaching out
  if (rand() < 0.7) {
    const by = top + (base - top) * (0.25 + rand() * 0.3);
    const dir = rand() < 0.5 ? -1 : 1;
    const len = w * (1 + rand() * 1.3);
    d += ` M ${(x + dir * w * 0.3).toFixed(1)} ${by.toFixed(1)} L ${(x + dir * (w * 0.4 + len)).toFixed(1)} ${(by - len * 0.9).toFixed(1)} L ${(x + dir * (w * 0.4 + len * 0.9)).toFixed(1)} ${(by - len * 0.9 + 4).toFixed(1)} L ${(x + dir * w * 0.3).toFixed(1)} ${(by + w * 0.45).toFixed(1)} Z`;
  }
  const lit = 'M ' + right.slice().reverse().slice(0, steps).map(([a, b]) => `${(a - 1.5).toFixed(1)} ${b.toFixed(1)}`).join(' L ');
  return { d, lit };
}

function trunkRow(seed, { x0, x1, step, base, top, minW, maxW, gaps = [] }) {
  const rand = seeded(seed);
  const ds = [];
  const lits = [];
  for (let x = x0; x < x1; x += step[0] + rand() * step[1]) {
    if (gaps.some(([a, b]) => x > a && x < b)) continue;
    const t = trunk(rand, x, base + rand() * 10, top - rand() * 60, minW + rand() * (maxW - minW));
    ds.push(t.d); lits.push(t.lit);
  }
  return { d: ds.join(' '), lit: lits.join(' ') };
}

// A fern: an arching stem with leaflets that shrink toward the tip
function fern(rand, x, y, len, angle) {
  let d = '';
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = angle + t * 0.9 * Math.sign(angle || 1);
    const px = x + Math.sin(a) * len * t;
    const py = y - Math.cos(a) * len * t + t * t * len * 0.35;
    const leaf = len * 0.2 * (1 - t) + 2;
    for (const side of [-1, 1]) {
      const la = a + side * 1.1;
      const tx = px + Math.sin(la) * leaf;
      const ty = py - Math.cos(la) * leaf * 0.6 + leaf * 0.3;
      d += `M ${px.toFixed(1)} ${py.toFixed(1)} Q ${((px + tx) / 2 + side * 2).toFixed(1)} ${((py + ty) / 2 - 3).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} `;
    }
  }
  return d;
}

function fernClump(seed, x, y, size) {
  const rand = seeded(seed);
  let d = '';
  for (let i = 0; i < 6; i++) d += fern(rand, x + (rand() - 0.5) * size * 0.4, y, size * (0.6 + rand() * 0.5), (i / 5 - 0.5) * 2.2);
  return d;
}

// Reeds at the pond's edge, each a thin curve, some with a cattail
function reeds(seed, x0, x1, y) {
  const rand = seeded(seed);
  const stems = [];
  for (let x = x0; x < x1; x += 5 + rand() * 9) {
    const h = 40 + rand() * 70;
    const bend = (rand() - 0.5) * 18;
    stems.push({ d: `M ${x.toFixed(1)} ${y} Q ${(x + bend * 0.3).toFixed(1)} ${(y - h * 0.6).toFixed(1)} ${(x + bend).toFixed(1)} ${(y - h).toFixed(1)}`, tip: rand() < 0.35 ? [x + bend, y - h] : null, delay: -rand() * 6 });
  }
  return stems;
}

const FAR_FOREST = spruceRow(9, { base: 420, minH: 60, maxH: 130, step: [9, 12], baseJitter: 10 });
const MID_FOREST = spruceRow(14, { base: 470, minH: 120, maxH: 230, step: [26, 40], gaps: [[640, 960]], baseJitter: 10 });
const BACK_TRUNKS = trunkRow(21, { x0: -40, x1: 1660, step: [70, 90], base: 500, top: -900, minW: 9, maxW: 16, gaps: [[620, 980]] });
const MID_TRUNKS = trunkRow(33, { x0: -40, x1: 1660, step: [130, 140], base: 560, top: -900, minW: 20, maxW: 32, gaps: [[560, 1040]] });
const NEAR_TRUNKS = [
  trunk(seeded(41), 470, 680, -900, 64), trunk(seeded(42), 1130, 690, -900, 74),
  trunk(seeded(43), 90, 700, -900, 90), trunk(seeded(44), 1500, 700, -900, 96),
];
const GROUND = ridgePoints(51, { y: 560, amp: 30, rough: 0.5, passes: 6, anchors: [[400, 545], [1200, 548]] });
const FERNS = [fernClump(61, 330, 650, 120), fernClump(62, 1290, 655, 130), fernClump(63, 600, 640, 70), fernClump(64, 1020, 645, 80), fernClump(65, 40, 660, 140), fernClump(66, 1560, 660, 140)];
const REEDS = [...reeds(71, 560, 650, 560), ...reeds(72, 960, 1060, 560)];

// Fireflies at three depths: far (tiny, dim, slow), mid, and near (big,
// blurred, as if out of focus close to the eye)
function flies(seed, count, { top, bottom, size, wander, blur }) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    left: rand() * 100, top: top + rand() * (bottom - top), size: size[0] + rand() * (size[1] - size[0]),
    x1: (rand() - 0.5) * wander, y1: (rand() - 0.5) * wander * 0.6, x2: (rand() - 0.5) * wander, y2: (rand() - 0.5) * wander * 0.6,
    x3: (rand() - 0.5) * wander, y3: (rand() - 0.5) * wander * 0.6,
    dur: 16 + rand() * 18, blink: 2.4 + rand() * 4.5, delay: -rand() * 30, blur,
    color: rand() < 0.75 ? '#eaff8f' : '#ffd36b',
  }));
}
const FLIES = [
  ...flies(7, 22, { top: 45, bottom: 72, size: [1.6, 2.6], wander: 50, blur: 0 }),
  ...flies(8, 20, { top: 52, bottom: 88, size: [2.8, 4.4], wander: 110, blur: 0 }),
  ...flies(9, 6, { top: 30, bottom: 90, size: [10, 18], wander: 180, blur: 4 }),
];
const MOTES = Array.from({ length: 18 }, (_, i) => ({ left: 54 + ((i * 37) % 30), top: 10 + ((i * 53) % 55), delay: -i * 1.3, dur: 9 + (i % 5) * 2 }));
// Leaves hanging into the top corners: overlapping clusters, fringed with
// small leaves along their lower edges, plus a few hanging vines. (Until
// 2026-11-16 a noise filter roughened plain blobs, which stretched into
// scribbles across wide screens.)
const CANOPY = (() => {
  const rand = seeded(81);
  const blobs = [];
  for (const [x0, x1, depth] of [[-100, 520, 140], [1180, 1700, 140], [520, 1180, 6]]) {
    for (let x = x0; x < x1; x += 34 + rand() * 30) {
      const edge = Math.min(x - x0, x1 - x) / (x1 - x0);
      blobs.push([x, rand() * depth * (0.4 + edge), 30 + rand() * 46]);
    }
  }
  return blobs;
})();
// Small pointed leaves round the lower half of each cluster: [x, y, length, angle]
const leafPath = (x, y, l) => `M ${x} ${y} Q ${x + l * 0.38} ${y + l * 0.45} ${x} ${y + l} Q ${x - l * 0.38} ${y + l * 0.45} ${x} ${y} Z`;
const CANOPY_LEAVES = (() => {
  const rand = seeded(23);
  const leaves = [];
  for (const [x, y, r] of CANOPY) {
    const n = 7 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.05 + 0.9 * rand());           // the lower half
      // based just inside the edge, pointing outwards, tilted at random
      leaves.push([x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88, 10 + rand() * 12, (a * 180) / Math.PI - 90 + (rand() - 0.5) * 70]);
    }
  }
  return leaves;
})();
const VINES = (() => {
  const rand = seeded(5);
  return [[150, 120], [330, 90], [1290, 110], [1460, 140], [880, 30]].map(([x, len]) => {
    const sway = (rand() - 0.5) * 30;
    return { x, len: len + rand() * 60, sway, leaves: Array.from({ length: 5 }, (_, i) => [(i + 1) / 6, rand() < 0.5 ? -1 : 1]) };
  });
})();

const MUSHROOMS = [[690, 0.9, '#6ff5e6', 0], [712, 1.2, '#8cfbff', 1.2], [736, 0.75, '#6ff5e6', 2.1], [760, 1, '#b8a6ff', 0.6], [790, 0.7, '#8cfbff', 1.8]];

export default function FireflyGrove({ variant = 'page' }) {
  const page = variant === 'page';
  return (
    <>
      <div className="aura-ff-sky absolute inset-0" />
      <div className="absolute inset-0 aura-ff-stars"><TwinklingStars seed={61} count={34} /></div>
      <div className="aura-ff-moon absolute" aria-hidden="true" />
      <FloatingCloud seed={5} idPrefix="ff-cloud" top="#8aa3b5" bottom="#203547" className="aura-ff-cloud w-80 top-[18vh] left-[4%]" style={{ animationDuration: '70s' }} />

      {/* Moonbeams and the dust drifting in them */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {[0, 1, 2, 3].map(i => <div key={i} className={`aura-ff-beam aura-ff-beam-${i}`} />)}
        {MOTES.map((m, i) => (
          <span key={i} className="aura-ff-mote" style={{ left: `${m.left}%`, top: `${m.top}%`, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }} />
        ))}
      </div>

      {/* The canopy overhead */}
      <svg className="absolute inset-x-0 top-0 w-full h-[34vh] overflow-visible" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        {/* the far layer: lit faintly by the moon, a little lower and wider */}
        <g fill="#0e2a2b" opacity="0.85">
          <rect x="-200" y="-200" width="2000" height="190" />
          {CANOPY.map(([x, y, r], i) => <circle key={i} cx={x + 14} cy={y + 16} r={r * 1.08} />)}
          {CANOPY_LEAVES.filter((_, i) => i % 2 === 0).map(([x, y, l, a], i) => (
            <path key={`f${i}`} d={leafPath(x + 14, y + 20, l * 1.1)} transform={`rotate(${a + 15} ${x + 14} ${y + 20})`} />
          ))}
        </g>
        {/* the near layer, with leaves fringing its edge */}
        <g fill="#04100f">
          <rect x="-200" y="-200" width="2000" height="196" />
          {CANOPY.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
          {CANOPY_LEAVES.map(([x, y, l, a], i) => (
            <path key={`l${i}`} d={leafPath(x, y, l)} transform={`rotate(${a} ${x} ${y})`} />
          ))}
        </g>
        {/* hanging vines, swaying a little */}
        <g className="aura-ff-vines" stroke="#06140f" strokeWidth="2.2" fill="none">
          {VINES.map((v, i) => (
            <g key={i}>
              <path d={`M ${v.x} 0 Q ${v.x + v.sway} ${v.len * 0.55} ${v.x + v.sway * 0.4} ${v.len}`} />
              {v.leaves.map(([f, side], k) => {
                const lx = v.x + v.sway * 0.9 * f * (1 - f) * 2 + side * 5, ly = v.len * f;
                return <ellipse key={k} cx={lx} cy={ly} rx="3.4" ry="7" transform={`rotate(${side * 40} ${lx} ${ly})`} fill="#06140f" stroke="none" />;
              })}
            </g>
          ))}
        </g>
        {/* moonlight catching the tops of a few leaves on the moon's side */}
        <g fill="#cfeee4" opacity="0.07">
          {CANOPY_LEAVES.filter(([x], i) => x > 1000 && i % 4 === 0).map(([x, y, l, a], i) => (
            <path key={i} d={leafPath(x, y, l * 0.8)} transform={`rotate(${a} ${x} ${y})`} />
          ))}
        </g>
      </svg>

      <div className={`absolute inset-x-0 bottom-0 ${page ? 'h-[72vh] min-h-[360px]' : 'h-[60vh] min-h-[300px]'}`}>
        {/* Far forest and the back rows of trunks, fading into mist. The
            trunks run up past the top of this layer to the top of the screen. */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="ff-mist" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7fb6b8" stopOpacity="0" />
              <stop offset="60%" stopColor="#7fb6b8" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#7fb6b8" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="ff-trunk-back" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#163236" />
              <stop offset="100%" stopColor="#2a5054" />
            </linearGradient>
            <linearGradient id="ff-trunk-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1d21" />
              <stop offset="100%" stopColor="#1a3638" />
            </linearGradient>
            <filter id="ff-bark" x="-10%" y="-5%" width="120%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.05 0.008" numOctaves="2" seed="4" />
              <feDisplacementMap in="SourceGraphic" scale="4" />
            </filter>
          </defs>
          <path d={FAR_FOREST.d} fill="#2b5559" opacity="0.8" />
          <rect x="-80" y="300" width={W + 160} height="200" fill="url(#ff-mist)" />
          <path d={MID_FOREST.d} fill="#1d3f43" opacity="0.9" />
          <path d={BACK_TRUNKS.d} fill="url(#ff-trunk-back)" filter="url(#ff-bark)" />
          <path d={BACK_TRUNKS.lit} fill="none" stroke="#a9d8d0" strokeOpacity="0.18" strokeWidth="1.5" />
          <rect x="-80" y="380" width={W + 160} height="180" fill="url(#ff-mist)" />
          <path d={MID_TRUNKS.d} fill="url(#ff-trunk-mid)" filter="url(#ff-bark)" />
          <path d={MID_TRUNKS.lit} fill="none" stroke="#bfe6dc" strokeOpacity="0.22" strokeWidth="2" />
        </svg>

        {/* The clearing: ground, pond, log, reeds, near trunks and ferns */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="ff-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#163430" />
              <stop offset="100%" stopColor="#050f0e" />
            </linearGradient>
            <radialGradient id="ff-pond" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#2f5a6a" />
              <stop offset="70%" stopColor="#0c2230" />
              <stop offset="100%" stopColor="#071520" />
            </radialGradient>
            <linearGradient id="ff-moonpath" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f6f1d6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#f6f1d6" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ff-shroom">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="30%" stopColor="#8cfbff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#8cfbff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ff-near" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#020707" />
              <stop offset="70%" stopColor="#06110f" />
              <stop offset="100%" stopColor="#0e2321" />
            </linearGradient>
            <filter id="ff-moss" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="9" />
              <feDisplacementMap in="SourceGraphic" scale="9" />
            </filter>
          </defs>
          <path d={areaUnder(GROUND, H + 20)} fill="url(#ff-ground)" filter="url(#ff-moss)" />
          {/* the pond, with the moon's light lying across it */}
          <ellipse cx="805" cy={POND_Y + 12} rx="210" ry="34" fill="url(#ff-pond)" />
          <ellipse cx="805" cy={POND_Y + 12} rx="210" ry="34" fill="none" stroke="#9fd2c8" strokeOpacity="0.18" strokeWidth="2" />
          <g className="aura-ff-glimmer">
            <rect x="868" y={POND_Y - 12} width="16" height="56" rx="8" fill="url(#ff-moonpath)" opacity="0.6" />
            {[0, 1, 2, 3].map(i => <rect key={i} x={862 - i * 3} y={POND_Y - 4 + i * 11} width={28 + i * 6} height="2" rx="1" fill="#fbf6dc" opacity={0.55 - i * 0.1} />)}
          </g>
          {[[740, POND_Y + 22, 14], [770, POND_Y + 30, 10], [930, POND_Y + 26, 12]].map(([x, y, r], i) => (
            <path key={i} d={`M ${x - r} ${y} A ${r} ${r * 0.35} 0 1 0 ${x + r} ${y} L ${x} ${y - 1} Z`} fill="#1f4a3a" />
          ))}
          {/* a fallen, mossy log with glowing mushrooms */}
          <path d="M 640 600 C 660 585 760 582 850 590 C 860 598 858 610 846 614 C 760 608 690 612 642 616 C 632 612 632 604 640 600 Z" fill="#0b1a17" filter="url(#ff-moss)" />
          {MUSHROOMS.map(([x, s, hue, d], i) => (
            <g key={i} transform={`translate(${x} 592) scale(${s})`}>
              <circle className="aura-ff-shroom-glow" r="22" cy="-10" fill="url(#ff-shroom)" style={{ animationDelay: `${d}s` }} />
              <rect x="-1.6" y="-9" width="3.2" height="10" rx="1.6" fill="#dff7f2" opacity="0.85" />
              <path className="aura-ff-shroom" d="M -9 -8 C -8 -17 8 -17 9 -8 Z" fill={hue} style={{ animationDelay: `${d}s` }} />
            </g>
          ))}
          {REEDS.map((r, i) => (
            <g key={i} className="aura-ff-reed" style={{ animationDelay: `${r.delay}s`, transformOrigin: `${r.d.split(' ')[1]}px 560px` }}>
              <path d={r.d} stroke="#081613" strokeWidth="2" fill="none" />
              {r.tip && <rect x={r.tip[0] - 2.5} y={r.tip[1] - 2} width="5" height="16" rx="2.5" fill="#1a1410" />}
            </g>
          ))}
          {NEAR_TRUNKS.map((t, i) => (
            <g key={i}>
              <path d={t.d} fill="url(#ff-near)" filter="url(#ff-moss)" />
              <path d={t.lit} fill="none" stroke="#b9e3d8" strokeOpacity="0.16" strokeWidth="3" />
            </g>
          ))}
          <path d={FERNS.join(' ')} stroke="#0a1a16" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d={FERNS.join(' ')} stroke="#2b5a47" strokeOpacity="0.35" strokeWidth="1" fill="none" strokeLinecap="round" transform="translate(0.8 -0.8)" />
        </svg>

        {/* Mist drifting low through the clearing */}
        {[0, 1, 2].map(i => <div key={i} className={`aura-ff-fog aura-ff-fog-${i}`} aria-hidden="true" />)}
      </div>

      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {FLIES.map((f, i) => (
          <span key={i} className="aura-ff-fly-path absolute"
            style={{
              left: `${f.left}%`, top: `${f.top}%`,
              '--x1': `${f.x1}px`, '--y1': `${f.y1}px`, '--x2': `${f.x2}px`, '--y2': `${f.y2}px`, '--x3': `${f.x3}px`, '--y3': `${f.y3}px`,
              animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`,
            }}>
            <span className="aura-ff-fly block rounded-full"
              style={{ width: f.size, height: f.size, background: f.color, color: f.color, filter: f.blur ? `blur(${f.blur}px)` : undefined,
                animationDuration: `${f.blink}s`, animationDelay: `${f.delay / 3}s` }} />
          </span>
        ))}
      </div>
    </>
  );
}
