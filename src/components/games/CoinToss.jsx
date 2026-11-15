import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import './games.css';

const TOSS_MS = 1900;

// The aura coin: the halo on heads, a star on tails. It's tossed once when
// the page opens (the flip itself happened on the server the moment the
// challenge was accepted) and lands on the real result.
export default function CoinToss({ view, players, seat }) {
  const [landed, setLanded] = useState(false);
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    // start face up, then spin six full turns plus half a turn for tails
    const go = requestAnimationFrame(() => setTurn(360 * 6 + (view.result === 'tails' ? 180 : 0)));
    const t = setTimeout(() => setLanded(true), TOSS_MS);
    return () => { cancelAnimationFrame(go); clearTimeout(t); };
  }, [view.result]);
  const caller = seat === 0 ? 'You' : players[0]?.displayName ?? 'The challenger';
  const winner = view.winner;
  const winnerName = winner === seat ? 'You win' : `${players[winner]?.displayName ?? 'They'} wins`;

  return (
    <div className="coin-stage game-stage flex flex-col items-center gap-4 px-4 pt-14 pb-6">
      <span className="game-stage-label">{caller} called {view.call}</span>
      <div className="coin-toss">
        <div className={`coin-scene ${landed ? 'coin-glow' : ''}`}>
          <div className="coin-spin" style={{ transform: `rotateX(${turn}deg)` }}>
            <div className="coin-face">
              <img src="/aura-halo.webp" alt="" className="w-16 h-16 object-contain opacity-80 mix-blend-multiply" draggable={false} />
              <span className="absolute font-wordmark text-4xl italic font-bold">A</span>
            </div>
            <div className="coin-face coin-back">
              <Star size={54} strokeWidth={1.6} fill="currentColor" fillOpacity={0.2} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <div className="coin-shadow coin-shadow-toss" aria-hidden="true" />
      <p className="text-base font-semibold text-white min-h-[1.5rem] text-center" aria-live="polite">
        {landed ? <>It landed <span className="text-amber-300">{view.result}</span>. {winnerName}!</> : 'Flipping…'}
      </p>
    </div>
  );
}
