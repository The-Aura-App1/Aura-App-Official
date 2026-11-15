import React, { useEffect, useState } from 'react';
import PlayingCard, { CardBacks } from './PlayingCard';
import ChipStack from './Chips';
import './games.css';

const STREET = { preflop: 'Pre-flop', flop: 'The flop', turn: 'The turn', river: 'The river' };

// Heads-up Hold'em on an oval felt table. The opponent sits at the top, you
// at the bottom; bets sit in front of each seat as chips and the pot in the
// middle. The server decides every option; this only offers what it allows.
export default function PokerTable({ view, seat, players, move, busy, myTurn }) {
  const o = view.options;
  const [raiseTo, setRaiseTo] = useState(o?.minRaiseTo ?? 0);
  useEffect(() => { if (o?.minRaiseTo) setRaiseTo(o.minRaiseTo); }, [o?.minRaiseTo, view.hand, view.street]);
  const me = seat ?? 0;
  const opp = 1 - me;
  const last = view.last;
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Opponent');
  const pot = view.pot;
  const totalPot = pot + view.bets[0] + view.bets[1];
  const lastLog = view.log?.[view.log.length - 1];

  // Bet presets: half the pot, the pot, all in (each kept inside the allowed range)
  const presets = [];
  if (o?.canRaise) {
    const potAfterCall = totalPot + o.toCall;
    const clamp = v => Math.max(o.minRaiseTo, Math.min(o.maxRaiseTo, Math.round(v)));
    const base = view.bets[opp];
    presets.push(['Min', o.minRaiseTo]);
    if (potAfterCall / 2 + base > o.minRaiseTo) presets.push(['½ pot', clamp(base + potAfterCall / 2)]);
    if (potAfterCall + base > o.minRaiseTo) presets.push(['Pot', clamp(base + potAfterCall)]);
    presets.push(['All in', o.maxRaiseTo]);
  }

  const plate = s => (
    <div className={`game-seat w-full max-w-[15rem] text-white ${view.turn === s && !view.over ? 'game-seat-on' : ''}`}>
      <span className="flex items-center gap-1.5 min-w-0 font-semibold">
        {view.turn === s && !view.over && <span className="game-turn-dot flex-shrink-0" aria-hidden="true" />}
        <span className="truncate">{name(s)}</span>
        {view.button === s && <span className="poker-button flex-shrink-0" title="Dealer button" aria-label="dealer">D</span>}
      </span>
      <span className="tabular-nums text-white/80 flex-shrink-0">{view.chips[s].toLocaleString()} chips</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="poker-rail w-full max-w-md">
        <div className="poker-felt game-stage game-sheen relative flex flex-col items-center gap-2.5 px-4 pt-4 pb-5 min-h-[23rem]">
          <div className="poker-felt-line absolute inset-3 pointer-events-none" aria-hidden="true" />
          {plate(opp)}
          <div className="h-[52px] flex items-center">
            {view.over ? null : <CardBacks count={2} label={`${name(opp)}'s two cards`} />}
          </div>
          <div className="h-7 flex items-center"><ChipStack amount={view.bets[opp]} from="above" /></div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="game-stage-label">{view.over ? 'Game over' : `${STREET[view.street] ?? ''} · hand ${view.hand} · blinds ${view.blinds?.[0]}/${view.blinds?.[1]}`}</span>
            <div className="flex gap-1.5 min-h-[68px]">
              {Array.from({ length: 5 }, (_, i) => (view.board[i]
                ? <PlayingCard key={`${view.hand}-${view.board[i]}`} card={view.board[i]} enter="flip" delay={i < 3 ? i * 110 : 0} />
                : <span key={i} className="w-12 h-[68px] rounded-lg border border-dashed border-white/20" />))}
            </div>
            <div className="h-7 flex items-center poker-pot-glow"><ChipStack amount={pot} label="Pot" from="below" /></div>
          </div>

          <div className="h-7 flex items-center"><ChipStack amount={view.bets[me]} from="below" /></div>
          {seat !== null && view.hole.length > 0 && (
            <div className="flex gap-1.5 -mb-1">
              {view.hole.map((c, i) => (
                <PlayingCard key={`${view.hand}-${c}`} card={c} size="lg" enter="deal" delay={i * 120}
                  style={{ transform: `rotate(${i ? 4 : -4}deg)` }} />
              ))}
            </div>
          )}
          {seat !== null && view.made && <span className="text-xs font-semibold text-emerald-100" aria-live="polite">You have: {view.made}</span>}
          {plate(me)}
          {lastLog && !view.over && <span key={`${view.log.length}-${lastLog.t}`} className="game-toast text-white" style={{ top: "31%" }} aria-hidden="true">
            {lastLog.s === null || lastLog.s === undefined ? '' : `${name(lastLog.s)} `}{lastLog.t}
          </span>}
        </div>
      </div>

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
            <>
              <div className="flex gap-1.5">
                {presets.map(([label, v]) => (
                  <button key={label} type="button" onClick={() => setRaiseTo(v)} aria-pressed={raiseTo === v}
                    className={`flex-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors
                      ${raiseTo === v ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <input type="range" min={o.minRaiseTo} max={o.maxRaiseTo} step={1} value={raiseTo}
                onChange={e => setRaiseTo(Number(e.target.value))} aria-label="Raise amount" className="w-full accent-[var(--accent)]" />
            </>
          )}
        </div>
      )}

      {last && (
        <div className="w-full max-w-sm text-xs text-[var(--text-muted)] border-t border-[var(--border)] pt-3 flex flex-col gap-2">
          <span className="font-semibold text-[var(--text-secondary)]">
            Last hand ({last.hand}): {last.winners.length === 2 ? 'split pot' : `${name(last.winners[0])} won ${last.pot}`}
            {last.folded !== undefined && !last.showdown ? ` after ${last.folded === seat ? 'you' : name(last.folded)} folded` : ''}
          </span>
          {last.showdown && (
            <>
              <div className="flex gap-1">{last.board.map(c => <PlayingCard key={c} card={c} size="xs" />)}</div>
              {[0, 1].map(s => (
                <div key={s} className={`flex items-center gap-2 ${last.winners.includes(s) ? 'text-[var(--text-primary)]' : ''}`}>
                  <span className="w-20 truncate">{name(s)}</span>
                  {last.hole[s].map(c => <PlayingCard key={c} card={c} size="sm" />)}
                  <span>{last.described?.[s] ?? last.handNames[s]}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
