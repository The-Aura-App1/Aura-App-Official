// Plays thousands of random games of every type and checks the invariants:
// cards and chips are never created or lost, hidden cards never reach the
// other seat or spectators, every game ends, and bad moves are refused.
// Run with: npm run test:games
import * as R from '../lambdas/aura-aura/gameRules.mjs';
import * as P from '../lambdas/aura-aura/pool.mjs';
const { GAMES, viewFor, bestHand, GameError, POKER_START_CHIPS } = R;

let seed = 12345;
const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * n); };
const pick = arr => arr[rand(arr.length)];
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

function cardsIn(game, s) {
  if (game === 'gofish') return [...s.deck, ...s.hands[0], ...s.hands[1], ...s.books.flat().flatMap(r => [r + 's', r + 'h', r + 'd', r + 'c'])];
  return null;
}

// A random move the player could legally make, from their own view only
function randomMove(game, view) {
  switch (game) {
    case 'connect4': return { col: pick([0, 1, 2, 3, 4, 5, 6].filter(c => view.cols[c].length < 6)) };
    case 'dice': return { type: 'roll' };
    case 'pool': {
      // Aim roughly at a random ball still on the table, at a random power
      const move = { power: rand(1001) / 1000 };
      let cue = view.balls[0];
      if (view.hand && (rand(2) || !cue)) {
        for (let tries = 0; tries < 200; tries++) {
          const x = P.R + rand(P.W - 2 * P.R), y = (view.kitchen ? P.HEAD_LINE : P.R) + rand(P.H - P.R - (view.kitchen ? P.HEAD_LINE : P.R));
          if (P.cueSpotFree(view.balls, x, y, view.kitchen)) { move.cue = [x, y]; cue = move.cue; break; }
        }
      }
      const targets = view.balls.map((b, n) => (n && b ? b : null)).filter(Boolean);
      const t = pick(targets);
      move.angle = Math.atan2(t[1] - cue[1], t[0] - cue[0]) + (rand(201) - 100) / 2000;
      return move;
    }
    case 'gofish': return { type: 'ask', rank: pick(view.askable) };
    case 'poker': {
      const o = view.options;
      const opts = [];
      if (o.canFold && rand(6) === 0) opts.push({ type: 'fold' });
      if (o.canCheck) opts.push({ type: 'check' });
      else opts.push({ type: 'call' }, { type: 'call' });
      if (o.canRaise) opts.push({ type: 'raise', to: o.minRaiseTo + rand(o.maxRaiseTo - o.minRaiseTo + 1) });
      return pick(opts);
    }
  }
}

const results = {};
for (const game of Object.keys(GAMES)) {
  const tally = { games: 0, wins: [0, 0], draws: 0, maxMoves: 0 };
  for (let g = 0; g < (game === 'pool' ? 150 : 2000); g++) {
    let state = GAMES[game].init(rand, GAMES[game].options({}));
    let moves = 0;
    while (!state.over) {
      const seat = state.turn;
      assert(seat === 0 || seat === 1, `${game}: bad turn ${seat}`);
      const view = viewFor(game, state, seat);
      // Hidden information never reaches the other seat or spectators
      const json = JSON.stringify(viewFor(game, state, 1 - seat)) + JSON.stringify(viewFor(game, state, null));
      assert(!json.includes('"deck":['), `${game}: deck leaked`);
      if (state.hands) for (const c of state.hands[seat]) {
        assert(!JSON.stringify(viewFor(game, state, null).hand ?? []).includes(c), `${game}: spectator sees hand`);
      }
      if (game === 'poker') {
        for (const c of state.hole[seat]) assert(!JSON.stringify(viewFor(game, state, 1 - seat).hole).includes(c), 'poker: hole leaked');
      }
      state = GAMES[game].apply(state, seat, randomMove(game, view), rand);
      moves++;
      const cards = cardsIn(game, state);
      if (cards) assert(cards.length === 52 && new Set(cards).size === 52, `${game}: cards not conserved (${cards.length})`);
      if (game === 'poker' && !state.over) {
        const total = state.chips[0] + state.chips[1] + state.pot + state.bets[0] + state.bets[1];
        assert(total === 2 * POKER_START_CHIPS, `poker: chips not conserved (${total})`);
        assert(state.chips.every(c => c >= 0), 'poker: negative stack');
      }
      if (game === 'pool') {
        // Balls stay on the cloth and never overlap; potted ones stay potted (the 8-on-break re-rack aside)
        const on = state.balls.map((b, n) => [b, n]).filter(([b]) => b);
        for (const [[x, y], n] of on) assert(x >= P.R - 0.01 && x <= P.W - P.R + 0.01 && y >= P.R - 0.01 && y <= P.H - P.R + 0.01, `pool: ball ${n} off the table at ${x},${y}`);
        for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
          const d = Math.hypot(on[i][0][0] - on[j][0][0], on[i][0][1] - on[j][0][1]);
          assert(d >= 2 * P.R - 0.5, `pool: balls ${on[i][1]} and ${on[j][1]} overlap (${d.toFixed(2)})`);
        }
        const g0 = state.groups[0], g1 = state.groups[1];
        assert((g0 === null && g1 === null) || (g0 && g1 && g0 !== g1), 'pool: groups inconsistent');
        assert(state.over || state.balls[0] || state.hand, 'pool: cue ball gone without ball in hand');
        assert(state.balls[8] || state.over || state.shot.potted.includes(8), 'pool: 8 gone but game going');
      }
      assert(moves < 5000, `${game}: never ended`);
    }
    if (game === 'poker') assert(state.chips[0] + state.chips[1] === 2 * POKER_START_CHIPS, 'poker: final chips');
    tally.games++;
    if (state.draw) tally.draws++; else tally.wins[state.winner]++;
    tally.maxMoves = Math.max(tally.maxMoves, moves);
  }
  results[game] = tally;
}
for (const [game, t] of Object.entries(results)) console.log(`${game}: ${t.games} games, wins ${t.wins.join('/')}, draws ${t.draws}, longest ${t.maxMoves} moves`);

// Illegal moves are refused with a GameError, never a crash
const c4 = GAMES.connect4.init(rand);
for (const bad of [null, {}, { col: 9 }, { col: '1' }, { col: -1 }]) {
  try { GAMES.connect4.apply(c4, c4.turn, bad, rand); throw new Error('accepted ' + JSON.stringify(bad)); }
  catch (e) { assert(e instanceof GameError, e.message); }
}
const pl = GAMES.pool.init(rand);
for (const bad of [null, 'x', {}, { angle: 1 }, { angle: NaN, power: 0.5 }, { angle: 1, power: 2 }, { angle: 1, power: 0.5, cue: [500, 400] },
  { angle: 1, power: 0.5, cue: [5, 1800] }, { angle: 1, power: 0.5, cue: 'x' }]) {
  try { GAMES.pool.apply(pl, pl.turn, bad, rand); throw new Error('accepted ' + JSON.stringify(bad)); }
  catch (e) { assert(e instanceof GameError, e.message); }
}

// Pool rules on set-up tables
const table = (balls, extra = {}) => {
  const b = Array(16).fill(null);
  for (const [n, xy] of Object.entries(balls)) b[n] = xy;
  return { ...GAMES.pool.init(rand), balls: b, broke: true, hand: false, kitchen: false, groups: [null, null], ...extra };
};
const LEFT = Math.PI;
// Potting on an open table takes that group and keeps the turn
let st = GAMES.pool.apply(table({ 0: [400, 1000], 3: [200, 1000], 11: [800, 300], 8: [600, 600] }), 0, { angle: LEFT, power: 0.4 }, rand);
assert(st.groups[0] === 'solids' && st.groups[1] === 'stripes' && st.turn === 0 && !st.hand, 'pool: open-table pot');
// Hitting the other group first is a foul: ball in hand for the opponent
st = GAMES.pool.apply(table({ 0: [400, 1000], 11: [200, 1000], 3: [800, 300], 8: [600, 600] }, { groups: ['solids', 'stripes'] }), 0, { angle: LEFT, power: 0.4 }, rand);
assert(st.turn === 1 && st.hand && st.groups[0] === 'solids', 'pool: wrong group first is a foul');
// Scratching takes the cue ball off and gives ball in hand
st = GAMES.pool.apply(table({ 0: [200, 1000], 3: [800, 300], 8: [600, 600] }), 0, { angle: LEFT, power: 0.4 }, rand);
assert(st.turn === 1 && st.hand && st.balls[0] === null, 'pool: scratch');
// Sinking the 8 early loses; sinking it after clearing your group wins
st = GAMES.pool.apply(table({ 0: [400, 1000], 8: [200, 1000], 3: [800, 300] }, { groups: ['solids', 'stripes'] }), 0, { angle: LEFT, power: 0.4 }, rand);
assert(st.over && st.winner === 1, 'pool: early 8 loses');
st = GAMES.pool.apply(table({ 0: [400, 1000], 8: [200, 1000], 12: [800, 300] }, { groups: ['solids', 'stripes'] }), 0, { angle: LEFT, power: 0.4 }, rand);
assert(st.over && st.winner === 0, 'pool: 8 after clearing wins');
// The 8 and a scratch on the same shot loses
st = GAMES.pool.apply(table({ 0: [400, 1000], 8: [360, 1000], 12: [800, 300] }, { groups: ['solids', 'stripes'] }), 0, { angle: LEFT, power: 1 }, rand);
assert(!st.shot.potted.includes(0) || (st.over && st.winner === 1), 'pool: 8 with scratch loses');
const pk = GAMES.poker.init(rand);
for (const bad of [{ type: 'raise', to: 1 }, { type: 'raise', to: 99999 }, { type: 'raise', to: 50.5 }, { type: 'dance' }]) {
  try { GAMES.poker.apply(pk, pk.turn, bad, rand); throw new Error('accepted ' + JSON.stringify(bad)); }
  catch (e) { assert(e instanceof GameError, e.message); }
}

// Hand rankings
const name = cards => bestHand(cards).name;
assert(name(['As', 'Ks', 'Qs', 'Js', 'Ts', '2h', '3d']) === 'Straight flush', 'royal');
assert(name(['Ah', '2s', '3d', '4c', '5h', 'Kd', 'Kc']) === 'Straight', 'wheel');
assert(name(['Ah', 'Ad', 'Ac', 'Kd', 'Kc', '2h', '2s']) === 'Full house', 'boat');
assert(name(['2h', '7h', '9h', 'Jh', 'Kh', 'Ah', '3c']) === 'Flush', 'flush');
assert(name(['2h', '2d', '9s', '9h', 'Kh', 'Kd', '3c']) === 'Two pair', 'two pair');
const cmp = (a, b) => R.compareScores(bestHand(a).score, bestHand(b).score);
assert(cmp(['As', 'Ad', '5c', '6d', '9h', 'Jc', '2s'], ['Ks', 'Kd', '5c', '6d', '9h', 'Jc', '2s']) > 0, 'aces beat kings');
assert(cmp(['As', 'Ad', 'Kc', '6d', '9h', 'Jc', '2s'], ['Ah', 'Ac', 'Qc', '6d', '9h', 'Jc', '2s']) > 0, 'kicker');
assert(cmp(['Ah', '2s', '3d', '4c', '5h', 'Kd', 'Qc'], ['6h', '2s', '3d', '4c', '5h', 'Kd', 'Qc']) < 0, 'wheel loses to six-high');
console.log('rule checks passed');
