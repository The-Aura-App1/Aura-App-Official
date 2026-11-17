import React, { useRef, useState } from 'react';
import { Type, Link2, AtSign, Hash, Smile, Trash2, Minus, Plus, CaseSensitive } from 'lucide-react';
import { OverlayItem } from './PostOverlays';
import { MAX_OVERLAYS, OVERLAY_TEXT_MAX, OVERLAY_LABEL_MAX, OVERLAY_COLORS, normalizeUrl, newOverlayId } from '../../utils/overlays';
import { REACTION_EMOJIS } from '../../utils/reactions';
import { FONT_BY_ID } from '../../utils/postStyle';
import FontPicker from '../common/FontPicker';

const TOOLS = [
  { kind: 'text', icon: Type, label: 'Text' },
  { kind: 'link', icon: Link2, label: 'Link' },
  { kind: 'mention', icon: AtSign, label: 'Mention' },
  { kind: 'hashtag', icon: Hash, label: 'Hashtag' },
  { kind: 'emoji', icon: Smile, label: 'Emoji' },
];
const DEFAULTS = {
  text: { text: '', color: '#ffffff', bg: 'none', size: 1.3 },
  link: { url: '', label: '', color: '#7c3aed', size: 1 },
  mention: { username: '', color: '#7c3aed', size: 1 },
  hashtag: { tag: '', color: '#7c3aed', size: 1 },
  emoji: { emoji: '✨', color: '#ffffff', size: 1.4 },
};

// The canvas in the composer: `children` is the photo, video or text card,
// and everything placed on it can be dragged anywhere, tapped to edit, and
// styled from the panel underneath. Positions are fractions of the canvas,
// the same box the feed shows, so they land in the same spot there. aspect
// null lets the children set the height (a text post's card).
export default function OverlayEditor({ overlays, onChange, slide = 0, aspect = 1, children }) {
  const canvas = useRef(null);
  const drag = useRef(null);
  const [selected, setSelected] = useState(null);
  const [fontsOpen, setFontsOpen] = useState(false);
  const here = overlays.filter(o => o.slide === slide);
  const current = overlays.find(o => o.id === selected && o.slide === slide) ?? null;
  const full = overlays.length >= MAX_OVERLAYS;

  const update = (id, fields) => onChange(overlays.map(o => (o.id === id ? { ...o, ...fields } : o)));
  const remove = id => { onChange(overlays.filter(o => o.id !== id)); setSelected(null); };
  function add(kind) {
    if (full) return;
    const o = { id: newOverlayId(), kind, slide, x: 0.5, y: 0.5 - (here.length % 4) * 0.08, ...DEFAULTS[kind] };
    onChange([...overlays, o]);
    setSelected(o.id);
  }

  function down(e, o) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = canvas.current.getBoundingClientRect();
    drag.current = { id: o.id, dx: e.clientX - (box.left + o.x * box.width), dy: e.clientY - (box.top + o.y * box.height), moved: false, x0: e.clientX, y0: e.clientY };
    setSelected(o.id);
  }
  function move(e) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    d.moved = true;
    const box = canvas.current.getBoundingClientRect();
    const clamp = v => Math.min(0.97, Math.max(0.03, v));
    update(d.id, { x: clamp((e.clientX - d.dx - box.left) / box.width), y: clamp((e.clientY - d.dy - box.top) / box.height) });
  }
  const up = () => { drag.current = null; };

  const linkError = current?.kind === 'link' && current.url && !normalizeUrl(current.url);

  return (
    <div className="flex flex-col gap-3">
      <div ref={canvas} className="relative w-full overflow-hidden rounded-xl bg-black select-none touch-none" style={aspect ? { aspectRatio: String(aspect) } : undefined}
        onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerDown={() => setSelected(null)}>
        {children}
        <div className="absolute inset-0" style={{ containerType: 'inline-size' }}>
          {here.map(o => (
            <div key={o.id} role="button" tabIndex={0} aria-label={`${o.kind}: drag to move, tap to edit`}
              onPointerDown={e => down(e, o)} onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') remove(o.id); }}
              className={`absolute cursor-grab active:cursor-grabbing rounded-lg ${selected === o.id ? 'outline outline-2 outline-dashed outline-white/90 outline-offset-4' : ''}`}
              style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: 'translate(-50%, -50%)' }}>
              <OverlayItem o={{ ...o, text: o.text || (o.kind === 'text' ? 'Type something' : o.text), url: o.url || 'https://your.link',
                username: o.username || 'username', tag: o.tag || 'hashtag' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Add things */}
      <div className="flex items-center justify-between gap-1">
        {TOOLS.map(({ kind, icon: Icon, label }) => (
          <button key={kind} type="button" onClick={() => add(kind)} disabled={full}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:border-aura-500/40 hover:text-[var(--accent)] disabled:opacity-40">
            <Icon size={18} aria-hidden="true" />
            <span className="text-[11px] font-semibold">{label}</span>
          </button>
        ))}
      </div>
      {full && <p className="text-xs text-[var(--text-muted)]">That's the most ({MAX_OVERLAYS}) one post can hold.</p>}
      {!current && here.length > 0 && <p className="text-xs text-[var(--text-muted)] text-center">Drag things to move them. Tap one to change it.</p>}

      {/* Change the selected one */}
      {current && (
        <div className="flex flex-col gap-2.5 p-3 rounded-xl border border-aura-500/30 bg-aura-500/5 overlay-panel">
          {current.kind === 'text' && (
            <textarea value={current.text} onChange={e => update(current.id, { text: e.target.value.slice(0, OVERLAY_TEXT_MAX) })} rows={2} autoFocus
              placeholder="Type something" aria-label="Text on the post" className="input resize-none text-sm" />
          )}
          {current.kind === 'link' && (
            <>
              <input value={current.url} onChange={e => update(current.id, { url: e.target.value })} autoFocus inputMode="url"
                placeholder="your-site.com/page" aria-label="Link address" className={`input py-2 text-sm ${linkError ? 'border-red-400' : ''}`} />
              <input value={current.label} onChange={e => update(current.id, { label: e.target.value.slice(0, OVERLAY_LABEL_MAX) })}
                placeholder="Label (optional, the site's name shows otherwise)" aria-label="Link label" className="input py-2 text-sm" />
              {linkError && <p className="text-xs text-red-400">That doesn't look like a web address.</p>}
            </>
          )}
          {current.kind === 'mention' && (
            <input value={current.username} onChange={e => update(current.id, { username: e.target.value.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) })}
              autoFocus placeholder="username" aria-label="Username to mention" className="input py-2 text-sm" />
          )}
          {current.kind === 'hashtag' && (
            <input value={current.tag} onChange={e => update(current.id, { tag: e.target.value.replace(/^#/, '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 30) })}
              autoFocus placeholder="hashtag" aria-label="Hashtag" className="input py-2 text-sm" />
          )}
          {current.kind === 'emoji' && (
            <div className="grid grid-cols-8 gap-0.5">
              {REACTION_EMOJIS.slice(0, 24).map(e => (
                <button key={e} type="button" onClick={() => update(current.id, { emoji: e })} aria-pressed={current.emoji === e}
                  className={`h-9 rounded-lg text-xl ${current.emoji === e ? 'bg-aura-500/20' : 'hover:bg-[var(--accent-subtle)]'}`}>{e}</button>
              ))}
            </div>
          )}

          {current.kind !== 'emoji' && (
            <div className="flex items-center gap-1.5 flex-wrap" role="radiogroup" aria-label="Color">
              {OVERLAY_COLORS.map(c => (
                <button key={c} type="button" role="radio" aria-checked={current.color === c} aria-label={c} onClick={() => update(current.id, { color: c })}
                  className={`w-7 h-7 rounded-full border-2 ${current.color === c ? 'border-aura-500 scale-110' : 'border-black/20'}`} style={{ background: c }} />
              ))}
            </div>
          )}
          {current.kind !== 'emoji' && fontsOpen && (
            <FontPicker label="Font" value={current.font ?? null} defaultLabel="Aura's font" height="max-h-48"
              onChange={font => update(current.id, { font: font ?? undefined })} />
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {current.kind !== 'emoji' && (
              <button type="button" onClick={() => setFontsOpen(v => !v)} aria-expanded={fontsOpen}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)]">
                <CaseSensitive size={14} aria-hidden="true" /> {current.font ? FONT_BY_ID[current.font]?.name ?? 'Font' : 'Font'}
              </button>
            )}
            {current.kind === 'text' && (
              <div className="flex rounded-lg border border-[var(--border)] p-0.5 text-xs font-semibold">
                {[['none', 'Plain'], ['solid', 'Filled'], ['soft', 'Shaded']].map(([bg, name]) => (
                  <button key={bg} type="button" aria-pressed={current.bg === bg} onClick={() => update(current.id, { bg })}
                    className={`px-2.5 py-1 rounded-md ${current.bg === bg ? 'bg-aura-500/20 text-aura-400' : 'text-[var(--text-muted)]'}`}>{name}</button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <button type="button" aria-label="Smaller" onClick={() => update(current.id, { size: Math.max(0.5, Math.round((current.size - 0.15) * 100) / 100) })}
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)]"><Minus size={14} /></button>
              <button type="button" aria-label="Bigger" onClick={() => update(current.id, { size: Math.min(3, Math.round((current.size + 0.15) * 100) / 100) })}
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)]"><Plus size={14} /></button>
              <button type="button" aria-label="Remove it" onClick={() => remove(current.id)}
                className="p-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// What the server will accept: drops empty text, fixes up links; returns { overlays } or { error }
export function readyOverlays(overlays) {
  const out = [];
  for (const o of overlays) {
    const { id, ...rest } = o;
    if (o.kind === 'text' && !o.text.trim()) continue;
    if (o.kind === 'mention' && !o.username) continue;
    if (o.kind === 'hashtag' && !o.tag) continue;
    if (o.kind === 'link') {
      if (!o.url.trim()) continue;
      const url = normalizeUrl(o.url);
      if (!url) return { error: `"${o.url}" isn't a web address. Fix the link or remove it.` };
      out.push({ ...rest, url, ...(o.label?.trim() ? { label: o.label.trim() } : {}) });
      if (!o.label?.trim()) delete out[out.length - 1].label;
      continue;
    }
    out.push(rest);
  }
  return { overlays: out };
}
