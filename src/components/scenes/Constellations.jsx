import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Galaxy from './Galaxy';
import placeInSky from './placeInSky';

// The night sky's constellations and the distant galaxy.
//
// On the public pages (welcome, sign in, about...) they're placed by
// measuring where the page's content actually is and spreading them through
// the empty sky around it (placeInSky.js), so they never sit on text or cards
// on any page or screen size, and they stay above the cloud bank. Behind the
// signed-in app they have fixed spots in the margins beside the feed.

// AuthBackdrop shares its content layer through this, so the sky can see
// what to keep clear of.
export const SkyContentContext = createContext(null);

const star = (x, y, r, color) => ({ x, y, r, color });

// Stars on a tilted ellipse, like the halo logo (tilted about 12 degrees and
// squashed to half its width). Each star is nudged off the ellipse a little so
// it reads as a constellation rather than a drawn ring.
const HALO_STARS = [
  { angle: 0,   nudge: 2,  r: 2.6 },
  { angle: 38,  nudge: -3, r: 1.8 },
  { angle: 80,  nudge: 3,  r: 2.2 },
  { angle: 122, nudge: -2, r: 1.6 },
  { angle: 160, nudge: 4,  r: 2.8 },
  { angle: 200, nudge: -3, r: 1.7 },
  { angle: 243, nudge: 2,  r: 2.3 },
  { angle: 285, nudge: -4, r: 1.6 },
  { angle: 322, nudge: 3,  r: 2.0 },
].map(({ angle, nudge, r }) => {
  const a = (angle * Math.PI) / 180;
  const tilt = (-12 * Math.PI) / 180;
  const x = (88 + nudge) * Math.cos(a);
  const y = (36 + nudge / 2) * Math.sin(a);
  return star(110 + x * Math.cos(tilt) - y * Math.sin(tilt), 62 + x * Math.sin(tilt) + y * Math.cos(tilt), r);
});

// Each one's shape follows the real constellation, and star sizes follow how
// bright each star really is. `lines` lists the stars each line passes
// through, in order. `width` is its size on a 1440px-wide screen. Smaller
// drawings get a bigger `labelSize` so every name ends up about the same size
// on screen.
const CONSTELLATIONS = {
  aura: {
    name: 'Aura', viewBox: [220, 140], label: [110, 128], width: 260,
    stars: HALO_STARS,
    lines: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 0]],
  },
  // Alkaid, Mizar, Alioth, Megrez, then the bowl: Phecda, Merak, Dubhe.
  bigDipper: {
    name: 'Big Dipper', viewBox: [220, 140], label: [110, 128], width: 230,
    stars: [star(18, 38, 2.2), star(52, 26, 2.3), star(86, 34, 2.4), star(116, 50, 1.6),
      star(124, 88, 2.0), star(178, 94, 2.2), star(184, 52, 2.6)],
    lines: [[0, 1, 2, 3, 4, 5, 6, 3]],
  },
  // Polaris at the tip of the handle, then Yildun, Epsilon, Zeta and the
  // bowl: Eta, Pherkad, Kochab.
  littleDipper: {
    name: 'Little Dipper', viewBox: [160, 132], label: [80, 126], labelSize: 18, width: 128,
    stars: [star(16, 18, 2.8), star(42, 30, 1.5), star(66, 44, 1.6), star(86, 62, 1.7),
      star(92, 94, 1.5), star(136, 100, 2.0), star(130, 66, 2.6)],
    lines: [[0, 1, 2, 3, 4, 5, 6, 3]],
  },
  // The W.
  cassiopeia: {
    name: 'Cassiopeia', viewBox: [200, 120], label: [100, 114], labelSize: 17, width: 160,
    stars: [star(16, 42, 2.2), star(56, 80, 2.4), star(98, 48, 2.6), star(140, 84, 2.0), star(184, 34, 2.2)],
    lines: [[0, 1, 2, 3, 4]],
  },
  // Meissa (the head), Betelgeuse and Bellatrix (shoulders), the belt
  // (Alnitak, Alnilam, Mintaka), Saiph and Rigel (knees). Betelgeuse is red.
  orion: {
    name: 'Orion', viewBox: [160, 212], label: [80, 206], labelSize: 20, width: 118,
    stars: [star(80, 14, 1.6), star(38, 42, 2.8, '#ffd6c4'), star(118, 50, 2.2), star(66, 108, 2.1),
      star(80, 102, 2.2), star(94, 96, 2.0), star(50, 168, 2.0), star(126, 162, 2.8, '#e0e7ff')],
    lines: [[1, 0, 2], [1, 3, 4, 5, 2], [3, 6], [5, 7]],
  },
  // The Northern Cross: Deneb at the top, Sadr in the middle, Albireo at the
  // foot, and the wings (Delta, Gienah).
  cygnus: {
    name: 'Cygnus', viewBox: [180, 196], label: [90, 190], labelSize: 18, width: 128,
    stars: [star(100, 18, 2.8), star(88, 78, 2.2), star(80, 122, 1.5), star(72, 166, 2.0, '#ffe2b8'),
      star(34, 58, 1.8), star(146, 104, 2.0)],
    lines: [[0, 1, 2, 3], [4, 1, 5]],
  },
  // Vega and the small parallelogram (Zeta, Delta, Gamma, Beta).
  lyra: {
    name: 'Lyra', viewBox: [110, 132], label: [55, 126], labelSize: 22, width: 84,
    stars: [star(28, 16, 3.0, '#e0e7ff'), star(52, 12, 1.3), star(56, 42, 1.6), star(30, 56, 1.8),
      star(42, 100, 1.9), star(70, 88, 1.5)],
    lines: [[1, 0, 2], [2, 5, 4, 3, 2]],
  },
  // The Sickle (Regulus up to Epsilon) and the body to Denebola.
  leo: {
    name: 'Leo', viewBox: [240, 140], label: [120, 134], labelSize: 15, width: 190,
    stars: [star(60, 110, 2.8), star(62, 80, 1.6), star(72, 52, 2.4), star(58, 30, 1.5),
      star(36, 22, 1.4), star(24, 40, 1.8), star(160, 58, 2.0), star(170, 98, 1.8), star(222, 84, 2.4)],
    lines: [[5, 4, 3, 2, 1, 0], [2, 6, 8, 7, 0]],
  },
  // The claws (Acrab, Dschubba, Pi), red Antares at the heart, and the tail
  // curling round to Shaula and Lesath, the sting.
  scorpius: {
    name: 'Scorpius', viewBox: [200, 210], label: [96, 205], labelSize: 18, width: 140,
    stars: [star(30, 22, 1.9), star(34, 46, 2.1), star(32, 70, 1.6), star(70, 70, 3.0, '#ffc2a8'),
      star(84, 88, 1.5), star(98, 116, 1.9), star(104, 140, 1.7), star(110, 162, 1.7), star(132, 178, 1.6),
      star(160, 180, 1.9), star(178, 166, 1.6), star(176, 148, 1.7), star(158, 138, 2.4), star(146, 128, 1.6)],
    lines: [[0, 1, 2], [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]],
  },
  // The twins: Castor and Pollux at the heads, their bodies running down.
  gemini: {
    name: 'Gemini', viewBox: [160, 172], label: [80, 166], labelSize: 18, width: 118,
    stars: [star(40, 16, 2.5), star(84, 26, 2.8, '#ffe8c8'), star(36, 60, 1.5), star(32, 100, 1.6),
      star(24, 140, 1.8), star(88, 70, 1.6), star(96, 110, 1.9), star(108, 148, 1.7)],
    lines: [[0, 2, 3, 4], [1, 5, 6, 7], [0, 1]],
  },
  // The Great Square (Alpheratz, Scheat, Markab, Algenib) and the neck to Enif.
  pegasus: {
    name: 'Pegasus', viewBox: [220, 160], label: [110, 154], labelSize: 15, width: 170,
    stars: [star(150, 30, 2.4), star(60, 24, 2.2), star(54, 104, 2.3), star(146, 110, 2.0),
      star(30, 124, 1.6), star(8, 138, 2.2, '#ffe2c8')],
    lines: [[0, 1, 2, 3, 0], [2, 4, 5]],
  },
  // The Seven Sisters: a tiny, tight cluster.
  pleiades: {
    name: 'Pleiades', viewBox: [90, 82], label: [45, 76], labelSize: 16, width: 78,
    stars: [star(20, 20, 1.9, '#dbe4ff'), star(36, 14, 1.6, '#dbe4ff'), star(48, 28, 2.2, '#dbe4ff'),
      star(30, 38, 1.5, '#dbe4ff'), star(62, 36, 1.7, '#dbe4ff'), star(46, 50, 1.4, '#dbe4ff'), star(66, 52, 1.3, '#dbe4ff')],
    lines: [[1, 0, 3, 2, 1], [2, 4, 6, 5, 2]],
  },
};

// Faint dashed lines that draw in, glowing stars that each twinkle on their
// own rhythm, and the name in italics. `delay` staggers when each appears.
function Constellation({ id, className = '', style, delay = 0 }) {
  const { name, viewBox: [vw, vh], label, labelSize = 14, stars, lines } = CONSTELLATIONS[id];
  const path = lines
    .map(line => line.map((s, i) => `${i ? 'L' : 'M'}${stars[s].x.toFixed(1)} ${stars[s].y.toFixed(1)}`).join(' '))
    .join(' ');
  return (
    <svg className={`aura-constellation absolute ${className}`} style={style} viewBox={`0 0 ${vw} ${vh}`} aria-hidden="true">
      <path className="aura-constellation-line" d={path} fill="none" stroke="rgba(221, 214, 254, 0.35)"
        strokeWidth="0.8" strokeDasharray="3 3" style={{ animationDelay: `${0.8 + delay}s` }} />
      {stars.map((s, i) => (
        <g key={i} className="aura-constellation-star" style={{ animationDelay: `${(i * 0.7 + delay) % 4}s` }}>
          <circle cx={s.x} cy={s.y} r={s.r * 2.6} fill="rgba(196, 181, 253, 0.18)" />
          <circle cx={s.x} cy={s.y} r={s.r} fill={s.color ?? '#f5f3ff'} />
        </g>
      ))}
      <text x={label[0]} y={label[1]} textAnchor="middle" className="font-heading" fontSize={labelSize} fontStyle="italic" fill="rgba(221, 214, 254, 0.55)">
        {name}
      </text>
    </svg>
  );
}

// ── Public pages: placed around the content ──────────────────────────

// What counts as content to keep clear of. A card covers everything in it.
const CONTENT = 'h1, h2, h3, p, a, button, input, textarea, select, label, img, .aura-glass-card, .aura-preview';

// Placement order. The galaxy, halo and Big Dipper go near their spots; the
// rest spread out through whatever sky is left, and any that don't fit on a
// smaller screen are left out.
const SPREAD = ['cassiopeia', 'orion', 'cygnus', 'leo', 'scorpius', 'littleDipper', 'gemini', 'pegasus', 'lyra', 'pleiades'];

function measureContent(content, field) {
  const origin = field.getBoundingClientRect();
  const boxes = [];
  content.querySelectorAll(CONTENT).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    boxes.push({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
  });
  // Drop boxes inside another box (text inside a card), which saves work.
  // Of two identical boxes (a link around an image), keep the first.
  const contains = (b, a) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  return {
    width: origin.width,
    height: origin.height,
    obstacles: boxes.filter((a, i) => !boxes.some((b, j) => j !== i && contains(b, a) && (!contains(a, b) || j < i))),
  };
}

function layoutSky({ width, height, obstacles }) {
  const scale = Math.min(1.15, Math.max(0.8, width / 1440));
  const firstScreen = Math.min(window.innerHeight, height);
  const wide = width >= 900;
  const size = id => {
    const c = CONSTELLATIONS[id];
    const w = Math.round(c.width * scale);
    return { w, h: Math.round((w * c.viewBox[1]) / c.viewBox[0]) };
  };
  // On phones it's small enough to tuck in beside the halo or logo
  const galaxyW = Math.round(wide ? 300 * scale : Math.min(120, width * 0.25));
  const items = [
    { id: 'galaxy', w: galaxyW, h: Math.round(galaxyW * 0.52), gap: wide ? undefined : 10,
      prefer: wide ? { x: width * 0.14, y: firstScreen * 0.42 } : { x: width * 0.16, y: 140 } },
  ];
  if (wide) {
    items.push(
      { id: 'aura', ...size('aura'), prefer: { x: width * 0.86, y: 180 } },
      { id: 'bigDipper', ...size('bigDipper'), prefer: { x: width * 0.14, y: 170 } },
      ...SPREAD.map(id => ({ id, ...size(id) })),
    );
  }
  return placeInSky({ width, height, obstacles, items });
}

// The sky above the cloud bank, with the galaxy and constellations placed in
// whatever room the page's content leaves.
export function SkyField() {
  const contentRef = useContext(SkyContentContext);
  const fieldRef = useRef(null);
  const [placed, setPlaced] = useState([]);

  useEffect(() => {
    const field = fieldRef.current;
    const content = contentRef?.current;
    if (!field || !content) return undefined;
    let timer;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Hidden (the day sky): nothing to place
        if (!field.offsetWidth) return;
        setPlaced(layoutSky(measureContent(content, field)));
      }, 120);
    };
    update();
    // Again once the fonts and entrance animations have settled
    const settled = setTimeout(update, 1600);
    document.fonts?.ready.then(update);
    const observer = new ResizeObserver(update);
    observer.observe(content);
    observer.observe(field);
    return () => { clearTimeout(timer); clearTimeout(settled); observer.disconnect(); };
  }, [contentRef]);

  return (
    <div ref={fieldRef} className="aura-night-only aura-sky-field absolute inset-x-0 top-0">
      {placed.map(({ id, x, y, w }, i) => {
        const style = { left: x, top: y, width: w };
        return id === 'galaxy'
          ? <Galaxy key={id} style={style} />
          : <Constellation key={id} id={id} style={style} delay={i * 0.35} />;
      })}
    </div>
  );
}

// ── Behind the signed-in app: fixed spots beside the feed ────────────

export function AppSkyConstellations() {
  return (
    <div className="aura-night-only absolute inset-0">
      <Constellation id="aura" className="top-[96px] right-[3%] w-52" />
      <Constellation id="bigDipper" className="top-[9%] left-[3%] w-48" delay={0.4} />
      <Galaxy className="aura-app-galaxy top-[34%] right-[2%] w-56" />
      <Constellation id="lyra" className="top-[33%] left-[9%] w-16" delay={0.8} />
      <Constellation id="orion" className="top-[47%] left-[3%] w-24" delay={1.2} />
      <Constellation id="cassiopeia" className="top-[55%] right-[5%] w-36" delay={1.6} />
    </div>
  );
}
