// Bots to play for fun (no stakes) in the skill games, at three levels.
// Dice Duel and Flip a Coin are pure luck, so there's no bot for them.
//
// A bot decides from what its seat may see (viewFor), the same as a person,
// so card bots never peek at hidden hands. Pool and Mini Golf have nothing
// hidden; their bots try shots with the same physics the server uses and
// pick the best, with more tries and less wobble the harder they are.
//
//   botMove(game, level, { state, view, seat, rand }) → a move for GAMES[game].apply
//   fallbackMove(...) → a simple legal move, if a bot move is ever refused
import { legalMoves, makeMove, inCheck, sqName } from './chess.mjs';
import { simulate as poolShot, cueSpotFree, POCKETS, R as BALL_R, W as POOL_W, H as POOL_H, HEAD_LINE, SOLIDS, STRIPES } from './pool.mjs';
import { simulate as golfShot, T as TILE, COLS as GOLF_COLS, millStartFor } from './golf.mjs';
import { bestHand } from './gameRules.mjs';

export const BOT_GAMES = ['connect4', 'pool', 'chess', 'gofish', 'crazy8', 'poker', 'golf'];
export const BOT_LEVELS = ['easy', 'medium', 'hard'];
export const BOT_NAMES = { easy: 'Pip', medium: 'Nova', hard: 'Atlas' };
export const isBotId = id => typeof id === 'string' && id.startsWith('bot:');

const pick = (list, rand) => list[rand(list.length)];
const chance = (p, rand) => rand(1000) < p * 1000;
const noise = (amount, rand) => ((rand(2001) - 1000) / 1000) * amount;

// ─── Connect 4 ────────────────────────────────────────────────
const C4_COLS = 7, C4_ROWS = 6;
function c4Winner(cols, c) {
  const r = cols[c].length - 1;
  const seat = cols[c][r];
  const at = (x, y) => (x >= 0 && x < C4_COLS && y >= 0 ? cols[x][y] : undefined);
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let n = 1;
    for (const d of [1, -1]) { let x = c + dx * d, y = r + dy * d; while (at(x, y) === seat) { n++; x += dx * d; y += dy * d; } }
    if (n >= 4) return true;
  }
  return false;
}
const c4Open = cols => [...Array(C4_COLS).keys()].filter(c => cols[c].length < C4_ROWS);
function c4Play(cols, c, seat) { cols[c].push(seat); const won = c4Winner(cols, c); return won; }
// Scores every window of four for `me`
function c4Score(cols, me) {
  let score = 0;
  const at = (x, y) => (y < cols[x].length ? cols[x][y] : null);
  for (let x = 0; x < C4_COLS; x++) for (let y = 0; y < C4_ROWS; y++) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const cells = [0, 1, 2, 3].map(k => [x + dx * k, y + dy * k]);
      if (cells.some(([cx, cy]) => cx < 0 || cx >= C4_COLS || cy < 0 || cy >= C4_ROWS)) continue;
      const v = cells.map(([cx, cy]) => at(cx, cy));
      const mine = v.filter(s => s === me).length, theirs = v.filter(s => s !== null && s !== me).length;
      if (mine && !theirs) score += [0, 1, 6, 40, 1000][mine];
      if (theirs && !mine) score -= [0, 1, 7, 50, 1000][theirs];
    }
  }
  for (let y = 0; y < cols[3].length; y++) score += cols[3][y] === me ? 4 : -4;
  return score;
}
function c4Negamax(cols, depth, alpha, beta, me, toMove) {
  const open = c4Open(cols);
  if (!open.length) return 0;
  if (depth === 0) return (toMove === me ? 1 : -1) * c4Score(cols, me);
  const order = open.sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  let best = -Infinity;
  for (const c of order) {
    const won = c4Play(cols, c, toMove);
    const v = won ? 100000 + depth : -c4Negamax(cols, depth - 1, -beta, -alpha, me, 1 - toMove);
    cols[c].pop();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
function connect4Bot(level, { view, seat, rand }) {
  const cols = view.cols.map(c => [...c]);
  const open = c4Open(cols);
  const wins = s => open.filter(c => { const w = c4Play(cols, c, s); cols[c].pop(); return w; });
  if (level === 'easy') {
    if (wins(seat).length && chance(0.6, rand)) return { col: wins(seat)[0] };
    if (wins(1 - seat).length && chance(0.3, rand)) return { col: wins(1 - seat)[0] };
    return { col: pick(open, rand) };
  }
  if (wins(seat).length) return { col: wins(seat)[0] };
  if (wins(1 - seat).length) return { col: wins(1 - seat)[0] };
  if (level === 'medium') {
    // avoid handing over a win straight away; lean toward the middle
    const safe = open.filter(c => { cols[c].push(seat); const bad = c4Open(cols).some(d => { const w = c4Play(cols, d, 1 - seat); cols[d].pop(); return w; }); cols[c].pop(); return !bad; });
    const from = safe.length ? safe : open;
    const weights = from.map(c => 4 - Math.abs(3 - c));
    let r = rand(weights.reduce((a, b) => a + b, 0));
    for (let i = 0; i < from.length; i++) { r -= weights[i]; if (r < 0) return { col: from[i] }; }
    return { col: from[0] };
  }
  let best = null, bestV = -Infinity;
  for (const c of open.sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b))) {
    c4Play(cols, c, seat);
    const v = -c4Negamax(cols, 5, -Infinity, Infinity, seat, 1 - seat);
    cols[c].pop();
    if (v > bestV) { bestV = v; best = c; }
  }
  return { col: best ?? open[0] };
}

// ─── Chess ────────────────────────────────────────────────────
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// A small nudge toward the middle and forward, per piece type (white's view, rank 0 first)
const CENTER = [0, 1, 2, 3, 3, 2, 1, 0];
function chessEval(board, color) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === '.') continue;
    const white = p === p.toUpperCase();
    const t = p.toLowerCase();
    const f = i % 8, r = Math.floor(i / 8);
    const fwd = white ? r : 7 - r;
    let v = VALUE[t];
    if (t === 'p') v += fwd * 6 + (f >= 2 && f <= 5 ? CENTER[r] * 3 : 0);
    else if (t === 'n' || t === 'b') v += (CENTER[f] + CENTER[r]) * 5 - (fwd === 0 ? 10 : 0);
    else if (t === 'q') v += (CENTER[f] + CENTER[r]) * 2;
    else if (t === 'k') v += fwd === 0 ? 10 : -fwd * 8;
    score += (white === (color === 'w')) ? v : -v;
  }
  return score;
}
const child = (s, m) => { const n = makeMove(s, m); return { ...s, board: n.board, castle: n.castle, ep: n.ep, side: s.side === 'w' ? 'b' : 'w', captured: n.captured }; };
function chessSearch(s, depth, alpha, beta, deadline) {
  const moves = legalMoves(s);
  if (!moves.length) return inCheck(s, s.side) ? -100000 - depth : 0;
  if (depth === 0) return chessEval(s.board, s.side);
  if (Date.now() > deadline) return chessEval(s.board, s.side);
  // captures first, biggest victim first
  moves.sort((a, b) => (VALUE[s.board[b.to].toLowerCase()] ?? 0) - (VALUE[s.board[a.to].toLowerCase()] ?? 0));
  let best = -Infinity;
  for (const m of moves) {
    const v = -chessSearch(child(s, m), depth - 1, -beta, -alpha, deadline);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
function chessBot(level, { state, rand }) {
  const moves = legalMoves(state);
  const out = m => ({ from: sqName(m.from), to: sqName(m.to), ...(m.promo && { promo: m.promo }) });
  const promoQ = moves.filter(m => !m.promo || m.promo === 'q');
  if (level === 'easy') {
    // mostly random; grabs a capture now and then
    const caps = promoQ.filter(m => state.board[m.to] !== '.');
    return out(caps.length && chance(0.4, rand) ? pick(caps, rand) : pick(promoQ, rand));
  }
  const depth = level === 'medium' ? 2 : 4;
  const deadline = Date.now() + (level === 'medium' ? 600 : 1500);
  let best = [], bestV = -Infinity;
  for (let d = 1; d <= depth && Date.now() < deadline; d++) {
    let roundBest = [], roundV = -Infinity;
    for (const m of promoQ) {
      const v = -chessSearch(child(state, m), d - 1, -Infinity, Infinity, deadline) + (level === 'medium' ? rand(30) : rand(4));
      if (v > roundV) { roundV = v; roundBest = [m]; } else if (v === roundV) roundBest.push(m);
    }
    if (Date.now() <= deadline || !best.length) { best = roundBest; bestV = roundV; }
  }
  return out(best.length ? pick(best, rand) : pick(promoQ, rand));
}

// ─── Pool ─────────────────────────────────────────────────────
function poolTarget(state, seat) {
  const g = state.groups?.[seat];
  if (!state.broke) return 'break';
  if (!g) return 'open';
  const balls = g === 'solids' ? SOLIDS : STRIPES;
  return balls.every(n => !state.balls[n]) ? 'eight' : g;
}
function poolScore(state, seat, aim, result) {
  const potted = result.potted;
  const scratch = potted.includes(0);
  const first = result.firstHit;
  const legalFirst = aim === 'break' || aim === 'open' ? first !== null && first !== 8
    : aim === 'eight' ? first === 8 : first !== null && (aim === 'solids' ? SOLIDS : STRIPES).includes(first);
  const foul = !legalFirst || scratch || first === null;
  if (potted.includes(8)) return aim === 'eight' && !foul ? 10000 : -10000;
  const mine = aim === 'open' || aim === 'break' ? potted.filter(n => n !== 0 && n !== 8)
    : potted.filter(n => (aim === 'solids' ? SOLIDS : STRIPES).includes(n));
  const theirs = potted.filter(n => n !== 0 && n !== 8 && !mine.includes(n));
  return (foul ? -300 : 0) + mine.length * 200 - theirs.length * 80 + (legalFirst ? 20 : 0);
}
function poolCueSpot(state, rand) {
  const kitchen = !!state.kitchen;
  const tries = [[POOL_W / 2, (HEAD_LINE + POOL_H) / 2]];
  for (let k = 0; k < 40; k++) tries.push([BALL_R + rand(POOL_W - 2 * BALL_R), kitchen ? HEAD_LINE + BALL_R + rand(POOL_H - HEAD_LINE - 2 * BALL_R) : BALL_R + rand(POOL_H - 2 * BALL_R)]);
  return tries.find(([x, y]) => cueSpotFree(state.balls, x, y, kitchen)) ?? tries[0];
}
function poolBot(level, { state, seat, rand }) {
  const aim = poolTarget(state, seat);
  const balls = state.balls.map(b => (b ? [...b] : null));
  let cue = null;
  if (state.hand) {
    cue = poolCueSpot(state, rand);
    balls[0] = cue;
  }
  const [cx, cy] = balls[0];
  const wanted = aim === 'break' || aim === 'open' ? balls.map((b, n) => (b && n !== 0 && n !== 8 ? n : null)).filter(n => n !== null)
    : aim === 'eight' ? [8] : (aim === 'solids' ? SOLIDS : STRIPES).filter(n => balls[n]);
  const move = (angle, power) => ({ angle, power: Math.max(0.05, Math.min(1, power)), ...(cue && { cue }) });
  if (aim === 'break') return move(Math.atan2(balls[1][1] - cy, balls[1][0] - cx) + noise(0.01, rand), level === 'easy' ? 0.75 : 1);

  // Ghost-ball aims: the spot where the cue ball must hit each ball to send it at each pocket
  const aims = [];
  for (const n of wanted) {
    const [bx, by] = balls[n];
    for (const [px, py] of POCKETS) {
      const d = Math.hypot(px - bx, py - by);
      const gx = bx - ((px - bx) / d) * 2 * BALL_R, gy = by - ((py - by) / d) * 2 * BALL_R;
      const toGhost = Math.atan2(gy - cy, gx - cx), toPocket = Math.atan2(py - by, px - bx);
      let cut = Math.abs(toGhost - toPocket); if (cut > Math.PI) cut = 2 * Math.PI - cut;
      if (cut > 1.25) continue;
      aims.push({ angle: toGhost, cut, dist: Math.hypot(gx - cx, gy - cy) + d });
    }
  }
  if (!aims.length) {
    const n = pick(wanted.length ? wanted : [8], rand);
    return move(Math.atan2(balls[n][1] - cy, balls[n][0] - cx), 0.5);
  }
  aims.sort((a, b) => a.cut - b.cut || a.dist - b.dist);
  if (level === 'easy') {
    const a = pick(aims.slice(0, 4), rand);
    return move(a.angle + noise(0.06, rand), 0.3 + rand(50) / 100);
  }
  const wobble = level === 'medium' ? 0.025 : 0.004;
  const tries = level === 'medium' ? 10 : 36;
  const deadline = Date.now() + (level === 'medium' ? 500 : 1200);
  let best = null;
  for (let k = 0; k < tries && Date.now() < deadline; k++) {
    const a = aims[k % Math.min(aims.length, level === 'medium' ? 5 : 12)];
    const angle = a.angle + noise(wobble, rand);
    const power = Math.min(1, 0.25 + a.dist / 2600 + rand(30) / 100);
    const result = poolShot(balls, angle, power, [0, 0]);
    const score = poolScore(state, seat, aim, result) + rand(10);
    if (!best || score > best.score) best = { angle, power, score };
  }
  return move(best.angle, best.power);
}

// ─── Mini Golf ────────────────────────────────────────────────
// How far a resting spot is from the cup, following the fairway (tile path)
function golfDistance(course, end) {
  const [cx, cy] = course.cup;
  if (!end) return 0;
  const tile = Math.floor(end[1] / TILE) * GOLF_COLS + Math.floor(end[0] / TILE);
  const at = course.path.indexOf(tile);
  const steps = at === -1 ? course.path.length + 2 : course.path.length - 1 - at;
  return steps * TILE + Math.hypot(end[0] - cx, end[1] - cy) * 0.6;
}
function golfBot(level, { state, seat, rand }) {
  const course = state.course;
  const from = state.balls[seat];
  const [cx, cy] = course.cup;
  const direct = Math.atan2(cy - from[1], cx - from[0]);
  if (level === 'easy') {
    const d = Math.hypot(cx - from[0], cy - from[1]);
    return { angle: direct + noise(0.25, rand), power: Math.max(0.05, Math.min(1, 0.12 + d / 1500 + noise(0.1, rand))) };
  }
  const tries = level === 'medium' ? 24 : 110;
  const wobble = level === 'medium' ? 0.05 : 0.01;
  let best = null;
  for (let k = 0; k < tries; k++) {
    const angle = k < tries / 3 ? direct + noise(0.6, rand) : rand(6283) / 1000;
    const power = 0.08 + rand(92) / 100;
    const shot = golfShot(course, from, angle + noise(wobble, rand), power, millStartFor(state.shots ?? 0));
    const score = shot.holed ? -1e6 : (shot.water ? 1e5 : golfDistance(course, shot.end));
    if (!best || score < best.score) best = { angle, power, score };
  }
  return { angle: best.angle, power: best.power };
}

// ─── Go Fish ──────────────────────────────────────────────────
const RANK_WORD = { T: '10', J: 'jack', Q: 'queen', K: 'king', A: 'ace' };
const rankPlural = r => (r === '6' ? 'sixes' : `${RANK_WORD[r] ?? r}s`);
function gofishBot(level, { view, seat, rand }) {
  const ranks = view.askable;
  const others = view.handCounts.map((n, i) => i).filter(i => i !== seat && !view.out?.[i] && view.handCounts[i] > 0);
  const targets = others.length ? others : view.handCounts.map((n, i) => i).filter(i => i !== seat && !view.out?.[i]);
  const ask = (rank, from) => ({ type: 'ask', rank, ...(view.n > 2 && { from }) });
  if (level === 'easy') return ask(pick(ranks, rand), pick(targets, rand));
  const counts = r => view.hand.filter(c => c[0] === r).length;
  if (level === 'hard') {
    // Remember who has asked for what: they still hold it, unless they've
    // made the book or handed those cards over since
    const holds = new Map();
    for (const e of view.log ?? []) {
      if (e.s === null || e.s === undefined) continue;
      for (const r of Object.keys(RANK_WORD).concat(['2', '3', '4', '5', '6', '7', '8', '9'])) {
        if (new RegExp(`asked (\\{o\\} )?for ${rankPlural(r)}\\b`).test(e.t)) {
          if (!holds.has(e.s)) holds.set(e.s, new Set());
          holds.get(e.s).add(r);
          if (/ and got /.test(e.t) && e.o !== undefined && holds.has(e.o)) holds.get(e.o).delete(r);
        }
        if (e.t.includes(`made a book of ${rankPlural(r)}`)) holds.get(e.s)?.delete(r);
      }
    }
    for (const [who, set] of holds) {
      if (who === seat || !targets.includes(who)) continue;
      const hit = ranks.filter(r => set.has(r)).sort((a, b) => counts(b) - counts(a));
      if (hit.length) return ask(hit[0], who);
    }
  }
  const best = [...ranks].sort((a, b) => counts(b) - counts(a) || rand(3) - 1)[0];
  const biggest = [...targets].sort((a, b) => view.handCounts[b] - view.handCounts[a])[0];
  return ask(best, level === 'medium' ? pick(targets, rand) : biggest);
}

// ─── Crazy 8 ──────────────────────────────────────────────────
function crazy8Bot(level, { view, seat, rand }) {
  if (!view.playable.length) return view.canDraw ? { type: 'draw' } : { type: 'pass' };
  const suitCount = s => view.hand.filter(c => c[1] === s && c[0] !== '8').length;
  const bestSuit = () => ['s', 'h', 'd', 'c'].sort((a, b) => suitCount(b) - suitCount(a))[0];
  const play = card => ({ type: 'play', card, ...(card[0] === '8' && { suit: level === 'easy' ? pick(['s', 'h', 'd', 'c'], rand) : bestSuit() }) });
  if (level === 'easy') return play(pick(view.playable, rand));
  const next = (seat + 1) % view.n;
  const plain = view.playable.filter(c => c[0] !== '8');
  if (level === 'hard') {
    // attack when the next player is close to going out; keep 8s for last
    const attack = plain.filter(c => c[0] === '2' || c[0] === 'J');
    if (attack.length && view.handCounts[next] <= 3) return play(attack[0]);
  }
  if (plain.length) return play([...plain].sort((a, b) => suitCount(b[1]) - suitCount(a[1]))[0]);
  return play(view.playable[0]);
}

// ─── Poker ────────────────────────────────────────────────────
const VAL = c => '23456789TJQKA'.indexOf(c[0]) + 2;
// 0..1: how good these cards are right now
function pokerStrength(hole, board) {
  if (board.length === 0) {
    const [a, b] = hole.map(VAL).sort((x, y) => y - x);
    let s = (a + b) / 28;
    if (a === b) s = 0.55 + a / 30;
    if (hole[0][1] === hole[1][1]) s += 0.06;
    if (a - b === 1) s += 0.03;
    return Math.min(1, s);
  }
  const [cat, top] = bestHand([...hole, ...board]).score;
  const usesHole = cat > 0 || hole.some(c => VAL(c) >= 12);
  return Math.min(1, cat / 8 * 0.9 + (cat === 1 ? (top ?? 2) / 70 : 0) + (cat >= 2 ? 0.15 : 0) + (usesHole ? 0.05 : 0));
}
function pokerBot(level, { view, rand }) {
  const o = view.options;
  if (!o) return { type: 'check' };
  const strength = pokerStrength(view.hole, view.board);
  const pot = (view.pot ?? 0) + view.bets.reduce((t, b) => t + b, 0);
  const potOdds = o.toCall / Math.max(1, pot + o.toCall);
  const raiseTo = frac => {
    if (!o.canRaise) return null;
    const want = Math.round((view.bets.reduce((m, b) => Math.max(m, b), 0)) + pot * frac);
    return Math.max(o.minRaiseTo, Math.min(o.maxRaiseTo, want));
  };
  const passive = () => (o.canCheck ? { type: 'check' } : { type: 'call' });
  if (level === 'easy') {
    if (o.canRaise && strength > 0.8 && chance(0.5, rand)) return { type: 'raise', to: raiseTo(0.5) };
    if (!o.canCheck && o.toCall > 0 && strength < 0.25 && chance(0.4, rand)) return { type: 'fold' };
    return passive();
  }
  const bluff = level === 'hard' && chance(0.08, rand);
  if (o.canRaise && (strength > (level === 'hard' ? 0.62 : 0.7) || bluff)) {
    return { type: 'raise', to: raiseTo(strength > 0.85 ? 1 : 0.6) };
  }
  if (o.canCheck) return { type: 'check' };
  const need = level === 'hard' ? potOdds * 1.1 : 0.35;
  return strength >= need || o.toCall <= view.blinds?.[1] ? { type: 'call' } : { type: 'fold' };
}

const BOTS = { connect4: connect4Bot, chess: chessBot, pool: poolBot, golf: golfBot, gofish: gofishBot, crazy8: crazy8Bot, poker: pokerBot };

export function botMove(game, level, ctx) {
  return BOTS[game](BOT_LEVELS.includes(level) ? level : 'medium', ctx);
}

// A plain legal move, in case a bot's own choice is ever refused
export function fallbackMove(game, { state, view, seat, rand }) {
  switch (game) {
    case 'connect4': return { col: view.cols.findIndex(c => c.length < 6) };
    case 'chess': { const m = legalMoves(state)[0]; return { from: sqName(m.from), to: sqName(m.to), ...(m.promo && { promo: 'q' }) }; }
    case 'pool': return { angle: rand(6283) / 1000, power: 0.5, ...(state.hand && { cue: poolCueSpot(state, rand) }) };
    case 'golf': { const [x, y] = state.balls[seat]; const [cx, cy] = state.course.cup; return { angle: Math.atan2(cy - y, cx - x), power: 0.3 }; }
    case 'gofish': return { type: 'ask', rank: view.askable[0], ...(view.n > 2 && { from: (seat + 1) % view.n }) };
    case 'crazy8': return view.playable.length ? { type: 'play', card: view.playable[0], ...(view.playable[0][0] === '8' && { suit: 's' }) } : view.canDraw ? { type: 'draw' } : { type: 'pass' };
    case 'poker': return view.options?.canCheck ? { type: 'check' } : { type: 'fold' };
    default: return null;
  }
}

// How long the bot "thinks" before moving, so the last move (a shot, a
// putt, a card) has time to play out on screen first
export function botDelay(game, state) {
  const frames = state?.shot?.frames?.length ?? 0;
  if (game === 'pool') return frames * 50 + 900;
  if (game === 'golf') return (frames / 2) * 50 + 800;
  if (game === 'poker' || game === 'gofish' || game === 'crazy8') return 1100;
  return 650;
}
