import React, { useState } from 'react';
import PlayingCard, { CardBacks, rankLabel, RANK_ORDER } from './PlayingCard';
import { logText } from './gameInfo';
import './games.css';

// Ripples and fish in the pond, placed once (they're scenery, not state)
const RIPPLES = [[22, 38, 0], [74, 62, 1.8], [48, 50, 3.6]];
const FISH = [
  { top: '28%', swim: '26s', delay: '-4s', dir: 1, size: 34 },
  { top: '66%', swim: '32s', delay: '-17s', dir: -1, size: 26 },
];

function Fish({ size }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 40 20" aria-hidden="true">
      <path d="M2 10 C10 0 26 0 32 10 C26 20 10 20 2 10 Z M32 10 L40 3 L38 10 L40 17 Z" fill="#bae6fd" />
      <circle cx="9" cy="8.5" r="1.4" fill="#0c4a6e" />
    </svg>
  );
}

// A player's finished books: a little stack of four per rank
function Books({ ranks, label }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <span className="game-stage-label">{label} · {ranks.length} book{ranks.length === 1 ? '' : 's'}</span>
      <div className="flex flex-wrap justify-center gap-1 min-h-[42px]">
        {ranks.map(r => (
          <span key={r} className="relative w-7 h-10 card-deal" aria-label={`Book of ${rankLabel(r)}s`} role="img">
            {[3, 2, 1].map(i => <span key={i} className="absolute inset-0 rounded bg-white/80 border border-slate-300" style={{ transform: `translate(${i * 1.5}px, ${-i * 1.5}px)` }} />)}
            <PlayingCard card={`${r}s`} size="xs" className="absolute inset-0" />
          </span>
        ))}
      </div>
    </div>
  );
}

const lastFishing = log => {
  const e = log?.[log.length - 1];
  if (!e) return null;
  if (/Go fish!/.test(e.t)) return 'Go fish!';
  if (/drew one!/.test(e.t)) return 'Lucky catch!';
  if (/and got \d/.test(e.t)) return `Got ${e.t.match(/got (\d)/)[1]}!`;
  if (/made a book/.test(e.t)) return 'Book!';
  return null;
};

// Go Fish in a pond: the draw pile floats in the middle with fish swimming
// under it, your hand sits on the shore below, theirs face down above.
export default function GoFishPond(props) {
  return (props.view.n ?? 2) > 2 ? <GoFishTable {...props} /> : <GoFishPair {...props} />;
}

function GoFishPair({ view, seat, players, move, busy, myTurn }) {
  const opp = seat === null ? 1 : 1 - seat;
  const me = seat ?? 0;
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Opponent');
  const groups = {};
  for (const c of [...view.hand].sort((a, b) => RANK_ORDER.indexOf(a[0]) - RANK_ORDER.indexOf(b[0]))) (groups[c[0]] ??= []).push(c);
  const askable = new Set(view.askable);
  const splash = lastFishing(view.log);
  const lastLog = view.log?.[view.log.length - 1];
  const pile = Math.min(view.deckCount, 6);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="pond game-stage w-full max-w-md px-3 pt-3 pb-4 flex flex-col items-center gap-3">
        <div className="pond-caustics" aria-hidden="true" />
        {RIPPLES.map(([x, y, d], i) => (
          <span key={i} className="pond-ripple" aria-hidden="true" style={{ left: `${x}%`, top: `${y}%`, width: 180, height: 70, animationDelay: `${d}s` }} />
        ))}
        {FISH.map((f, i) => (
          <span key={i} className="pond-fish left-0 w-full" aria-hidden="true" style={{ top: f.top, '--swim': f.swim, '--delay': f.delay, '--dir': f.dir }}>
            <Fish size={f.size} />
          </span>
        ))}

        <div className={`game-seat text-white ${view.turn === opp && !view.over ? 'game-seat-on' : ''}`}>
          {view.turn === opp && !view.over && <span className="game-turn-dot" aria-hidden="true" />}
          <span className="font-semibold">{name(opp)}</span>
          <span className="text-white/70">{view.handCounts[opp]} card{view.handCounts[opp] === 1 ? '' : 's'}</span>
        </div>
        <CardBacks count={view.handCounts[opp]} size="sm" label={`${name(opp)} holds ${view.handCounts[opp]} cards`} />

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full py-2">
          <Books ranks={view.books[opp]} label={name(opp)} />
          <div className="relative flex flex-col items-center gap-1 px-2">
            <div className="relative w-12 h-[68px] pond-bob" role="img" aria-label={`${view.deckCount} cards left in the pond`}>
              {pile === 0
                ? <span className="absolute inset-0 rounded-lg border border-dashed border-white/30" />
                : Array.from({ length: pile }, (_, i) => (
                  <PlayingCard key={i} faceDown size="md" className="absolute inset-0"
                    style={{ transform: `rotate(${(i * 37) % 24 - 12}deg) translate(${(i * 13) % 7 - 3}px, ${-i}px)` }} />
                ))}
              {splash && <span key={view.log.length} className="pond-ripple pond-splash absolute left-1/2 top-1/2 w-24 h-24 border-2" aria-hidden="true" />}
            </div>
            <span className="game-stage-label">{view.deckCount} in the pond</span>
          </div>
          <Books ranks={view.books[me]} label={name(me)} />
        </div>

        {splash && !view.over && <span key={`t${view.log.length}`} className="game-toast text-white" style={{ top: '46%' }} aria-hidden="true">{splash}</span>}

        <div className={`game-seat text-white ${view.turn === me && !view.over ? 'game-seat-on' : ''}`}>
          {view.turn === me && !view.over && <span className="game-turn-dot" aria-hidden="true" />}
          <span className="font-semibold">{name(me)}</span>
          <span className="text-white/70">{view.handCounts[me]} card{view.handCounts[me] === 1 ? '' : 's'}</span>
        </div>
        {seat !== null && (
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 pt-1">
            {Object.entries(groups).map(([rank, cards]) => (
              <button key={rank} type="button" disabled={!myTurn || busy || !askable.has(rank)} onClick={() => move({ type: 'ask', rank })}
                aria-label={`Ask for ${rankLabel(rank)}s (you have ${cards.length})`}
                className="flex rounded-lg enabled:hover:-translate-y-1.5 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
                {cards.map((c, i) => <PlayingCard key={c} card={c} enter="deal" className={i ? '-ml-8' : ''} />)}
              </button>
            ))}
          </div>
        )}
        {seat === null && <CardBacks count={view.handCounts[me]} size="sm" />}
      </div>

      {lastLog && (
        <p className="text-sm text-[var(--text-secondary)] text-center" aria-live="polite">
          {lastLog.s !== null && lastLog.s !== undefined && <span className="font-semibold text-[var(--text-primary)]">{name(lastLog.s)} </span>}
          {logText(lastLog, name)}
        </p>
      )}
      {myTurn && <p className="text-xs text-[var(--text-muted)]">Tap a set of your cards to ask {name(opp)} for that rank.</p>}
    </div>
  );
}

// Three to five players: everyone else around the top of the pond. On your
// turn, pick who to ask (the first player after you with cards to start
// with), then tap a set of your cards.
function GoFishTable({ view, seat, players, move, busy, myTurn }) {
  const n = view.n;
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Player');
  const me = seat ?? 0;
  const others = Array.from({ length: n - 1 }, (_, k) => (me + 1 + k) % n);
  const askableFrom = others.filter(s => !view.out[s]);
  const firstWithCards = askableFrom.find(s => view.handCounts[s] > 0) ?? askableFrom[0];
  const [picked, setPicked] = useState(null);
  const target = askableFrom.includes(picked) ? picked : firstWithCards;
  const groups = {};
  for (const c of [...view.hand].sort((a, b) => RANK_ORDER.indexOf(a[0]) - RANK_ORDER.indexOf(b[0]))) (groups[c[0]] ??= []).push(c);
  const askable = new Set(view.askable);
  const splash = lastFishing(view.log);
  const lastLog = view.log?.[view.log.length - 1];
  const pile = Math.min(view.deckCount, 6);
  const logName = s => (s === seat ? 'you' : players[s]?.displayName ?? 'someone');

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="pond game-stage w-full max-w-lg px-3 pt-3 pb-4 flex flex-col items-center gap-3">
        <div className="pond-caustics" aria-hidden="true" />
        {RIPPLES.map(([x, y, d], i) => (
          <span key={i} className="pond-ripple" aria-hidden="true" style={{ left: `${x}%`, top: `${y}%`, width: 180, height: 70, animationDelay: `${d}s` }} />
        ))}
        {FISH.map((f, i) => (
          <span key={i} className="pond-fish left-0 w-full" aria-hidden="true" style={{ top: f.top, '--swim': f.swim, '--delay': f.delay, '--dir': f.dir }}>
            <Fish size={f.size} />
          </span>
        ))}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full" role={myTurn ? 'radiogroup' : undefined} aria-label={myTurn ? 'Who to ask' : 'Other players'}>
          {others.map(s => {
            const out = view.out[s];
            const chosen = myTurn && target === s;
            const Tag = myTurn && !out ? 'button' : 'div';
            return (
              <Tag key={s} {...(Tag === 'button' && { type: 'button', role: 'radio', 'aria-checked': chosen, onClick: () => setPicked(s), disabled: busy })}
                className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 border text-white transition-colors
                  ${chosen ? 'border-white/80 bg-white/15' : 'border-white/15 bg-black/10'} ${out ? 'opacity-40' : ''}
                  ${view.turn === s && !view.over ? 'game-seat-on' : ''}`}>
                <span className="flex items-center gap-1 text-xs font-semibold max-w-full">
                  {view.turn === s && !view.over && <span className="game-turn-dot" aria-hidden="true" />}
                  <span className="truncate">{name(s)}</span>
                </span>
                {out
                  ? <span className="text-[11px] text-white/70">Out</span>
                  : <CardBacks count={view.handCounts[s]} size="xs" label={`${name(s)} holds ${view.handCounts[s]} cards`} />}
                <span className="text-[11px] text-white/75">
                  {view.handCounts[s]} card{view.handCounts[s] === 1 ? '' : 's'} · {view.books[s].length} book{view.books[s].length === 1 ? '' : 's'}
                </span>
              </Tag>
            );
          })}
        </div>

        <div className="relative flex flex-col items-center gap-1 py-2">
          <div className="relative w-12 h-[68px] pond-bob" role="img" aria-label={`${view.deckCount} cards left in the pond`}>
            {pile === 0
              ? <span className="absolute inset-0 rounded-lg border border-dashed border-white/30" />
              : Array.from({ length: pile }, (_, i) => (
                <PlayingCard key={i} faceDown size="md" className="absolute inset-0"
                  style={{ transform: `rotate(${(i * 37) % 24 - 12}deg) translate(${(i * 13) % 7 - 3}px, ${-i}px)` }} />
              ))}
            {splash && <span key={view.log.length} className="pond-ripple pond-splash absolute left-1/2 top-1/2 w-24 h-24 border-2" aria-hidden="true" />}
          </div>
          <span className="game-stage-label">{view.deckCount} in the pond</span>
        </div>

        {splash && !view.over && <span key={`t${view.log.length}`} className="game-toast text-white" style={{ top: '46%' }} aria-hidden="true">{splash}</span>}

        <Books ranks={view.books[me]} label={name(me)} />
        <div className={`game-seat text-white ${view.turn === me && !view.over ? 'game-seat-on' : ''}`}>
          {view.turn === me && !view.over && <span className="game-turn-dot" aria-hidden="true" />}
          <span className="font-semibold">{name(me)}</span>
          <span className="text-white/70">{view.handCounts[me]} card{view.handCounts[me] === 1 ? '' : 's'}</span>
        </div>
        {seat !== null && (
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 pt-1">
            {Object.entries(groups).map(([rank, cards]) => (
              <button key={rank} type="button" disabled={!myTurn || busy || !askable.has(rank) || target === undefined}
                onClick={() => move({ type: 'ask', rank, from: target })}
                aria-label={`Ask ${name(target)} for ${rankLabel(rank)}s (you have ${cards.length})`}
                className="flex rounded-lg enabled:hover:-translate-y-1.5 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
                {cards.map((c, i) => <PlayingCard key={c} card={c} enter="deal" className={i ? '-ml-8' : ''} />)}
              </button>
            ))}
          </div>
        )}
        {seat === null && <CardBacks count={view.handCounts[me]} size="sm" />}
      </div>

      {lastLog && (
        <p className="text-sm text-[var(--text-secondary)] text-center" aria-live="polite">
          {lastLog.s !== null && lastLog.s !== undefined && <span className="font-semibold text-[var(--text-primary)]">{name(lastLog.s)} </span>}
          {logText(lastLog, logName)}
        </p>
      )}
      {myTurn && target !== undefined && <p className="text-xs text-[var(--text-muted)]">Asking {name(target)}. Tap another player to change, then tap a set of your cards.</p>}
    </div>
  );
}
