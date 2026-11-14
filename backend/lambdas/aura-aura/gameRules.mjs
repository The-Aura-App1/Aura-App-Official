// Rules for the group games. Pure functions only: no database, no clock.
// The server owns every shuffle, roll and flip (rand comes from crypto in
// games.mjs), checks every move here, and only ever sends a player
// view(state, seat), which hides the deck and the other player's cards.
//
// Every game is two players, seats 0 (the challenger) and 1. Each state has:
//   turn    seat to move, or null once the game is over
//   over    true when finished; winner is a seat, or null with draw: true
//   log     the last few public events, { s: seat | null, t: text }

export class GameError extends Error {}

const fail = message => { throw new GameError(message); };
const other = seat => 1 - seat;
const clone = value => JSON.parse(JSON.stringify(value));
const LOG_SIZE = 12;

function log(state, seat, text) {
  state.log = [...(state.log ?? []), { s: seat, t: text }].slice(-LOG_SIZE);
}

function finish(state, winner) {
  state.over   = true;
  state.turn   = null;
  state.winner = winner;
  state.draw   = winner === null;
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

function shuffledDeck(rand) {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const isCard = c => typeof c === 'string' && c.length === 2 && RANKS.includes(c[0]) && SUITS.includes(c[1]);

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
// Best of three rounds. Each round both players roll two dice; the higher
// total takes the round, and a tie replays it.
const dice = {
  name: 'Dice Duel',
  options: () => ({}),
  init(rand) {
    return { wins: [0, 0], rolls: [null, null], rounds: [], turn: rand(2), log: [] };
  },
  apply(state, seat, move, rand) {
    if (move?.type !== 'roll') fail('Roll the dice.');
    const s = clone(state);
    const roll = [1 + rand(6), 1 + rand(6)];
    s.rolls[seat] = roll;
    log(s, seat, `rolled ${roll[0]} and ${roll[1]}.`);
    if (!s.rolls[other(seat)]) { s.turn = other(seat); return s; }

    const totals = s.rolls.map(r => r[0] + r[1]);
    const roundWinner = totals[0] === totals[1] ? null : (totals[0] > totals[1] ? 0 : 1);
    s.rounds.push({ rolls: s.rolls, winner: roundWinner });
    s.rolls = [null, null];
    if (roundWinner === null) {
      log(s, null, `Tie at ${totals[0]}. Roll again.`);
    } else {
      s.wins[roundWinner] += 1;
      log(s, roundWinner, `took the round, ${totals[roundWinner]} to ${totals[other(roundWinner)]}.`);
    }
    if (roundWinner !== null && s.wins[roundWinner] === 2) finish(s, roundWinner);
    else s.turn = seat;   // whoever rolled second starts the next round
    return s;
  },
  view: state => clone(state),
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

// ─── Crazy Eights ─────────────────────────────────────────────
// Seven cards each. Play a card that matches the top card's rank or the suit
// in play; an eight is wild and names the next suit. Can't (or won't) play?
// Draw one, then play it or pass. First to empty their hand wins. If the
// deck runs dry and both players pass, the smaller hand wins.
function crazyPlayable(state, card) {
  const top = state.discard[state.discard.length - 1];
  return card[0] === '8' || card[0] === top[0] || card[1] === state.suit;
}

function crazyCanDraw(state) {
  return state.deck.length > 0 || state.discard.length > 1;
}

const crazy8s = {
  name: 'Crazy Eights',
  options: () => ({}),
  init(rand) {
    const deck = shuffledDeck(rand);
    const hands = [deck.splice(0, 7), deck.splice(0, 7)];
    // The starting card is never an eight
    let start = deck.shift();
    while (start[0] === '8') { deck.push(start); start = deck.shift(); }
    return { deck, hands, discard: [start], suit: start[1], turn: rand(2), drew: false, stuck: 0, log: [] };
  },
  apply(state, seat, move, rand) {
    const s = clone(state);
    const hand = s.hands[seat];
    if (move?.type === 'play') {
      if (!isCard(move.card) || !hand.includes(move.card)) fail('You don\'t have that card.');
      if (!crazyPlayable(s, move.card)) fail('That card doesn\'t match the rank or the suit.');
      if (move.card[0] === '8' && !SUITS.includes(move.suit)) fail('Pick a suit for your eight.');
      hand.splice(hand.indexOf(move.card), 1);
      s.discard.push(move.card);
      s.suit = move.card[0] === '8' ? move.suit : move.card[1];
      s.drew = false;
      s.stuck = 0;
      log(s, seat, move.card[0] === '8'
        ? `played the ${cardName(move.card)} and picked ${SUIT_NAMES[s.suit]}.`
        : `played the ${cardName(move.card)}.`);
      if (!hand.length) { log(s, seat, 'played the last card in hand!'); finish(s, seat); return s; }
      s.turn = other(seat);
      return s;
    }
    if (move?.type === 'draw') {
      if (s.drew) fail('You already drew. Play a card or pass.');
      if (!s.deck.length) {
        if (!crazyCanDraw(s)) fail('There is nothing left to draw. Pass instead.');
        // Reshuffle everything under the top card into a new deck
        const top = s.discard.pop();
        const rest = s.discard;
        for (let i = rest.length - 1; i > 0; i--) { const j = rand(i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }
        s.deck = rest;
        s.discard = [top];
        log(s, null, 'The discard pile was shuffled into a new deck.');
      }
      hand.push(s.deck.shift());
      s.drew = true;
      log(s, seat, 'drew a card.');
      return s;
    }
    if (move?.type === 'pass') {
      const dry = !crazyCanDraw(s);
      if (!s.drew && !dry) fail('Draw a card before passing.');
      s.drew = false;
      log(s, seat, 'passed.');
      if (dry) {
        s.stuck += 1;
        if (s.stuck >= 2) {
          const [a, b] = s.hands.map(h => h.length);
          log(s, null, 'Nobody can play. The smaller hand wins.');
          finish(s, a === b ? null : (a < b ? 0 : 1));
          return s;
        }
      }
      s.turn = other(seat);
      return s;
    }
    fail('Play a card, draw, or pass.');
  },
  view(state, seat) {
    const mine = seat === 0 || seat === 1;
    const myTurn = mine && state.turn === seat;
    return {
      hand:       mine ? state.hands[seat] : [],
      handCounts: state.hands.map(h => h.length),
      top:        state.discard[state.discard.length - 1],
      suit:       state.suit,
      deckCount:  state.deck.length,
      drew:       state.drew,
      canDraw:    myTurn && !state.drew && crazyCanDraw(state),
      canPass:    myTurn && (state.drew || !crazyCanDraw(state)),
      playable:   myTurn ? state.hands[seat].filter(c => crazyPlayable(state, c)) : [],
      // Everyone sees the hands once the game is over
      hands:      state.over ? state.hands : undefined,
      turn: state.turn, over: !!state.over, winner: state.winner ?? null, draw: !!state.draw, log: state.log,
    };
  },
};

// ─── Go Fish ──────────────────────────────────────────────────
// Seven cards each. On your turn ask for a rank you hold: if the other
// player has any they hand them all over and you go again; if not, go fish.
// Draw the rank you asked for and you go again too. Four of a kind makes a
// book. The most books once all 13 are made wins.
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

// Makes sure whoever is on turn can ask: an empty hand draws one card, or
// passes the turn when the deck is gone. Ends the game when nothing is left.
function fishReady(state) {
  for (let guard = 0; guard < 4; guard++) {
    if (state.books[0].length + state.books[1].length === 13) break;
    const seat = state.turn;
    if (state.hands[seat].length) return state;
    if (state.deck.length) {
      state.hands[seat].push(state.deck.shift());
      log(state, seat, 'drew a card (empty hand).');
      layBooks(state, seat);
      if (state.hands[seat].length) return state;
    } else {
      state.turn = other(seat);
    }
  }
  const [a, b] = state.books.map(x => x.length);
  finish(state, a === b ? null : (a > b ? 0 : 1));
  return state;
}

const gofish = {
  name: 'Go Fish',
  options: () => ({}),
  init(rand) {
    const deck = shuffledDeck(rand);
    const state = { deck, hands: [deck.splice(0, 7), deck.splice(0, 7)], books: [[], []], turn: rand(2), log: [] };
    layBooks(state, 0);
    layBooks(state, 1);
    return fishReady(state);
  },
  apply(state, seat, move) {
    const rank = move?.rank;
    if (move?.type !== 'ask' || typeof rank !== 'string' || !RANKS.includes(rank) || rank.length !== 1) fail('Ask for a rank.');
    const s = clone(state);
    const mine = s.hands[seat];
    if (!mine.some(c => c[0] === rank)) fail('You can only ask for a rank you hold.');
    const theirs = s.hands[other(seat)];
    const given = theirs.filter(c => c[0] === rank);
    if (given.length) {
      s.hands[other(seat)] = theirs.filter(c => c[0] !== rank);
      mine.push(...given);
      log(s, seat, `asked for ${plural(rank)} and got ${given.length}.`);
    } else if (s.deck.length) {
      const drawn = s.deck.shift();
      mine.push(drawn);
      if (drawn[0] === rank) log(s, seat, `asked for ${plural(rank)}, went fishing and drew one! They go again.`);
      else { log(s, seat, `asked for ${plural(rank)}. Go fish!`); s.turn = other(seat); }
    } else {
      log(s, seat, `asked for ${plural(rank)}. Go fish, but the pond is empty.`);
      s.turn = other(seat);
    }
    layBooks(s, seat);
    return fishReady(s);
  },
  view(state, seat) {
    const mine = seat === 0 || seat === 1;
    return {
      hand:       mine ? state.hands[seat] : [],
      handCounts: state.hands.map(h => h.length),
      books:      state.books,
      deckCount:  state.deck.length,
      askable:    mine && state.turn === seat ? [...new Set(state.hands[seat].map(c => c[0]))] : [],
      turn: state.turn, over: !!state.over, winner: state.winner ?? null, draw: !!state.draw, log: state.log,
    };
  },
};

// ─── Poker (heads-up Texas Hold'em) ───────────────────────────
// A freezeout: both players start with the same chips, which are just for
// this match; the aura stakes are fixed. No-limit betting, blinds double
// every few hands so a match stays short, and whoever ends up with every
// chip wins the pot of aura.
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
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const five = cards.filter((_, i) => i !== a && i !== b);
    if (five.length !== 5) continue;
    const score = score5(five);
    if (!best || compareScores(score, best.score) > 0) best = { score, cards: five };
  }
  if (n === 5) best = { score: score5(cards), cards };
  return { ...best, name: HAND_NAMES[best.score[0]] };
}

function pokerStartHand(s, rand) {
  s.hand += 1;
  if (s.hand > 1) s.button = other(s.button);
  const level = Math.floor((s.hand - 1) / POKER_LEVEL_HANDS);
  const sb = POKER_BLIND * 2 ** level;
  s.blinds = [sb, sb * 2];
  s.deck = shuffledDeck(rand);
  s.hole = [s.deck.splice(0, 2), s.deck.splice(0, 2)];
  s.board = [];
  s.street = 'preflop';
  s.pot = 0;
  s.bets = [0, 0];
  // Heads-up: the button posts the small blind and acts first before the flop
  const bb = other(s.button);
  s.bets[s.button] = Math.min(sb, s.chips[s.button]);
  s.chips[s.button] -= s.bets[s.button];
  s.bets[bb] = Math.min(sb * 2, s.chips[bb]);
  s.chips[bb] -= s.bets[bb];
  s.acted = [false, false];
  s.minRaise = sb * 2;
  s.turn = s.button;
  log(s, null, `Hand ${s.hand}. Blinds ${sb}/${sb * 2}.`);
  return pokerAdvance(s, rand);
}

// Whether this round of betting is done. Settles an all-in that the other
// player covered by giving back the part nobody could match.
function pokerSettled(s) {
  const allIn = s.chips.map(c => c === 0);
  if (allIn[0] || allIn[1]) {
    for (const i of [0, 1]) {
      const j = other(i);
      if (allIn[i] && s.bets[j] > s.bets[i]) { s.chips[j] += s.bets[j] - s.bets[i]; s.bets[j] = s.bets[i]; }
    }
    for (const j of [0, 1]) if (!allIn[j] && s.bets[j] < s.bets[other(j)]) return false;
    return true;
  }
  return s.acted[0] && s.acted[1] && s.bets[0] === s.bets[1];
}

function pokerAward(s, winners, rand, summary) {
  const pot = s.pot + s.bets[0] + s.bets[1];
  s.pot = 0;
  s.bets = [0, 0];
  if (winners.length === 2) {
    const half = Math.floor(pot / 2);
    s.chips[s.button] += half;
    s.chips[other(s.button)] += pot - half;   // the odd chip goes to the big blind
  } else {
    s.chips[winners[0]] += pot;
  }
  s.last = { hand: s.hand, pot, winners, board: s.board, ...summary };
  if (s.chips[0] === 0 || s.chips[1] === 0) {
    finish(s, s.chips[0] === 0 ? 1 : 0);
    log(s, s.winner, 'won every chip!');
    return s;
  }
  return pokerStartHand(s, rand);
}

function pokerShowdown(s, rand) {
  while (s.board.length < 5) s.board.push(s.deck.shift());
  const hands = s.hole.map(h => bestHand([...h, ...s.board]));
  const cmp = compareScores(hands[0].score, hands[1].score);
  const winners = cmp === 0 ? [0, 1] : [cmp > 0 ? 0 : 1];
  if (winners.length === 2) log(s, null, `Split pot with ${hands[0].name.toLowerCase()}.`);
  else log(s, winners[0], `won ${s.pot + s.bets[0] + s.bets[1]} with ${hands[winners[0]].name.toLowerCase()}.`);
  return pokerAward(s, winners, rand, { showdown: true, hole: s.hole, handNames: hands.map(h => h.name) });
}

// Moves the hand on once a betting round is settled
function pokerAdvance(s, rand) {
  if (!pokerSettled(s)) return s;
  s.pot += s.bets[0] + s.bets[1];
  s.bets = [0, 0];
  if (s.street === 'river' || s.chips[0] === 0 || s.chips[1] === 0) return pokerShowdown(s, rand);
  const next = { preflop: ['flop', 3], flop: ['turn', 1], turn: ['river', 1] }[s.street];
  s.street = next[0];
  s.board.push(...s.deck.splice(0, next[1]));
  s.acted = [false, false];
  s.minRaise = s.blinds[1];
  s.turn = other(s.button);   // the big blind acts first after the flop
  return s;
}

function pokerOptions(s, seat) {
  const opp = other(seat);
  const toCall = Math.max(0, s.bets[opp] - s.bets[seat]);
  const maxTo = s.bets[seat] + s.chips[seat];
  const canRaise = s.chips[seat] > toCall && s.chips[opp] > 0;
  return {
    toCall: Math.min(toCall, s.chips[seat]),
    canCheck: toCall === 0,
    canFold:  toCall > 0,
    canRaise,
    minRaiseTo: canRaise ? Math.min(s.bets[opp] + s.minRaise, maxTo) : null,
    maxRaiseTo: canRaise ? maxTo : null,
  };
}

const poker = {
  name: 'Poker',
  options: () => ({}),
  init(rand) {
    const s = { chips: [POKER_START_CHIPS, POKER_START_CHIPS], hand: 0, button: rand(2), last: null, log: [] };
    return pokerStartHand(s, rand);
  },
  apply(state, seat, move, rand) {
    const s = clone(state);
    const opp = other(seat);
    const o = pokerOptions(s, seat);
    switch (move?.type) {
      case 'fold':
        if (!o.canFold) fail('Nothing to fold to. Check instead.');
        log(s, seat, 'folded.');
        return pokerAward(s, [opp], rand, { showdown: false, folded: seat });
      case 'check':
        if (!o.canCheck) fail(`It's ${o.toCall} to call.`);
        s.acted[seat] = true;
        log(s, seat, 'checked.');
        break;
      case 'call': {
        if (o.canCheck) fail('Nothing to call. Check instead.');
        s.chips[seat] -= o.toCall;
        s.bets[seat] += o.toCall;
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
        const increase = to - s.bets[opp];
        if (increase >= s.minRaise) s.minRaise = increase;
        s.chips[seat] -= to - s.bets[seat];
        s.bets[seat] = to;
        s.acted = [false, false];
        s.acted[seat] = true;
        const verb = s.bets[opp] === 0 ? 'bet' : 'raised to';
        log(s, seat, s.chips[seat] === 0 ? `went all in (${to}).` : `${verb} ${to}.`);
        break;
      }
      default:
        fail('Fold, check, call or raise.');
    }
    s.turn = opp;
    return pokerAdvance(s, rand);
  },
  view(state, seat) {
    const mine = seat === 0 || seat === 1;
    return {
      chips: state.chips, bets: state.bets, pot: state.pot, board: state.board,
      street: state.street, button: state.button, blinds: state.blinds, hand: state.hand,
      hole: mine && !state.over ? state.hole[seat] : [],
      last: state.last,
      options: mine && state.turn === seat ? pokerOptions(state, seat) : null,
      turn: state.turn, over: !!state.over, winner: state.winner ?? null, draw: !!state.draw, log: state.log,
    };
  },
};

export const GAMES = { connect4, crazy8s, gofish, poker, dice, coinflip };

// What a player (seat 0/1) or a spectator (null) may see
export function viewFor(game, state, seat) {
  const view = GAMES[game].view(state, seat);
  // Games with nothing hidden expose their whole state; keep the common fields consistent
  return { ...view, turn: state.turn ?? null, over: !!state.over, winner: state.winner ?? null, draw: !!state.draw };
}
