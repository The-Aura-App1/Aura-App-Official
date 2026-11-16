import React, { useEffect, useState } from 'react';
import './games.css';

// Chess. The board turns so your pieces are at the bottom (white for
// spectators). Tap one of your pieces to see where it can go, then tap a
// square; a pawn reaching the far side asks what to become. The server
// sends the legal moves for whoever is on turn, so the board never decides
// what's legal on its own.
const FILES = 'abcdefgh';
const sqName = i => FILES[i % 8] + (Math.floor(i / 8) + 1);
// Solid glyphs for both colours, coloured with CSS; U+FE0E keeps them as text, not emoji
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function Piece({ p, landed }) {
  const white = p === p.toUpperCase();
  return (
    <span className={`chess-piece ${white ? 'chess-white' : 'chess-black'} ${landed ? 'chess-land' : ''}`} aria-hidden="true">
      {GLYPH[p.toLowerCase()]}{'︎'}
    </span>
  );
}

function Captured({ pieces, lead }) {
  if (!pieces.length && !lead) return <div className="h-6" />;
  const sorted = [...pieces].sort((a, b) => (VALUE[b.toLowerCase()] ?? 0) - (VALUE[a.toLowerCase()] ?? 0));
  return (
    <div className="h-6 flex items-center gap-0.5 text-lg leading-none" aria-label={`Captured: ${sorted.map(p => NAME[p.toLowerCase()]).join(', ') || 'none'}`}>
      {sorted.map((p, i) => <span key={i} className={`chess-mini ${p === p.toUpperCase() ? 'chess-white' : 'chess-black'}`}>{GLYPH[p.toLowerCase()]}{'︎'}</span>)}
      {lead > 0 && <span className="ml-1 text-xs font-semibold text-[var(--text-muted)]">+{lead}</span>}
    </div>
  );
}

export default function ChessBoard({ view, seat, players, move, busy, myTurn }) {
  const [selected, setSelected] = useState(null);
  const [promoting, setPromoting] = useState(null);   // { from, to } waiting for a piece choice
  useEffect(() => { setSelected(null); setPromoting(null); }, [view.moves]);

  const mine = seat === null ? 'w' : seat === view.white ? 'w' : 'b';
  const flip = mine === 'b';
  const rows = flip ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const legal = myTurn ? view.legal : [];
  const fromHere = from => legal.filter(m => m.startsWith(sqName(from)));
  const targets = selected === null ? new Set() : new Set(fromHere(selected).map(m => m.slice(2, 4)));
  const king = view.board.indexOf(view.side === 'w' ? 'K' : 'k');
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Opponent');
  const seatOf = color => (color === 'w' ? view.white : 1 - view.white);
  const material = color => view.captured[color].reduce((t, p) => t + (VALUE[p.toLowerCase()] ?? 0), 0);
  const lead = color => material(color) - material(color === 'w' ? 'b' : 'w');
  const top = mine === 'w' ? 'b' : 'w';

  function tap(i) {
    if (!myTurn || busy) return;
    const p = view.board[i];
    const own = p !== '.' && (p === p.toUpperCase() ? 'w' : 'b') === mine;
    if (selected !== null && targets.has(sqName(i))) {
      const options = fromHere(selected).filter(m => m.slice(2, 4) === sqName(i));
      if (options.some(m => m.length === 5)) { setPromoting({ from: sqName(selected), to: sqName(i) }); return; }
      move({ from: sqName(selected), to: sqName(i) });
      setSelected(null);
      return;
    }
    setSelected(own && fromHere(i).length ? i : null);
  }

  const plate = color => (
    <div className={`flex items-center justify-between gap-2 w-full max-w-md px-1 ${view.side === color && !view.over ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
      <span className="flex items-center gap-2 text-sm font-semibold min-w-0">
        <span className={`w-3.5 h-3.5 rounded-full border ${color === 'w' ? 'bg-white border-slate-400' : 'bg-slate-900 border-slate-500'}`} aria-hidden="true" />
        <span className="truncate">{name(seatOf(color))}</span>
        {view.side === color && !view.over && <span className="game-turn-dot" aria-label="to move" />}
      </span>
      <Captured pieces={view.captured[color]} lead={lead(color)} />
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-2">
      {plate(top)}
      <div className="chess-frame relative w-full max-w-md">
        <div className="grid grid-cols-8 aspect-square w-full" role="grid" aria-label="Chess board">
          {rows.map(r => cols.map(c => {
            const i = r * 8 + c;
            const p = view.board[i];
            const dark = (r + c) % 2 === 0;
            const isLast = view.last && (view.last[0] === i || view.last[1] === i);
            const target = targets.has(sqName(i));
            const label = `${sqName(i)}${p !== '.' ? `, ${p === p.toUpperCase() ? 'white' : 'black'} ${NAME[p.toLowerCase()]}` : ''}`;
            return (
              <button key={i} type="button" role="gridcell" aria-label={label} onClick={() => tap(i)} disabled={!myTurn || busy}
                aria-selected={selected === i}
                className={`chess-square relative flex items-center justify-center ${dark ? 'chess-dark' : 'chess-light'}
                  ${isLast ? 'chess-last' : ''} ${selected === i ? 'chess-selected' : ''} ${view.check && i === king ? 'chess-check' : ''}`}>
                {p !== '.' && <Piece p={p} landed={view.last?.[1] === i} />}
                {target && <span className={`absolute rounded-full pointer-events-none ${p !== '.' ? 'inset-[6%] border-[5px] border-black/25' : 'w-[30%] h-[30%] bg-black/25'}`} aria-hidden="true" />}
                {c === (flip ? 7 : 0) && <span className="absolute left-0.5 top-0 text-[9px] font-semibold chess-coord">{r + 1}</span>}
                {r === (flip ? 7 : 0) && <span className="absolute right-0.5 bottom-0 text-[9px] font-semibold chess-coord">{FILES[c]}</span>}
              </button>
            );
          }))}
        </div>
        {promoting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg" role="dialog" aria-label="Promote your pawn">
            <div className="card flex flex-col items-center gap-2 py-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Promote to</span>
              <div className="flex gap-2">
                {['q', 'r', 'b', 'n'].map(k => (
                  <button key={k} type="button" aria-label={NAME[k]} onClick={() => { move({ ...promoting, promo: k }); setPromoting(null); setSelected(null); }}
                    className="w-12 h-12 rounded-lg chess-light flex items-center justify-center text-3xl">
                    <span className={`chess-piece ${mine === 'w' ? 'chess-white' : 'chess-black'}`}>{GLYPH[k]}{'︎'}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPromoting(null)} className="text-xs text-[var(--text-muted)]">Cancel</button>
            </div>
          </div>
        )}
      </div>
      {plate(mine)}
      {view.check && !view.over && <p className="text-sm font-bold text-red-400" role="status">Check!</p>}
      {myTurn && !view.check && <p className="text-xs text-[var(--text-muted)]">Tap a piece, then where it should go.</p>}
    </div>
  );
}
