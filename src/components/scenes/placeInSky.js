// Finds room in the sky for constellations and the galaxy, keeping clear of
// the page's content (headings, text, buttons, cards) and of each other.
//
// Items are placed in order. One with a `prefer` point goes to the free spot
// nearest it (the halo constellation top right, for example). The rest go
// wherever is farthest from everything placed so far, which spreads them
// evenly over whatever empty sky the page has. Items that don't fit anywhere
// are left out.
//
// `gap` is the clearance from content (an item can set its own `gap`), and
// `spacing` the larger clearance between two placed items, so they don't
// bunch up. All boxes are { x, y, w, h } in pixels, relative to the sky.

function overlaps(a, b, gap) {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap
      && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

export default function placeInSky({ width, height, obstacles, items, gap = 28, spacing = 56, edge = 12, step = 20 }) {
  const placed = [];

  for (const item of items) {
    const { w, h } = item;
    let best = null;
    for (let y = edge; y + h <= height - edge; y += step) {
      for (let x = edge; x + w <= width - edge; x += step) {
        const box = { x, y, w, h };
        if (obstacles.some(o => overlaps(box, o, item.gap ?? gap))) continue;
        if (placed.some(p => overlaps(box, p, spacing))) continue;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const score = item.prefer
          ? -Math.hypot(cx - item.prefer.x, cy - item.prefer.y)
          : placed.reduce((min, p) => Math.min(min, Math.hypot(cx - p.cx, cy - p.cy)), Infinity);
        if (!best || score > best.score) best = { x, y, cx, cy, score };
      }
    }
    if (best) {
      placed.push({ id: item.id, x: best.x, y: best.y, w, h, cx: best.cx, cy: best.cy });
    }
  }

  return placed.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
}
