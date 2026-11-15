import React, { useState } from 'react';
import './games.css';

const COLS = 7;
const ROWS = 6;
const SEAT_NAMES = ['violet', 'gold'];

// Connect 4 on a glassy board in the theme's colors, with stars behind the
// holes. Discs drop into place; the winning four glow.
export default function Connect4Board({ view, seat, players, move, busy, myTurn }) {
  const [hover, setHover] = useState(null);
  const line = new Set((view.line ?? []).map(([c, r]) => `${c},${r}`));
  const [lc, lr] = view.last ?? [];
  const turnSeat = view.turn;
  const canPlay = myTurn && !busy && !view.over;
  const name = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Opponent');
  const discs = view.cols.reduce((n, c) => n + c.length, 0);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
        {[0, 1].map(s => (
          <div key={s} className={`game-seat bg-[var(--bg-elevated)] text-[var(--text-primary)] ${turnSeat === s ? 'game-seat-on' : ''}`}
            style={{ background: 'color-mix(in srgb, var(--bg-elevated) 85%, transparent)' }}>
            <span className="flex items-center gap-2 min-w-0">
              <span className={`c4-disc c4-p${s} relative w-4 h-4 flex-shrink-0`} aria-hidden="true" />
              <span className="font-semibold truncate">{name(s)}</span>
            </span>
            {turnSeat === s && <span className="game-turn-dot flex-shrink-0" aria-label="to move" />}
          </div>
        ))}
      </div>
      {seat !== null && !view.over && <p className="text-xs text-[var(--text-muted)]">You're <span className="font-semibold">{SEAT_NAMES[seat]}</span>. {myTurn ? 'Tap a column to drop a disc.' : ''}</p>}

      <div className="w-full max-w-sm" onPointerLeave={() => setHover(null)}>
        {/* the disc waiting above the board */}
        <div className="grid grid-cols-7 gap-1.5 px-2.5 h-9" aria-hidden="true">
          {Array.from({ length: COLS }, (_, c) => (
            <span key={c} className="flex items-end justify-center">
              {canPlay && hover === c && view.cols[c].length < ROWS && <span className={`c4-disc c4-p${seat} c4-ghost relative w-[78%] aspect-square`} />}
            </span>
          ))}
        </div>
        <div className="c4-frame relative grid grid-cols-7 gap-1.5 p-2.5 rounded-2xl overflow-hidden" role="grid" aria-label={`Connect 4 board, ${discs} discs played`}>
          {Array.from({ length: COLS }, (_, c) => {
            const full = view.cols[c].length >= ROWS;
            return (
              <button key={c} type="button" disabled={!canPlay || full} onClick={() => move({ col: c })}
                onPointerEnter={() => setHover(c)} onFocus={() => setHover(c)}
                aria-label={`Drop in column ${c + 1}${full ? ' (full)' : ''}`}
                className={`flex flex-col-reverse gap-1.5 rounded-xl p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70
                  ${canPlay && hover === c && !full ? 'bg-white/10' : ''}`}>
                {Array.from({ length: ROWS }, (_, r) => {
                  const owner = view.cols[c][r];
                  const win = line.has(`${c},${r}`);
                  const fresh = c === lc && r === lr;
                  return (
                    <span key={r} className="c4-hole relative aspect-square w-full rounded-full overflow-visible">
                      <span className="c4-stars absolute inset-0 rounded-full" />
                      {owner !== undefined && (
                        <span className={`c4-disc c4-p${owner} absolute inset-[6%] ${fresh ? 'c4-drop' : ''} ${win ? 'c4-win' : ''}`}
                          style={fresh ? { '--fall': ROWS - r } : undefined} />
                      )}
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
        <div className="mx-3 h-3 rounded-b-xl bg-black/30 blur-[3px]" aria-hidden="true" />
      </div>
    </div>
  );
}
