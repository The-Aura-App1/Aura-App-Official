// Rules for the group games. Pure functions only: no database, no clock.
// The server owns every shuffle, roll and flip (rand comes from crypto in
// games.mjs), checks every move here, and only ever sends a player
// view(state, seat), which hides the deck and everyone else's cards.
//
// Seats are 0 (the challenger) to n - 1. Connect 4, Pool and Flip a Coin are
// always two players; Dice Duel, Go Fish and Poker take up to MAX_PLAYERS.
// Each state has:
//   turn    seat to move, or null once the game is over
//   over    true when finished; winner is a seat, or null with draw: true
//   split   when some (not all) players tie at the end: the seats sharing the pot
//   out     (bigger-table games) seats that left, timed out or went bust
//   log     the last few public events, { s: seat | null, t: text, o?: seat }
//           where "{o}" in the text stands for seat o's name

import { makePool } from './pool.mjs';

export class GameError extends Error {}

// Most players a game takes (all others are two-player). Keep equal to
// maxPlayers in src/components/games/gameInfo.js (a test checks).
export const MAX_PLAYERS = { dice: 6, gofish: 5, poker: 6 };

const fail = message => { throw new GameError(message); };
const other = seat => 1 - seat;
const clone = value => JSON.parse(JSON.stringify(value));
const LOG_SIZE = 12;

function log(state, seat, text, o) {
  state.log = [...(state.log ?? []), { s: seat, t: text, ...(o !== undefined && { o }) }].slice(-LOG_SIZE);
}

function finish(state, winner, split = null) {
  state.over   = true;
  state.turn   = null;
  state.winner = winner;
  state.draw   = winner === null;
  if (split) state.split = split;
}

// ─── Seats ────────────────────────────────────────────────────
const seatCount = s => s.n ?? 2;
const isIn = (s, i) => !s.out?.[i];
const allSeats = s => Array.from({ length: seatCount(s) }, (_, i) => i);
const activeSeats = s => allSeats(s).filter(i => isIn(s, i));
const isSeat = (s, seat) => Number.isInteger(seat) && seat >= 0 && seat < seatCount(s);

// The next seat after `from`, going round the table, that passes ok()
function nextSeat(s, from, ok = i => isIn(s, i)) {
  const n = seatCount(s);
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (ok(i)) return i;
  }
  return null;
}

// ─── Cards ────────────────────────────────────────────────────
// A card is rank + suit: 'Ts' is the ten of spades, 'Ah' the ace of hearts
export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc';
const RANK_NAMES = { T: '10', J: 'jack', Q: 'queen', K: 'king', A: 'ace' };
const SUIT_NAMES = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const rankName = r => RANK_NAMES[r] ?? r;
const plural = r => (r === '6' ? 'sixes' : `${rankName(r)}s`);
const cardName = c => `${rankName(c[0])} of ${SUIT_NAMES[c[1]]}`;

function shuffle(cards, rand) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function shuffledDeck(rand) {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return shuffle(deck, rand);
}


// ─── Flip a Coin ──────────────────────────────────────────────
// The challenger calls heads or tails; the coin is flipped the moment the
// challenge is accepted, so the game is over as soon as it starts.
const coinflip = {
  name: 'Flip a Coin',
  options(raw) {
    const call = raw?.call ?? 'heads';
    if (call !== 'heads' && call !== 'tails') fail('Call heads or tails.');
    return { call };
  },
  init(rand, { call }) {
    const result = rand(2) === 0 ? 'heads' : 'tails';
    const state = { call, result, log: [] };
    log(state, null, `The coin landed ${result}.`);
    finish(state, result === call ? 0 : 1);
    return state;
  },
  apply() { fail('The coin has already been flipped.'); },
  view: state => clone(state),
};

// ─── Dice Duel ────────────────────────────────────────────────
// First to win two rounds. Each round everyone rolls two dice; the highest
// total takes the round. A tie for the top replays it between the tied
// players only (with two players, that's both).
function diceUp(s) {   // games saved before bigger tables: two players
  return s.n ? s : { ...s, n: 2, out: [false, false], rolling: [0, 1] };
}

// Settles the round once everyone still in it has rolled; `from` is who acted last
function diceNext(s, from) {
  const contenders = s.rolling.filter(i => isIn(s, i));
  const waiting = i => contenders.includes(i) && !s.rolls[i];
  if (contenders.length > 1) {
    const next = waiting(from) ? from : nextSeat(s, from, waiting);
    if (next !== null) { s.turn = next; return s; }
  }
  const total = i => (s.rolls[i] ? s.rolls[i][0] + s.rolls[i][1] : 0);
  const top = Math.max(...contenders.map(total));
  const leaders = contenders.filter(i => total(i) === top);
  s.rounds.push({ rolls: s.rolls, winner: leaders.length === 1 ? leaders[0] : null, ...(leaders.length > 1 && { tied: leaders }) });
  s.rolls = Array(s.n).fill(null);
  if (leaders.length > 1) {
    s.rolling = leaders;
    log(s, null, leaders.length === contenders.length ? `Tie at ${top}. Roll again.` : `Tie at ${top}. The tied players roll again.`);
    s.turn = leaders.includes(from) ? from : nextSeat(s, from, i => leaders.includes(i));
    return s;
  }
  const w = leaders[0];
  s.wins[w] += 1;
  const second = contenders.filter(i => i !== w).map(total);
  if (contenders.length === 1) log(s, w, 'took the round.');
  else if (contenders.length === 2) log(s, w, `took the round, ${top} to ${second[0]}.`);
  else log(s, w, `took the round with ${top}.`);
  if (s.wins[w] === 2) { finish(s, w); return s; }
  s.rolling = activeSeats(s);
  s.turn = isIn(s, from) ? from : nextSeat(s, from);   // whoever rolled last starts the next round
  return s;
}

const dice = {
  name: 'Dice Duel',
  options: () => ({}),
  init(rand, _options, n = 2) {
    return { n, wins: Array(n).fill(0), rolls: Array(n).fill(null), rolling: Array.from({ length: n }, (_, i) => i), rounds: [], out: Array(n).fill(false), turn: rand(n), log: [] };
  },
  apply(state, seat, move, rand) {
    if (move?.type !== 'roll') fail('Roll the dice.');
    const s = diceUp(clone(state));
    if (!s.rolling.includes(seat) || s.rolls[seat]) fail('Wait for your turn to roll.');
    const roll = [1 + rand(6), 1 + rand(6)];
    s.rolls[seat] = roll;
    log(s, seat, `rolled ${roll[0]} and ${roll[1]}.`);
    return diceNext(s, seat);
  },
  remove(state, seat) {
    const s = diceUp(clone(state));
    if (s.over || !isIn(s, seat)) return s;
    s.out[seat] = true;
    s.rolls[seat] = null;
    log(s, seat, 'left the game.');
    const left = activeSeats(s);
    if (left.length === 1) { finish(s, left[0]); return s; }
    // the round may now be complete, or down to one player
    const contenders = s.rolling.filter(i => isIn(s, i));
    if (s.turn === seat || contenders.every(i => s.rolls[i]) || contenders.length === 1) return diceNext(s, s.turn === seat ? seat : s.turn);
    return s;
  },
  view: state => clone(diceUp(state)),
};

// ─── Connect 4 ────────────────────────────────────────────────
// Seven columns, six rows. cols[c] lists the seats of the discs in column c,
// bottom first. Four in a row in any direction wins; a full board is a draw.
const COLS = 7;
const ROWS = 6;

function fourFrom(cols, c, r) {
  const seat = cols[c][r];
  const at = (x, y) => (x >= 0 && x < COLS && y >= 0 ? cols[x][y] : undefined);
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [[c, r]];
    for (const dir of [1, -1]) {
      let x = c + dx * dir;
      let y = r + dy * dir;
      while (at(x, y) === seat) { line.push([x, y]); x += dx * dir; y += dy * dir; }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

const connect4 = {
  name: 'Connect 4',
  options: () => ({}),
  init(rand) {
    return { cols: Array.from({ length: COLS }, () => []), turn: rand(2), last: null, line: null, log: [] };
  },
  apply(state, seat, move) {
    const col = move?.col;
    if (!Number.isInteger(col) || col < 0 || col >= COLS) fail('Pick a column.');
    if (state.cols[col].length >= ROWS) fail('That column is full.');
    const s = clone(state);
    s.cols[col].push(seat);
    const row = s.cols[col].length - 1;
    s.last = [col, row];
    const line = fourFrom(s.cols, col, row);
    if (line) { s.line = line; log(s, seat, 'connected four!'); finish(s, seat); }
    else if (s.cols.every(c => c.length === ROWS)) { log(s, null, 'The board is full. It\'s a draw.'); finish(s, null); }
    else s.turn = other(seat);
    return s;
  },
  view: state => clone(state),
};

// ─── 8-Ball Pool ──────────────────────────────────────────────
// Physics and rules live in pool.mjs; nothing is hidden, every shot is run here.
const pool = makePool({ fail, other, clone, log, finish });

// ─── Go Fish ──────────────────────────────────────────────────
// Seven cards each (five with four or more players). On your turn ask
// another player for a rank you hold: if they have any they hand them all
// over and you go again; if not, go fish, and the turn passes on. Draw the
// rank you asked for and you go again too. Four of a kind makes a book. The
// most books once all 13 are made wins; a tie shares the pot.
function fishUp(s) {   // games saved before bigger tables: two players
  return s.n ? s : { ...s, n: 2, out: [false, false] };
}
const booksMade = s => s.books.reduce((t, b) => t + b.length, 0);

function layBooks(state, seat) {
  const hand = state.hands[seat];
  for (const r of RANKS) {
    if (hand.filter(c => c[0] === r).length === 4) {
      state.hands[seat] = hand.filter(c => c[0] !== r);
      state.books[seat].push(r);
      log(state, seat, `made a book of ${plural(r)}.`);
      return layBooks(state, seat);
    }
  }
  return state;
}

function fishEnd(state) {
  const active = activeSeats(state);
  const top = Math.max(...active.map(i => state.books[i].length));
  const leaders = active.filter(i => state.books[i].length === top);
  if (leaders.length === 1) finish(state, leaders[0]);
  else if (leaders.length === state.n) { log(state, null, 'It\'s a tie.'); finish(state, null); }   // everyone tied: stakes back
  else { log(state, null, `It's a tie between ${leaders.length} players. They share the pot.`); finish(state, null, leaders); }
  return state;
}

// Makes sure whoever is on turn can ask: an empty hand draws one card, or
// passes the turn when the pond is empty. Ends the game when nothing is left.
function fishReady(state) {
  for (let guard = 0; guard < 60 + state.n * 3; guard++) {
    if (booksMade(state) === 13) break;
    const seat = state.turn;
    if (!isIn(state, seat)) { state.turn = nextSeat(state, seat); continue; }
    if (state.hands[seat].length) return state;
    if (state.deck.length) {
      state.hands[seat].push(state.deck.shift());
      log(state, seat, 'drew a card (empty hand).');
      layBooks(state, seat);
      if (state.hands[seat].length) return state;
    } else {
      if (activeSeats(state).every(i => !state.hands[i].length)) break;
      state.turn = nextSeat(state, seat);
    }
  }
  return fishEnd(state);
}

const gofish = {
  name: 'Go Fish',
  options: () => ({}),
  init(rand, _options, n = 2) {
    const deck = shuffledDeck(rand);
    const size = n <= 3 ? 7 : 5;
    const state = {
      n, deck, hands: Array.from({ length: n }, () => deck.splice(0, size)), books: Array.from({ length: n }, () => []),
      out: Array(n).fill(false), turn: rand(n), log: [],
    };
    for (let i = 0; i < n; i++) layBooks(state, i);
    return fishReady(state);
  },
  apply(state, seat, move) {
    const rank = move?.rank;
    if (move?.type !== 'ask' || typeof rank !== 'string' || !RANKS.includes(rank) || rank.length !== 1) fail('Ask for a rank.');
    const s = fishUp(clone(state));
    const targets = activeSeats(s).filter(i => i !== seat);
    let from = move.from;
    if (from === undefined || from === null) {
      if (targets.length !== 1) fail('Pick who to ask.');
      from = targets[0];
    }
    if (!targets.includes(from)) fail('Ask a player who is still in the game.');
    const mine = s.hands[seat];
    if (!mine.some(c => c[0] === rank)) fail('You can only ask for a rank you hold.');
    const two = s.n === 2;
    const asked = two ? `asked for ${plural(rank)}` : `asked {o} for ${plural(rank)}`;
    const theirs = s.hands[from];
    const given = theirs.filter(c => c[0] === rank);
    if (given.length) {
      s.hands[from] = theirs.filter(c => c[0] !== rank);
      mine.push(...given);
      log(s, seat, `${asked} and got ${given.length}.`, from);
    } else if (s.deck.length) {
      const drawn = s.deck.shift();
      mine.push(drawn);
      if (drawn[0] === rank) log(s, seat, `${asked}, went fishing and drew one! They go again.`, from);
      else { log(s, seat, `${asked}. Go fish!`, from); s.turn = nextSeat(s, seat); }
    } else {
      log(s, seat, `${asked}. Go fish, but the pond is empty.`, from);
      s.turn = nextSeat(s, seat);
    }
    layBooks(s, seat);
    return fishReady(s);
  },
  // A player leaves: their cards go back into the pond, shuffled in
  remove(state, seat, rand) {
    const s = fishUp(clone(state));
    if (s.over || !isIn(s, seat)) return s;
    s.out[seat] = true;
    s.deck.push(...s.hands[seat]);
    s.hands[seat] = [];
    shuffle(s.deck, rand);
    log(s, seat, 'left the game. Their cards went back into the pond.');
    const left = activeSeats(s);
    if (left.length === 1) { finish(s, left[0]); return s; }
    if (s.turn === seat) s.turn = nextSeat(s, seat);
    return fishReady(s);
  },
  view(state, seat) {
    const s = fishUp(state);
    const mine = isSeat(s, seat) && isIn(s, seat);
    return {
      n:          s.n,
      hand:       mine ? s.hands[seat] : [],
      handCounts: s.hands.map(h => h.length),
      books:      s.books,
      out:        s.out,
      deckCount:  s.deck.length,
      askable:    mine && s.turn === seat ? [...new Set(s.hands[seat].map(c => c[0]))] : [],
      turn: s.turn, over: !!s.over, winner: s.winner ?? null, draw: !!s.draw, log: s.log,
    };
  },
};

// ─── Poker (Texas Hold'em, 2 to 6 players) ────────────────────
// A freezeout: everyone starts with the same chips, which are just for this
// match; the aura stakes are fixed. No-limit betting with side pots, blinds
// double every few hands so a match stays short, and whoever ends up with
// every chip wins the pot of aura.
export const POKER_START_CHIPS = 1000;
const POKER_BLIND = 10;          // small blind at the start; the big blind is double
const POKER_LEVEL_HANDS = 6;     // blinds double every 6 hands
const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

// [category, tiebreakers...] for exactly five cards; compare with compareScores
function score5(cards) {
  const values = cards.map(c => RANKS.indexOf(c[0]) + 2).sort((a, b) => b - a);
  const flush = cards.every(c => c[1] === cards[0][1]);
  const unique = [...new Set(values)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (values[0] - values[4] === 4) straightHigh = values[0];
    else if (values.join() === '14,5,4,3,2') straightHigh = 5;   // A-2-3-4-5
  }
  const counts = unique.map(v => [values.filter(x => x === v).length, v]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byCount = counts.map(([, v]) => v);
  if (straightHigh && flush) return [8, straightHigh];
  if (counts[0][0] === 4) return [7, ...byCount];
  if (counts[0][0] === 3 && counts[1][0] === 2) return [6, ...byCount];
  if (flush) return [5, ...values];
  if (straightHigh) return [4, straightHigh];
  if (counts[0][0] === 3) return [3, ...byCount];
  if (counts[0][0] === 2 && counts[1][0] === 2) return [2, ...byCount];
  if (counts[0][0] === 2) return [1, ...byCount];
  return [0, ...values];
}

export function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
}

// The best five of up to seven cards: { score, name, cards }
export function bestHand(cards) {
  let best = null;
  const pick = (from, chosen) => {   // every way to choose five of the cards
    if (chosen.length === 5) {
      const score = score5(chosen);
      if (!best || compareScores(score, best.score) > 0) best = { score, cards: chosen };
      return;
    }
    for (let i = from; i <= cards.length - (5 - chosen.length); i++) pick(i + 1, [...chosen, cards[i]]);
  };
  pick(0, []);
  return { ...best, name: HAND_NAMES[best.score[0]] };
}

// A spoken description of a hand: "Pair of kings", "Two pair, jacks and fours"
const VALUE_NAMES = [, , 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
const valueName = v => VALUE_NAMES[v];
const valuePlural = v => (v === 6 ? 'sixes' : `${valueName(v)}s`);
const cap = t => t[0].toUpperCase() + t.slice(1);

export function describeHand(cards) {
  if (cards.length < 5) {   // before the flop: just the two hole cards
    const v = cards.map(c => RANKS.indexOf(c[0]) + 2).sort((a, b) => b - a);
    return v[0] === v[1] ? `Pair of ${valuePlural(v[0])}` : `${cap(valueName(v[0]))} high`;
  }
  const [cat, a, b] = bestHand(cards).score;
  switch (cat) {
    case 8: return a === 14 ? 'Royal flush' : `Straight flush, ${valueName(a)} high`;
    case 7: return `Four ${valuePlural(a)}`;
    case 6: return `Full house, ${valuePlural(a)} over ${valuePlural(b)}`;
    case 5: return `Flush, ${valueName(a)} high`;
    case 4: return `Straight, ${valueName(a)} high`;
    case 3: return `Three ${valuePlural(a)}`;
    case 2: return `Two pair, ${valuePlural(a)} and ${valuePlural(b)}`;
    case 1: return `Pair of ${valuePlural(a)}`;
    default: return `${cap(valueName(a))} high`;
  }
}

// A heads-up game saved before bigger tables. Within a hand both players
// always put the same into the pot on finished streets, so each one's share
// of it is half.
function pokerUp(s) {
  if (s.v === 2) return s;
  const committed = s.hole && !s.over ? [s.pot / 2 + s.bets[0], s.pot / 2 + s.bets[1]] : [0, 0];
  return { ...s, v: 2, n: 2, out: [false, false], folded: [false, false], committed, gone: 0 };
}

const inHand = (s, i) => isIn(s, i) && !s.folded[i];
const canAct = (s, i) => inHand(s, i) && s.chips[i] > 0;
const handSeats = s => allSeats(s).filter(i => inHand(s, i));
const topBet = s => Math.max(0, ...s.bets);
const sum = list => list.reduce((t, v) => t + v, 0);

function pokerPay(s, seat, amount) {
  s.chips[seat] -= amount;
  s.bets[seat] += amount;
  s.committed[seat] += amount;
}

// Who acts next after `from`: someone who can still bet and hasn't acted
// since the last raise or hasn't matched the bet
function pokerToAct(s, from) {
  const top = topBet(s);
  return nextSeat(s, from, i => canAct(s, i) && (!s.acted[i] || s.bets[i] < top));
}

function pokerStartHand(s, rand) {
  s.hand += 1;
  if (s.hand > 1) s.button = nextSeat(s, s.button);
  const live = activeSeats(s);
  const level = Math.floor((s.hand - 1) / POKER_LEVEL_HANDS);
  const sb = POKER_BLIND * 2 ** level;
  s.blinds = [sb, sb * 2];
  s.deck = shuffledDeck(rand);
  s.hole = allSeats(s).map(i => (isIn(s, i) ? s.deck.splice(0, 2) : null));
  s.board = [];
  s.street = 'preflop';
  s.pot = 0;
  s.bets = Array(s.n).fill(0);
  s.committed = Array(s.n).fill(0);
  s.folded = allSeats(s).map(i => !isIn(s, i));
  s.acted = Array(s.n).fill(false);
  // Heads-up the button posts the small blind and acts first before the
  // flop; with more players the two seats after the button post the blinds
  const sbSeat = live.length === 2 ? s.button : nextSeat(s, s.button);
  const bbSeat = nextSeat(s, sbSeat);
  pokerPay(s, sbSeat, Math.min(sb, s.chips[sbSeat]));
  pokerPay(s, bbSeat, Math.min(sb * 2, s.chips[bbSeat]));
  s.minRaise = sb * 2;
  s.turn = nextSeat(s, bbSeat, i => canAct(s, i));
  log(s, null, `Hand ${s.hand}. Blinds ${sb}/${sb * 2}.`);
  return pokerAdvance(s, rand);
}

// Whether this round of betting is done
function pokerSettled(s) {
  const hand = handSeats(s);
  if (hand.length <= 1) return true;
  const top = topBet(s);
  const actors = hand.filter(i => s.chips[i] > 0);
  if (actors.length === 0) return true;
  if (actors.length === 1) return s.bets[actors[0]] >= top;   // nobody left to bet against
  return actors.every(i => s.acted[i] && s.bets[i] === top);
}

// After a hand: anyone out of chips is out of the game; the last one left wins
function pokerNextHand(s, rand) {
  for (const i of allSeats(s)) {
    if (isIn(s, i) && s.chips[i] === 0) {
      s.out[i] = true;
      if (s.n > 2) log(s, i, 'is out of chips.');
    }
  }
  const live = activeSeats(s);
  if (live.length <= 1) {
    finish(s, live[0] ?? null);
    if (live.length) log(s, live[0], 'won every chip!');
    return s;
  }
  return pokerStartHand(s, rand);
}

// Everyone else folded (or left): the last player in the hand takes it all
function pokerFoldWin(s, winner, rand, folded) {
  const pot = s.pot + sum(s.bets);
  s.chips[winner] += pot;
  s.pot = 0;
  s.bets = Array(s.n).fill(0);
  s.last = { hand: s.hand, pot, winners: [winner], won: allSeats(s).map(i => (i === winner ? pot : 0)), board: s.board, showdown: false, folded };
  if (s.n > 2) log(s, winner, `won ${pot}.`);
  return pokerNextHand(s, rand);
}

// Splits what's in the middle into a main pot and side pots by how much each
// player put in, and gives each pot to the best hand among those who
// covered it. Odd chips go to the winners first after the button.
function pokerShowdown(s, rand) {
  while (s.board.length < 5) s.board.push(s.deck.shift());
  s.pot += sum(s.bets);
  s.bets = Array(s.n).fill(0);
  const hand = handSeats(s);
  const best = {};
  for (const i of hand) best[i] = bestHand([...s.hole[i], ...s.board]);

  const pots = [];
  let prev = 0;
  for (const level of [...new Set(s.committed.filter(c => c > 0))].sort((a, b) => a - b)) {
    const amount = sum(s.committed.map(c => Math.max(0, Math.min(c, level) - prev)));
    const eligible = hand.filter(i => s.committed[i] >= level);
    prev = level;
    const last = pots[pots.length - 1];
    if (last && last.eligible.join() === eligible.join()) last.amount += amount;
    else pots.push({ amount, eligible });
  }

  const won = Array(s.n).fill(0);
  const afterButton = i => (i - s.button - 1 + s.n) % s.n;
  for (const { amount, eligible } of pots) {
    const contenders = eligible.length ? eligible : hand;
    let winners = [];
    for (const i of contenders) {
      const c = winners.length ? compareScores(best[i].score, best[winners[0]].score) : 1;
      if (c > 0) winners = [i];
      else if (c === 0) winners.push(i);
    }
    winners.sort((a, b) => afterButton(a) - afterButton(b));
    const share = Math.floor(amount / winners.length);
    let odd = amount - share * winners.length;
    for (const i of winners) {
      const extra = odd > 0 ? 1 : 0;
      odd -= extra;
      s.chips[i] += share + extra;
      won[i] += share + extra;
    }
  }

  const total = s.pot;
  s.pot = 0;
  const winners = hand.filter(i => won[i] > 0);
  if (s.n === 2 && winners.length === 2) log(s, null, `Split pot with ${best[winners[0]].name.toLowerCase()}.`);
  else for (const i of winners) log(s, i, `won ${won[i]} with ${best[i].name.toLowerCase()}.`);
  s.last = {
    hand: s.hand, pot: total, winners, won, board: s.board, showdown: true,
    hole: allSeats(s).map(i => (hand.includes(i) ? s.hole[i] : null)),
    handNames: allSeats(s).map(i => best[i]?.name ?? null),
    described: allSeats(s).map(i => (hand.includes(i) ? describeHand([...s.hole[i], ...s.board]) : null)),
  };
  return pokerNextHand(s, rand);
}

// Moves the hand on once a betting round is settled
function pokerAdvance(s, rand) {
  const hand = handSeats(s);
  if (hand.length === 1) return pokerFoldWin(s, hand[0], rand, null);
  if (!pokerSettled(s)) {
    if (s.turn === null || !canAct(s, s.turn)) s.turn = pokerToAct(s, s.turn ?? s.button);
    return s;
  }
  s.pot += sum(s.bets);
  s.bets = Array(s.n).fill(0);
  const actors = hand.filter(i => s.chips[i] > 0);
  if (s.street === 'river' || actors.length <= 1) return pokerShowdown(s, rand);
  const next = { preflop: ['flop', 3], flop: ['turn', 1], turn: ['river', 1] }[s.street];
  s.street = next[0];
  s.board.push(...s.deck.splice(0, next[1]));
  s.acted = Array(s.n).fill(false);
  s.minRaise = s.blinds[1];
  s.turn = nextSeat(s, s.button, i => canAct(s, i));   // the first player after the button acts first after the flop
  return s;
}

function pokerOptions(s, seat) {
  const top = topBet(s);
  const toCall = Math.max(0, top - s.bets[seat]);
  const maxTo = s.bets[seat] + s.chips[seat];
  const othersCanBet = handSeats(s).some(i => i !== seat && s.chips[i] > 0);
  const canRaise = s.chips[seat] > toCall && othersCanBet;
  return {
    toCall: Math.min(toCall, s.chips[seat]),
    canCheck: toCall === 0,
    canFold:  toCall > 0,
    canRaise,
    minRaiseTo: canRaise ? Math.min(top + s.minRaise, maxTo) : null,
    maxRaiseTo: canRaise ? maxTo : null,
  };
}

const poker = {
  name: 'Poker',
  options: () => ({}),
  init(rand, _options, n = 2) {
    const s = { v: 2, n, chips: Array(n).fill(POKER_START_CHIPS), out: Array(n).fill(false), gone: 0, hand: 0, button: rand(n), last: null, log: [] };
    return pokerStartHand(s, rand);
  },
  apply(state, seat, move, rand) {
    const s = pokerUp(clone(state));
    if (!canAct(s, seat)) fail('You can\'t act right now.');
    const o = pokerOptions(s, seat);
    switch (move?.type) {
      case 'fold': {
        if (!o.canFold) fail('Nothing to fold to. Check instead.');
        s.folded[seat] = true;
        log(s, seat, 'folded.');
        const hand = handSeats(s);
        if (hand.length === 1) return pokerFoldWin(s, hand[0], rand, seat);
        break;
      }
      case 'check':
        if (!o.canCheck) fail(`It's ${o.toCall} to call.`);
        s.acted[seat] = true;
        log(s, seat, 'checked.');
        break;
      case 'call': {
        if (o.canCheck) fail('Nothing to call. Check instead.');
        pokerPay(s, seat, o.toCall);
        s.acted[seat] = true;
        log(s, seat, s.chips[seat] === 0 ? `called all in (${o.toCall}).` : `called ${o.toCall}.`);
        break;
      }
      case 'raise': {
        const to = move.to;
        if (!o.canRaise) fail('You can\'t raise here.');
        if (!Number.isInteger(to) || to < o.minRaiseTo || to > o.maxRaiseTo) {
          fail(`Raise to between ${o.minRaiseTo} and ${o.maxRaiseTo}.`);
        }
        const top = topBet(s);
        if (to - top >= s.minRaise) s.minRaise = to - top;
        pokerPay(s, seat, to - s.bets[seat]);
        s.acted = Array(s.n).fill(false);   // everyone else gets to answer the raise
        s.acted[seat] = true;
        log(s, seat, s.chips[seat] === 0 ? `went all in (${to}).` : `${top === 0 ? 'bet' : 'raised to'} ${to}.`);
        break;
      }
      default:
        fail('Fold, check, call or raise.');
    }
    s.turn = pokerToAct(s, seat);
    return pokerAdvance(s, rand);
  },
  // A player leaves: they fold for good, and their chips leave the table
  remove(state, seat, rand) {
    const s = pokerUp(clone(state));
    if (s.over || !isIn(s, seat)) return s;
    const wasTurn = s.turn === seat;
    s.out[seat] = true;
    s.folded[seat] = true;
    s.gone += s.chips[seat];
    s.chips[seat] = 0;
    log(s, seat, 'left the table.');
    const live = activeSeats(s);
    if (live.length === 1) {
      const w = live[0];
      s.chips[w] += s.pot + sum(s.bets);
      s.pot = 0;
      s.bets = Array(s.n).fill(0);
      finish(s, w);
      log(s, w, 'is the last player at the table!');
      return s;
    }
    const hand = handSeats(s);
    if (hand.length === 1) return pokerFoldWin(s, hand[0], rand, seat);
    if (wasTurn) s.turn = pokerToAct(s, seat);
    return pokerAdvance(s, rand);
  },
  view(state, seat) {
    const s = pokerUp(state);
    const mine = isSeat(s, seat) && isIn(s, seat) && !s.over && !!s.hole?.[seat];
    return {
      n: s.n, chips: s.chips, bets: s.bets, pot: s.pot, board: s.board, out: s.out, folded: s.folded,
      street: s.street, button: s.button, blinds: s.blinds, hand: s.hand,
      dealt: s.over ? allSeats(s).map(() => false) : allSeats(s).map(i => !!s.hole?.[i] && inHand(s, i)),
      hole: mine ? s.hole[seat] : [],
      made: mine ? describeHand([...s.hole[seat], ...s.board]) : null,
      last: s.last,
      options: mine && s.turn === seat ? pokerOptions(s, seat) : null,
      turn: s.turn, over: !!s.over, winner: s.winner ?? null, draw: !!s.draw, log: s.log,
    };
  },
};

export const GAMES = { connect4, pool, gofish, poker, dice, coinflip };

// What a player (their seat) or a spectator (null) may see
export function viewFor(game, state, seat) {
  const view = GAMES[game].view(state, seat);
  // Games with nothing hidden expose their whole state; keep the common fields consistent
  return { ...view, turn: state.turn ?? null, over: !!state.over, winner: state.winner ?? null, draw: !!state.draw, split: state.split ?? null };
}
