// Plays thousands of random games of every type and checks the invariants:
// cards and chips are never created or lost, hidden cards never reach the
// other seat or spectators, every game ends, and bad moves are refused.
// Run with: npm run test:games
import * as R from '../lambdas/aura-aura/gameRules.mjs';
const { GAMES, viewFor, bestHand, GameError, POKER_START_CHIPS } = R;

let seed = 12345;
const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.floor((seed / 2147483648) * n); };
const pick = arr => arr[rand(arr.length)];
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

function cardsIn(game, s) {
  if (game === 'crazy8s') return [...s.deck, ...s.discard, ...s.hands[0], ...s.hands[1]];
  if (game === 'gofish') return [...s.deck, ...s.hands[0], ...s.hands[1], ...s.books.flat().flatMap(r => [r + 's', r + 'h', r + 'd', r + 'c'])];
  return null;
}

// A random move the player could legally make, from their own view only
function randomMove(game, view) {
  switch (game) {
    case 'connect4': return { col: pick([0, 1, 2, 3, 4, 5, 6].filter(c => view.cols[c].length < 6)) };
    case 'dice': return { type: 'roll' };
    case 'crazy8s': {
      const opts = [];
      for (const c of view.playable) opts.push({ type: 'play', card: c, suit: pick(['s', 'h', 'd', 'c']) });
      if (view.canDraw) opts.push({ type: 'draw' });
      if (view.canPass) opts.push({ type: 'pass' });
      return pick(opts);
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
  for (let g = 0; g < 2000; g++) {
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
const c8 = GAMES.crazy8s.init(rand);
for (const bad of [{ type: 'play', card: 'XX' }, { type: 'pass' }, { type: 'play', card: '__proto__' }, 'x']) {
  try { GAMES.crazy8s.apply(c8, c8.turn, bad, rand); throw new Error('accepted ' + JSON.stringify(bad)); }
  catch (e) { assert(e instanceof GameError, e.message); }
}
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
