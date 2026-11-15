import React, { useRef } from 'react';
import { Dice5 } from 'lucide-react';
import './games.css';

// Pips on a 3×3 grid for each face
const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// Each face's place on the cube, and the turn that brings it to the front
const FACES = { 1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 3: 'rotateY(90deg)', 4: 'rotateY(-90deg)', 2: 'rotateX(90deg)', 5: 'rotateX(-90deg)' };
const SHOW = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

function Face({ n, size }) {
  return (
    <span className="die-face" style={{ transform: `${FACES[n]} translateZ(${size / 2}px)` }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[n].includes(i) ? `die-pip ${n === 1 ? 'die-pip-red' : ''}` : ''} />
      ))}
    </span>
  );
}

// A die that tumbles to its value whenever `rolls` (how many times it's been
// rolled) goes up. Tumbling adds whole turns, so it lands on the same face.
function Die({ value, rolls, size = 52, tilt = 0 }) {
  const spins = useRef(0);
  const seen = useRef(rolls);
  if (rolls !== seen.current) {   // a new roll: two extra turns on the way to the new face
    seen.current = rolls;
    spins.current += 2;
  }
  const [x, y] = SHOW[value] ?? [0, 0];
  const turns = spins.current * 360;
  // the hop restarts by swapping between two identical animations
  const hop = spins.current === 0 ? '' : spins.current % 4 === 2 ? 'die-hop' : 'die-hop2';
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${value}`}>
      <div className={`die-scene ${hop}`} style={{ '--die': `${size}px` }}>
        <div className="die-cube" style={{ transform: `rotateZ(${tilt}deg) rotateX(${x + turns}deg) rotateY(${y + turns}deg)` }}>
          {[1, 2, 3, 4, 5, 6].map(n => <Face key={n} n={n} size={size} />)}
        </div>
      </div>
      <div className="die-shadow" aria-hidden="true" />
    </div>
  );
}

// Dice Duel on a felt tray. Each side shows its latest two dice (this round's
// once rolled, otherwise last round's), the round tally, and the history.
export default function DiceTray({ view, seat, players, move, busy, myTurn }) {
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Opponent');
  const lastRound = view.rounds[view.rounds.length - 1];
  const shown = [0, 1].map(s => view.rolls[s] ?? lastRound?.rolls[s] ?? null);
  // how many times each seat has rolled, so a die knows when to tumble
  const rolled = [0, 1].map(s => view.rounds.length + (view.rolls[s] ? 1 : 0));
  const total = r => (r ? r[0] + r[1] : null);
  const order = seat === 1 ? [1, 0] : [0, 1];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="dice-tray game-stage w-full max-w-md px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-center gap-2" aria-label="Rounds won">
          {order.map((s, i) => (
            <React.Fragment key={s}>
              {i === 1 && <span className="game-stage-label px-1">best of 3</span>}
              <span className="flex gap-1">
                {[0, 1].map(k => (
                  <span key={k} className={`w-3 h-3 rounded-full border border-white/40 transition-colors ${view.wins[s] > k ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]' : ''}`} />
                ))}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {order.map(s => {
            const r = shown[s];
            const fresh = !!view.rolls[s];
            return (
              <div key={s} className="flex flex-col items-center gap-3">
                <div className={`game-seat text-white ${view.turn === s && !view.over ? 'game-seat-on' : ''}`}>
                  {view.turn === s && !view.over && <span className="game-turn-dot" aria-hidden="true" />}
                  <span className="font-semibold truncate max-w-[7rem]">{name(s)}</span>
                </div>
                <div className="flex gap-3 min-h-[66px] items-start" aria-label={`${name(s)}'s dice`}>
                  {r
                    ? r.map((v, i) => <Die key={i} value={v} rolls={rolled[s]} tilt={i ? 8 : -6} />)
                    : <span className="text-xs text-white/60 self-center">Not rolled yet</span>}
                </div>
                <span className={`text-2xl font-bold tabular-nums ${fresh ? 'text-white' : 'text-white/45'}`}>{total(r) ?? '–'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {myTurn && (
        <button type="button" disabled={busy} onClick={() => move({ type: 'roll' })} className="btn-primary dice-shake text-base px-6">
          <Dice5 size={18} aria-hidden="true" /> Roll the dice
        </button>
      )}

      {view.rounds.length > 0 && (
        <ol className="w-full max-w-sm flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          {view.rounds.map((round, i) => (
            <li key={i} className="flex justify-between border-b border-[var(--border)] last:border-0 py-1">
              <span>Round {i + 1}</span>
              <span className="tabular-nums">{total(round.rolls[0])} – {total(round.rolls[1])}</span>
              <span className="font-semibold text-[var(--text-secondary)]">{round.winner === null ? 'Tie, rolled again' : `${name(round.winner)} won`}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
