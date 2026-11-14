// 8-Ball Pool: the table physics and the rules. Pure functions, like the
// other games in gameRules.mjs, which wraps this into GAMES.pool.
//
// The table is portrait: x runs 0..W across, y runs 0..H down. Players aim
// (an angle) and pick a power; the server runs the whole shot here and
// returns where every ball ended up plus a recording (frames) the app plays
// back. The app never decides where a ball goes.

export const W = 1000;
export const H = 2000;
export const R = 22;                  // ball radius
export const HEAD_LINE = 1500;        // break and kitchen: the cue ball sits below this line
export const FOOT_SPOT = [W / 2, 500];

const DT          = 1 / 500;          // seconds per physics step
const FRAME_EVERY = 25;               // steps per recorded frame (20 frames a second)
const MAX_STEPS   = 14 * 500;         // a shot never runs past 14 seconds
const FRICTION    = 700;              // rolling slowdown, units/s²
const MIN_SPEED   = 300;
const MAX_SPEED   = 5200;
const BALL_BOUNCE = 0.96;
const RAIL_BOUNCE = 0.78;
const STOP        = 4;                // slower than this counts as stopped

// Pockets: four corners and the middle of each long side
export const POCKETS = [[0, 0], [W, 0], [0, H / 2], [W, H / 2], [0, H], [W, H]];
const CORNER_MOUTH = 64;              // along a rail, this close to a corner there's no cushion
const SIDE_MOUTH   = 46;              // same for the side pockets
const CAPTURE      = 38;              // a ball's center this close to a pocket drops

export const SOLIDS  = [1, 2, 3, 4, 5, 6, 7];
export const STRIPES = [9, 10, 11, 12, 13, 14, 15];
const GROUP_BALLS = { solids: SOLIDS, stripes: STRIPES };
const groupOf = n => (n >= 1 && n <= 7 ? 'solids' : n >= 9 && n <= 15 ? 'stripes' : null);
const otherGroup = g => (g === 'solids' ? 'stripes' : 'solids');
export const MAX_SHOTS = 300;         // after this many shots the game is a draw

// ─── Physics ──────────────────────────────────────────────────

// True when a ball at (x, y) is in a pocket's mouth on the rail it's crossing
function inMouth(x, y, rail) {
  const along = rail === 'x' ? y : x;              // position along the rail being crossed
  const length = rail === 'x' ? H : W;
  if (along < CORNER_MOUTH || along > length - CORNER_MOUTH) return true;
  return rail === 'x' && Math.abs(y - H / 2) < SIDE_MOUTH;
}

function pocketed(x, y) {
  for (const [px, py] of POCKETS) if (Math.hypot(x - px, y - py) < CAPTURE) return true;
  // A ball that slipped past the cushion line through a mouth has dropped
  return x < -R * 0.6 || x > W + R * 0.6 || y < -R * 0.6 || y > H + R * 0.6;
}

// Runs one shot. balls: 16 entries of [x, y] or null (potted); ball 0 is the cue.
// Returns the final positions, the recording, which ball the cue touched first,
// and the balls that dropped, in order.
export function simulate(balls, angle, power) {
  const pos = balls.map(b => (b ? [b[0], b[1]] : null));
  const vel = balls.map(() => [0, 0]);
  const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * power;
  vel[0] = [Math.cos(angle) * speed, Math.sin(angle) * speed];
  const potted = [];
  let firstHit = null;
  let rails = 0;
  const frames = [snapshot(pos)];

  for (let step = 1; step <= MAX_STEPS; step++) {
    let moving = false;
    for (let i = 0; i < 16; i++) {
      const p = pos[i];
      if (!p) continue;
      const v = vel[i];
      const sp = Math.hypot(v[0], v[1]);
      if (sp < STOP) { v[0] = 0; v[1] = 0; continue; }
      moving = true;
      const slow = Math.max(0, sp - FRICTION * DT) / sp;
      v[0] *= slow; v[1] *= slow;
      p[0] += v[0] * DT; p[1] += v[1] * DT;
      // Cushions, except across a pocket's mouth
      if ((p[0] < R && v[0] < 0) || (p[0] > W - R && v[0] > 0)) {
        if (!inMouth(p[0], p[1], 'x')) { v[0] = -v[0] * RAIL_BOUNCE; v[1] *= 0.97; p[0] = p[0] < R ? R : W - R; rails++; }
      }
      if ((p[1] < R && v[1] < 0) || (p[1] > H - R && v[1] > 0)) {
        if (!inMouth(p[0], p[1], 'y')) { v[1] = -v[1] * RAIL_BOUNCE; v[0] *= 0.97; p[1] = p[1] < R ? R : H - R; rails++; }
      }
      if (pocketed(p[0], p[1])) { pos[i] = null; vel[i] = [0, 0]; potted.push(i); }
    }
    // Ball on ball: equal masses, so they trade the speed along the line between them
    for (let i = 0; i < 16; i++) {
      if (!pos[i]) continue;
      for (let j = i + 1; j < 16; j++) {
        if (!pos[j]) continue;
        const dx = pos[j][0] - pos[i][0];
        const dy = pos[j][1] - pos[i][1];
        const d = Math.hypot(dx, dy);
        if (d >= 2 * R || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        const closing = (vel[i][0] - vel[j][0]) * nx + (vel[i][1] - vel[j][1]) * ny;
        if (closing > 0) {
          const impulse = closing * (1 + BALL_BOUNCE) / 2;
          vel[i][0] -= impulse * nx; vel[i][1] -= impulse * ny;
          vel[j][0] += impulse * nx; vel[j][1] += impulse * ny;
          if (firstHit === null && (i === 0 || j === 0)) firstHit = i === 0 ? j : i;
          moving = true;
        }
        // Push them apart so they never overlap
        const push = (2 * R - d) / 2 + 0.01;
        pos[i][0] -= nx * push; pos[i][1] -= ny * push;
        pos[j][0] += nx * push; pos[j][1] += ny * push;
      }
    }
    // A push can shove a ball past a cushion; put it back on the table
    for (let i = 0; i < 16; i++) {
      const p = pos[i];
      if (!p) continue;
      if (!inMouth(p[0], p[1], 'x')) p[0] = Math.min(W - R, Math.max(R, p[0]));
      if (!inMouth(p[0], p[1], 'y')) p[1] = Math.min(H - R, Math.max(R, p[1]));
      if (pocketed(p[0], p[1])) { pos[i] = null; vel[i] = [0, 0]; potted.push(i); }
    }
    if (step % FRAME_EVERY === 0) frames.push(snapshot(pos));
    if (!moving) break;
  }
  // Anything still sitting in a mouth when the table stops drops in
  for (let i = 0; i < 16; i++) {
    const p = pos[i];
    if (p && (p[0] < R - 0.005 || p[0] > W - R + 0.005 || p[1] < R - 0.005 || p[1] > H - R + 0.005)) { pos[i] = null; potted.push(i); }
  }
  frames.push(snapshot(pos));
  return { balls: pos.map(p => (p ? [round(p[0]), round(p[1])] : null)), frames, firstHit, potted, rails };
}

const round = v => Math.round(v * 100) / 100;
// One recorded frame: x, y for each ball as whole numbers, -1, -1 once it's gone
const snapshot = pos => pos.flatMap(p => (p ? [Math.round(p[0]), Math.round(p[1])] : [-1, -1]));

// ─── Rules ────────────────────────────────────────────────────

function rack(rand) {
  // 8 in the middle of the third row, a solid and a stripe in the back corners,
  // everything else shuffled
  const solids = [...SOLIDS], stripes = [...STRIPES];
  const take = list => list.splice(rand(list.length), 1)[0];
  const corners = rand(2) ? [take(solids), take(stripes)] : [take(stripes), take(solids)];
  const rest = [...solids, ...stripes];
  for (let i = rest.length - 1; i > 0; i--) { const j = rand(i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const balls = Array(16).fill(null);
  const gap = R + 0.4;
  for (let row = 0; row < 5; row++) {
    for (let k = 0; k <= row; k++) {
      let n;
      if (row === 2 && k === 1) n = 8;
      else if (row === 4 && k === 0) n = corners[0];
      else if (row === 4 && k === 4) n = corners[1];
      else n = rest.pop();
      balls[n] = [round(FOOT_SPOT[0] + (k - row / 2) * 2 * gap), round(FOOT_SPOT[1] - row * Math.sqrt(3) * gap)];
    }
  }
  balls[0] = [W / 2, (HEAD_LINE + H) / 2];
  return balls;
}

export function cueSpotFree(balls, x, y, kitchen) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < R || x > W - R || y < R || y > H - R) return false;
  if (kitchen && y < HEAD_LINE) return false;
  return balls.every((b, n) => n === 0 || !b || Math.hypot(b[0] - x, b[1] - y) >= 2 * R + 0.5);
}

const ballList = nums => {
  const names = nums.map(n => `the ${n}`);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
};

// What the shooter has to hit first: their group, the 8 once that's cleared,
// or anything but the 8 while the table is open
function target(state, seat) {
  const g = state.groups[seat];
  if (!state.broke) return 'break';
  if (!g) return 'open';
  return GROUP_BALLS[g].every(n => !state.balls[n]) ? 'eight' : g;
}

export function makePool({ fail, other, clone, log, finish }) {
  return {
    name: '8-Ball Pool',
    options: () => ({}),
    init(rand) {
      return { balls: rack(rand), groups: [null, null], broke: false, hand: true, kitchen: true, shots: 0, shot: null, turn: 0, log: [] };
    },
    apply(state, seat, move, rand) {
      const s = clone(state);
      if (!move || typeof move !== 'object') fail('Aim and shoot.');
      const { angle, power } = move;
      if (typeof angle !== 'number' || !Number.isFinite(angle)) fail('Aim first.');
      if (typeof power !== 'number' || !(power >= 0 && power <= 1)) fail('Pick a power between 0 and 1.');

      // Ball in hand: they may place the cue ball (and must, if it went in)
      if (move.cue !== undefined) {
        if (!s.hand) fail('You can only move the cue ball after a foul.');
        const [x, y] = Array.isArray(move.cue) ? move.cue : [];
        if (!cueSpotFree(s.balls, x, y, s.kitchen)) {
          fail(s.kitchen ? 'Put the cue ball below the line, clear of other balls.' : 'Put the cue ball on the table, clear of other balls.');
        }
        s.balls[0] = [round(x), round(y)];
      } else if (!s.balls[0]) {
        fail('Place the cue ball first.');
      }

      const before = s.balls;
      const aim = target(s, seat);
      const shot = simulate(before, angle, power);
      s.balls = shot.balls;
      s.shots += 1;
      const opp = other(seat);
      const scratch = shot.potted.includes(0);
      const dropped = shot.potted.filter(n => n !== 0);

      let foul = null;
      if (shot.firstHit === null) foul = 'missed every ball';
      else if (aim === 'open' && shot.firstHit === 8) foul = 'hit the 8 first';
      else if (aim === 'eight' && shot.firstHit !== 8) foul = 'had to hit the 8 first';
      else if ((aim === 'solids' || aim === 'stripes') && groupOf(shot.firstHit) !== aim) foul = `hit ${groupOf(shot.firstHit) === null ? 'the 8' : 'the other group'} first`;
      if (scratch) foul = foul ? `${foul} and scratched` : 'scratched (the cue ball went in)';

      s.shot = { no: s.shots, by: seat, start: before, frames: shot.frames, potted: shot.potted, foul };
      if (dropped.length) log(s, seat, `potted ${ballList(dropped)}.`);

      // The 8
      if (dropped.includes(8)) {
        if (aim === 'break') {
          log(s, null, 'The 8 went down on the break. Re-racked; same player breaks again.');
          s.balls = rack(rand);
          s.hand = true; s.kitchen = true; s.groups = [null, null];
          s.turn = seat;
          return s;
        }
        if (aim === 'eight' && !foul) {
          log(s, seat, 'sank the 8 and won!');
          finish(s, seat);
        } else {
          log(s, seat, foul ? `sank the 8 but ${foul}. That loses.` : 'sank the 8 too early. That loses.');
          finish(s, opp);
        }
        return s;
      }

      if (s.shots >= MAX_SHOTS) {
        log(s, null, `${MAX_SHOTS} shots and still going. It's a draw.`);
        finish(s, null);
        return s;
      }

      // An open table goes to the group of the first ball potted on a clean shot
      if (aim === 'open' && !foul && dropped.length) {
        const g = groupOf(dropped[0]);
        s.groups[seat] = g;
        s.groups[opp] = otherGroup(g);
        log(s, seat, `takes ${g}.`);
      }
      s.broke = true;
      s.kitchen = false;

      const mine = s.groups[seat];
      const scored = dropped.some(n => (mine ? groupOf(n) === mine : true));
      if (foul) {
        log(s, seat, `${foul}. Ball in hand.`);
        s.turn = opp;
        s.hand = true;
        if (scratch) s.balls[0] = null;
      } else if (scored) {
        s.turn = seat;
        s.hand = false;
      } else {
        if (!dropped.length) log(s, seat, 'missed.');
        s.turn = opp;
        s.hand = false;
      }
      return s;
    },
    view(state, seat) {
      const left = g => GROUP_BALLS[g].filter(n => state.balls[n]).length;
      return {
        balls: state.balls,
        groups: state.groups,
        left: { solids: left('solids'), stripes: left('stripes') },
        hand: !!state.hand,
        kitchen: !!state.kitchen,
        target: state.over ? null : target(state, state.turn),
        shots: state.shots,
        shot: state.shot,
        log: state.log,
      };
    },
  };
}
