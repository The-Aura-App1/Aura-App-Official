import React from 'react';
import './games.css';

// Suits are drawn as SVG: as text (♥ ♦ ♠ ♣) phones can turn them into emoji,
// which ignore the card's red or black and look out of place
const SUIT_SHAPES = {
  h: <path d="M50 90 C20 66 6 50 6 31 C6 16 17 6 30 6 C40 6 47 12 50 21 C53 12 60 6 70 6 C83 6 94 16 94 31 C94 50 80 66 50 90 Z" />,
  d: <path d="M50 4 L86 50 L50 96 L14 50 Z" />,
  s: <path d="M50 4 C30 30 8 44 8 62 C8 76 19 84 31 84 C39 84 45 80 48 74 C47 84 43 90 35 96 H65 C57 90 53 84 52 74 C55 80 61 84 69 84 C81 84 92 76 92 62 C92 44 70 30 50 4 Z" />,
  c: <><circle cx="50" cy="27" r="19" /><circle cx="27" cy="57" r="19" /><circle cx="73" cy="57" r="19" /><circle cx="50" cy="52" r="12" />
    <path d="M45 55 C45 76 40 88 33 96 H67 C60 88 55 76 55 55 Z" /></>,
};
export function Suit({ s, className = '' }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" focusable="false" data-suit={s}
      className={`inline-block w-[0.9em] h-[0.9em] align-[-0.1em] ${className}`}>{SUIT_SHAPES[s]}</svg>
  );
}
const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
const RANK_NAME = { T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
export const RANK_ORDER = '23456789TJQKA';

export const suitSymbol = s => <Suit s={s} />;
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
      <span className="absolute top-[6%] left-[10%] leading-[0.95] font-bold text-center">{rankLabel(card[0])}<br /><Suit s={card[1]} /></span>
      {size !== 'xs' && (
        <span className="absolute bottom-[6%] right-[10%] leading-[0.95] font-bold text-center rotate-180">{rankLabel(card[0])}<br /><Suit s={card[1]} /></span>
      )}
      <span className={`absolute inset-0 flex items-center justify-center leading-none ${size === 'xs' ? 'text-[1.5em] pt-2' : 'text-[1.7em]'}`}><Suit s={card[1]} /></span>
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
