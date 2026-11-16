import React, { useState } from 'react';
import PlayingCard, { CardBacks, RANK_ORDER, suitSymbol, suitName, cardLabel } from './PlayingCard';
import { logText } from './gameInfo';
import './games.css';

// Crazy 8 on a felt table: everyone else along the top, the draw pile and
// the played pile in the middle (with the suit to follow when an 8 changed
// it), your hand at the bottom. Cards you can play rise up; tap one to play
// it, and an 8 asks which suit comes next.
const SUITS = ['s', 'h', 'd', 'c'];
const red = s => s === 'h' || s === 'd';

export default function Crazy8Table({ view, seat, players, move, busy, myTurn }) {
  const [eight, setEight] = useState(null);   // the 8 waiting for a suit
  const n = view.n;
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Player');
  const me = seat ?? 0;
  const others = Array.from({ length: n - 1 }, (_, k) => (me + 1 + k) % n);
  const playable = new Set(view.playable);
  const hand = [...view.hand].sort((a, b) => a[1].localeCompare(b[1]) || RANK_ORDER.indexOf(a[0]) - RANK_ORDER.indexOf(b[0]));
  const lastLog = view.log?.[view.log.length - 1];
  const changed = view.top[0] === '8' || view.suit !== view.top[1];

  function play(card) {
    if (!myTurn || busy || !playable.has(card)) return;
    if (card[0] === '8') { setEight(card); return; }
    move({ type: 'play', card });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="c8-table game-stage relative w-full max-w-lg px-3 pt-3 pb-4 flex flex-col items-center gap-4">
        <div className={`grid gap-2 w-full ${others.length === 1 ? 'grid-cols-1' : others.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {others.map(s => (
            <div key={s} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 border text-white
              ${view.turn === s && !view.over ? 'border-white/70 bg-white/10' : 'border-white/15 bg-black/10'} ${view.out?.[s] ? 'opacity-40' : ''}`}>
              <span className="flex items-center gap-1 text-xs font-semibold max-w-full">
                {view.turn === s && !view.over && <span className="game-turn-dot" aria-hidden="true" />}
                <span className="truncate">{name(s)}</span>
              </span>
              {view.out?.[s]
                ? <span className="text-[11px] text-white/70">Out</span>
                : <CardBacks count={view.handCounts[s]} size="xs" max={9} label={`${name(s)} holds ${view.handCounts[s]} cards`} />}
              <span className={`text-[11px] ${view.handCounts[s] === 1 ? 'font-bold text-amber-300' : 'text-white/75'}`}>
                {view.handCounts[s] === 1 ? 'Last card!' : `${view.handCounts[s]} cards`}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6 py-1">
          <button type="button" disabled={!view.canDraw || busy} onClick={() => move({ type: 'draw' })}
            aria-label={`Draw a card (${view.deckCount} left)`}
            className="relative w-16 h-[90px] rounded-lg enabled:hover:-translate-y-1 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
            {view.deckCount === 0
              ? <span className="absolute inset-0 rounded-lg border border-dashed border-white/30" />
              : [2, 1, 0].map(i => (
                <PlayingCard key={i} faceDown size="lg" className="absolute inset-0" style={{ transform: `translate(${i * 2}px, ${-i * 2}px)` }} />
              ))}
            {view.canDraw && <span className="absolute -bottom-5 inset-x-0 text-center text-[11px] font-semibold text-white">Draw</span>}
          </button>
          <div className="relative">
            <PlayingCard key={`${view.top}-${view.log?.length}`} card={view.top} size="lg" enter="flip" />
            {changed && (
              <span className={`absolute -right-3 -top-3 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-xl font-bold ${red(view.suit) ? 'text-red-600' : 'text-slate-900'}`}
                title={`Follow ${suitName(view.suit)}`} aria-label={`Suit to follow: ${suitName(view.suit)}`}>
                {suitSymbol(view.suit)}
              </span>
            )}
          </div>
        </div>
        <span className="game-stage-label">{view.deckCount} in the pile · follow {suitName(view.suit)}</span>

        <div className={`game-seat text-white ${view.turn === me && !view.over ? 'game-seat-on' : ''}`}>
          {view.turn === me && !view.over && <span className="game-turn-dot" aria-hidden="true" />}
          <span className="font-semibold">{name(me)}</span>
          <span className="text-white/70">{view.handCounts[me]} card{view.handCounts[me] === 1 ? '' : 's'}</span>
        </div>
        {seat !== null && (
          <div className="flex flex-wrap justify-center gap-y-2 pt-1 max-w-full">
            {hand.map((c, i) => {
              const can = myTurn && playable.has(c);
              return (
                <button key={c} type="button" disabled={!can || busy} onClick={() => play(c)} aria-label={`Play the ${cardLabel(c)}`}
                  className={`rounded-lg transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${i ? '-ml-5' : ''}
                    ${can ? '-translate-y-2 enabled:hover:-translate-y-4' : myTurn ? 'brightness-[.72] saturate-50' : ''}`}>
                  <PlayingCard card={c} enter="deal" delay={i * 40} />
                </button>
              );
            })}
          </div>
        )}
        {seat === null && <CardBacks count={view.handCounts[me]} size="sm" />}

        {eight && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[inherit] z-10" role="dialog" aria-label="Pick the suit to follow">
            <div className="card flex flex-col items-center gap-2 py-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Crazy 8! Pick the next suit</span>
              <div className="flex gap-2">
                {SUITS.map(s => (
                  <button key={s} type="button" aria-label={suitName(s)} onClick={() => { move({ type: 'play', card: eight, suit: s }); setEight(null); }}
                    className={`w-12 h-12 rounded-xl bg-white text-3xl font-bold shadow ${red(s) ? 'text-red-600' : 'text-slate-900'}`}>
                    {suitSymbol(s)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setEight(null)} className="text-xs text-[var(--text-muted)]">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {myTurn && (
        <div className="flex gap-2">
          {view.canPass && <button type="button" disabled={busy} onClick={() => move({ type: 'pass' })} className="btn-secondary px-5 py-2 text-[var(--text-primary)]">Pass</button>}
        </div>
      )}
      {lastLog && (
        <p className="text-sm text-[var(--text-secondary)] text-center" aria-live="polite">
          {lastLog.s !== null && lastLog.s !== undefined && <span className="font-semibold text-[var(--text-primary)]">{name(lastLog.s)} </span>}
          {logText(lastLog, s => (s === seat ? 'you' : players[s]?.displayName ?? 'someone'))}
        </p>
      )}
      {myTurn && (
        <p className="text-xs text-[var(--text-muted)] text-center">
          {view.playable.length ? 'Tap a raised card to play it.' : view.canDraw ? 'Nothing to play. Draw a card.' : 'Play the card you drew, or pass.'}
          {' '}8s are wild; a 2 makes the next player draw two; a jack skips them.
        </p>
      )}
    </div>
  );
}
