import seeded from './seeded';

// Shapes shared by the scenes. Everything here is plain geometry (path
// strings), worked out once when a scene module loads, never per frame.

// A natural ridgeline by midpoint displacement: each pass halves the gaps
// and nudges the new points up or down by less than the pass before, so
// big shapes carry small, rocky detail. `anchors` pin chosen peaks/valleys.
export function ridgePoints(seed, { x0 = -80, x1 = 1680, y = 300, amp = 120, rough = 0.52, passes = 7, anchors = [] }) {
  const rand = seeded(seed);
  let pts = [[x0, y + (rand() - 0.5) * amp * 0.6], ...anchors, [x1, y + (rand() - 0.5) * amp * 0.6]].sort((a, b) => a[0] - b[0]);
  let spread = amp;
  for (let p = 0; p < passes; p++) {
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      next.push(pts[i], [(ax + bx) / 2 + (rand() - 0.5) * (bx - ax) * 0.2, (ay + by) / 2 + (rand() - 0.5) * spread]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    spread *= rough;
  }
  return pts;
}

// A filled shape under a line of points, down to `bottom`
export function areaUnder(points, bottom) {
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `${line} L ${points[points.length - 1][0].toFixed(1)} ${bottom} L ${points[0][0].toFixed(1)} ${bottom} Z`;
}

// Just the line along the top (for rim light and edge highlights)
export const lineThrough = points => points.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

// A smooth curve through points (Catmull-Rom as cubic Béziers)
export function smoothThrough(points, close = null) {
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  if (close !== null) d += ` L ${points[points.length - 1][0].toFixed(1)} ${close} L ${points[0][0].toFixed(1)} ${close} Z`;
  return d;
}

// A spruce: a spire of drooping, ragged branch tiers that widen toward the
// base. Returns the whole silhouette and its lit left edge (the side the
// light comes from), plus where snow rests on the tier tops.
export function spruce(rand, x, base, h, { lean = 0 } = {}) {
  const tiers = 7 + Math.floor(rand() * 5);
  const top = base - h;
  const maxW = h * (0.2 + rand() * 0.07);
  const left = [];
  const snow = [];
  for (let t = 1; t <= tiers; t++) {
    const f = t / tiers;
    const y = top + h * (0.08 + f * 0.86);
    const w = maxW * Math.pow(f, 0.85) * (0.8 + rand() * 0.4);
    const droop = h * 0.025 * (0.6 + rand());
    const inner = w * (0.25 + rand() * 0.15);
    const lx = x + lean * (1 - f);
    left.push([lx - inner, y - h * 0.05], [lx - w, y + droop], [lx - w * 0.55, y + droop * 0.4]);
    snow.push(`M ${(lx - w * 0.92).toFixed(1)} ${(y + droop * 0.6).toFixed(1)} Q ${(lx - w * 0.5).toFixed(1)} ${(y - h * 0.035).toFixed(1)} ${(lx - inner * 0.6).toFixed(1)} ${(y - h * 0.045).toFixed(1)}`);
  }
  const right = left.map(([px, py]) => [2 * (x) - px + (rand() - 0.5) * 2, py + (rand() - 0.5) * 2]).reverse();
  const trunkW = Math.max(1.2, h * 0.025);
  const pts = [[x + lean, top], ...left, [x - trunkW, base - 2], [x - trunkW, base], [x + trunkW, base], [x + trunkW, base - 2], ...right];
  const d = 'M ' + pts.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L ') + ' Z';
  const lit = 'M ' + [[x + lean, top], ...left].map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L ');
  return { d, lit, snow: snow.join(' ') };
}

// A row of spruces between x0 and x1 (skipping `gaps`), smaller toward the back
export function spruceRow(seed, { x0 = -40, x1 = 1640, base, minH, maxH, step = [10, 18], gaps = [], baseJitter = 8 }) {
  const rand = seeded(seed);
  const bodies = [];
  const lits = [];
  const snows = [];
  for (let x = x0; x < x1; x += step[0] + rand() * step[1]) {
    if (gaps.some(([a, b]) => x > a && x < b)) continue;
    const h = minH + Math.pow(rand(), 1.4) * (maxH - minH);
    const t = spruce(rand, x, base + rand() * baseJitter, h, { lean: (rand() - 0.5) * h * 0.04 });
    bodies.push(t.d); lits.push(t.lit); snows.push(t.snow);
  }
  return { d: bodies.join(' '), lit: lits.join(' '), snow: snows.join(' ') };
}

// Scatter of points (stars, sparkles, plankton) from a seed
export function scatter(seed, count, fn) {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => fn(rand, i));
}
