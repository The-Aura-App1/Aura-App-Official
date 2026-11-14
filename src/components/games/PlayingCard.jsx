import React from 'react';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
const RANK_NAME = { T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };

export const suitSymbol = s => SUIT[s];
export const suitName = s => SUIT_NAME[s];
export const rankLabel = r => RANK[r] ?? r;
export const cardLabel = c => `${RANK_NAME[c[0]] ?? c[0]} of ${SUIT_NAME[c[1]]}`;
const red = s => s === 'h' || s === 'd';

const SIZES = {
  sm: 'w-9 h-[52px] text-[11px] rounded-md',
  md: 'w-12 h-[68px] text-sm rounded-lg',
  lg: 'w-16 h-[90px] text-base rounded-lg',
};

// A playing card, face up ('Ts' = ten of spades) or face down. Playing cards
// stay white with red/black suits in every theme so they read as cards.
export default function PlayingCard({ card, faceDown = false, size = 'md', onClick, disabled, dim, raised, label, className = '' }) {
  const box = `${SIZES[size]} flex-shrink-0 border shadow-md select-none ${className}`;
  if (faceDown || !card) {
    return (
      <div aria-hidden={!label} aria-label={label} className={`${box} border-white/20`}
        style={{ background: 'repeating-linear-gradient(45deg, var(--brand-1), var(--brand-1) 4px, var(--brand-2) 4px, var(--brand-2) 8px)' }} />
    );
  }
  const color = red(card[1]) ? 'text-red-600' : 'text-slate-900';
  const face = (
    <>
      <span className="absolute top-1 left-1.5 leading-none font-bold">{rankLabel(card[0])}<br />{SUIT[card[1]]}</span>
      <span className="absolute inset-0 flex items-center justify-center text-[1.6em] leading-none">{SUIT[card[1]]}</span>
    </>
  );
  const look = `${box} relative bg-white border-slate-300 ${color} transition-all duration-150
    ${dim ? 'opacity-40' : ''} ${raised ? '-translate-y-2 ring-2 ring-aura-400' : ''}`;
  if (!onClick) return <div className={look} role="img" aria-label={cardLabel(card)}>{face}</div>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label ?? cardLabel(card)}
      className={`${look} hover:-translate-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-400 disabled:hover:translate-y-0 disabled:cursor-default`}>
      {face}
    </button>
  );
}

// An overlapping row of cards that wraps on narrow screens
export function Hand({ children }) {
  return <div className="flex flex-wrap gap-1.5 justify-center pt-2">{children}</div>;
}
