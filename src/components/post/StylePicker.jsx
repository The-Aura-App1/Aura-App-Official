import React, { useEffect, useState } from 'react';
import { Palette, ChevronDown, Lock, AlignLeft, AlignCenter, AlignRight, RotateCcw } from 'lucide-react';
import {
  POST_BACKGROUNDS, BACKGROUND_KINDS, POST_FRAMES,
  SAFE_COLORS, CARD_COLORS, HEX, STYLE_PREMIUM_ONLY, cleanStyle, hasCard, groupBgCss,
} from '../../utils/postStyle';
import { TextBody, CaptionText, frameProps } from './PostStyle';
import FontPicker from '../common/FontPicker';
import { PatternPicker, GradientBuilder, FrameBuilder, GRADIENT_PRESETS } from './DesignBuilders';
import { surfaceColors, inkReads } from '../../utils/postDesign';

// The "Customize the look" panel in CreatePost: fonts, text color, background,
// size and alignment (text posts), and a frame (any post), with a live preview.

const Tile = ({ selected, label, onClick, children, className = '' }) => (
  <button type="button" onClick={onClick} aria-pressed={selected} aria-label={label} title={label}
    className={`rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-400
      ${selected ? 'ring-2 ring-aura-400 ring-offset-2 ring-offset-[var(--bg-card)]' : 'hover:scale-105'} ${className}`}>
    {children}
  </button>
);

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

// groupBackgrounds: a level-10 group's own backgrounds, when posting in it
// bare: always open, no header and no preview of its own (the composer's
// edit step shows the post itself as the preview)
export default function StylePicker({ style, onChange, postType, caption, isPremium, groupBackgrounds = [], bare = false }) {
  const kind = postType === 'text' ? 'text' : 'media';
  const [open, setOpen] = useState(bare);
  const [tab, setTab] = useState('Font');
  const locked = STYLE_PREMIUM_ONLY && !isPremium;
  const tabs = TABS[kind];
  const current = cleanStyle(style, postType) ?? {};
  const set = (key, value) => onChange(cleanStyle({ ...style, [key]: value }, postType) ?? {});
  // One background (preset, color, pattern or gradient) and one frame (preset or built)
  const choose = changes => onChange(cleanStyle({ ...style, ...changes }, postType) ?? {});
  const pickBg = bg => choose({ bg, pat: null, grad: null });
  const [building, setBuilding] = useState(null);   // 'grad' | 'frame' while a builder is open
  const noBg = !current.bg && !current.pat && !current.grad;

  useEffect(() => { if (!tabs.includes(tab)) setTab('Font'); }, [tabs, tab]);

  const changed = Object.keys(current).length;
  const sample = caption.trim() || (kind === 'text' ? 'Your words, your look.' : 'Your caption, your look.');
  const frame = frameProps(current, postType);
  const groupBg = current.bg?.startsWith('grp:') ? groupBackgrounds.find(b => `grp:${b.id}` === current.bg) : null;

  return (
    <section className={bare ? '' : 'mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/40'}>
      {!bare && <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--text-primary)]">
        <Palette size={16} className="text-aura-400" aria-hidden="true" />
        Customize the look
        {changed > 0 && <span className="aura-badge text-[10px]">{changed} change{changed === 1 ? '' : 's'}</span>}
        {STYLE_PREMIUM_ONLY && <span className="aura-badge text-[10px]">Premium</span>}
        <ChevronDown size={16} className={`ml-auto text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>}

      {open && locked && (
        <p className="flex items-center gap-2 px-3 pb-3 text-xs text-[var(--text-muted)]">
          <Lock size={13} aria-hidden="true" /> Fonts, backgrounds and frames for your posts come with Premium.
        </p>
      )}

      {open && !locked && (
        <div className={`flex flex-col gap-3 ${bare ? '' : 'px-3 pb-3'}`}>
          {/* Live preview, drawn the way the feed draws it */}
          {!bare && <div className={`card p-0 overflow-hidden ${frame.className}`} style={frame.style} aria-label="Preview">
            {kind === 'text'
              ? <div className="py-3"><TextBody text={sample} style={current} groupBg={groupBg} className="!mx-3 !mb-0" /></div>
              : <p className="px-4 py-3 text-sm text-[var(--text-primary)]"><span className="font-semibold mr-1">you</span><CaptionText text={sample} style={current} /></p>}
          </div>}

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
            <div role="tabpanel">
              <FontPicker value={current.font ?? null} onChange={id => set('font', id)} />
            </div>
          )}

          {tab === 'Background' && (
            <div className="flex flex-col gap-2" role="tabpanel">
              {groupBackgrounds.length > 0 && (
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] mb-1">This group's</p>
                  <div className="flex flex-wrap gap-2">
                    {groupBackgrounds.map(b => (
                      <Tile key={b.id} selected={current.bg === `grp:${b.id}`} label={b.name} onClick={() => set('bg', `grp:${b.id}`)} className="w-14 h-9">
                        <span className="block w-full h-full rounded-lg border border-black/10" style={{ background: groupBgCss(b) }} />
                      </Tile>
                    ))}
                  </div>
                </div>
              )}
              {BACKGROUND_KINDS.filter(k => k !== 'Pattern').map(k => (
                <div key={k}>
                  <p className="text-[11px] text-[var(--text-muted)] mb-1">{k}</p>
                  <div className="flex flex-wrap gap-2">
                    {k === 'Solid' && (
                      <Tile selected={noBg} label="No background" onClick={() => pickBg(null)}
                        className="w-9 h-9 border border-dashed border-[var(--border)] text-[10px] text-[var(--text-muted)]">None</Tile>
                    )}
                    {POST_BACKGROUNDS.filter(b => b.kind === k).map(b => (
                      <Tile key={b.id} selected={current.bg === b.id} label={b.name} onClick={() => pickBg(b.id)} className="w-9 h-9">
                        <span className="block w-full h-full rounded-lg border border-black/10" style={{ background: b.css }} />
                      </Tile>
                    ))}
                    {k === 'Solid' && <CustomColor value={HEX.test(current.bg ?? '') ? current.bg : null} onChange={v => pickBg(v)} label="Custom background color" />}
                    {k === 'Gradient' && (
                      <button type="button" onClick={() => { setBuilding(b => (b === 'grad' ? null : 'grad')); if (!current.grad) choose({ grad: GRADIENT_PRESETS[1][1], bg: null, pat: null }); }}
                        aria-expanded={building === 'grad'} className={`h-9 px-3 rounded-lg border text-xs font-semibold ${current.grad ? 'border-aura-400 bg-aura-500/15 text-[var(--text-primary)]' : 'border-dashed border-[var(--border)] text-[var(--text-muted)]'}`}>
                        Build your own
                      </button>
                    )}
                  </div>
                  {k === 'Gradient' && building === 'grad' && (
                    <div className="mt-2 p-3 rounded-xl border border-[var(--border)]">
                      <GradientBuilder value={current.grad} onChange={grad => choose({ grad, bg: null, pat: null })} />
                    </div>
                  )}
                </div>
              ))}
              <div>
                <p className="text-[11px] text-[var(--text-muted)] mb-1">Pattern</p>
                <PatternPicker value={current.pat} onChange={pat => choose({ pat, bg: null, grad: null })} />
              </div>
            </div>
          )}

          {tab === 'Color' && (
            <div className="flex flex-col gap-2" role="tabpanel">
              <div className="flex flex-wrap gap-2">
                <Tile selected={!current.color} label="Automatic" onClick={() => set('color', null)}
                  className="w-9 h-9 border border-dashed border-[var(--border)] text-[10px] text-[var(--text-muted)]">Auto</Tile>
                {(hasCard(current) ? CARD_COLORS.filter(c => !surfaceColors(current).length || inkReads(c, surfaceColors(current))) : SAFE_COLORS).map(c => (
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
              <Tile selected={!current.frame && !current.fr} label="No frame" onClick={() => choose({ frame: null, fr: null })}
                className="w-12 h-12 border border-dashed border-[var(--border)] text-[10px] text-[var(--text-muted)]">None</Tile>
              {POST_FRAMES.map(f => {
                const p = frameProps({ frame: f.id });
                return (
                  <Tile key={f.id} selected={current.frame === f.id} label={f.name} onClick={() => choose({ frame: f.id, fr: null })} className="w-12 h-12 p-1">
                    <span className={`block w-full h-full rounded-md bg-[var(--bg-card)] border border-[var(--border)] ${p.className}`} style={p.style} />
                  </Tile>
                );
              })}
              <CustomColor value={HEX.test(current.frame ?? '') ? current.frame : null} onChange={v => choose({ frame: v, fr: null })} label="Custom frame color" />
              <button type="button" onClick={() => { setBuilding(b => (b === 'frame' ? null : 'frame')); if (!current.fr) choose({ fr: { w: 4, c: ['#a855f7', '#22d3ee'], line: 'solid', corner: 'round', glow: 1 }, frame: null }); }} aria-expanded={building === 'frame'}
                className={`h-12 px-3 rounded-lg border text-xs font-semibold ${current.fr ? 'border-aura-400 bg-aura-500/15 text-[var(--text-primary)]' : 'border-dashed border-[var(--border)] text-[var(--text-muted)]'}`}>
                Build your own
              </button>
              {building === 'frame' && (
                <div className="w-full mt-1 p-3 rounded-xl border border-[var(--border)]">
                  <FrameBuilder value={current.fr} onChange={fr => choose({ fr, frame: null })} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

