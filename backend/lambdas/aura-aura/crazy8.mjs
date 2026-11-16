// Crazy 8: the card game. Pure functions, wrapped into GAMES.crazy8 by
// gameRules.mjs. 2 to 4 players.
//
// Seven cards each (five with three or more players), one face up to start
// the pile. On your turn play a card that matches the top card's suit or
// rank. 8s are wild: play one any time and name the suit to follow. A 2
// makes the next player draw two and miss their turn; a jack skips the next
// player. Can't (or don't want to) play? Draw one; then play a card or pass.
// The first to empty their hand wins. If the draw pile runs out the played
// cards are shuffled back in. After 500 turns the fewest cards wins.
//
// Moves: { type: 'play', card: 'Qh', suit?: 's' | 'h' | 'd' | 'c' (after an 8) },
// { type: 'draw' }, { type: 'pass' }.

const SUITS = 'shdc';
const SUIT_NAMES = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK_NAMES = { T: '10', J: 'jack', Q: 'queen', K: 'king', A: 'ace' };
const cardName = c => `${RANK_NAMES[c[0]] ?? c[0]} of ${SUIT_NAMES[c[1]]}`;
const MAX_TURNS = 500;

export function makeCrazy8({ fail, clone, log, finish, shuffle, shuffledDeck, activeSeats, nextSeat, isIn, isSeat }) {
  const top = s => s.discard[s.discard.length - 1];
  const playable = (s, c) => c[0] === '8' || c[0] === top(s)[0] || c[1] === s.suit;

  // Draws n cards for a seat, shuffling the played cards back in if the pile runs dry
  function draw(s, seat, n) {
    let got = 0;
    for (let k = 0; k < n; k++) {
      if (!s.deck.length && s.discard.length > 1) {
        const keep = s.discard.pop();
        s.deck = shuffle(s.discard, s.rand);
        s.discard = [keep];
        log(s, null, 'The pile was shuffled back in.');
      }
      if (!s.deck.length) break;
      s.hands[seat].push(s.deck.shift());
      got++;
    }
    return got;
  }

  function endByCount(s) {
    const active = activeSeats(s);
    const fewest = Math.min(...active.map(i => s.hands[i].length));
    const leaders = active.filter(i => s.hands[i].length === fewest);
    log(s, null, `${MAX_TURNS} turns. The fewest cards wins.`);
    if (leaders.length === 1) finish(s, leaders[0]);
    else if (leaders.length === s.n) finish(s, null);
    else finish(s, null, leaders);
    return s;
  }

  function passTurn(s, to) {
    s.turn = to;
    s.drew = false;
    s.turns += 1;
    if (s.turns >= MAX_TURNS) endByCount(s);
    return s;
  }

  // shuffle needs a source of randomness; it's kept off the saved state
  const withRand = (s, rand) => Object.defineProperty(s, 'rand', { value: rand, enumerable: false, configurable: true });

  return {
    name: 'Crazy 8',
    options: () => ({}),
    init(rand, _options, n = 2) {
      const deck = shuffledDeck(rand);
      const size = n === 2 ? 7 : 5;
      const s = { n, deck, hands: Array.from({ length: n }, () => deck.splice(0, size)), discard: [], suit: null, out: Array(n).fill(false), drew: false, turns: 0, turn: rand(n), log: [] };
      // the starting card is never an 8
      let i = s.deck.findIndex(c => c[0] !== '8');
      const first = s.deck.splice(i, 1)[0];
      s.discard.push(first);
      s.suit = first[1];
      log(s, null, `The first card is the ${cardName(first)}.`);
      return s;
    },
    apply(state, seat, move, rand) {
      const s = withRand(clone(state), rand);
      const hand = s.hands[seat];
      switch (move?.type) {
        case 'play': {
          const card = move.card;
          if (typeof card !== 'string' || !hand.includes(card)) fail('Play a card from your hand.');
          if (!playable(s, card)) fail(`Match the ${SUIT_NAMES[s.suit]} or the ${RANK_NAMES[top(s)[0]] ?? top(s)[0]}, or play an 8.`);
          let suit = card[1];
          if (card[0] === '8') {
            suit = move.suit;
            if (typeof suit !== 'string' || !SUITS.includes(suit) || suit.length !== 1) fail('Pick the suit to follow.');
          }
          s.hands[seat] = hand.filter(c => c !== card);
          s.discard.push(card);
          s.suit = suit;
          if (card[0] === '8') log(s, seat, `played the ${cardName(card)} and picked ${SUIT_NAMES[suit]}.`);
          else log(s, seat, `played the ${cardName(card)}.`);
          if (!s.hands[seat].length) { log(s, seat, 'is out of cards and wins!'); finish(s, seat); return s; }
          if (s.hands[seat].length === 1) log(s, seat, 'has one card left!');
          const next = nextSeat(s, seat);
          if (card[0] === '2') {
            const got = draw(s, next, 2);
            log(s, next, `drew ${got} and misses a turn.`);
            return passTurn(s, nextSeat(s, next));
          }
          if (card[0] === 'J') {
            log(s, next, 'is skipped.');
            return passTurn(s, nextSeat(s, next));
          }
          return passTurn(s, next);
        }
        case 'draw': {
          if (s.drew) fail('You already drew. Play a card or pass.');
          const got = draw(s, seat, 1);
          s.drew = true;
          log(s, seat, got ? 'drew a card.' : 'had nothing to draw.');
          return s;
        }
        case 'pass':
          if (!s.drew) fail('Draw a card first.');
          log(s, seat, 'passed.');
          return passTurn(s, nextSeat(s, seat));
        default:
          fail('Play a card, draw or pass.');
      }
      return s;
    },
    // A player leaves: their cards go back into the draw pile
    remove(state, seat, rand) {
      const s = withRand(clone(state), rand);
      if (s.over || !isIn(s, seat)) return s;
      s.out[seat] = true;
      s.deck = shuffle([...s.deck, ...s.hands[seat]], rand);
      s.hands[seat] = [];
      log(s, seat, 'left the game. Their cards went back into the pile.');
      const left = activeSeats(s);
      if (left.length === 1) { finish(s, left[0]); return s; }
      if (s.turn === seat) { s.turn = nextSeat(s, seat); s.drew = false; }
      return s;
    },
    view(state, seat) {
      const mine = isSeat(state, seat) && isIn(state, seat);
      const myTurn = mine && state.turn === seat && !state.over;
      return {
        n: state.n,
        hand: mine ? state.hands[seat] : [],
        handCounts: state.hands.map(h => h.length),
        top: top(state),
        suit: state.suit,
        deckCount: state.deck.length,
        out: state.out,
        playable: myTurn ? state.hands[seat].filter(c => playable(state, c)) : [],
        canDraw: myTurn && !state.drew,
        canPass: myTurn && state.drew,
        turn: state.turn, over: !!state.over, winner: state.winner ?? null, draw: !!state.draw, log: state.log,
      };
    },
  };
}
