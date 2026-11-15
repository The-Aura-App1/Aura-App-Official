import React from 'react';

// Casino chips for the poker table. An amount is split into denominations
// and drawn as a short stack (capped so a big pot still fits).
const DENOMS = [
  { v: 500, face: '#5b21b6', edge: '#c4b5fd' },
  { v: 100, face: '#111827', edge: '#e5e7eb' },
  { v: 25,  face: '#047857', edge: '#a7f3d0' },
  { v: 5,   face: '#b91c1c', edge: '#fecaca' },
  { v: 1,   face: '#e5e7eb', edge: '#2563eb' },
];

function split(amount, max) {
  const out = [];
  let left = amount;
  for (const d of DENOMS) {
    while (left >= d.v && out.length < max) { out.push(d); left -= d.v; }
  }
  return out;
}

export function Chip({ d, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
      <circle cx="12" cy="12" r="11.5" fill={d.face} />
      <circle cx="12" cy="12" r="11.5" fill="none" stroke={d.edge} strokeWidth="3" strokeDasharray="4.5 4.5" />
      <circle cx="12" cy="12" r="7" fill="none" stroke={d.edge} strokeOpacity=".7" strokeWidth="1" />
      <circle cx="12" cy="12" r="5.5" fill={d.face} />
    </svg>
  );
}

// A stack of chips with its amount. `from` sets which way new chips slide in.
export default function ChipStack({ amount, label, from = 'below', className = '' }) {
  if (!amount) return null;
  const chips = split(amount, 7).reverse();
  return (
    <div key={amount} className={`chip-slide flex items-center gap-1.5 ${className}`} style={{ '--chip-from': from === 'above' ? '-26px' : '26px' }}>
      <div className="relative w-[22px]" style={{ height: 22 + (chips.length - 1) * 3.5 }} aria-hidden="true">
        {chips.map((d, i) => (
          <span key={i} className="absolute left-0" style={{ bottom: i * 3.5 }}><Chip d={d} /></span>
        ))}
      </div>
      <span className="text-xs font-bold tabular-nums text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
        {label ? `${label} ` : ''}{amount.toLocaleString()}
      </span>
    </div>
  );
}
