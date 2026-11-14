import React, { useEffect, useState } from 'react';
import PlayingCard, { Hand, suitSymbol, suitName, rankLabel } from './PlayingCard';

// One board per game. Each gets the server's view of the match for this
// viewer, their seat (0, 1, or null when watching), the players, and
// move(m), which sends a move and resolves once the server has answered.
// The boards never decide what's legal; they show what the view allows.

const SEAT_COLORS = ['bg-aura-500', 'bg-amber-400'];
const SEAT_NAMES  = ['purple', 'gold'];

const name = (players, seat, viewerSeat) => (seat === viewerSeat ? 'You' : players[seat]?.displayName ?? 'Opponent');

function Connect4({ view, seat, move, busy, myTurn }) {
  const line = new Set((view.line ?? []).map(([c, r]) => `${c},${r}`));
  const [lc, lr] = view.last ?? [];
  return (
    <div className="flex flex-col items-center gap-3">
      {seat !== null && <p className="text-xs text-[var(--text-muted)]">You're <span className="font-semibold">{SEAT_NAMES[seat]}</span>.</p>}
      <div className="grid grid-cols-7 gap-1.5 p-2.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] w-full max-w-sm"
        role="grid" aria-label="Connect 4 board">
        {Array.from({ length: 7 }, (_, c) => {
          const full = view.cols[c].length >= 6;
          return (
            <button key={c} type="button" disabled={!myTurn || busy || full} onClick={() => move({ col: c })}
              aria-label={`Drop in column ${c + 1}${full ? ' (full)' : ''}`}
              className="flex flex-col-reverse gap-1.5 rounded-xl p-0.5 enabled:hover:bg-aura-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-400">
              {Array.from({ length: 6 }, (_, r) => {
                const owner = view.cols[c][r];
                const win = line.has(`${c},${r}`);
                return (
                  <span key={r} className={`aspect-square w-full rounded-full transition-all
                    ${owner === undefined ? 'bg-[var(--bg-primary)] shadow-inner' : SEAT_COLORS[owner]}
                    ${win ? 'ring-2 ring-white scale-90' : ''} ${c === lc && r === lr && !win ? 'ring-2 ring-white/50' : ''}`} />
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function Die({ value }) {
  return (
    <span className="grid grid-cols-3 grid-rows-3 gap-0.5 w-11 h-11 p-1.5 rounded-lg bg-white shadow-md" role="img" aria-label={`${value}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`rounded-full ${PIPS[value]?.includes(i) ? 'bg-slate-900' : ''}`} />
      ))}
    </span>
  );
}

function DiceDuel({ view, seat, players, move, busy, myTurn }) {
  const shown = view.rolls.some(Boolean) ? view.rolls : (view.rounds[view.rounds.length - 1]?.rolls ?? [null, null]);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid grid-cols-2 gap-6 w-full max-w-sm">
        {[0, 1].map(s => (
          <div key={s} className="flex flex-col items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{name(players, s, seat)}</span>
            <span className="text-xs text-[var(--text-muted)]">{view.wins[s]} of 2 rounds</span>
            <div className="flex gap-2 min-h-11">
              {shown[s] ? shown[s].map((v, i) => <Die key={i} value={v} />) : <span className="text-xs text-[var(--text-muted)] self-center">Not rolled</span>}
            </div>
          </div>
        ))}
      </div>
      {myTurn && (
        <button type="button" disabled={busy} onClick={() => move({ type: 'roll' })} className="btn-primary">Roll the dice</button>
      )}
    </div>
  );
}

function CoinFlip({ view, players, seat }) {
  const [spinning, setSpinning] = useState(true);
  useEffect(() => { const t = setTimeout(() => setSpinning(false), 1200); return () => clearTimeout(t); }, []);
  const caller = name(players, 0, seat);
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-amber-900 shadow-lg
        bg-gradient-to-br from-amber-200 to-amber-500 border-4 border-amber-300 ${spinning ? 'animate-spin' : ''}`}
        style={spinning ? { animationDuration: '0.35s' } : undefined} aria-live="polite">
        {spinning ? '' : (view.result === 'heads' ? 'H' : 'T')}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        {caller} called <span className="font-semibold">{view.call}</span>
        {!spinning && <>. It landed <span className="font-semibold">{view.result}</span>.</>}
      </p>
    </div>
  );
}

function SuitPicker({ onPick, onCancel }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
      <p className="text-sm font-semibold text-[var(--text-primary)]">Eights are wild. Pick the next suit:</p>
      <div className="flex gap-2">
        {['s', 'h', 'd', 'c'].map(s => (
          <button key={s} type="button" onClick={() => onPick(s)} aria-label={suitName(s)}
            className={`w-11 h-11 rounded-lg bg-white text-2xl shadow ${s === 'h' || s === 'd' ? 'text-red-600' : 'text-slate-900'}`}>
            {suitSymbol(s)}
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="text-xs text-[var(--text-muted)]">Cancel</button>
    </div>
  );
}

function Opponent({ count, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex -space-x-6">
        {Array.from({ length: Math.min(count, 12) }, (_, i) => <PlayingCard key={i} faceDown size="sm" />)}
      </div>
      <span className="text-xs text-[var(--text-muted)]">{label}: {count} card{count === 1 ? '' : 's'}</span>
    </div>
  );
}

function CrazyEights({ view, seat, players, move, busy, myTurn }) {
  const [eight, setEight] = useState(null);
  const playable = new Set(view.playable);
  const opp = seat === null ? 1 : 1 - seat;
  return (
    <div className="flex flex-col items-center gap-4">
      {seat === null && <Opponent count={view.handCounts[0]} label={players[0]?.displayName} />}
      <Opponent count={view.handCounts[opp]} label={name(players, opp, seat)} />

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <button type="button" disabled={!view.canDraw || busy} onClick={() => move({ type: 'draw' })}
            aria-label={`Draw a card (${view.deckCount} left)`} className="rounded-lg enabled:hover:-translate-y-1 transition-transform disabled:opacity-60">
            <PlayingCard faceDown size="lg" />
          </button>
          <span className="text-[11px] text-[var(--text-muted)]">{view.deckCount} left</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <PlayingCard card={view.top} size="lg" />
          <span className="text-[11px] text-[var(--text-muted)]">
            Suit: <span className={view.suit === 'h' || view.suit === 'd' ? 'text-red-500' : ''}>{suitSymbol(view.suit)} {suitName(view.suit)}</span>
          </span>
        </div>
      </div>

      {eight && (
        <SuitPicker onCancel={() => setEight(null)}
          onPick={async s => { const card = eight; setEight(null); await move({ type: 'play', card, suit: s }); }} />
      )}

      {seat !== null && (
        <>
          <Hand>
            {view.hand.map(c => (
              <PlayingCard key={c} card={c} disabled={!myTurn || busy || !playable.has(c)} dim={myTurn && !playable.has(c)}
                onClick={() => (c[0] === '8' ? setEight(c) : move({ type: 'play', card: c }))} />
            ))}
          </Hand>
          {myTurn && (
            <p className="text-xs text-[var(--text-muted)] text-center">
              {view.playable.length ? 'Tap a highlighted card to play it' : 'Nothing matches'}
              {view.canDraw ? ', or tap the deck to draw.' : '.'}
            </p>
          )}
          {view.canPass && <button type="button" disabled={busy} onClick={() => move({ type: 'pass' })} className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Pass</button>}
        </>
      )}
    </div>
  );
}

function Books({ ranks, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-[var(--text-muted)]">{label}: {ranks.length} book{ranks.length === 1 ? '' : 's'}</span>
      <div className="flex flex-wrap justify-center gap-1">
        {ranks.map(r => <span key={r} className="aura-badge px-2 py-0.5">{rankLabel(r)}</span>)}
      </div>
    </div>
  );
}

function GoFish({ view, seat, players, move, busy, myTurn }) {
  const opp = seat === null ? 1 : 1 - seat;
  const groups = {};
  for (const c of view.hand) (groups[c[0]] ??= []).push(c);
  const askable = new Set(view.askable);
  return (
    <div className="flex flex-col items-center gap-4">
      <Opponent count={view.handCounts[opp]} label={name(players, opp, seat)} />
      <div className="grid grid-cols-2 gap-6">
        <Books ranks={view.books[opp]} label={name(players, opp, seat)} />
        <Books ranks={view.books[seat ?? 0]} label={name(players, seat ?? 0, seat)} />
      </div>
      <span className="text-xs text-[var(--text-muted)]">{view.deckCount} cards in the pond</span>
      {seat !== null && (
        <>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {Object.entries(groups).map(([rank, cards]) => (
              <button key={rank} type="button" disabled={!myTurn || busy || !askable.has(rank)} onClick={() => move({ type: 'ask', rank })}
                aria-label={`Ask for ${rankLabel(rank)}s (you have ${cards.length})`}
                className="flex -space-x-7 rounded-lg enabled:hover:-translate-y-1.5 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-400">
                {cards.map(c => <PlayingCard key={c} card={c} />)}
              </button>
            ))}
          </div>
          {myTurn && <p className="text-xs text-[var(--text-muted)]">Tap a set of cards to ask for that rank.</p>}
        </>
      )}
    </div>
  );
}

function Poker({ view, seat, players, move, busy, myTurn }) {
  const o = view.options;
  const [raiseTo, setRaiseTo] = useState(o?.minRaiseTo ?? 0);
  useEffect(() => { if (o?.minRaiseTo) setRaiseTo(o.minRaiseTo); }, [o?.minRaiseTo, view.hand, view.street]);
  const me = seat ?? 0;
  const opp = 1 - me;
  const last = view.last;
  const lastName = s => name(players, s, seat);
  const player = s => (
    <div className={`flex items-center justify-between gap-3 w-full max-w-sm px-3 py-2 rounded-xl border
      ${view.turn === s ? 'border-aura-500/50 bg-aura-500/10' : 'border-[var(--border)]'}`}>
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        {lastName(s)}{view.button === s && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white text-slate-900 font-bold" title="Dealer button">D</span>}
      </span>
      <span className="text-xs text-[var(--text-muted)]">{view.chips[s]} chips{view.bets[s] ? ` · bet ${view.bets[s]}` : ''}</span>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-3">
      {player(opp)}
      <div className="flex gap-1.5">
        {seat === null ? null : [0, 1].map(i => <PlayingCard key={i} faceDown size="sm" />)}
      </div>

      <div className="flex flex-col items-center gap-2 py-3 px-4 rounded-2xl w-full max-w-sm bg-emerald-900/40 border border-emerald-500/20">
        <span className="text-xs text-emerald-100/80">Hand {view.hand} · blinds {view.blinds?.[0]}/{view.blinds?.[1]} · pot {view.pot + view.bets[0] + view.bets[1]}</span>
        <div className="flex gap-1.5 min-h-[68px]">
          {Array.from({ length: 5 }, (_, i) => (view.board[i]
            ? <PlayingCard key={i} card={view.board[i]} />
            : <span key={i} className="w-12 h-[68px] rounded-lg border border-dashed border-emerald-200/20" />))}
        </div>
      </div>

      {seat !== null && view.hole.length > 0 && <Hand>{view.hole.map(c => <PlayingCard key={c} card={c} size="lg" />)}</Hand>}
      {player(me)}

      {myTurn && o && (
        <div className="flex flex-col gap-2 w-full max-w-sm">
          <div className="flex gap-2">
            {o.canFold && <button type="button" disabled={busy} onClick={() => move({ type: 'fold' })} className="btn-secondary flex-1 text-[var(--text-primary)]">Fold</button>}
            {o.canCheck
              ? <button type="button" disabled={busy} onClick={() => move({ type: 'check' })} className="btn-secondary flex-1 text-[var(--text-primary)]">Check</button>
              : <button type="button" disabled={busy} onClick={() => move({ type: 'call' })} className="btn-secondary flex-1 text-[var(--text-primary)]">Call {o.toCall}</button>}
            {o.canRaise && (
              <button type="button" disabled={busy} onClick={() => move({ type: 'raise', to: raiseTo })} className="btn-primary flex-1">
                {raiseTo === o.maxRaiseTo ? 'All in' : `${view.bets[opp] ? 'Raise to' : 'Bet'} ${raiseTo}`}
              </button>
            )}
          </div>
          {o.canRaise && o.maxRaiseTo > o.minRaiseTo && (
            <input type="range" min={o.minRaiseTo} max={o.maxRaiseTo} step={1} value={raiseTo}
              onChange={e => setRaiseTo(Number(e.target.value))} aria-label="Raise amount" className="w-full accent-[var(--accent)]" />
          )}
        </div>
      )}

      {last && (
        <div className="w-full max-w-sm text-xs text-[var(--text-muted)] border-t border-[var(--border)] pt-3 flex flex-col gap-2">
          <span className="font-semibold text-[var(--text-secondary)]">
            Last hand ({last.hand}): {last.winners.length === 2 ? 'split pot' : `${lastName(last.winners[0])} won ${last.pot}`}
            {last.folded !== undefined && !last.showdown ? ` after ${lastName(last.folded).toLowerCase() === 'you' ? 'you' : lastName(last.folded)} folded` : ''}
          </span>
          {last.showdown && [0, 1].map(s => (
            <div key={s} className="flex items-center gap-2">
              <span className="w-20 truncate">{lastName(s)}</span>
              {last.hole[s].map(c => <PlayingCard key={c} card={c} size="sm" />)}
              <span>{last.handNames[s]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const BOARDS = { connect4: Connect4, dice: DiceDuel, coinflip: CoinFlip, crazy8s: CrazyEights, gofish: GoFish, poker: Poker };
