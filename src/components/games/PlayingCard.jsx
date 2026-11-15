import React from 'react';
import './games.css';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
const RANK_NAME = { T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
export const RANK_ORDER = '23456789TJQKA';

export const suitSymbol = s => SUIT[s];
export const suitName = s => SUIT_NAME[s];
export const rankLabel = r => RANK[r] ?? r;
export const cardLabel = c => `${RANK_NAME[c[0]] ?? c[0]} of ${SUIT_NAME[c[1]]}`;
const red = s => s === 'h' || s === 'd';

const SIZES = {
  xs: 'w-7 h-10 text-[9px] rounded',
  sm: 'w-9 h-[52px] text-[11px] rounded-md',
  md: 'w-12 h-[68px] text-sm rounded-lg',
  lg: 'w-16 h-[90px] text-base rounded-lg',
};

// How a card arrives: 'deal' slides it in, 'flip' turns it face up
const ENTER = { deal: 'card-deal', flip: 'card-flip' };

// A playing card, face up ('Ts' = ten of spades) or face down. Playing cards
// stay white with red/black suits in every theme so they read as cards; the
// backs wear the theme's colors with the halo in the middle.
export default function PlayingCard({ card, faceDown = false, size = 'md', onClick, disabled, dim, raised, label, className = '', enter, delay = 0, style }) {
  const motion = enter ? ENTER[enter] : '';
  const timing = { ...(delay ? { animationDelay: `${delay}ms` } : null), ...style };
  const box = `${SIZES[size]} flex-shrink-0 select-none ${motion} ${className}`;
  if (faceDown || !card) {
    return <div aria-hidden={!label} aria-label={label} role={label ? 'img' : undefined} className={`${box} card-back`} style={timing} />;
  }
  const color = red(card[1]) ? 'text-red-600' : 'text-slate-900';
  const face = (
    <>
      <span className="absolute top-[6%] left-[10%] leading-[0.95] font-bold text-center">{rankLabel(card[0])}<br />{SUIT[card[1]]}</span>
      {size !== 'xs' && (
        <span className="absolute bottom-[6%] right-[10%] leading-[0.95] font-bold text-center rotate-180">{rankLabel(card[0])}<br />{SUIT[card[1]]}</span>
      )}
      <span className={`absolute inset-0 flex items-center justify-center leading-none ${size === 'xs' ? 'text-[1.5em] pt-2' : 'text-[1.7em]'}`}>{SUIT[card[1]]}</span>
    </>
  );
  const look = `${box} relative border border-slate-300 ${color} transition-[transform,opacity,box-shadow] duration-150
    shadow-[0_3px_8px_-2px_rgba(0,0,0,0.45)] bg-[linear-gradient(160deg,#ffffff,#f4f1ea)]
    ${dim ? 'opacity-40' : ''} ${raised ? '-translate-y-2 ring-2 ring-aura-400' : ''}`;
  if (!onClick) return <div className={look} style={timing} role="img" aria-label={cardLabel(card)}>{face}</div>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label ?? cardLabel(card)} style={timing}
      className={`${look} hover:-translate-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-400 disabled:hover:translate-y-0 disabled:cursor-default`}>
      {face}
    </button>
  );
}

// An overlapping row of cards that wraps on narrow screens
export function Hand({ children }) {
  return <div className="flex flex-wrap gap-1.5 justify-center pt-2">{children}</div>;
}

// A fan of face-down cards (someone else's hand)
export function CardBacks({ count, size = 'sm', max = 12, label }) {
  const n = Math.min(count, max);
  const mid = (n - 1) / 2;
  return (
    <div className="flex justify-center" role="img" aria-label={label ?? `${count} card${count === 1 ? '' : 's'}`}>
      {Array.from({ length: n }, (_, i) => (
        <PlayingCard key={i} faceDown size={size} className="-mx-2.5 first:ml-0 last:mr-0"
          style={{ transform: `rotate(${(i - mid) * 4}deg) translateY(${Math.abs(i - mid) * 1.5}px)` }} />
      ))}
    </div>
  );
}
