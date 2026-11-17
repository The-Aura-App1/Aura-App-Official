import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { POST_FONTS, FONT_CATEGORIES, FONT_BY_ID, fontFamily, loadPostFont } from '../../utils/postStyle';

// The one font picker, used everywhere a font can be chosen (post styling,
// text on photos, Theme Studio, Angel's themes), so every feature offers the
// same full catalog (POST_FONTS, self-hosted). Search, a tab per kind, and
// each font previewed in itself, loaded only once it scrolls into view.

function FontOption({ font, selected, onPick, sample }) {
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
      {sample ?? font.name}
    </button>
  );
}

export default function FontPicker({ value, onChange, defaultLabel = 'App default', label = 'Font', height = 'max-h-60' }) {
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');
  const fonts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return POST_FONTS.filter(f => (cat === 'All' || f.cat === cat) && (!q || f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q)));
  }, [cat, query]);
  const current = value ? FONT_BY_ID[value] : null;

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${POST_FONTS.length} fonts`}
          aria-label={label === 'Font' ? 'Search fonts' : `Search fonts for ${label.toLowerCase()}`} className="input !py-2 pl-8 !text-base sm:!text-sm" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {['All', ...FONT_CATEGORIES].map(c => (
          <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
            className={`px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap border
              ${cat === c ? 'border-aura-400 text-[var(--text-primary)] bg-aura-500/15' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
            {c}
          </button>
        ))}
      </div>
      <div className={`grid grid-cols-2 gap-1.5 ${height} overflow-y-auto pr-1`}>
        <button type="button" onClick={() => onChange(null)} aria-pressed={!value}
          className={`text-left px-3 py-2 rounded-lg border text-sm ${!value ? 'border-aura-400 bg-aura-500/15 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
          {defaultLabel}
        </button>
        {fonts.map(f => <FontOption key={f.id} font={f} selected={value === f.id} onPick={() => onChange(f.id)} />)}
        {fonts.length === 0 && <p className="col-span-2 text-xs text-[var(--text-muted)] px-1 py-2">No fonts match "{query}".</p>}
      </div>
      {current && (
        <p className="text-[11px] text-[var(--text-muted)]">
          {current.name} · {current.cat}
          {(current.cat === 'Script' || current.cat === 'Handwriting') && ' · lovely for headings, harder to read in long text'}
        </p>
      )}
    </div>
  );
}
