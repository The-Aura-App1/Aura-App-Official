import React, { useEffect, useRef, useState } from 'react';
import { PenLine, X } from 'lucide-react';
import { clockFace } from './gameInfo';
import './games.css';
import ChessPiece from './ChessPiece';

// Chess. The board turns so your pieces are at the bottom (white for
// spectators). Tap a piece and then a square, or drag it there. Your move
// shows at once while the server checks it, and a move made while the other
// player is thinking is a premove: it's played the moment your turn comes,
// if it's legal then. Right-click and drag (or turn on Arrows on a phone) to
// draw arrows and rings for planning; any normal click clears them. The
// server sends the legal moves for whoever is on turn, so the board never
// decides what's legal on its own.
const FILES = 'abcdefgh';
const sqName = i => FILES[i % 8] + (Math.floor(i / 8) + 1);
const sqIndex = name => (Number(name[1]) - 1) * 8 + FILES.indexOf(name[0]);
// Solid glyphs for both colours, coloured with CSS; U+FE0E keeps them as text, not emoji
const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const colorOf = p => (p === '.' ? null : p === p.toUpperCase() ? 'w' : 'b');

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// Where a piece could go by its shape alone, ignoring what's in the way:
// the squares a premove may aim at (it's checked for real when it's played)
export function premoveTargets(board, from) {
  const p = board[from];
  if (!p || p === '.') return [];
  const type = p.toLowerCase();
  const white = colorOf(p) === 'w';
  const f = from % 8, r = Math.floor(from / 8);
  const out = [];
  const add = (df, dr) => {
    const nf = f + df, nr = r + dr;
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && colorOf(board[nr * 8 + nf]) !== colorOf(p)) out.push(nr * 8 + nf);
  };
  // a premove may land on its own side's piece only if that piece could be taken first, so own squares stay off
  if (type === 'p') {
    const d = white ? 1 : -1;
    add(0, d);
    if (r === (white ? 1 : 6)) add(0, 2 * d);
    add(-1, d); add(1, d);
  } else if (type === 'n') KNIGHT.forEach(([a, b]) => add(a, b));
  else if (type === 'k') {
    KING.forEach(([a, b]) => add(a, b));
    if (f === 4 && r === (white ? 0 : 7)) { add(2, 0); add(-2, 0); }
  } else {
    const dirs = type === 'r' ? ROOK : type === 'b' ? BISHOP : [...ROOK, ...BISHOP];
    for (const [df, dr] of dirs) for (let k = 1; k < 8; k++) add(df * k, dr * k);
  }
  return out;
}

// The board after a move, for showing it before the server confirms:
// castling moves the rook, en passant takes the pawn beside, a pawn promotes
export function playLocal(board, { from, to, promo }) {
  const b = board.split('');
  const p = b[from];
  const type = p.toLowerCase();
  if (type === 'p' && from % 8 !== to % 8 && b[to] === '.') b[to + (colorOf(p) === 'w' ? -8 : 8)] = '.';
  if (type === 'k' && Math.abs(to - from) === 2) {
    const [rf, rt] = to > from ? [from + 3, from + 1] : [from - 4, from - 1];
    b[rt] = b[rf];
    b[rf] = '.';
  }
  b[to] = promo ? (colorOf(p) === 'w' ? promo.toUpperCase() : promo) : p;
  b[from] = '.';
  return b.join('');
}

function Piece({ p, slide, faded }) {
  const white = p === p.toUpperCase();
  return (
    <span className={`absolute inset-0 flex items-center justify-center pointer-events-none ${slide ? 'chess-slide' : ''}`}
      style={slide ? { '--dx': `${slide[0] * 100}%`, '--dy': `${slide[1] * 100}%` } : undefined} aria-hidden="true">
      <ChessPiece p={p} className={`chess-on-board ${faded ? 'opacity-30' : ''}`} />
    </span>
  );
}

function Captured({ pieces, lead }) {
  if (!pieces.length && !lead) return <div className="h-6" />;
  const sorted = [...pieces].sort((a, b) => (VALUE[b.toLowerCase()] ?? 0) - (VALUE[a.toLowerCase()] ?? 0));
  return (
    <div className="h-6 flex items-center gap-0.5 text-lg leading-none min-w-0 overflow-hidden" aria-label={`Captured: ${sorted.map(p => NAME[p.toLowerCase()]).join(', ') || 'none'}`}>
      {sorted.map((p, i) => <ChessPiece key={i} p={p} className="chess-mini" />)}
      {lead > 0 && <span className="ml-1 text-xs font-semibold text-[var(--text-muted)]">+{lead}</span>}
    </div>
  );
}

function Clock({ ms, running, label }) {
  const low = ms < 20000;
  return (
    <span role="timer" aria-label={`${label}: ${clockFace(ms)} left`}
      className={`chess-clock tabular-nums ${running ? 'chess-clock-on' : ''} ${running && low ? 'chess-clock-low' : ''}`}>
      {clockFace(ms)}
    </span>
  );
}

// Arrows and rings drawn for planning, over the board (one unit per square)
function Plans({ arrows, at }) {
  if (!arrows.length) return null;
  return (
    <svg viewBox="0 0 8 8" className="absolute inset-0 w-full h-full pointer-events-none z-[3]" aria-hidden="true">
      <defs>
        <marker id="chess-arrowhead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--chess-arrow)" />
        </marker>
      </defs>
      {arrows.map(({ from, to }) => {
        const [x1, y1] = at(from), [x2, y2] = at(to);
        if (from === to) return <circle key={`${from}-${to}`} cx={x1} cy={y1} r="0.44" fill="none" stroke="var(--chess-arrow)" strokeWidth="0.08" />;
        // stop short so the head sits inside the target square
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ex = x2 - ((x2 - x1) / len) * 0.32, ey = y2 - ((y2 - y1) / len) * 0.32;
        return <line key={`${from}-${to}`} x1={x1} y1={y1} x2={ex} y2={ey} stroke="var(--chess-arrow)" strokeWidth="0.17" strokeLinecap="round" markerEnd="url(#chess-arrowhead)" />;
      })}
    </svg>
  );
}

export default function ChessBoard({ view, seat, players, move, busy, myTurn, clocks = null, live = true }) {
  const player = seat === 0 || seat === 1;
  const mine = !player ? 'w' : seat === view.white ? 'w' : 'b';
  const flip = mine === 'b';
  const [selected, setSelected]   = useState(null);
  const [promoting, setPromoting] = useState(null);   // { from, to } waiting for a piece choice
  const [pending, setPending]     = useState(null);   // a move sent, waiting for the server
  const [premove, setPremove]     = useState(null);   // { from, to } to play when your turn comes
  const [arrows, setArrows]       = useState([]);     // { from, to }; from === to is a ring
  const [drawMode, setDrawMode]   = useState(false);
  const [drag, setDrag]           = useState(null);   // { kind: 'piece' | 'arrow', from, x, y, moved }
  const grid = useRef(null);
  const frame = useRef(null);

  // A new position from the server replaces whatever was shown early
  useEffect(() => { setPending(null); setSelected(null); setPromoting(null); }, [view.moves]);
  // A move the server turned down goes back
  useEffect(() => { if (!busy) setPending(null); }, [busy]);

  const board = pending ? playLocal(view.board, pending) : view.board;
  const canMoveNow = myTurn && !busy && !pending && !view.over;
  const canPremove = player && live && !view.over && !canMoveNow;
  const legal = myTurn && !pending ? view.legal : [];
  const movesFrom = from => legal.filter(m => m.startsWith(sqName(from)));

  // Your turn has come: play the premove if it's legal now, or drop it
  useEffect(() => {
    if (!premove || !myTurn || busy || pending || view.over) return;
    const found = view.legal.filter(m => m.slice(0, 4) === sqName(premove.from) + sqName(premove.to));
    setPremove(null);
    if (!found.length) return;
    const m = { from: premove.from, to: premove.to, ...(found.some(x => x.length === 5) && { promo: 'q' }) };
    setPending(m);
    move({ from: sqName(m.from), to: sqName(m.to), ...(m.promo && { promo: m.promo }) });
  }, [myTurn, view.moves, busy]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (view.over) setPremove(null); }, [view.over]);

  const targets = (() => {
    if (selected === null) return new Set();
    if (canMoveNow) return new Set(movesFrom(selected).map(m => sqIndex(m.slice(2, 4))));
    if (canPremove) return new Set(premoveTargets(board, selected));
    return new Set();
  })();
  const own = i => colorOf(board[i]) === mine;

  function send(from, to, promo) {
    const m = { from, to, ...(promo && { promo }) };
    setPending(m);
    setSelected(null);
    move({ from: sqName(from), to: sqName(to), ...(promo && { promo }) });
  }

  // A tap (or a drop) on square i
  function choose(i) {
    setArrows([]);
    if (canMoveNow) {
      if (selected !== null && targets.has(i)) {
        const options = movesFrom(selected).filter(m => m.slice(2, 4) === sqName(i));
        if (options.some(m => m.length === 5)) { setPromoting({ from: selected, to: i }); return; }
        send(selected, i);
        return;
      }
      setSelected(own(i) && movesFrom(i).length && selected !== i ? i : null);
      return;
    }
    if (canPremove) {
      if (selected !== null && targets.has(i)) { setPremove({ from: selected, to: i }); setSelected(null); return; }
      setPremove(null);
      setSelected(own(i) && selected !== i ? i : null);
    }
  }

  // Squares on screen, top-left first
  const rows = flip ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const at = i => [cols.indexOf(i % 8) + 0.5, rows.indexOf(Math.floor(i / 8)) + 0.5];
  function squareAt(e) {
    const box = grid.current?.getBoundingClientRect();
    if (!box) return null;
    const c = Math.floor(((e.clientX - box.left) / box.width) * 8);
    const r = Math.floor(((e.clientY - box.top) / box.height) * 8);
    if (c < 0 || c > 7 || r < 0 || r > 7) return null;
    return rows[r] * 8 + cols[c];
  }
  function framePoint(e) {
    const box = frame.current.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  }

  function down(e) {
    const i = squareAt(e);
    if (i === null) return;
    if (e.button === 2 || (drawMode && e.button === 0)) {
      e.preventDefault();
      grid.current.setPointerCapture?.(e.pointerId);
      setDrag({ kind: 'arrow', from: i });
      return;
    }
    if (e.button !== 0) return;
    grid.current.setPointerCapture?.(e.pointerId);
    const [x, y] = framePoint(e);
    // pressing one of your pieces picks it up; anything else is a tap
    const grab = (canMoveNow || canPremove) && own(i) && !(selected !== null && targets.has(i));
    if (grab) { setArrows([]); setSelected(i); }
    setDrag({ kind: grab ? 'piece' : 'tap', from: i, x, y, x0: x, y0: y, moved: false, was: selected });
  }
  function moveTo(e) {
    if (!drag || drag.kind !== 'piece') return;
    const [x, y] = framePoint(e);
    setDrag(d => ({ ...d, x, y, moved: d.moved || Math.hypot(x - d.x0, y - d.y0) > 6 }));
  }
  function up(e) {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    const i = squareAt(e);
    if (d.kind === 'arrow') {
      if (i === null) return;
      setArrows(list => (list.some(a => a.from === d.from && a.to === i) ? list.filter(a => !(a.from === d.from && a.to === i)) : [...list, { from: d.from, to: i }]));
      return;
    }
    if (d.kind === 'tap') { if (i !== null) choose(i); return; }
    // a piece: dropped somewhere else is a move (or premove); let go where it was is a tap
    if (d.moved) {
      if (i !== null && i !== d.from) choose(i);
      return;
    }
    // tapping the piece that was already picked up puts it down
    if (d.was === d.from) setSelected(null);
  }

  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Opponent');
  const seatOf = color => (color === 'w' ? view.white : 1 - view.white);
  const material = color => view.captured[color].reduce((t, p) => t + (VALUE[p.toLowerCase()] ?? 0), 0);
  const lead = color => material(color) - material(color === 'w' ? 'b' : 'w');
  const top = mine === 'w' ? 'b' : 'w';
  const toMove = pending ? (view.side === 'w' ? 'b' : 'w') : view.side;
  const last = pending ? [pending.from, pending.to] : view.last;
  const king = board.indexOf(view.side === 'w' ? 'K' : 'k');
  // the other side's last move slides in; your own lands where you put it
  const lastBy = view.side === 'w' ? 'b' : 'w';
  const slideFor = i => {
    if (pending || !view.last || view.last[1] !== i || (player && lastBy === mine)) return null;
    const [fx, fy] = at(view.last[0]), [tx, ty] = at(view.last[1]);
    return [fx - tx, fy - ty];
  };

  const plate = color => (
    <div className={`flex items-center justify-between gap-2 w-full max-w-md px-1 ${toMove === color && !view.over ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
      <span className="flex items-center gap-2 text-sm font-semibold min-w-0">
        <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${color === 'w' ? 'bg-white border-slate-400' : 'bg-slate-900 border-slate-500'}`} aria-hidden="true" />
        <span className="truncate">{name(seatOf(color))}</span>
        {toMove === color && !view.over && <span className="game-turn-dot" aria-label="to move" />}
      </span>
      <span className="flex items-center gap-2 min-w-0">
        <Captured pieces={view.captured[color]} lead={lead(color)} />
        {clocks && <Clock ms={clocks[seatOf(color)]} running={live && !view.over && view.side === color} label={seatOf(color) === seat ? 'Your clock' : `${name(seatOf(color))}'s clock`} />}
      </span>
    </div>
  );

  const dragging = drag?.kind === 'piece' && drag.moved;
  return (
    <div className="flex flex-col items-center gap-2">
      {plate(top)}
      <div ref={frame} className="chess-frame relative w-full max-w-md">
        <div ref={grid} className="grid grid-cols-8 aspect-square w-full relative" role="grid" aria-label="Chess board"
          style={{ touchAction: player && live ? 'none' : 'auto' }}
          onPointerDown={down} onPointerMove={moveTo} onPointerUp={up} onPointerCancel={() => setDrag(null)}
          onContextMenu={e => e.preventDefault()}>
          {rows.map(r => cols.map(c => {
            const i = r * 8 + c;
            const p = board[i];
            const dark = (r + c) % 2 === 0;
            const isLast = last && (last[0] === i || last[1] === i);
            const target = targets.has(i);
            const pre = premove && (premove.from === i || premove.to === i);
            const label = `${sqName(i)}${p !== '.' ? `, ${p === p.toUpperCase() ? 'white' : 'black'} ${NAME[p.toLowerCase()]}` : ''}`;
            return (
              <button key={i} type="button" role="gridcell" aria-label={label} aria-selected={selected === i}
                // pointer presses are handled by the board; this is for the keyboard
                onClick={e => { if (e.detail === 0) choose(i); }}
                aria-disabled={!canMoveNow && !canPremove}
                className={`chess-square relative ${dark ? 'chess-dark' : 'chess-light'}
                  ${isLast ? 'chess-last' : ''} ${selected === i ? 'chess-selected' : ''} ${pre ? 'chess-premove' : ''}
                  ${!pending && view.check && i === king ? 'chess-check' : ''} ${canMoveNow || canPremove ? 'cursor-pointer' : 'cursor-default'}`}>
                {p !== '.' && <Piece key={view.last?.[1] === i ? `m${view.moves}` : 'p'} p={p} slide={slideFor(i)} faded={dragging && drag.from === i} />}
                {target && <span className={`absolute rounded-full pointer-events-none z-[2] ${p !== '.' ? 'inset-[6%] border-[5px] border-black/25' : 'left-[35%] top-[35%] w-[30%] h-[30%] bg-black/25'}`} aria-hidden="true" />}
                {c === (flip ? 7 : 0) && <span className="absolute left-0.5 top-0 text-[9px] font-semibold chess-coord">{r + 1}</span>}
                {r === (flip ? 7 : 0) && <span className="absolute right-0.5 bottom-0 text-[9px] font-semibold chess-coord">{FILES[c]}</span>}
              </button>
            );
          }))}
          <Plans arrows={arrows} at={at} />
        </div>
        {dragging && (
          <span className="absolute pointer-events-none z-[5] chess-drag" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
            <ChessPiece p={board[drag.from]} className="chess-ghost" />
          </span>
        )}
        {promoting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg z-[6]" role="dialog" aria-label="Promote your pawn">
            <div className="card flex flex-col items-center gap-2 py-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Promote to</span>
              <div className="flex gap-2">
                {['q', 'r', 'b', 'n'].map(k => (
                  <button key={k} type="button" aria-label={NAME[k]} onClick={() => { send(promoting.from, promoting.to, k); setPromoting(null); }}
                    className="w-12 h-12 rounded-lg chess-light flex items-center justify-center text-3xl">
                    <ChessPiece p={mine === 'w' ? k.toUpperCase() : k} className="w-10 h-10" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPromoting(null)} className="text-xs text-[var(--text-muted)]">Cancel</button>
            </div>
          </div>
        )}
      </div>
      {plate(mine)}
      <div className="flex items-center justify-center gap-2 flex-wrap min-h-[28px]">
        <button type="button" aria-pressed={drawMode} onClick={() => setDrawMode(v => !v)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border
            ${drawMode ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
          <PenLine size={13} aria-hidden="true" /> Arrows
        </button>
        {arrows.length > 0 && (
          <button type="button" onClick={() => setArrows([])} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--text-muted)] border border-[var(--border)]">
            <X size={12} aria-hidden="true" /> Clear
          </button>
        )}
        {premove && (
          <button type="button" onClick={() => setPremove(null)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-sky-300 border border-sky-400/40 bg-sky-400/10">
            Premove {sqName(premove.from)}–{sqName(premove.to)} <X size={12} aria-label="Cancel the premove" />
          </button>
        )}
      </div>
      {view.check && !view.over && !pending && <p className="text-sm font-bold text-red-400" role="status">Check!</p>}
      {player && live && !view.over && (
        <p className="text-[11px] text-[var(--text-muted)] text-center">
          {drawMode ? 'Drag from square to square to draw an arrow, or tap a square for a ring. Turn Arrows off to move.'
            : canMoveNow ? 'Tap or drag a piece to move. Right-click and drag to draw arrows.'
            : 'Their move. You can premove: pick a piece and where it should go.'}
        </p>
      )}
    </div>
  );
}
