import React, { useEffect, useRef, useState } from 'react';
import { Dice5 } from 'lucide-react';
import './games.css';

// Pips on a 3×3 grid for each face
const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// Each face's place on the cube, and the turn that brings it to the front
const FACES = { 1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 3: 'rotateY(90deg)', 4: 'rotateY(-90deg)', 2: 'rotateX(90deg)', 5: 'rotateX(-90deg)' };
const SHOW = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

// How long a throw takes, from leaving the hand to settling (matches games.css)
export const ROLL_MS = 2000;

function Face({ n, size }) {
  return (
    <span className="die-face" style={{ transform: `${FACES[n]} translateZ(${size / 2}px)` }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[n].includes(i) ? `die-pip ${n === 1 ? 'die-pip-red' : ''}` : ''} />
      ))}
    </span>
  );
}

// True for ROLL_MS after `key` changes (not on first show), while dice are in the air
function useRolling(key) {
  const [rolling, setRolling] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setRolling(true);
    const t = setTimeout(() => setRolling(false), ROLL_MS);
    return () => clearTimeout(t);
  }, [key]);
  return rolling;
}

// A die thrown into the tray whenever `rolls` (how many times it's been
// rolled) goes up: it flies in from the side, tumbles fast, then slows right
// down over the last turns and wobbles before it settles. Tumbling adds whole
// turns, so it lands on the right face.
function Die({ value, rolls, size = 52, tilt = 0, from = -1 }) {
  const spins = useRef(0);
  const seen = useRef(rolls);
  if (rolls !== seen.current) {
    seen.current = rolls;
    spins.current += 1;
  }
  const [x, y] = SHOW[value] ?? [0, 0];
  const k = spins.current;
  // more turns on one axis than the other, so it tumbles rather than spins
  const tx = x + k * 360 * 3;
  const ty = y + k * 360 * 2;
  // the throw restarts by swapping between two identical animations
  const throwClass = k === 0 ? '' : k % 2 ? 'die-throw' : 'die-throw2';
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${value}`}>
      <div className={`die-scene ${throwClass}`} style={{ '--die': `${size}px`, '--from-x': `${from * (40 + size / 2)}px` }}>
        <div className="die-cube" style={{ transform: `rotateZ(${tilt}deg) rotateX(${tx}deg) rotateY(${ty}deg)` }}>
          {[1, 2, 3, 4, 5, 6].map(n => <Face key={n} n={n} size={size} />)}
        </div>
      </div>
      <div className={`die-shadow ${throwClass ? `${throwClass}-shadow` : ''}`} aria-hidden="true" />
    </div>
  );
}

// The total under a pair of dice: while they're in the air it flickers
// through numbers, slowing down, and only shows the real total once they land
function RollingTotal({ value, rolling, fresh, big = true }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!rolling) { setShown(value); return undefined; }
    let delay = 55;
    let t;
    const tick = () => {
      setShown(2 + Math.floor(Math.random() * 11));
      delay *= 1.14;
      t = setTimeout(tick, delay);
    };
    tick();
    return () => clearTimeout(t);
  }, [rolling, value]);
  return (
    <span key={rolling ? 'rolling' : `v${value}`} aria-live={rolling ? 'off' : 'polite'}
      className={`${big ? 'text-2xl' : 'text-xl'} font-bold tabular-nums inline-block
        ${rolling ? 'text-white/50' : fresh ? 'text-white dice-total-pop' : 'text-white/45'}`}>
      {rolling ? shown : value ?? '–'}
    </span>
  );
}

// "Ann takes the round!" once the deciding dice have landed
function RoundBanner({ rounds, name }) {
  const [show, setShow] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const on = setTimeout(() => setShow(true), ROLL_MS);
    const off = setTimeout(() => setShow(false), ROLL_MS + 2600);
    return () => { clearTimeout(on); clearTimeout(off); setShow(false); };
  }, [rounds.length]);
  const last = rounds[rounds.length - 1];
  if (!show || !last) return null;
  const who = last.winner === null ? null : name(last.winner);
  return (
    <div className="dice-banner absolute left-1/2 top-1/2 z-10 px-5 py-2.5 rounded-2xl text-center pointer-events-none" role="status">
      <span className="block text-lg font-extrabold text-white whitespace-nowrap">
        {who === null ? 'Tie! Roll again' : `${who} ${who === 'You' ? 'take' : 'takes'} the round!`}
      </span>
    </div>
  );
}

// One player's spot on the tray
function Seat({ s, view, name, rolled, shownRoll, size, compact, from }) {
  const rolling = useRolling(rolled);
  const total = shownRoll ? shownRoll[0] + shownRoll[1] : null;
  const out = view.out?.[s];
  const sittingOut = !out && !view.over && view.rolling && !view.rolling.includes(s);
  const lastRound = view.rounds[view.rounds.length - 1];
  const wonLast = !rolling && lastRound?.winner === s && !view.rolls.some(Boolean);
  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-3'} transition-opacity ${out || sittingOut ? 'opacity-40' : ''}`}>
      <div className={`game-seat text-white max-w-full ${view.turn === s && !view.over ? 'game-seat-on' : ''} ${wonLast ? 'dice-seat-won' : ''}`}>
        {view.turn === s && !view.over && <span className="game-turn-dot" aria-hidden="true" />}
        <span className={`font-semibold truncate ${compact ? 'max-w-[6rem]' : 'max-w-[7rem]'}`}>{name(s)}</span>
      </div>
      {compact && (
        <span className="flex gap-1" aria-label={`${name(s)} has won ${view.wins[s]} round${view.wins[s] === 1 ? '' : 's'}`}>
          {[0, 1].map(k => (
            <span key={k} className={`w-2.5 h-2.5 rounded-full border border-white/40 ${view.wins[s] > k ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]' : ''}`} />
          ))}
        </span>
      )}
      <div className={`flex ${compact ? 'gap-2 min-h-[52px]' : 'gap-3 min-h-[66px]'} items-start`} aria-label={`${name(s)}'s dice`} aria-busy={rolling}>
        {out
          ? <span className="text-xs text-white/70 self-center">Out</span>
          : shownRoll
            ? shownRoll.map((v, i) => <Die key={i} value={v} rolls={rolled} size={size} tilt={i ? 8 : -6} from={from * (i ? 1.2 : 1)} />)
            : <span className="text-xs text-white/60 self-center">{sittingOut ? 'Sitting out' : 'Not rolled yet'}</span>}
      </div>
      {!out && <RollingTotal value={total} rolling={rolling} fresh={!!view.rolls[s]} big={!compact} />}
    </div>
  );
}

// Dice Duel on a felt tray. Each player shows their latest two dice (this
// round's once rolled, otherwise last round's), their rounds won, and below
// the tray the history. With more than two players the tray is a grid, and
// in a roll-off the players not in it sit back.
export default function DiceTray({ view, seat, players, move, busy, myTurn }) {
  const n = view.n ?? 2;
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? (n > 2 ? 'Player' : 'Opponent'));
  const total = r => (r ? r[0] + r[1] : null);
  const lastRound = view.rounds[view.rounds.length - 1];
  const start = seat ?? 0;
  const order = n === 2 ? (seat === 1 ? [1, 0] : [0, 1]) : Array.from({ length: n }, (_, k) => (start + k) % n);
  // What each seat shows: this round's roll, or last round's until the new
  // round gets going (so the deciding throw stays on the tray as it lands)
  const roundStarted = view.rolls.some(Boolean);
  const shownRoll = s => view.rolls[s] ?? (n > 2 && roundStarted ? null : lastRound?.rolls[s] ?? null);
  // how many times each seat has rolled, so a die knows when to tumble
  const rolled = s => view.rounds.filter(r => r.rolls[s]).length + (view.rolls[s] ? 1 : 0);
  const rollOff = n > 2 && view.rolling && view.rolling.length < n - (view.out ?? []).filter(Boolean).length;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`dice-tray game-stage relative w-full ${n > 2 ? 'max-w-lg px-4 py-5 gap-4' : 'max-w-md px-5 py-6 gap-5'} flex flex-col`}>
        {n === 2 ? (
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
        ) : (
          <span className="game-stage-label text-center">
            {view.over ? 'Game over' : rollOff ? 'Roll-off: the tied players roll again' : `Round ${view.rounds.filter(r => r.winner !== null).length + 1} · first to two rounds`}
          </span>
        )}
        <div className={n === 2 ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5'}>
          {order.map((s, i) => (
            <Seat key={s} s={s} view={view} name={name} rolled={rolled(s)} shownRoll={shownRoll(s)}
              size={n === 2 ? 52 : 40} compact={n > 2} from={i % 2 ? 1 : -1} />
          ))}
        </div>
        <RoundBanner rounds={view.rounds} name={name} />
      </div>

      {myTurn && (
        <button type="button" disabled={busy} onClick={() => move({ type: 'roll' })} className="btn-primary dice-shake text-base px-6">
          <Dice5 size={18} aria-hidden="true" /> Roll the dice
        </button>
      )}

      {view.rounds.length > 0 && (
        <ol className="w-full max-w-sm flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          {view.rounds.map((round, i) => {
            const best = Math.max(...round.rolls.map(r => total(r) ?? 0));
            return (
              <li key={i} className="flex justify-between gap-2 border-b border-[var(--border)] last:border-0 py-1">
                <span>Round {view.rounds.slice(0, i).filter(x => x.winner !== null).length + 1}</span>
                {n === 2 && <span className="tabular-nums">{total(round.rolls[0])} – {total(round.rolls[1])}</span>}
                <span className="font-semibold text-[var(--text-secondary)] text-right">
                  {round.winner === null
                    ? (n === 2 ? 'Tie, rolled again' : `Tie at ${best}: ${round.tied.map(name).join(', ')} rolled again`)
                    : n === 2 ? `${name(round.winner)} won` : `${name(round.winner)} won with ${best}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
