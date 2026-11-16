// Chess: the full rules. Pure functions, wrapped into GAMES.chess by
// gameRules.mjs. Seats are assigned colours at random when the game starts.
//
// The board is 64 characters, index = rank * 8 + file with rank 0 being
// white's back rank (a1 = 0, h1 = 7, a8 = 56). Uppercase is white (PNBRQK),
// lowercase black, '.' empty. A move from the app is { from: 'e2', to: 'e4',
// promo?: 'q' | 'r' | 'b' | 'n' }; only legal moves are accepted.
//
// The game ends in checkmate, or a draw by stalemate, the fifty-move rule,
// threefold repetition or too little material to mate.

const FILES = 'abcdefgh';
export const sqName = i => FILES[i % 8] + (Math.floor(i / 8) + 1);
const sqIndex = name => (typeof name === 'string' && /^[a-h][1-8]$/.test(name) ? (Number(name[1]) - 1) * 8 + FILES.indexOf(name[0]) : -1);
const fileOf = i => i % 8;
const rankOf = i => Math.floor(i / 8);
const colorOf = p => (p === '.' ? null : p === p.toUpperCase() ? 'w' : 'b');
const enemy = c => (c === 'w' ? 'b' : 'w');
const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export const START = 'RNBQKBNRPPPPPPPP' + '.'.repeat(32) + 'pppppppprnbqkbnr';

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const at = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);

// Whether square i is attacked by colour `by`
export function attacked(board, i, by) {
  const f = fileOf(i), r = rankOf(i);
  const own = p => p !== '.' && colorOf(p) === by;
  const is = (j, type) => j >= 0 && own(board[j]) && board[j].toLowerCase() === type;
  // pawns attack diagonally forward (from their side)
  const pr = by === 'w' ? r - 1 : r + 1;
  if (is(at(f - 1, pr), 'p') || is(at(f + 1, pr), 'p')) return true;
  for (const [df, dr] of KNIGHT) if (is(at(f + df, r + dr), 'n')) return true;
  for (const [df, dr] of KING) if (is(at(f + df, r + dr), 'k')) return true;
  const ray = (dirs, types) => dirs.some(([df, dr]) => {
    for (let k = 1; k < 8; k++) {
      const j = at(f + df * k, r + dr * k);
      if (j < 0) return false;
      if (board[j] === '.') continue;
      return own(board[j]) && types.includes(board[j].toLowerCase());
    }
    return false;
  });
  return ray(ROOK, 'rq') || ray(BISHOP, 'bq');
}

const kingSquare = (board, c) => board.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (s, c) => attacked(s.board, kingSquare(s.board, c), enemy(c));

// Every move the side `c` could make, before checking it leaves their king safe
function pseudoMoves(s, c) {
  const { board } = s;
  const moves = [];
  const add = (from, to, promo) => moves.push({ from, to, ...(promo && { promo }) });
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === '.' || colorOf(p) !== c) continue;
    const f = fileOf(i), r = rankOf(i);
    const type = p.toLowerCase();
    const target = j => j >= 0 && (board[j] === '.' || colorOf(board[j]) !== c);
    if (type === 'p') {
      const dir = c === 'w' ? 1 : -1;
      const last = c === 'w' ? 7 : 0;
      const pawnTo = (j) => {
        if (rankOf(j) === last) for (const promo of 'qrbn') add(i, j, promo);
        else add(i, j);
      };
      const one = at(f, r + dir);
      if (one >= 0 && board[one] === '.') {
        pawnTo(one);
        const two = at(f, r + 2 * dir);
        if (r === (c === 'w' ? 1 : 6) && board[two] === '.') add(i, two);
      }
      for (const df of [-1, 1]) {
        const j = at(f + df, r + dir);
        if (j < 0) continue;
        if (board[j] !== '.' && colorOf(board[j]) !== c) pawnTo(j);
        else if (j === s.ep) add(i, j);
      }
    } else if (type === 'n' || type === 'k') {
      for (const [df, dr] of type === 'n' ? KNIGHT : KING) {
        const j = at(f + df, r + dr);
        if (target(j)) add(i, j);
      }
      if (type === 'k') {
        // Castling: rights kept, nothing between, and the king doesn't start,
        // pass through or land on an attacked square
        const home = c === 'w' ? 4 : 60;
        const [kSide, qSide] = c === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (i === home && !attacked(board, home, enemy(c))) {
          if (s.castle.includes(kSide) && board[home + 1] === '.' && board[home + 2] === '.'
            && !attacked(board, home + 1, enemy(c)) && !attacked(board, home + 2, enemy(c))) add(i, home + 2);
          if (s.castle.includes(qSide) && board[home - 1] === '.' && board[home - 2] === '.' && board[home - 3] === '.'
            && !attacked(board, home - 1, enemy(c)) && !attacked(board, home - 2, enemy(c))) add(i, home - 2);
        }
      }
    } else {
      const dirs = type === 'r' ? ROOK : type === 'b' ? BISHOP : [...ROOK, ...BISHOP];
      for (const [df, dr] of dirs) {
        for (let k = 1; k < 8; k++) {
          const j = at(f + df * k, r + dr * k);
          if (j < 0) break;
          if (board[j] === '.') { add(i, j); continue; }
          if (colorOf(board[j]) !== c) add(i, j);
          break;
        }
      }
    }
  }
  return moves;
}

// Plays a move on the position: returns the new board, castling rights,
// en passant square and what was captured
export function makeMove(s, m) {
  const b = s.board.split('');
  const p = b[m.from];
  const c = colorOf(p);
  const type = p.toLowerCase();
  let captured = b[m.to] !== '.' ? b[m.to] : null;
  // en passant: the captured pawn sits beside, not on, the target square
  if (type === 'p' && m.to === s.ep && b[m.to] === '.') {
    const victim = m.to + (c === 'w' ? -8 : 8);
    captured = b[victim];
    b[victim] = '.';
  }
  b[m.to] = m.promo ? (c === 'w' ? m.promo.toUpperCase() : m.promo) : p;
  b[m.from] = '.';
  // castling moves the rook too
  if (type === 'k' && Math.abs(m.to - m.from) === 2) {
    const [rf, rt] = m.to > m.from ? [m.from + 3, m.from + 1] : [m.from - 4, m.from - 1];
    b[rt] = b[rf];
    b[rf] = '.';
  }
  let castle = s.castle;
  const drop = flags => { for (const x of flags) castle = castle.replace(x, ''); };
  if (p === 'K') drop('KQ');
  if (p === 'k') drop('kq');
  for (const sq of [m.from, m.to]) {
    if (sq === 0) drop('Q');
    if (sq === 7) drop('K');
    if (sq === 56) drop('q');
    if (sq === 63) drop('k');
  }
  const ep = type === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  return { board: b.join(''), castle, ep, captured, pawnOrCapture: type === 'p' || !!captured };
}

export function legalMoves(s, c = s.side) {
  return pseudoMoves(s, c).filter(m => {
    const next = makeMove(s, m);
    return !attacked(next.board, kingSquare(next.board, c), enemy(c));
  });
}

// Position key for repetition: placement, side to move, castling, and the
// en passant square only when a capture there is actually possible
function positionKey(s) {
  let ep = '-';
  if (s.ep >= 0 && pseudoMoves(s, s.side).some(m => m.to === s.ep && s.board[m.from].toLowerCase() === 'p')) ep = sqName(s.ep);
  return `${s.board}${s.side}${s.castle || '-'}${ep}`;
}

function insufficient(board) {
  const left = board.replace(/[.Kk]/g, '');
  if (left === '') return true;
  if (left.length === 1 && /[nNbB]/.test(left)) return true;
  // bishops only, all on the same colour of square
  if (/^[bB]+$/.test(left)) {
    const shades = new Set();
    for (let i = 0; i < 64; i++) if (/[bB]/.test(board[i])) shades.add((fileOf(i) + rankOf(i)) % 2);
    return shades.size === 1;
  }
  return false;
}

// Short algebraic notation for the move log: "Nf3", "exd5", "O-O", "e8=Q+"
function notation(s, m, after, moves) {
  const p = s.board[m.from];
  const type = p.toLowerCase();
  if (type === 'k' && Math.abs(m.to - m.from) === 2) return m.to > m.from ? 'O-O' : 'O-O-O';
  const capture = s.board[m.to] !== '.' || (type === 'p' && m.to === s.ep);
  let text = '';
  if (type === 'p') text = capture ? FILES[fileOf(m.from)] : '';
  else {
    text = type.toUpperCase();
    // say which one when two of the same piece could go there
    const rivals = moves.filter(o => o.to === m.to && o.from !== m.from && s.board[o.from] === p);
    if (rivals.length) {
      if (!rivals.some(o => fileOf(o.from) === fileOf(m.from))) text += FILES[fileOf(m.from)];
      else if (!rivals.some(o => rankOf(o.from) === rankOf(m.from))) text += rankOf(m.from) + 1;
      else text += sqName(m.from);
    }
  }
  text += (capture ? 'x' : '') + sqName(m.to) + (m.promo ? `=${m.promo.toUpperCase()}` : '');
  return text + after;
}

export function makeChess({ fail, clone, log, finish }) {
  return {
    name: 'Chess',
    options: () => ({}),
    init(rand) {
      const white = rand(2);
      const s = { board: START, side: 'w', white, castle: 'KQkq', ep: -1, half: 0, full: 1, reps: {}, last: null, captured: { w: [], b: [] }, check: false, moves: 0, turn: white, log: [] };
      s.reps[positionKey(s)] = 1;
      return s;
    },
    apply(state, seat, move) {
      const s = clone(state);
      const from = sqIndex(move?.from), to = sqIndex(move?.to);
      if (from < 0 || to < 0) fail('Pick a piece and a square.');
      const promo = move.promo;
      if (promo !== undefined && !['q', 'r', 'b', 'n'].includes(promo)) fail('Promote to a queen, rook, bishop or knight.');
      const moves = legalMoves(s);
      const m = moves.find(x => x.from === from && x.to === to && (x.promo ?? null) === (promo ?? (x.promo ? 'q' : null)));
      if (!m) fail(moves.some(x => x.from === from) ? 'That piece can\'t move there.' : 'That isn\'t a legal move.');
      const mover = s.side;
      const next = makeMove(s, m);
      if (next.captured) s.captured[mover].push(next.captured);
      s.board = next.board;
      s.castle = next.castle;
      s.ep = next.ep;
      s.half = next.pawnOrCapture ? 0 : s.half + 1;
      if (mover === 'b') s.full += 1;
      s.side = enemy(mover);
      s.last = [from, to];
      s.moves += 1;
      const replies = legalMoves(s);
      s.check = inCheck(s, s.side);
      const mate = s.check && !replies.length;
      log(s, seat, `played ${notation(state, m, mate ? '#' : s.check ? '+' : '', moves)}.`);
      const key = positionKey(s);
      s.reps[key] = (s.reps[key] ?? 0) + 1;
      if (mate) { log(s, seat, 'checkmate!'); finish(s, seat); return s; }
      if (!replies.length) { log(s, null, 'Stalemate. It\'s a draw.'); finish(s, null); return s; }
      if (s.reps[key] >= 3) { log(s, null, 'The same position three times. It\'s a draw.'); finish(s, null); return s; }
      if (s.half >= 100) { log(s, null, 'Fifty moves without a capture or a pawn move. It\'s a draw.'); finish(s, null); return s; }
      if (insufficient(s.board)) { log(s, null, 'Not enough pieces left to checkmate. It\'s a draw.'); finish(s, null); return s; }
      s.turn = 1 - seat;
      return s;
    },
    // Whether a seat still has the pieces to checkmate (a flag only wins if so)
    canWin(state, seat) {
      const color = seat === state.white ? 'w' : 'b';
      const left = [...state.board].filter(p => p !== '.' && colorOf(p) === color && p.toLowerCase() !== 'k');
      return !(left.length === 0 || (left.length === 1 && 'nb'.includes(left[0].toLowerCase())));
    },
    view(state, seat) {
      const mine = (seat === 0 || seat === 1) && state.turn === seat && !state.over;
      return {
        board: state.board, side: state.side, white: state.white, last: state.last, check: !!state.check,
        captured: state.captured, moves: state.moves,
        legal: mine ? legalMoves(state).map(m => sqName(m.from) + sqName(m.to) + (m.promo ?? '')) : [],
        log: state.log,
      };
    },
  };
}

// Counts the positions reachable in `depth` moves: the standard check that a
// move generator is exactly right (used by the tests)
export function perft(s, depth) {
  if (depth === 0) return 1;
  let total = 0;
  for (const m of legalMoves(s)) {
    const next = makeMove(s, m);
    total += perft({ ...s, board: next.board, castle: next.castle, ep: next.ep, side: enemy(s.side) }, depth - 1);
  }
  return total;
}

export { PIECE_NAMES };
