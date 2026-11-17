import React, { useMemo } from 'react';
import { Shuffle, Plus, X } from 'lucide-react';
import { PATTERNS, GRADIENT_TYPES, FRAME_LINES, FRAME_CORNERS, patternCss, gradientCss, customFrameVars } from '../../utils/postDesign';

// The pattern library, the gradient builder and the frame builder in the
// composer's style picker. Each edits checked parameters (postDesign.js);
// aura-posts checks them again.

const Swatch = ({ value, onChange, label }) => (
  <label className="relative w-10 h-10 rounded-lg border border-[var(--border)] overflow-hidden cursor-pointer flex-shrink-0" title={label}>
    <span className="absolute inset-0" style={{ background: value }} aria-hidden="true" />
    <input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label={label} className="absolute inset-0 opacity-0 cursor-pointer" />
  </label>
);

const Choice = ({ options, value, onChange, label, names = {} }) => (
  <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
    {options.map(o => (
      <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
        className={`px-3 h-9 rounded-full text-xs font-semibold border ${value === o ? 'border-aura-400 bg-aura-500/15 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
        {names[o] ?? o[0].toUpperCase() + o.slice(1)}
      </button>
    ))}
  </div>
);

// ── Patterns ──
export function PatternPicker({ value, onChange }) {
  const pat = value ?? { id: 'dots', c: ['#1e1b4b', '#a78bfa'], s: 'm' };
  const set = changes => onChange({ ...pat, ...changes });
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5" role="radiogroup" aria-label="Pattern">
        {PATTERNS.map(([id, name]) => (
          <button key={id} type="button" role="radio" aria-checked={value?.id === id} aria-label={name} title={name} onClick={() => set({ id })}
            className={`aspect-square rounded-lg border ${value?.id === id ? 'ring-2 ring-aura-400 ring-offset-2 ring-offset-[var(--bg-card)] border-transparent' : 'border-black/10'}`}
            style={{ background: patternCss({ id, c: pat.c, s: 's' }) }} />
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Swatch value={pat.c[0]} onChange={v => set({ c: [v, pat.c[1]] })} label="Pattern background color" />
        <Swatch value={pat.c[1]} onChange={v => set({ c: [pat.c[0], v] })} label="Pattern color" />
        <button type="button" onClick={() => set({ c: [pat.c[1], pat.c[0]] })} className="btn-ghost !px-2 !py-1.5 text-xs">Swap</button>
        <Choice label="Pattern size" options={['s', 'm', 'l']} names={{ s: 'Small', m: 'Medium', l: 'Large' }} value={pat.s} onChange={s => set({ s })} />
      </div>
    </div>
  );
}

// ── Gradients ──
// Presets that match the app's themes, as builder settings (so they can be edited)
export const GRADIENT_PRESETS = [
  ['Aurora', { t: 'mesh', stops: [['#06182a', 0], ['#3ee6a8', 40], ['#7c3aed', 70], ['#22d3ee', 100]], a: 135, grain: true }],
  ['Dusk', { t: 'linear', stops: [['#1e1b4b', 0], ['#7c3aed', 50], ['#f472b6', 100]], a: 160, grain: false }],
  ['Abyss', { t: 'radial', stops: [['#155e75', 0], ['#0b2340', 55], ['#020617', 100]], a: 0, grain: true }],
  ['Dunes', { t: 'linear', stops: [['#fde68a', 0], ['#f2b877', 45], ['#c2410c', 100]], a: 170, grain: true }],
  ['Northern lights', { t: 'linear', stops: [['#030c1c', 0], ['#0f766e', 45], ['#34d399', 75], ['#a78bfa', 100]], a: 200, grain: false }],
  ['Lantern lake', { t: 'mesh', stops: [['#110609', 0], ['#dd5a36', 50], ['#ffd27a', 100]], a: 0, grain: true }],
  ['Sky isles', { t: 'linear', stops: [['#e6f0fb', 0], ['#93c5fd', 55], ['#fde68a', 100]], a: 180, grain: false }],
  ['Halo', { t: 'conic', stops: [['#c4b5fd', 0], ['#f0abfc', 33], ['#a5f3fc', 66], ['#c4b5fd', 100]], a: 45, grain: false }],
];
const randomHex = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;

export function GradientBuilder({ value, onChange }) {
  const g = value ?? GRADIENT_PRESETS[1][1];
  const set = changes => onChange({ ...g, ...changes });
  const setStop = (i, stop) => set({ stops: g.stops.map((s, j) => (j === i ? stop : s)).sort((a, b) => a[1] - b[1]) });
  const shuffle = () => {
    const n = 2 + Math.floor(Math.random() * 3);
    onChange({ t: GRADIENT_TYPES[Math.floor(Math.random() * 4)], stops: Array.from({ length: n }, (_, i) => [randomHex(), Math.round((i / (n - 1)) * 100)]), a: Math.floor(Math.random() * 36) * 10, grain: Math.random() < 0.4 });
  };
  const preview = useMemo(() => gradientCss(g), [g]);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {GRADIENT_PRESETS.map(([name, preset]) => (
          <button key={name} type="button" onClick={() => onChange(preset)} title={name} aria-label={`${name} gradient`}
            className="w-12 h-9 rounded-lg border border-black/10" style={{ background: gradientCss(preset) }} />
        ))}
        <button type="button" onClick={shuffle} className="btn-secondary !px-3 !py-1.5 text-xs text-[var(--text-secondary)]"><Shuffle size={14} /> Shuffle</button>
      </div>
      <div className="h-14 rounded-xl border border-black/10" style={{ background: preview }} aria-hidden="true" />
      <Choice label="Gradient type" options={GRADIENT_TYPES} names={{ linear: 'Straight', radial: 'Round', conic: 'Swirl', mesh: 'Soft blobs' }} value={g.t} onChange={t => set({ t })} />
      {(g.t === 'linear' || g.t === 'conic') && (
        <label className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          Angle <input type="range" min={0} max={360} step={5} value={g.a} onChange={e => set({ a: Number(e.target.value) })} className="flex-1 accent-[var(--accent)] h-8" aria-label="Gradient angle" />
          <span className="tabular-nums w-10 text-right">{g.a}°</span>
        </label>
      )}
      <div className="flex flex-col gap-1.5">
        {g.stops.map(([c, at], i) => (
          <div key={i} className="flex items-center gap-2">
            <Swatch value={c} onChange={v => setStop(i, [v, at])} label={`Color ${i + 1}`} />
            <input type="range" min={0} max={100} value={at} onChange={e => setStop(i, [c, Number(e.target.value)])} aria-label={`Where color ${i + 1} sits`} className="flex-1 accent-[var(--accent)] h-8" />
            {g.stops.length > 2 && (
              <button type="button" onClick={() => set({ stops: g.stops.filter((_, j) => j !== i) })} aria-label={`Remove color ${i + 1}`} className="p-2 text-[var(--text-muted)]"><X size={14} /></button>
            )}
          </div>
        ))}
        {g.stops.length < 4 && (
          <button type="button" onClick={() => set({ stops: [...g.stops, [randomHex(), 100]].sort((a, b) => a[1] - b[1]) })} className="btn-ghost self-start !px-2 !py-1.5 text-xs"><Plus size={14} /> Add a color</button>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <input type="checkbox" checked={g.grain} onChange={e => set({ grain: e.target.checked })} className="w-5 h-5 accent-[var(--accent)]" /> Film grain
      </label>
    </div>
  );
}

// ── Frames ──
export function FrameBuilder({ value, onChange }) {
  const f = value ?? { w: 4, c: ['#a855f7', '#22d3ee'], line: 'solid', corner: 'round', glow: 1 };
  const set = changes => onChange({ ...f, ...changes });
  const sample = customFrameVars(f);
  return (
    <div className="flex flex-col gap-2.5">
      <div className={`h-16 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] post-frame ${f.glow ? 'post-frame-glow' : ''} ${f.line !== 'solid' ? 'post-frame-line' : ''}`} style={sample} aria-hidden="true" />
      <div className="flex items-center gap-2 flex-wrap">
        {f.c.map((c, i) => (
          <span key={i} className="relative">
            <Swatch value={c} onChange={v => set({ c: f.c.map((x, j) => (j === i ? v : x)) })} label={`Frame color ${i + 1}`} />
            {f.c.length > 1 && <button type="button" onClick={() => set({ c: f.c.filter((_, j) => j !== i) })} aria-label={`Remove frame color ${i + 1}`}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center"><X size={10} /></button>}
          </span>
        ))}
        {f.c.length < 3 && <button type="button" onClick={() => set({ c: [...f.c, randomHex()] })} className="btn-ghost !px-2 !py-1.5 text-xs"><Plus size={14} /> Color</button>}
      </div>
      <label className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        Width <input type="range" min={2} max={12} value={f.w} onChange={e => set({ w: Number(e.target.value) })} className="flex-1 accent-[var(--accent)] h-8" aria-label="Frame width" />
        <span className="tabular-nums w-10 text-right">{f.w}px</span>
      </label>
      <Choice label="Line" options={FRAME_LINES} value={f.line} onChange={line => set({ line })} />
      <div className="flex flex-wrap gap-3">
        <Choice label="Corners" options={FRAME_CORNERS} names={{ round: 'Round corners', square: 'Square corners' }} value={f.corner} onChange={corner => set({ corner })} />
        <Choice label="Glow" options={['0', '1', '2', '3']} names={{ 0: 'No glow', 1: 'Soft', 2: 'Glow', 3: 'Bright' }} value={String(f.glow)} onChange={g => set({ glow: Number(g) })} />
      </div>
      {f.line !== 'solid' && f.c.length > 1 && <p className="text-[11px] text-[var(--text-muted)]">Double, dashed and dotted lines use the first color.</p>}
    </div>
  );
}
