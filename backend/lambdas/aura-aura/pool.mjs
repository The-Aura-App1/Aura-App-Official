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

// ─── Physics ──────────────────────────────────────────────────
// Real pool, scaled: the table is a 9-foot one (2.54 m long = 2000 units, so
// about 787 units a metre) and gravity is 9.81 m/s² in those units. Every
// ball has a velocity and a spin. Spin is kept as the speed its surface
// turns at (top/back spin as a vector on the cloth, side spin as a signed
// number), so a ball rolling naturally has spin equal to its velocity.
//
// A ball whose spin doesn't match its velocity is sliding: cloth friction
// pulls the two together (fast), and once they match it rolls (slow). That
// is what makes the cue ball stop dead on a straight centre hit, follow
// through with top spin, and come back with draw. Balls are frictionless
// against each other, so a collision swaps the velocity along the line
// between centres and leaves spin alone. Cushions take the speed into them
// and give most of it back, and side spin pushes the ball along the rail as
// it comes off. The points where the cushions end at each pocket are hard
// corners a ball can rattle off.

const G           = 7720;             // gravity, units/s²
const SLIDE       = 0.15 * G;         // sliding friction (cloth), units/s²
const ROLL        = 0.012 * G;        // rolling resistance, units/s²
const DRAG        = 0.32;             // plus this much of the speed every second (keeps shots short, as in most pool games)
const SIDE_DECAY  = 0.1 * G;          // side spin wearing off on the cloth
const DT          = 1 / 500;          // seconds per physics step
const FRAME_EVERY = 25;               // steps per recorded frame (20 frames a second)
const MAX_STEPS   = 16 * 500;         // a shot never runs past 16 seconds
const MIN_SPEED   = 140;
const MAX_SPEED   = 6200;             // a hard break, about 8 m/s
const BALL_BOUNCE = 0.94;
const RAIL_BOUNCE = 0.8;
const RAIL_GRIP   = 0.25;             // how much side spin turns into speed along the rail
const JAW_BOUNCE  = 0.6;
const TIP_SPIN    = 1.5;              // a full-offset tip hit gives spin 1.5× the ball's speed (about 0.67 is a natural roll)
const STOP        = 3;                // slower than this counts as stopped

// Pockets: four corners and the middle of each long side
export const POCKETS = [[0, 0], [W, 0], [0, H / 2], [W, H / 2], [0, H], [W, H]];
const CORNER_MOUTH = 62;              // along a rail, this close to a corner there's no cushion
const SIDE_MOUTH   = 48;              // same for the side pockets
const CAPTURE      = 40;              // a ball's centre this close to a pocket drops
// Where each cushion ends at a pocket: the jaws
const JAWS = [
  [0, CORNER_MOUTH], [CORNER_MOUTH, 0], [W - CORNER_MOUTH, 0], [W, CORNER_MOUTH],
  [0, H - CORNER_MOUTH], [CORNER_MOUTH, H], [W - CORNER_MOUTH, H], [W, H - CORNER_MOUTH],
  [0, H / 2 - SIDE_MOUTH], [0, H / 2 + SIDE_MOUTH], [W, H / 2 - SIDE_MOUTH], [W, H / 2 + SIDE_MOUTH],
];

export const SOLIDS  = [1, 2, 3, 4, 5, 6, 7];
export const STRIPES = [9, 10, 11, 12, 13, 14, 15];
const GROUP_BALLS = { solids: SOLIDS, stripes: STRIPES };
const groupOf = n => (n >= 1 && n <= 7 ? 'solids' : n >= 9 && n <= 15 ? 'stripes' : null);
const otherGroup = g => (g === 'solids' ? 'stripes' : 'solids');
export const MAX_SHOTS = 300;         // after this many shots the game is a draw

// True when a ball at (x, y) is in a pocket's mouth on the rail it's crossing
function inMouth(x, y, rail) {
  const along = rail === 'x' ? y : x;              // position along the rail being crossed
  const length = rail === 'x' ? H : W;
  if (along < CORNER_MOUTH || along > length - CORNER_MOUTH) return true;
  return rail === 'x' && Math.abs(y - H / 2) < SIDE_MOUTH;
}

const CAPTURE2 = CAPTURE * CAPTURE;
function pocketed(x, y) {
  // well inside the table, nothing can drop
  if (x > CAPTURE && x < W - CAPTURE && y > 0 && y < H) return false;
  for (const [px, py] of POCKETS) { const dx = x - px, dy = y - py; if (dx * dx + dy * dy < CAPTURE2) return true; }
  // A ball that slipped past the cushion line through a mouth has dropped
  return x < -R * 0.7 || x > W + R * 0.7 || y < -R * 0.7 || y > H + R * 0.7;
}

// The speed a power (0..1) gives the cue ball: a gentle curve, so the low end
// has room for touch shots
export const speedFor = power => MIN_SPEED + (MAX_SPEED - MIN_SPEED) * power ** 1.5;

// Runs one shot. balls: 16 entries of [x, y] or null (potted); ball 0 is the
// cue. spin: [side, top] each -1..1, where the tip hits the cue ball (side +
// is right english, top + is follow, − is draw). Returns the final
// positions, the recording, which ball the cue touched first, and the balls
// that dropped, in order.
export function simulate(balls, angle, power, spin = [0, 0]) {
  const pos = balls.map(b => (b ? [b[0], b[1]] : null));
  const vel = balls.map(() => [0, 0]);
  const top = balls.map(() => [0, 0]);   // top/back spin, as surface speed on the cloth
  const side = balls.map(() => 0);        // side spin, + turns the ball to the right off a rail
  const speed = speedFor(power);
  const d = [Math.cos(angle), Math.sin(angle)];
  vel[0] = [d[0] * speed, d[1] * speed];
  top[0] = [d[0] * speed * TIP_SPIN * spin[1], d[1] * speed * TIP_SPIN * spin[1]];
  side[0] = speed * TIP_SPIN * spin[0];
  const potted = [];
  let firstHit = null;
  let rails = 0;
  const frames = [snapshot(pos)];
  const drop = i => { pos[i] = null; vel[i] = [0, 0]; top[i] = [0, 0]; side[i] = 0; potted.push(i); };

  // A cushion along one axis: the speed into it comes back smaller, side spin
  // pushes the ball along it, and the top spin into it is mostly turned round
  const cushion = (i, axis, into) => {
    const n = axis === 0 ? [into, 0] : [0, into];          // normal pointing back into the table
    const v = vel[i];
    v[axis] = -v[axis] * RAIL_BOUNCE;
    const along = 1 - axis;
    v[along] *= 0.97;
    // side spin: rotate the inward normal a quarter turn anticlockwise (as seen on screen)
    v[0] += RAIL_GRIP * side[i] * n[1];
    v[1] += RAIL_GRIP * side[i] * -n[0];
    side[i] *= 0.5;
    top[i][axis] = -top[i][axis] * 0.5;
    rails++;
  };

  for (let step = 1; step <= MAX_STEPS; step++) {
    let moving = false;
    for (let i = 0; i < 16; i++) {
      const p = pos[i];
      if (!p) continue;
      const v = vel[i], s = top[i];
      const slipX = v[0] - s[0], slipY = v[1] - s[1];
      const slipSpeed = Math.sqrt(slipX * slipX + slipY * slipY);
      const sp = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
      if (slipSpeed > STOP) {
        // Sliding: friction acts against the slip, slowing the ball and
        // winding its spin toward a natural roll
        moving = true;
        const ux = slipX / slipSpeed, uy = slipY / slipSpeed;
        if (slipSpeed <= 3.5 * SLIDE * DT) {
          // it catches up this step and starts to roll
          v[0] -= ux * slipSpeed / 3.5; v[1] -= uy * slipSpeed / 3.5;
          s[0] = v[0]; s[1] = v[1];
        } else {
          v[0] -= ux * SLIDE * DT; v[1] -= uy * SLIDE * DT;
          s[0] += ux * 2.5 * SLIDE * DT; s[1] += uy * 2.5 * SLIDE * DT;
        }
      } else if (sp > STOP) {
        // Rolling: a slow, steady slowdown
        moving = true;
        const next = Math.max(0, sp - (ROLL + DRAG * sp) * DT);
        v[0] *= next / sp; v[1] *= next / sp;
        s[0] = v[0]; s[1] = v[1];
      } else {
        v[0] = v[1] = s[0] = s[1] = 0;
      }
      if (side[i]) side[i] = Math.sign(side[i]) * Math.max(0, Math.abs(side[i]) - SIDE_DECAY * DT);
      if (v[0] === 0 && v[1] === 0) continue;
      p[0] += v[0] * DT; p[1] += v[1] * DT;
      // Cushions, except across a pocket's mouth
      if ((p[0] < R && v[0] < 0) || (p[0] > W - R && v[0] > 0)) {
        if (!inMouth(p[0], p[1], 'x')) { const into = p[0] < R ? 1 : -1; p[0] = into > 0 ? R : W - R; cushion(i, 0, into); }
      }
      if ((p[1] < R && v[1] < 0) || (p[1] > H - R && v[1] > 0)) {
        if (!inMouth(p[0], p[1], 'y')) { const into = p[1] < R ? 1 : -1; p[1] = into > 0 ? R : H - R; cushion(i, 1, into); }
      }
      // The jaws: hard corners where the cushions end (only near a rail)
      if (p[0] < 2 * R || p[0] > W - 2 * R || p[1] < 2 * R || p[1] > H - 2 * R) for (const [jx, jy] of JAWS) {
        const dx = p[0] - jx, dy = p[1] - jy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R || d2 === 0) continue;
        const dist = Math.sqrt(d2);
        const nx = dx / dist, ny = dy / dist;
        const vn = v[0] * nx + v[1] * ny;
        if (vn < 0) {
          v[0] -= (1 + JAW_BOUNCE) * vn * nx; v[1] -= (1 + JAW_BOUNCE) * vn * ny;
          s[0] *= 0.5; s[1] *= 0.5;
        }
        p[0] = jx + nx * R; p[1] = jy + ny * R;
      }
      if (pocketed(p[0], p[1])) drop(i);
    }
    // Ball on ball: equal masses, so they trade the velocity along the line
    // between their centres; spin carries on
    for (let i = 0; i < 16; i++) {
      if (!pos[i]) continue;
      for (let j = i + 1; j < 16; j++) {
        if (!pos[j]) continue;
        const dx = pos[j][0] - pos[i][0];
        const dy = pos[j][1] - pos[i][1];
        if (dx >= 2 * R || dx <= -2 * R || dy >= 2 * R || dy <= -2 * R) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        const dist = Math.sqrt(d2);
        const nx = dx / dist, ny = dy / dist;
        const closing = (vel[i][0] - vel[j][0]) * nx + (vel[i][1] - vel[j][1]) * ny;
        if (closing > 0) {
          const impulse = closing * (1 + BALL_BOUNCE) / 2;
          vel[i][0] -= impulse * nx; vel[i][1] -= impulse * ny;
          vel[j][0] += impulse * nx; vel[j][1] += impulse * ny;
          if (firstHit === null && (i === 0 || j === 0)) firstHit = i === 0 ? j : i;
          moving = true;
        }
        // Push them apart so they never overlap
        const push = (2 * R - dist) / 2 + 0.01;
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
      if (pocketed(p[0], p[1])) drop(i);
    }
    if (step % FRAME_EVERY === 0) frames.push(snapshot(pos));
    if (!moving) break;
  }
  // Anything still sitting in a mouth when the table stops drops in
  for (let i = 0; i < 16; i++) {
    const p = pos[i];
    if (p && (p[0] < R - 0.005 || p[0] > W - R + 0.005 || p[1] < R - 0.005 || p[1] > H - R + 0.005)) drop(i);
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
      // Where the tip hits the cue ball: [side, top], inside the ball
      const spin = move.spin ?? [0, 0];
      if (!Array.isArray(spin) || spin.length !== 2 || !spin.every(Number.isFinite) || Math.hypot(spin[0], spin[1]) > 1.0001) fail('Pick where to hit the cue ball.');

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
      const shot = simulate(before, angle, power, spin);
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
