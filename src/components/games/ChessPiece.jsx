import React from 'react';

// Chess pieces drawn as SVG (our own shapes), so they look the same on every
// device. As text symbols, phones drew the pawn (♟) as an emoji that ignores
// CSS color, so every pawn came out the same. White is ivory with a dark
// outline, black is near-black with a light rim; both read on every square.
const LOOK = {
  w: { fill: '#f7f3e8', line: '#1b1b1f', detail: '#1b1b1f', width: 4 },
  b: { fill: '#1e1e24', line: '#ece7da', detail: '#ece7da', width: 3 },
};

const BASE = <rect x="22" y="80" width="56" height="11" rx="3.5" />;

const SHAPES = {
  p: () => (
    <>
      <circle cx="50" cy="29" r="13" />
      <path d="M39 46 h22 c-1 12 3 22 9 34 H30 c6-12 10-22 9-34 Z" />
      <rect x="35" y="42" width="30" height="7" rx="3.5" />
      {BASE}
    </>
  ),
  r: () => (
    <>
      <path d="M27 14 h11 v8 h7 v-8 h10 v8 h7 v-8 h11 v22 H27 Z" />
      <path d="M34 36 h32 l3 44 H31 Z" />
      {BASE}
    </>
  ),
  n: d => (
    <>
      <path d="M31 80 c-1-17 6-26 15-33 c-7 0-14 3-20-2 c-5-4-3-11 3-17 c6-6 11-11 13-17 l4-3 l3 6 c16 2 27 16 27 36 c0 12-2 20-2 30 Z" />
      <circle cx="45" cy="30" r="3" fill={d} stroke="none" />
      <path d="M58 22 c6 6 9 15 8 26" fill="none" stroke={d} strokeWidth="2.5" />
      {BASE}
    </>
  ),
  b: d => (
    <>
      <circle cx="50" cy="12" r="5" />
      <path d="M50 17 c13 11 18 24 12 37 H38 c-6-13-1-26 12-37 Z" />
      <path d="M41 54 h18 l7 26 H34 Z" />
      <rect x="36" y="51" width="28" height="6" rx="3" />
      <path d="M55 27 L45 40" fill="none" stroke={d} strokeWidth="3" />
      {BASE}
    </>
  ),
  q: () => (
    <>
      <path d="M27 62 L18 26 L36 46 L41 18 L50 42 L59 18 L64 46 L82 26 L73 62 Z" />
      {[[18, 24], [41, 16], [59, 16], [82, 24]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" />)}
      <path d="M29 62 h42 l-4 18 H33 Z" />
      {BASE}
    </>
  ),
  k: () => (
    <>
      <path d="M46 5 h8 v8 h8 v8 h-8 v10 h-8 v-10 h-8 v-8 h8 Z" />
      <path d="M28 64 c-8-12-6-30 10-30 c4 0 8 2 12 6 c4-4 8-6 12-6 c16 0 18 18 10 30 Z" />
      <path d="M30 64 h40 l-4 16 H34 Z" />
      {BASE}
    </>
  ),
};

export const PIECE_NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

// p: 'K' (white king) .. 'p' (black pawn), as on the board
export default function ChessPiece({ p, className = '', style }) {
  const side = p === p.toUpperCase() ? 'w' : 'b';
  const look = LOOK[side];
  const kind = p.toLowerCase();
  return (
    <svg viewBox="0 0 100 100" className={`chess-art ${className}`} style={style} aria-hidden="true" focusable="false"
      data-piece={kind} data-side={side}
      fill={look.fill} stroke={look.line} strokeWidth={look.width} strokeLinejoin="round" strokeLinecap="round">
      {SHAPES[kind](look.detail)}
    </svg>
  );
}
