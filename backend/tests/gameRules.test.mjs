// Plays thousands of random games of every type, at every table size, and
// checks the invariants: cards and chips are never created or lost, hidden
// cards never reach other seats or spectators, every game ends, players who
// leave are skipped from then on, and bad moves are refused.
// Run with: npm run test:games
import * as R from '../lambdas/aura-aura/gameRules.mjs';
import * as P from '../lambdas/aura-aura/pool.mjs';
const { GAMES, viewFor, bestHand, GameError, POKER_START_CHIPS, MAX_PLAYERS } = R;

let seed = 12345;
const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * n); };
const pick = arr => arr[rand(arr.length)];
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const sum = list => list.reduce((t, v) => t + v, 0);

function cardsIn(game, s) {
  if (game === 'gofish') return [...s.deck, ...s.hands.flat(), ...s.books.flat().flatMap(r => [r + 's', r + 'h', r + 'd', r + 'c'])];
  return null;
}

// A random move the player could legally make, from their own view only
function randomMove(game, view, seat) {
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
    case 'gofish': {
      const targets = view.handCounts.map((_, i) => i).filter(i => i !== seat && !view.out?.[i]);
      const move = { type: 'ask', rank: pick(view.askable) };
      if (targets.length > 1 || rand(2)) move.from = pick(targets);   // with one opponent, `from` is optional
      return move;
    }
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

function checkState(game, state, n) {
  const cards = cardsIn(game, state);
  if (cards) assert(cards.length === 52 && new Set(cards).size === 52, `${game}: cards not conserved (${cards.length})`);
  if (game === 'poker') {
    const total = sum(state.chips) + (state.over ? 0 : state.pot + sum(state.bets)) + state.gone;
    assert(total === n * POKER_START_CHIPS, `poker: chips not conserved (${total} at ${n} players)`);
    assert(state.chips.every(c => c >= 0), 'poker: negative stack');
    if (!state.over) assert(sum(state.committed) === state.pot + sum(state.bets), 'poker: committed chips don\'t match the pot');
  }
  if (game === 'pool') {
    // Balls stay on the cloth and never overlap; potted ones stay potted (the 8-on-break re-rack aside)
    const on = state.balls.map((b, k) => [b, k]).filter(([b]) => b);
    for (const [[x, y], k] of on) assert(x >= P.R - 0.01 && x <= P.W - P.R + 0.01 && y >= P.R - 0.01 && y <= P.H - P.R + 0.01, `pool: ball ${k} off the table at ${x},${y}`);
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
      const d = Math.hypot(on[i][0][0] - on[j][0][0], on[i][0][1] - on[j][0][1]);
      assert(d >= 2 * P.R - 0.5, `pool: balls ${on[i][1]} and ${on[j][1]} overlap (${d.toFixed(2)})`);
    }
    const g0 = state.groups[0], g1 = state.groups[1];
    assert((g0 === null && g1 === null) || (g0 && g1 && g0 !== g1), 'pool: groups inconsistent');
    assert(state.over || state.balls[0] || state.hand, 'pool: cue ball gone without ball in hand');
    assert(state.balls[8] || state.over || state.shot.potted.includes(8), 'pool: 8 gone but game going');
  }
}

const results = {};
for (const game of Object.keys(GAMES)) {
  for (let n = 2; n <= (MAX_PLAYERS[game] ?? 2); n++) {
    const tally = { games: 0, wins: Array(n).fill(0), draws: 0, splits: 0, removed: 0, maxMoves: 0 };
    const rounds = game === 'pool' ? 150 : n === 2 ? 2000 : 600;
    for (let g = 0; g < rounds; g++) {
      let state = GAMES[game].init(rand, GAMES[game].options({}), n);
      let moves = 0;
      while (!state.over) {
        const seat = state.turn;
        assert(Number.isInteger(seat) && seat >= 0 && seat < n, `${game}/${n}: bad turn ${seat}`);
        assert(!state.out?.[seat], `${game}/${n}: a player who left got the turn`);
        // Sometimes someone leaves a bigger table (resigns or times out)
        if (n > 2 && GAMES[game].remove && rand(40) === 0) {
          const left = state.out.map((o, i) => (o ? null : i)).filter(i => i !== null);
          state = GAMES[game].remove(state, pick(left), rand);
          tally.removed++;
          checkState(game, state, n);
          continue;
        }
        const view = viewFor(game, state, seat);
        // Hidden information never reaches the other seats or spectators
        const others = [...Array.from({ length: n }, (_, i) => i).filter(i => i !== seat).map(i => viewFor(game, state, i)), viewFor(game, state, null)];
        assert(!JSON.stringify(others).includes('"deck":['), `${game}: deck leaked`);
        if (state.hands) for (const c of state.hands[seat]) {
          for (const v of others) assert(!(v.hand ?? []).includes(c), `${game}/${n}: someone else sees a hand`);
        }
        if (game === 'poker' && state.hole[seat]) {
          for (const v of others) for (const c of state.hole[seat]) assert(!v.hole.includes(c), 'poker: hole leaked');
        }
        state = GAMES[game].apply(state, seat, randomMove(game, view, seat), rand);
        moves++;
        checkState(game, state, n);
        assert(moves < 8000, `${game}/${n}: never ended`);
      }
      if (game === 'poker') assert(sum(state.chips) + state.gone === n * POKER_START_CHIPS, 'poker: final chips');
      if (state.split) {
        assert(state.split.length >= 2 && state.split.every(i => !state.out?.[i]), `${game}/${n}: bad split`);
        tally.splits++;
      } else if (state.draw) tally.draws++;
      else {
        assert(!state.out?.[state.winner], `${game}/${n}: a player who left won`);
        tally.wins[state.winner]++;
      }
      tally.games++;
      tally.maxMoves = Math.max(tally.maxMoves, moves);
    }
    results[`${game} (${n})`] = tally;
  }
}
for (const [game, t] of Object.entries(results)) {
  console.log(`${game}: ${t.games} games, wins ${t.wins.join('/')}, draws ${t.draws}, splits ${t.splits}, left ${t.removed}, longest ${t.maxMoves} moves`);
}

// Illegal moves are refused with a GameError, never a crash
const refused = (game, state, seat, bad) => {
  try { GAMES[game].apply(state, seat, bad, rand); throw new Error(`${game} accepted ${JSON.stringify(bad)}`); }
  catch (e) { assert(e instanceof GameError, e.message); }
};
const c4 = GAMES.connect4.init(rand);
for (const bad of [null, {}, { col: 9 }, { col: '1' }, { col: -1 }]) refused('connect4', c4, c4.turn, bad);
const pl = GAMES.pool.init(rand);
for (const bad of [null, 'x', {}, { angle: 1 }, { angle: NaN, power: 0.5 }, { angle: 1, power: 2 }, { angle: 1, power: 0.5, cue: [500, 400] },
  { angle: 1, power: 0.5, cue: [5, 1800] }, { angle: 1, power: 0.5, cue: 'x' }]) refused('pool', pl, pl.turn, bad);
// Go Fish at a bigger table: you must say who you're asking, and it can't be you or someone who left
const gf = GAMES.gofish.init(rand, {}, 4);
const gfRank = viewFor('gofish', gf, gf.turn).askable[0];
refused('gofish', gf, gf.turn, { type: 'ask', rank: gfRank });
refused('gofish', gf, gf.turn, { type: 'ask', rank: gfRank, from: gf.turn });
refused('gofish', gf, gf.turn, { type: 'ask', rank: gfRank, from: 7 });
const gone = (gf.turn + 1) % 4;
const gfOut = GAMES.gofish.remove(gf, gone, rand);
assert(gfOut.hands[gone].length === 0 && gfOut.out[gone], 'gofish: leaving empties the hand');
if (!gfOut.over) refused('gofish', gfOut, gfOut.turn, { type: 'ask', rank: viewFor('gofish', gfOut, gfOut.turn).askable[0], from: gone });

// Pool rules on set-up tables
const table = (balls, extra = {}) => {
  const b = Array(16).fill(null);
  for (const [k, xy] of Object.entries(balls)) b[k] = xy;
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
for (const bad of [{ type: 'raise', to: 1 }, { type: 'raise', to: 99999 }, { type: 'raise', to: 50.5 }, { type: 'dance' }]) refused('poker', pk, pk.turn, bad);

// Poker side pots. Three players are all in on the river for 100, 300 and
// 300; the third leaves (folding), so the first two show down. Trip aces
// (in for 100) can only win the 300 main pot; trip kings takes the 400 side pot.
{
  const s = GAMES.poker.init(rand, {}, 3);
  Object.assign(s, {
    hand: 1, button: 0, street: 'river', chips: [0, 0, 1], gone: 0, out: [false, false, false], folded: [false, false, false],
    bets: [0, 0, 0], committed: [100, 300, 300], pot: 700, acted: [true, true, true], turn: 2,
    hole: [['As', 'Ad'], ['Ks', 'Kd'], ['2c', '7d']], board: ['Ah', 'Kh', '9c', '5s', '3d'], deck: [],
  });
  const after = GAMES.poker.remove(s, 2, rand);
  assert(after.last?.won?.[0] === 300 && after.last?.won?.[1] === 400, `poker: side pots paid ${JSON.stringify(after.last?.won)}`);
}

// Games saved before bigger tables still play on
{
  const old = { wins: [1, 0], rolls: [[3, 4], null], rounds: [], turn: 1, log: [] };
  const next = GAMES.dice.apply(old, 1, { type: 'roll' }, rand);
  assert(next.n === 2 && (next.over || next.turn === 0 || next.turn === 1), 'dice: old game continues');
  const oldFish = GAMES.gofish.init(rand, {}, 2);
  delete oldFish.n; delete oldFish.out;
  if (!oldFish.over) GAMES.gofish.apply(oldFish, oldFish.turn, { type: 'ask', rank: oldFish.hands[oldFish.turn][0][0] }, rand);
  const oldPoker = GAMES.poker.init(rand, {}, 2);
  for (const k of ['v', 'n', 'out', 'folded', 'committed', 'gone']) delete oldPoker[k];
  const ov = GAMES.poker.view(oldPoker, oldPoker.turn);
  GAMES.poker.apply(oldPoker, oldPoker.turn, ov.options.canCheck ? { type: 'check' } : { type: 'call' }, rand);
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
// Spoken hand descriptions, from two cards (pre-flop) to seven
const say = cards => R.describeHand(cards);
assert(say(['As', 'Ad']) === 'Pair of aces', 'pocket pair');
assert(say(['Ks', '7d']) === 'King high', 'two cards high');
assert(say(['Kh', 'Kd', '4s', '4c', '9h']) === 'Two pair, kings and fours', 'two pair on the flop');
assert(say(['Kh', 'Kd', '4s', '4c', '9h', '6s']) === 'Two pair, kings and fours', 'six cards (the turn)');
assert(say(['5h', '5d', '5s', 'Jc', 'Jh', '2c', '3d']) === 'Full house, fives over jacks', 'boat');
assert(say(['As', 'Ks', 'Qs', 'Js', 'Ts', '2h', '3d']) === 'Royal flush', 'royal flush');
assert(say(['2h', '3d', '4h', '5c', 'Ah', 'Kc', 'Kd']) === 'Straight, five high', 'wheel');
assert(say(['6h', '6d', '9s', '2c', 'Jh', 'Qc']) === 'Pair of sixes', 'sixes');
// a player's view says what they hold; a spectator's doesn't
const pv = viewFor('poker', pk, 0);
assert(typeof pv.made === 'string' && pv.made.length > 0, 'player sees their hand');
assert(viewFor('poker', pk, null).made === null, 'spectator sees no hand');
console.log('rule checks passed');
