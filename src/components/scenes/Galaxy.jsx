import React, { useEffect, useRef } from 'react';
import seeded from './seeded';

// A spiral galaxy far off in the night sky, seen at a tilt. It's painted once
// onto a canvas from thousands of tiny stars (so the page only has to turn a
// picture, not redraw it): a warm, glowing core, two lavender-to-blue arms
// dotted with pink star-forming clouds and young blue-white stars, dark dust
// lanes along the arms' inner edges, and a faint halo. The disk turns very
// slowly and the core breathes softly (index.css, .aura-galaxy).

const SIZE = 640;          // drawing resolution, square
const C = SIZE / 2;
let painted = null;        // shared by every mount, so it's only drawn once

function gauss(rand) {
  // Box-Muller: normally distributed, mean 0, sd 1
  return Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const INNER = [255, 214, 236];   // warm pink-white near the core
const OUTER = [158, 168, 255];   // blue-violet in the outer arms

// A point on arm `arm` (0 or 1) at `t` (0 at the core, 1 at the tip). The arms
// wind about one and a half turns.
function armPoint(arm, t) {
  const r = SIZE * (0.05 + 0.39 * t);
  const angle = arm * Math.PI + t * 3.1 * Math.PI;
  return { r, angle };
}

function blob(g, x, y, radius, [r, gr, b], alpha) {
  const grad = g.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(${r}, ${gr}, ${b}, ${alpha})`);
  grad.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
  g.fillStyle = grad;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function paint() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const rand = seeded(1729);
  g.globalCompositeOperation = 'lighter';

  // Faint halo around the whole disk
  const halo = g.createRadialGradient(C, C, 0, C, C, SIZE * 0.49);
  halo.addColorStop(0, 'rgba(170, 150, 255, 0.16)');
  halo.addColorStop(0.45, 'rgba(130, 100, 230, 0.06)');
  halo.addColorStop(1, 'rgba(110, 80, 220, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, SIZE, SIZE);

  // Soft glow along the arms
  for (let i = 0; i < 520; i++) {
    const arm = i % 2;
    const t = rand() ** 0.85;
    const { r, angle } = armPoint(arm, t);
    const spread = 6 + 26 * t;
    const x = C + Math.cos(angle) * r + gauss(rand) * spread;
    const y = C + Math.sin(angle) * r + gauss(rand) * spread;
    blob(g, x, y, 10 + rand() * 18, mix(INNER, OUTER, t), 0.03 + rand() * 0.03);
  }

  // Stars scattered through the disk between the arms
  for (let i = 0; i < 1600; i++) {
    const r = SIZE * 0.42 * Math.min(1, -Math.log(1 - rand() * 0.98) / 3.2);
    const angle = rand() * Math.PI * 2;
    const [cr, cg, cb] = mix(INNER, OUTER, r / (SIZE * 0.42));
    g.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.12 + rand() * 0.28})`;
    g.fillRect(C + Math.cos(angle) * r, C + Math.sin(angle) * r, 1, 1);
  }

  // Stars along the arms, with pink star-forming clouds and young blue-white stars
  for (let i = 0; i < 4400; i++) {
    const arm = i % 2;
    const t = rand() ** 0.7;
    const { r, angle } = armPoint(arm, t);
    const spread = 3 + 17 * t;
    const x = C + Math.cos(angle) * r + gauss(rand) * spread;
    const y = C + Math.sin(angle) * r + gauss(rand) * spread;
    const roll = rand();
    if (roll < 0.035 * t) {
      blob(g, x, y, 3 + rand() * 4, [255, 128, 196], 0.35);
    } else if (roll < 0.035 * t + 0.03) {
      g.fillStyle = 'rgba(205, 220, 255, 0.95)';
      g.beginPath(); g.arc(x, y, 1.2 + rand() * 0.8, 0, Math.PI * 2); g.fill();
    } else {
      const [cr, cg, cb] = mix(INNER, OUTER, t);
      g.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.3 + rand() * 0.6})`;
      const s = rand() < 0.9 ? 1 : 1.6;
      g.fillRect(x, y, s, s);
    }
  }

  // Dark dust lanes just inside each arm
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 700; i++) {
    const arm = i % 2;
    const t = 0.06 + rand() * 0.66;
    const { r, angle } = armPoint(arm, t);
    const inner = r - (5 + 12 * t) + gauss(rand) * 3;
    const a = angle + gauss(rand) * 0.03;
    blob(g, C + Math.cos(a) * inner, C + Math.sin(a) * inner, 4 + rand() * 6, [0, 0, 0], 0.16 + rand() * 0.14);
  }

  // The core: a bright center fading through warm cream and rose
  g.globalCompositeOperation = 'lighter';
  const core = g.createRadialGradient(C, C, 0, C, C, SIZE * 0.14);
  core.addColorStop(0, 'rgba(255, 252, 244, 1)');
  core.addColorStop(0.18, 'rgba(255, 232, 210, 0.75)');
  core.addColorStop(0.5, 'rgba(244, 186, 228, 0.28)');
  core.addColorStop(1, 'rgba(200, 160, 255, 0)');
  g.fillStyle = core;
  g.fillRect(0, 0, SIZE, SIZE);

  return canvas;
}

// `width` in pixels; the galaxy's box is about half as tall as it is wide.
export default function Galaxy({ className = '', style }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!g) return;
    painted ??= paint();
    g.clearRect(0, 0, SIZE, SIZE);
    g.drawImage(painted, 0, 0);
  }, []);

  return (
    <div className={`aura-galaxy ${className}`} style={style} aria-hidden="true">
      <div className="aura-galaxy-tilt">
        <canvas ref={ref} width={SIZE} height={SIZE} className="aura-galaxy-disk" />
        <span className="aura-galaxy-core" />
      </div>
    </div>
  );
}
