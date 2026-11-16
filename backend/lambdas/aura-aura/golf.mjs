// Mini golf: random courses and ball physics. Pure functions, wrapped into
// GAMES.golf by gameRules.mjs. 2 to 4 players, 3, 5 or 9 holes.
//
// Every hole is new and random, built from tiles (8 across, 12 down, 125
// units each; the field is 1000 × 1500). A fairway winds from the tee to the
// cup without ever touching itself, so there is always a clear way through:
// walls run along every edge of the fairway, the path's own tiles may be
// sand, ice or a gentle slope (never water), and the bumpers and baffles put
// on straight stretches always leave a gap wider than the ball. Side pockets
// off the path add water, sand, slopes and bumpers. Slopes are gentler than
// the green's friction, so a ball can always come to rest on one.
//
// A move is { angle, power 0..1 }; the server runs the stroke like a pool
// shot and stores a recording (20 frames a second) for the app to play.
// Players take strokes in turn until everyone has holed out (or picked up
// after MAX_STROKES). Water costs a stroke and puts the ball back. The lowest
// total after the last hole wins; players who tie share the pot.

export const W = 1000;
export const H = 1500;
export const T = 125;
export const COLS = 8;
export const ROWS = 12;
export const BALL = 11;
export const CUP = 19;
export const MAX_STROKES = 8;
export const HOLE_COUNTS = [3, 5, 9];

const DT          = 1 / 400;
const FRAME_EVERY = 20;               // 20 frames a second
const MAX_STEPS   = 15 * 400;
const ROLL        = 300;              // friction on the green, units/s²
const DRAG        = 0.55;             // plus this share of the speed every second
const SAND        = 4.5;              // friction multipliers
const ICE         = 0.25;
const SLOPE       = 230;              // a slope's pull, always less than ROLL so balls can stop on it
const WALL_BOUNCE = 0.72;
const BUMPER_KICK = 1.05;
const MIN_SPEED   = 90;
const MAX_SPEED   = 2000;
const SINK_SPEED  = 950;              // faster than this, the ball rolls over the cup
const STOP        = 5;
export const speedFor = power => MIN_SPEED + (MAX_SPEED - MIN_SPEED) * power ** 1.4;

// Terrain: '.' off the course, 'g' green, 's' sand, 'i' ice, 'w' water, and
// slopes 'U' 'D' 'L' 'R' (the way a ball runs downhill, as seen on screen)
const SLOPES = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

// ─── Course ───────────────────────────────────────────────────

const key = (c, r) => r * COLS + c;
const inField = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// A fairway path from the bottom of the field up, in legs of 1 to 3 tiles,
// that never runs back down and never touches itself
function walkPath(rand, length) {
  const start = [1 + rand(COLS - 2), ROWS - 1];
  const path = [start];
  const used = new Set([key(...start)]);
  let dir = [0, -1];
  let fails = 0;
  while (path.length < length && fails < 40) {
    const [c, r] = path[path.length - 1];
    const turns = [[0, -1], [-1, 0], [1, 0]].filter(d => !(d[0] === -dir[0] && d[1] === -dir[1]));
    // mostly up, often across
    const d = rand(10) < 4 ? [0, -1] : turns[rand(turns.length)];
    const leg = [];
    let ok = true;
    for (let k = 1; k <= 1 + rand(3) && ok; k++) {
      const nc = c + d[0] * k, nr = r + d[1] * k;
      if (!inField(nc, nr) || used.has(key(nc, nr))) { ok = false; break; }
      // never touch an earlier part of the path (only the tile it came from)
      const from = k === 1 ? [c, r] : [c + d[0] * (k - 1), r + d[1] * (k - 1)];
      if (NEIGHBORS.some(([dc, dr]) => {
        const x = nc + dc, y = nr + dr;
        return used.has(key(x, y)) && !(x === from[0] && y === from[1]);
      })) { ok = false; break; }
      leg.push([nc, nr]);
      used.add(key(nc, nr));
    }
    if (!leg.length) { fails++; continue; }
    path.push(...leg);
    dir = d;
  }
  return path;
}

export function makeCourse(rand, holeNo) {
  const want = Math.min(20, 5 + rand(4) + holeNo);
  let path = [];
  for (let tries = 0; tries < 50 && path.length < Math.min(want, 6); tries++) path = walkPath(rand, want);
  const onPath = new Set(path.map(p => key(...p)));
  const tiles = Array(COLS * ROWS).fill('.');
  const bumpers = [];
  const walls = [];
  const center = ([c, r]) => [c * T + T / 2, r * T + T / 2];

  // The path: mostly green, with sand, ice and slopes along the way
  path.forEach(([c, r], i) => {
    const end = i === 0 || i === path.length - 1;
    const x = rand(100);
    tiles[key(c, r)] = end ? 'g' : x < 13 ? 's' : x < 22 ? 'i' : x < 38 ? 'UDLR'[rand(4)] : 'g';
  });
  // Side pockets off the path: water, sand, slopes, or green with a bumper
  for (let i = 1; i < path.length - 1; i++) {
    if (rand(100) >= 30) continue;
    const [c, r] = path[i];
    const spots = NEIGHBORS.map(([dc, dr]) => [c + dc, r + dr]).filter(([x, y]) => inField(x, y) && tiles[key(x, y)] === '.');
    if (!spots.length) continue;
    const [x, y] = spots[rand(spots.length)];
    const k = rand(100);
    tiles[key(x, y)] = k < 40 ? 'w' : k < 55 ? 's' : k < 65 ? 'UDLR'[rand(4)] : 'g';
    if (tiles[key(x, y)] === 'g') { const [cx, cy] = center([x, y]); bumpers.push([cx, cy, 20 + rand(11)]); }
  }
  // Bumpers and baffles on straight stretches, always leaving room to pass
  for (let i = 1; i < path.length - 2; i++) {
    const [a, b, n] = [path[i - 1], path[i], path[i + 1]];
    const d1 = [b[0] - a[0], b[1] - a[1]], d2 = [n[0] - b[0], n[1] - b[1]];
    if (d1[0] !== d2[0] || d1[1] !== d2[1]) continue;
    const [cx, cy] = center(b);
    const side = [-d1[1], d1[0]];            // across the fairway
    const roll = rand(100);
    if (roll < 28) {
      const off = (rand(31) - 15);
      const radius = 18 + rand(7);
      bumpers.push([cx + side[0] * off, cy + side[1] * off, radius]);
    } else if (roll < 48) {
      // a baffle: a short wall out from one side, across the line of play
      const s = rand(2) ? 1 : -1;
      const from = [cx + side[0] * s * T / 2, cy + side[1] * s * T / 2];
      const len = T * 0.42;
      walls.push([from[0], from[1], from[0] - side[0] * s * len, from[1] - side[1] * s * len]);
    }
  }
  // Walls along every edge of the fairway
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (tiles[key(c, r)] === '.') continue;
    const open = (x, y) => inField(x, y) && tiles[key(x, y)] !== '.';
    const x0 = c * T, y0 = r * T, x1 = x0 + T, y1 = y0 + T;
    if (!open(c, r - 1)) walls.push([x0, y0, x1, y0]);
    if (!open(c, r + 1)) walls.push([x0, y1, x1, y1]);
    if (!open(c - 1, r)) walls.push([x0, y0, x0, y1]);
    if (!open(c + 1, r)) walls.push([x1, y0, x1, y1]);
  }
  const tee = center(path[0]);
  const [ccx, ccy] = center(path[path.length - 1]);
  const cup = [ccx + rand(41) - 20, ccy + rand(41) - 20];
  const par = path.length <= 6 ? 2 : path.length <= 10 ? 3 : path.length <= 15 ? 4 : 5;
  return { tiles: tiles.join(''), walls, bumpers, tee, cup, par, path: path.map(p => key(...p)) };
}

// ─── Physics ──────────────────────────────────────────────────

const tileAt = (course, x, y) => {
  const c = Math.floor(x / T), r = Math.floor(y / T);
  return inField(c, r) ? course.tiles[key(c, r)] : '.';
};

// Runs one stroke from `from`. Returns where the ball stopped (or that it
// dropped, or found water), and the recording.
export function simulate(course, from, angle, power) {
  const p = [from[0], from[1]];
  const speed0 = speedFor(power);
  const v = [Math.cos(angle) * speed0, Math.sin(angle) * speed0];
  const frames = [Math.round(p[0]), Math.round(p[1])];
  let holed = false, water = false, bounces = 0;
  const [cx, cy] = course.cup;

  for (let step = 1; step <= MAX_STEPS; step++) {
    const terrain = tileAt(course, p[0], p[1]);
    if (terrain === 'w') { water = true; break; }
    const mult = terrain === 's' ? SAND : terrain === 'i' ? ICE : 1;
    const slope = SLOPES[terrain];
    let sp = Math.hypot(v[0], v[1]);
    const toCup = Math.hypot(p[0] - cx, p[1] - cy);
    // Resting: a slow ball stops unless the slope can pull it harder than friction holds it
    if (sp < STOP && (!slope || SLOPE <= ROLL * mult)) {
      if (toCup < CUP - 3) holed = true;
      break;
    }
    if (slope) { v[0] += slope[0] * SLOPE * DT; v[1] += slope[1] * SLOPE * DT; }
    // The cup's edge draws a slow ball in
    if (toCup < CUP + 6 && sp < 380 && toCup > 0.5) {
      v[0] += ((cx - p[0]) / toCup) * 600 * DT; v[1] += ((cy - p[1]) / toCup) * 600 * DT;
    }
    sp = Math.hypot(v[0], v[1]);
    if (sp > 0) {
      const next = Math.max(0, sp - (ROLL * mult + DRAG * sp) * DT);
      v[0] *= next / sp; v[1] *= next / sp;
    }
    p[0] += v[0] * DT; p[1] += v[1] * DT;
    // Walls and baffles: bounce off the nearest point of each segment
    for (const [x1, y1, x2, y2] of course.walls) {
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / len2)) : 0;
      const qx = x1 + dx * t, qy = y1 + dy * t;
      const ex = p[0] - qx, ey = p[1] - qy;
      const d = Math.hypot(ex, ey);
      if (d >= BALL || d === 0) continue;
      const nx = ex / d, ny = ey / d;
      const vn = v[0] * nx + v[1] * ny;
      if (vn < 0) { v[0] -= (1 + WALL_BOUNCE) * vn * nx; v[1] -= (1 + WALL_BOUNCE) * vn * ny; bounces++; }
      p[0] = qx + nx * BALL; p[1] = qy + ny * BALL;
    }
    // Bumpers kick the ball back out a little faster
    for (const [bx, by, br] of course.bumpers) {
      const ex = p[0] - bx, ey = p[1] - by;
      const d = Math.hypot(ex, ey);
      if (d >= br + BALL || d === 0) continue;
      const nx = ex / d, ny = ey / d;
      const vn = v[0] * nx + v[1] * ny;
      if (vn < 0) {
        v[0] -= (1 + BUMPER_KICK) * vn * nx; v[1] -= (1 + BUMPER_KICK) * vn * ny;
        const s = Math.hypot(v[0], v[1]);
        if (s > MAX_SPEED) { v[0] *= MAX_SPEED / s; v[1] *= MAX_SPEED / s; }
        bounces++;
      }
      p[0] = bx + nx * (br + BALL); p[1] = by + ny * (br + BALL);
    }
    // Into the cup, if it's slow enough to drop
    if (Math.hypot(p[0] - cx, p[1] - cy) < CUP - 3 && Math.hypot(v[0], v[1]) < SINK_SPEED) { holed = true; }
    if (step % FRAME_EVERY === 0) frames.push(Math.round(p[0]), Math.round(p[1]));
    if (holed) break;
  }
  if (holed) frames.push(Math.round(cx), Math.round(cy));
  else frames.push(Math.round(p[0]), Math.round(p[1]));
  return { end: holed ? null : [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100], holed, water, frames, bounces };
}

// ─── Rules ────────────────────────────────────────────────────

export function makeGolf({ fail, clone, log, finish, activeSeats, nextSeat, isIn, isSeat }) {
  const totals = s => s.scores.reduce((t, hole) => t.map((v, i) => v + (hole[i] ?? 0)), Array(s.n).fill(0));

  function startHole(s, rand, first) {
    s.course = makeCourse(rand, s.hole);
    s.balls = Array.from({ length: s.n }, (_, i) => (isIn(s, i) ? [...s.course.tee] : null));
    s.strokes = Array(s.n).fill(0);
    s.done = s.out.map(Boolean);
    s.turn = first;
    // s.shot stays: the stroke that finished the last hole still plays back
    log(s, null, `Hole ${s.hole + 1} of ${s.holes}. Par ${s.course.par}.`);
  }

  // The next player still on this hole, or the end of the hole
  function advance(s, from, rand) {
    const next = nextSeat(s, from, i => isIn(s, i) && !s.done[i]);
    if (next !== null) { s.turn = next; return s; }
    s.scores.push(s.strokes.map((n, i) => (isIn(s, i) ? n : null)));
    if (s.hole + 1 < s.holes) {
      // honours: the best score on the last hole goes first
      const last = s.scores[s.scores.length - 1];
      const active = activeSeats(s);
      const best = active.reduce((a, i) => (last[i] < last[a] ? i : a), active[0]);
      s.hole += 1;
      startHole(s, rand, best);
      return s;
    }
    const sum = totals(s);
    const active = activeSeats(s);
    const low = Math.min(...active.map(i => sum[i]));
    const leaders = active.filter(i => sum[i] === low);
    if (leaders.length === 1) { log(s, leaders[0], `won with ${low} strokes!`); finish(s, leaders[0]); }
    else if (leaders.length === s.n) { log(s, null, `Everyone finished on ${low}. It's a draw.`); finish(s, null); }
    else { log(s, null, `A tie on ${low} strokes. They share the pot.`); finish(s, null, leaders); }
    return s;
  }

  return {
    name: 'Mini Golf',
    options(raw) {
      const holes = raw?.holes ?? 5;
      if (!HOLE_COUNTS.includes(holes)) fail('Play 3, 5 or 9 holes.');
      return { holes };
    },
    init(rand, { holes }, n = 2) {
      const s = { n, holes, hole: 0, scores: [], out: Array(n).fill(false), shots: 0, shot: null, log: [] };
      startHole(s, rand, rand(n));
      return s;
    },
    apply(state, seat, move, rand) {
      const s = clone(state);
      const { angle, power } = move ?? {};
      if (typeof angle !== 'number' || !Number.isFinite(angle)) fail('Aim first.');
      if (typeof power !== 'number' || !(power > 0 && power <= 1)) fail('Pick a power above 0, up to 1.');
      const from = s.balls[seat];
      const stroke = simulate(s.course, from, angle, power);
      s.shots += 1;
      s.strokes[seat] += 1;
      s.shot = { no: s.shots, by: seat, start: from, frames: stroke.frames, holed: stroke.holed, water: stroke.water };
      if (stroke.water) {
        s.strokes[seat] += 1;
        log(s, seat, 'found the water. One stroke penalty.');
      } else if (stroke.holed) {
        s.balls[seat] = null;
        s.done[seat] = true;
        const n = s.strokes[seat];
        const par = s.course.par;
        log(s, seat, n === 1 ? 'got a hole in one!' : `holed out in ${n}${n < par ? ` (${par - n === 1 ? 'birdie' : 'eagle'})` : n === par ? ' (par)' : ''}.`);
      } else {
        s.balls[seat] = stroke.end;
      }
      if (!s.done[seat] && s.strokes[seat] >= MAX_STROKES) {
        s.strokes[seat] = MAX_STROKES;
        s.done[seat] = true;
        s.balls[seat] = null;
        log(s, seat, `picked up on ${MAX_STROKES}.`);
      }
      return advance(s, seat, rand);
    },
    remove(state, seat, rand) {
      const s = clone(state);
      if (s.over || !isIn(s, seat)) return s;
      s.out[seat] = true;
      s.done[seat] = true;
      s.balls[seat] = null;
      log(s, seat, 'left the course.');
      const left = activeSeats(s);
      if (left.length === 1) { finish(s, left[0]); return s; }
      if (s.turn === seat) return advance(s, seat, rand);
      return s;
    },
    view(state) {
      return {
        n: state.n, holes: state.holes, hole: state.hole, course: state.course, balls: state.balls,
        strokes: state.strokes, done: state.done, scores: state.scores, totals: totals(state), out: state.out,
        shot: state.shot, shots: state.shots, turn: state.turn, log: state.log,
      };
    },
  };
}
