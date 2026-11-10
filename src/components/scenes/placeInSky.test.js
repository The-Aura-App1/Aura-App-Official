import placeInSky from './placeInSky';

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('keeps items off content and off each other', () => {
  const obstacles = [{ x: 300, y: 100, w: 400, h: 500 }];
  const items = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, w: 120, h: 80 }));
  const placed = placeInSky({ width: 1000, height: 700, obstacles, items, gap: 20 });
  expect(placed.length).toBeGreaterThan(3);
  for (const p of placed) {
    expect(overlap(p, obstacles[0])).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y + p.h).toBeLessThanOrEqual(700);
    for (const q of placed) if (q !== p) expect(overlap(p, q)).toBe(false);
  }
});

test('puts preferred items near their point', () => {
  const [p] = placeInSky({ width: 1000, height: 600, obstacles: [], items: [{ id: 'a', w: 100, h: 60, prefer: { x: 850, y: 100 } }] });
  expect(Math.abs(p.x + 50 - 850)).toBeLessThanOrEqual(20);
  expect(Math.abs(p.y + 30 - 100)).toBeLessThanOrEqual(20);
});

test('spreads unpreferred items apart', () => {
  const placed = placeInSky({ width: 1000, height: 600, obstacles: [], items: [{ id: 'a', w: 100, h: 60 }, { id: 'b', w: 100, h: 60 }] });
  const [a, b] = placed;
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(700);
});

test('leaves out items that do not fit', () => {
  const placed = placeInSky({ width: 300, height: 200, obstacles: [{ x: 0, y: 0, w: 300, h: 200 }], items: [{ id: 'a', w: 50, h: 50 }] });
  expect(placed).toEqual([]);
});

test('keeps placed items farther from each other than from content', () => {
  const placed = placeInSky({ width: 400, height: 100, obstacles: [], items: [{ id: 'a', w: 60, h: 40 }, { id: 'b', w: 60, h: 40 }], spacing: 300, step: 10 });
  expect(placed).toHaveLength(1);
});
