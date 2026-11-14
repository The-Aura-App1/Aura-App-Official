import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Palette, ChevronDown, Lock, AlignLeft, AlignCenter, AlignRight, Search, RotateCcw } from 'lucide-react';
import {
  POST_FONTS, FONT_CATEGORIES, FONT_BY_ID, POST_BACKGROUNDS, BACKGROUND_KINDS, POST_FRAMES,
  SAFE_COLORS, CARD_COLORS, HEX, STYLE_PREMIUM_ONLY, fontFamily, loadPostFont, cleanStyle,
} from '../../utils/postStyle';
import { TextBody, CaptionText, frameProps } from './PostStyle';

// The "Customize the look" panel in CreatePost: fonts, text color, background,
// size and alignment (text posts), and a frame (any post), with a live preview.

const Tile = ({ selected, label, onClick, children, className = '' }) => (
  <button type="button" onClick={onClick} aria-pressed={selected} aria-label={label} title={label}
    className={`rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-400
      ${selected ? 'ring-2 ring-aura-400 ring-offset-2 ring-offset-[var(--bg-card)]' : 'hover:scale-105'} ${className}`}>
    {children}
  </button>
);

// Loads its font only once it scrolls into view, so opening the list doesn't fetch all 126
function FontOption({ font, selected, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (typeof IntersectionObserver === 'undefined' || !el) { loadPostFont(font.id); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { loadPostFont(font.id); io.disconnect(); } }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [font.id]);
  return (
    <button ref={ref} type="button" onClick={onPick} aria-pressed={selected}
      className={`text-left px-3 py-2 rounded-lg border text-[15px] truncate transition-colors
        ${selected ? 'border-aura-400 bg-aura-500/15 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-aura-500/40'}`}
      style={{ fontFamily: fontFamily(font.id) }}>
      {font.name}
    </button>
  );
}

function CustomColor({ value, onChange, label }) {
  const custom = value && HEX.test(value) ? value : '#7c3aed';
  return (
    <label className="relative w-9 h-9 rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center cursor-pointer
      text-[10px] text-[var(--text-muted)] overflow-hidden" title={label}>
      <span aria-hidden="true" className="absolute inset-1 rounded-md" style={{ background: 'conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)' }} />
      <input type="color" value={custom} onChange={e => onChange(e.target.value)} aria-label={label}
        className="absolute inset-0 opacity-0 cursor-pointer" />
    </label>
  );
}

const TABS = { text: ['Font', 'Background', 'Color', 'Size', 'Frame'], media: ['Font', 'Color', 'Frame'] };

export default function StylePicker({ style, onChange, postType, caption, isPremium }) {
  const kind = postType === 'text' ? 'text' : 'media';
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('Font');
  const [fontCat, setFontCat] = useState('All');
  const [query, setQuery] = useState('');
  const locked = STYLE_PREMIUM_ONLY && !isPremium;
  const tabs = TABS[kind];
  const current = cleanStyle(style, postType) ?? {};
  const set = (key, value) => onChange(cleanStyle({ ...style, [key]: value }, postType) ?? {});

  useEffect(() => { if (!tabs.includes(tab)) setTab('Font'); }, [tabs, tab]);

  const fonts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return POST_FONTS.filter(f => (fontCat === 'All' || f.cat === fontCat) && (!q || f.name.toLowerCase().includes(q)));
  }, [fontCat, query]);

  const changed = Object.keys(current).length;
  const sample = caption.trim() || (kind === 'text' ? 'Your words, your look.' : 'Your caption, your look.');
  const frame = frameProps(current);

  return (
    <section className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/40">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--text-primary)]">
        <Palette size={16} className="text-aura-400" aria-hidden="true" />
        Customize the look
        {changed > 0 && <span className="aura-badge text-[10px]">{changed} change{changed === 1 ? '' : 's'}</span>}
        {STYLE_PREMIUM_ONLY && <span className="aura-badge text-[10px]">Premium</span>}
        <ChevronDown size={16} className={`ml-auto text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && locked && (
        <p className="flex items-center gap-2 px-3 pb-3 text-xs text-[var(--text-muted)]">
          <Lock size={13} aria-hidden="true" /> Fonts, backgrounds and frames for your posts come with Premium.
        </p>
      )}

      {open && !locked && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {/* Live preview, drawn the way the feed draws it */}
          <div className={`card p-0 overflow-hidden ${frame.className}`} style={frame.style} aria-label="Preview">
            {kind === 'text'
              ? <div className="py-3"><TextBody text={sample} style={current} className="!mx-3 !mb-0" /></div>
              : <p className="px-4 py-3 text-sm text-[var(--text-primary)]"><span className="font-semibold mr-1">you</span><CaptionText text={sample} style={current} /></p>}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Style settings">
            {tabs.map(t => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap
                  ${tab === t ? 'bg-aura-500/20 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                {t}
              </button>
            ))}
            {changed > 0 && (
              <button type="button" onClick={() => onChange({})} className="ml-auto flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <RotateCcw size={12} aria-hidden="true" /> Reset
              </button>
            )}
          </div>

          {tab === 'Font' && (
            <div className="flex flex-col gap-2" role="tabpanel">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${POST_FONTS.length} fonts`}
                  aria-label="Search fonts" className="input !py-2 pl-8 text-sm" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {['All', ...FONT_CATEGORIES].map(c => (
                  <button key={c} type="button" onClick={() => setFontCat(c)} aria-pressed={fontCat === c}
                    className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap border
                      ${fontCat === c ? 'border-aura-400 text-[var(--text-primary)] bg-aura-500/15' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                <button type="button" onClick={() => set('font', null)} aria-pressed={!current.font}
                  className={`text-left px-3 py-2 rounded-lg border text-sm ${!current.font ? 'border-aura-400 bg-aura-500/15 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                  App default
                </button>
                {fonts.map(f => <FontOption key={f.id} font={f} selected={current.font === f.id} onPick={() => set('font', f.id)} />)}
              </div>
              {current.font && <p className="text-[11px] text-[var(--text-muted)]">{FONT_BY_ID[current.font]?.name} · {FONT_BY_ID[current.font]?.cat}</p>}
            </div>
          )}

          {tab === 'Background' && (
            <div className="flex flex-col gap-2" role="tabpanel">
              {BACKGROUND_KINDS.map(k => (
                <div key={k}>
                  <p className="text-[11px] text-[var(--text-muted)] mb-1">{k}</p>
                  <div className="flex flex-wrap gap-2">
                    {k === 'Solid' && (
                      <Tile selected={!current.bg} label="No background" onClick={() => set('bg', null)}
                        className="w-9 h-9 border border-dashed border-[var(--border)] text-[10px] text-[var(--text-muted)]">None</Tile>
                    )}
                    {POST_BACKGROUNDS.filter(b => b.kind === k).map(b => (
                      <Tile key={b.id} selected={current.bg === b.id} label={b.name} onClick={() => set('bg', b.id)} className="w-9 h-9">
                        <span className="block w-full h-full rounded-lg border border-black/10" style={{ background: b.css }} />
                      </Tile>
                    ))}
                    {k === 'Solid' && <CustomColor value={HEX.test(current.bg ?? '') ? current.bg : null} onChange={v => set('bg', v)} label="Custom background color" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Color' && (
            <div className="flex flex-col gap-2" role="tabpanel">
              <div className="flex flex-wrap gap-2">
                <Tile selected={!current.color} label="Automatic" onClick={() => set('color', null)}
                  className="w-9 h-9 border border-dashed border-[var(--border)] text-[10px] text-[var(--text-muted)]">Auto</Tile>
                {(current.bg ? CARD_COLORS : SAFE_COLORS).map(c => (
                  <Tile key={c} selected={current.color === c} label={c} onClick={() => set('color', c)} className="w-9 h-9">
                    <span className="block w-full h-full rounded-lg border border-black/15" style={{ background: c }} />
                  </Tile>
                ))}
                {current.bg && <CustomColor value={current.color} onChange={v => set('color', v)} label="Custom text color" />}
              </div>
              {!current.bg && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {kind === 'text' ? 'Pick a background for any color you like. ' : ''}These colors read well on both light and dark themes.
                </p>
              )}
            </div>
          )}

          {tab === 'Size' && (
            <div className="flex flex-wrap items-center gap-3" role="tabpanel">
              <div className="flex gap-1" role="group" aria-label="Text size">
                {[['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Huge']].map(([v, label]) => (
                  <button key={v} type="button" onClick={() => set('size', v)} aria-pressed={(current.size ?? (current.bg ? 'm' : null)) === v} aria-label={label}
                    className={`w-10 h-9 rounded-lg border font-semibold ${(current.size ?? (current.bg ? 'm' : null)) === v ? 'border-aura-400 bg-aura-500/15 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                    style={{ fontSize: { s: 11, m: 13, l: 15, xl: 18 }[v] }}>
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex gap-1" role="group" aria-label="Alignment">
                {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([v, Icon]) => {
                  const on = (current.align ?? (current.bg ? 'center' : 'left')) === v;
                  return (
                    <button key={v} type="button" onClick={() => set('align', v)} aria-pressed={on} aria-label={`Align ${v}`}
                      className={`w-10 h-9 rounded-lg border flex items-center justify-center ${on ? 'border-aura-400 bg-aura-500/15 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                      <Icon size={16} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <p className="w-full text-[11px] text-[var(--text-muted)]">Long posts step down a size so they still fit.</p>
            </div>
          )}

          {tab === 'Frame' && (
            <div className="flex flex-wrap gap-2.5" role="tabpanel">
              <Tile selected={!current.frame} label="No frame" onClick={() => set('frame', null)}
                className="w-12 h-12 border border-dashed border-[var(--border)] text-[10px] text-[var(--text-muted)]">None</Tile>
              {POST_FRAMES.map(f => {
                const p = frameProps({ frame: f.id });
                return (
                  <Tile key={f.id} selected={current.frame === f.id} label={f.name} onClick={() => set('frame', f.id)} className="w-12 h-12 p-1">
                    <span className={`block w-full h-full rounded-md bg-[var(--bg-card)] border border-[var(--border)] ${p.className}`} style={p.style} />
                  </Tile>
                );
              })}
              <CustomColor value={HEX.test(current.frame ?? '') ? current.frame : null} onChange={v => set('frame', v)} label="Custom frame color" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

