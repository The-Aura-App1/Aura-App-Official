import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brush, Crown, ImagePlus, RotateCcw, Save, Undo2, Wand2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';
import { THEMES } from '../themes';
import {
  cleanCustom, customVars, loadCustom, saveCustom, saveTheme, readableKeys, contrast,
  THEME_FONT_CATEGORIES, NAME_MAX,
} from '../themes/customTheme';
import { DESIGN_SCENES } from '../themes/themeDesign';
import { saveMedia, checkMedia } from '../themes/studioMedia';
import { POST_FONTS, fontFamily, loadPostFont } from '../utils/postStyle';
import StudioBackdrop, { gradientCss } from '../components/theme/StudioBackdrop';
import { SceneDecor } from '../components/auth/AuthBackdrop';

// Theme Studio (Premium): every part of a custom theme, with a live preview.
// Anyone can play with it here; using it on the app (and saving it to the
// account, which aura-users allows only for Premium) needs Premium.

const TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'colors', label: 'Colors' },
  { id: 'backdrop', label: 'Backdrop' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'shape', label: 'Shape' },
];

const COLOR_FIELDS = [
  { key: 'background',    label: 'Page background', varName: '--bg-primary' },
  { key: 'surface',       label: 'Cards',           varName: '--bg-card' },
  { key: 'elevated',      label: 'Inputs and menus', varName: '--bg-elevated' },
  { key: 'border',        label: 'Borders',         varName: '--border' },
  { key: 'text',          label: 'Main text',       varName: '--text-primary' },
  { key: 'textSecondary', label: 'Second text',     varName: '--text-secondary' },
  { key: 'muted',         label: 'Quiet text',      varName: '--text-muted' },
  { key: 'brand1',        label: 'Gradient start',  varName: '--brand-1' },
  { key: 'brand2',        label: 'Gradient middle', varName: '--brand-2' },
  { key: 'brand3',        label: 'Gradient end',    varName: '--brand-3' },
];

const BACKDROPS = [
  { id: 'glow', label: 'Soft glow' },
  { id: 'none', label: 'Plain' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'scene', label: 'Scene' },
  { id: 'image', label: 'Picture or GIF' },
  { id: 'video', label: 'Video' },
];

const SCENE_NAMES = Object.fromEntries(DESIGN_SCENES.map(id => {
  const themes = THEMES.filter(t => t.scene === id).map(t => t.name);
  return [id, id === 'sky' ? 'Day or Night sky' : themes[0] ?? id];
}));

const FONT_GROUPS = THEME_FONT_CATEGORIES.map(cat => [cat, POST_FONTS.filter(f => f.cat === cat)]);

const HEX = /^#[0-9a-f]{6}$/i;
// Reads any CSS color as #rrggbb (for the color inputs)
function toHex(value, fallback = '#808080') {
  if (HEX.test(value ?? '')) return value.toLowerCase();
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value ?? '');
  return m ? `#${m.slice(1, 4).map(n => Number(n).toString(16).padStart(2, '0')).join('')}` : fallback;
}

const EMPTY_DESIGN = {
  colors: {},
  backdrop: { kind: 'glow', type: 'linear', angle: 160, stops: [], scene: 'sky', dim: 0.25, blur: 0, animate: true },
  fonts: { heading: null, scale: 1, weight: 400 },
  shape: { radius: 1, cardOpacity: 1, cardBlur: 0, shadow: 1, border: 1 },
};

// A starting point: the design in use, or one built from a built-in theme
function fromTheme(theme) {
  const p = theme.preview ?? {};
  return cleanCustom({
    name: `My ${theme.name}`, base: theme.base, background: toHex(theme.bar), accent: toHex(p.accent, '#7c3aed'), font: null,
    design: {
      ...EMPTY_DESIGN,
      colors: { surface: toHex(p.card, undefined), text: toHex(p.text, undefined) },
      backdrop: { ...EMPTY_DESIGN.backdrop, kind: theme.scene ? 'scene' : 'glow', scene: theme.scene ?? 'sky' },
    },
  });
}
function startingSpec(themeId) {
  const current = loadCustom();
  if (current?.design) return current;
  const builtIn = THEMES.find(t => t.id === themeId);
  if (builtIn) return fromTheme(builtIn);
  return cleanCustom({ ...(current ?? { name: 'My theme', base: 'dark' }), design: EMPTY_DESIGN });
}

// ── Small controls ───────────────────────────────────────────────────

function ColorField({ label, value, auto, onChange, onAuto, note }) {
  const id = `studio-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const [draft, setDraft] = useState(null);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <input id={id} type="color" value={toHex(value)} onChange={e => onChange(e.target.value)}
        className="w-11 h-11 rounded-xl border border-[var(--border)] bg-transparent cursor-pointer flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm text-[var(--text-primary)]">{label}</label>
        <p className="text-xs text-[var(--text-muted)]">{auto ? 'Worked out from your basics' : note || 'Your color'}</p>
      </div>
      <input aria-label={`${label} hex code`} value={draft ?? toHex(value)} maxLength={7}
        onChange={e => { setDraft(e.target.value); if (HEX.test(e.target.value)) onChange(e.target.value); }}
        onBlur={() => setDraft(null)}
        className="input !w-24 !px-2 !py-2 font-mono !text-base sm:!text-xs" />
      {onAuto && !auto && (
        <button type="button" onClick={onAuto} className="btn-ghost !px-2 !py-2 text-xs">Auto</button>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, show }) {
  const id = `studio-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm text-[var(--text-primary)]">{label}</label>
        <span className="text-xs tabular-nums text-[var(--text-muted)]">{show(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)] h-8" />
    </div>
  );
}

function Chips({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`px-3 h-9 rounded-full text-sm border transition-colors ${value === o.id
            ? 'aura-fill text-white border-transparent' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-aura-500/50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FontSelect({ label, value, onChange, defaultLabel }) {
  const id = `studio-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="py-1.5">
      <label htmlFor={id} className="block text-sm text-[var(--text-primary)] mb-1">{label}</label>
      <select id={id} value={value ?? ''} onChange={e => { const v = e.target.value || null; if (v) loadPostFont(v); onChange(v); }}
        className="input !text-base sm:!text-sm">
        <option value="">{defaultLabel}</option>
        {FONT_GROUPS.map(([cat, fonts]) => (
          <optgroup key={cat} label={cat}>
            {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </optgroup>
        ))}
      </select>
      {value && <p className="mt-1.5 text-lg text-[var(--text-secondary)]" style={{ fontFamily: fontFamily(value) }}>The quick brown fox jumps over the lazy dog</p>}
    </div>
  );
}

// ── The live preview ─────────────────────────────────────────────────

function Preview({ spec }) {
  const vars = customVars(spec, { studio: true });
  const d = spec.design;
  const b = d.backdrop;
  const style = {
    ...vars,
    background: vars['--bg-primary'],
    color: vars['--text-primary'],
    fontFamily: spec.font ? fontFamily(spec.font) : undefined,
    fontWeight: d.fonts.weight,
    zoom: d.fonts.scale,
  };
  const heading = d.fonts.heading ? { fontFamily: fontFamily(d.fonts.heading) } : undefined;
  return (
    <div data-theme="custom" className={`relative overflow-hidden rounded-2xl border border-[var(--border)] ${spec.base === 'dark' ? 'dark' : ''}`}
      style={style} aria-label="Preview of your theme" role="img">
      {b.kind === 'scene' && <div aria-hidden="true" className="absolute inset-0 pointer-events-none"><SceneDecor scene={b.scene} variant="app" /></div>}
      {b.kind === 'glow' && <div aria-hidden="true" className="aura-ambient absolute inset-0 pointer-events-none" />}
      {['gradient', 'image', 'video'].includes(b.kind) && <StudioBackdrop backdrop={b} />}
      <div className="relative p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={heading}>{spec.name}</h2>
          <span className="aura-badge">Premium</span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full aura-fill" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Ana Lights</p>
              <p className="text-xs text-[var(--text-muted)]">2 hours ago</p>
            </div>
          </div>
          <p className="text-sm text-[var(--text-primary)]">Watched the sunrise from the ridge today. Worth the early alarm.</p>
          <p className="text-xs text-[var(--text-secondary)]">#sunrise #hiking</p>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" tabIndex={-1} className="btn-primary !py-2 !px-4 text-sm">Give aura</button>
            <button type="button" tabIndex={-1} className="btn-secondary !py-2 !px-4 text-sm text-[var(--text-secondary)]">Comment</button>
          </div>
        </div>
        <input tabIndex={-1} readOnly value="Search Aura" className="input" aria-hidden="true" />
      </div>
    </div>
  );
}

// ── The page ─────────────────────────────────────────────────────────

export default function ThemeStudio() {
  const { dbProfile, refreshUser } = useAuth();
  const { themeId, setThemeId, refreshCustom } = useTheme();
  const premium = !!dbProfile?.isPremium;
  const [spec, setSpecNow] = useState(() => startingSpec(themeId));
  const [tab, setTab] = useState('basics');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState(null);
  const fileInput = useRef(null);

  const setSpec = next => setSpecNow(s => cleanCustom(typeof next === 'function' ? next(s) : next));
  const d = spec.design;
  const setDesign = (part, changes) => setSpec(s => ({ ...s, design: { ...s.design, [part]: { ...s.design[part], ...changes } } }));
  const setColor = (key, value) => setSpec(s => {
    const colors = { ...s.design.colors };
    if (value) colors[key] = value; else delete colors[key];
    return { ...s, design: { ...s.design, colors } };
  });
  const vars = useMemo(() => customVars(spec, { studio: true }), [spec]);
  const adjusted = readableKeys(spec);

  async function pickMedia(file) {
    if (!file) return;
    const check = checkMedia(file);
    if (check.error) { setNotice({ error: true, text: check.error }); return; }
    try {
      const { id, kind } = await saveMedia(file);
      setDesign('backdrop', { kind, mediaId: id });
      setNotice({ text: `Your ${kind} is kept on this device only. Nobody else sees it, and other devices show a soft glow until you add it there too.` });
    } catch (err) {
      setNotice({ error: true, text: err.message });
    }
  }

  async function useIt() {
    if (!premium || busy) return;
    setBusy(true);
    setNotice(null);
    const before = { themeId, custom: loadCustom() };
    const applied = saveCustom(spec);
    setThemeId('custom');
    refreshCustom();
    try {
      const { savedId, ...forAccount } = applied;
      await api.updateProfile({ theme: 'custom', themeDesign: forAccount });
      refreshUser?.();
      setNotice({ text: 'It\'s on, and saved to your account so it follows you to your other devices.' });
    } catch (err) {
      setNotice({ text: `It's on for this device. Saving it to your account didn't work (${err.message}).` });
    } finally {
      setUndo(before);
      setBusy(false);
    }
  }

  function undoIt() {
    if (!undo) return;
    if (undo.custom) saveCustom(undo.custom);
    setThemeId(undo.themeId);
    refreshCustom();
    if (undo.themeId !== 'custom') api.updateProfile({ theme: undo.themeId }).catch(() => {});
    setUndo(null);
    setNotice({ text: 'Back to your previous theme.' });
  }

  function saveCopy() {
    const result = saveTheme(spec, spec.name);
    setNotice(result.error ? { error: true, text: result.error } : { text: `Saved "${result.theme.name}" to Your themes in Settings.` });
  }

  const b = d.backdrop;
  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-4 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
          <Brush size={22} className="text-aura-400" /> Theme Studio
          <span className="aura-badge"><Crown size={12} /> Premium</span>
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Make every part of Aura yours: colors, backdrop, fonts and shapes. Text is kept readable whatever you pick.</p>
      </div>

      {!premium && (
        <div className="card flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-[var(--text-secondary)] flex-1">Theme Studio is part of Premium. Try everything here; to use your design on the app, get Premium.</p>
          <Link to="/premium" className="btn-primary text-sm">See Premium</Link>
        </div>
      )}

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
        <div className="lg:sticky lg:top-4 flex flex-col gap-3 min-w-0">
          <Preview spec={spec} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={useIt} disabled={!premium || busy} className="btn-primary flex-1 min-w-[9rem]">
              <Wand2 size={16} /> {busy ? 'Putting it on...' : 'Use this theme'}
            </button>
            <button type="button" onClick={saveCopy} disabled={!premium} className="btn-secondary text-[var(--text-secondary)]">
              <Save size={16} /> Save a copy
            </button>
            {undo && <button type="button" onClick={undoIt} className="btn-ghost"><Undo2 size={16} /> Undo</button>}
          </div>
          {notice && (
            <p role="status" className={`text-sm rounded-xl px-3 py-2 border ${notice.error
              ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-aura-400 bg-aura-500/10 border-aura-500/20'}`}>{notice.text}</p>
          )}
        </div>

        <div className="card flex flex-col gap-4 min-w-0">
          <div role="tablist" aria-label="Theme Studio sections" className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
            {TABS.map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`px-3.5 h-10 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${tab === t.id
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'basics' && (
            <div className="flex flex-col gap-3" role="tabpanel" aria-label="Basics">
              <div>
                <label htmlFor="studio-name" className="block text-sm text-[var(--text-primary)] mb-1">Name</label>
                <input id="studio-name" value={spec.name} maxLength={NAME_MAX} onChange={e => setSpecNow(s => ({ ...s, name: e.target.value }))}
                  onBlur={() => setSpec(s => s)} className="input !text-base sm:!text-sm" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-primary)] mb-1.5">Light or dark</p>
                <Chips label="Light or dark" options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]}
                  value={spec.base} onChange={base => setSpec(s => ({ ...s, base }))} />
              </div>
              <ColorField label="Background" value={spec.background} onChange={background => setSpec(s => ({ ...s, background }))} note="Everything else starts from this and the accent" />
              <ColorField label="Accent" value={spec.accent} onChange={accent => setSpec(s => ({ ...s, accent }))} note="Buttons, links and highlights" />
              <div>
                <p className="text-sm text-[var(--text-primary)] mb-1.5">Start from a theme</p>
                <div className="flex flex-wrap gap-1.5">
                  {THEMES.map(t => (
                    <button key={t.id} type="button" onClick={() => setSpec(fromTheme(t))}
                      className="px-3 h-9 rounded-full text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:border-aura-500/50">{t.name}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'colors' && (
            <div role="tabpanel" aria-label="Colors" className="divide-y divide-[var(--border)]">
              {COLOR_FIELDS.map(f => (
                <ColorField key={f.key} label={f.label} value={d.colors[f.key] ?? vars[f.varName]} auto={!d.colors[f.key]}
                  onChange={v => setColor(f.key, v)} onAuto={() => setColor(f.key, null)}
                  note={adjusted.includes(f.key) ? 'Adjusted a little so it stays readable' : undefined} />
              ))}
              <p className="pt-3 text-xs text-[var(--text-muted)]">
                Main text on cards: contrast {contrast(toHex(vars['--text-primary']), toHex(vars['--bg-card'].startsWith('rgba') ? vars['--bg-secondary'] : vars['--bg-card'])).toFixed(1)} to 1.
              </p>
            </div>
          )}

          {tab === 'backdrop' && (
            <div role="tabpanel" aria-label="Backdrop" className="flex flex-col gap-3">
              <Chips label="Backdrop" options={BACKDROPS} value={b.kind}
                onChange={kind => {
                  if (kind === 'image' || kind === 'video') { fileInput.current?.click(); return; }
                  setDesign('backdrop', { kind, ...(kind === 'gradient' && b.stops.length < 2 && { stops: [spec.accent, spec.background] }) });
                }} />
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm" className="hidden"
                aria-label="Choose a picture or video" onChange={e => { pickMedia(e.target.files?.[0]); e.target.value = ''; }} />

              {b.kind === 'gradient' && (
                <>
                  <Chips label="Gradient shape" options={[{ id: 'linear', label: 'Straight' }, { id: 'radial', label: 'Round' }, { id: 'conic', label: 'Swirl' }]}
                    value={b.type} onChange={type => setDesign('backdrop', { type })} />
                  {b.type !== 'radial' && <Slider label="Angle" value={b.angle} min={0} max={360} step={5} onChange={angle => setDesign('backdrop', { angle })} show={v => `${v}°`} />}
                  {b.stops.map((stop, i) => (
                    <ColorField key={i} label={`Color ${i + 1}`} value={stop}
                      onChange={v => setDesign('backdrop', { stops: b.stops.map((s, j) => (j === i ? v : s)) })}
                      onAuto={b.stops.length > 2 ? () => setDesign('backdrop', { stops: b.stops.filter((_, j) => j !== i) }) : undefined} />
                  ))}
                  {b.stops.length < 4 && (
                    <button type="button" className="btn-ghost self-start" onClick={() => setDesign('backdrop', { stops: [...b.stops, spec.accent] })}>Add a color</button>
                  )}
                  <div className="h-10 rounded-xl border border-[var(--border)]" style={{ background: gradientCss(b) }} aria-hidden="true" />
                </>
              )}
              {b.kind === 'scene' && (
                <Chips label="Scene" options={DESIGN_SCENES.map(id => ({ id, label: SCENE_NAMES[id] }))} value={b.scene} onChange={scene => setDesign('backdrop', { scene })} />
              )}
              {(b.kind === 'image' || b.kind === 'video') && (
                <button type="button" onClick={() => fileInput.current?.click()} className="btn-secondary self-start text-[var(--text-secondary)]">
                  <ImagePlus size={16} /> Choose another
                </button>
              )}
              {['gradient', 'image', 'video'].includes(b.kind) && (
                <>
                  <Slider label="Darken" value={b.dim} min={0} max={0.85} step={0.05} onChange={dim => setDesign('backdrop', { dim })} show={v => `${Math.round(v * 100)}%`} />
                  <Slider label="Blur" value={b.blur} min={0} max={24} step={1} onChange={blur => setDesign('backdrop', { blur })} show={v => `${v}px`} />
                </>
              )}
              {['gradient', 'video'].includes(b.kind) && (
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input type="checkbox" checked={b.animate} onChange={e => setDesign('backdrop', { animate: e.target.checked })} className="w-5 h-5 accent-[var(--accent)]" />
                  Move slowly
                </label>
              )}
            </div>
          )}

          {tab === 'fonts' && (
            <div role="tabpanel" aria-label="Fonts" className="flex flex-col gap-2">
              <FontSelect label="Text font" value={spec.font} defaultLabel="Aura's font (Plus Jakarta Sans)" onChange={font => setSpec(s => ({ ...s, font }))} />
              <FontSelect label="Heading font" value={d.fonts.heading} defaultLabel="Aura's heading font (Sora)" onChange={heading => setDesign('fonts', { heading })} />
              <Slider label="Text size" value={d.fonts.scale} min={0.85} max={1.2} step={0.05} onChange={scale => setDesign('fonts', { scale })} show={v => `${Math.round(v * 100)}%`} />
              <Slider label="Text weight" value={d.fonts.weight} min={400} max={700} step={100} onChange={weight => setDesign('fonts', { weight })}
                show={v => ({ 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' }[v])} />
              <p className="text-xs text-[var(--text-muted)]">Script and handwriting fonts are for posts only, so the app stays easy to read.</p>
            </div>
          )}

          {tab === 'shape' && (
            <div role="tabpanel" aria-label="Shape" className="flex flex-col gap-1">
              <Slider label="Corner roundness" value={d.shape.radius} min={0} max={2} step={0.1} onChange={radius => setDesign('shape', { radius })}
                show={v => (v === 0 ? 'Square' : v < 0.7 ? 'Slight' : v <= 1.2 ? 'Rounded' : 'Very round')} />
              <Slider label="Card see-through" value={1 - d.shape.cardOpacity} min={0} max={0.65} step={0.05} onChange={v => setDesign('shape', { cardOpacity: 1 - v })} show={v => `${Math.round(v * 100)}%`} />
              <Slider label="Frosted glass" value={d.shape.cardBlur} min={0} max={24} step={1} onChange={cardBlur => setDesign('shape', { cardBlur })} show={v => `${v}px`} />
              <Slider label="Shadow" value={d.shape.shadow} min={0} max={2} step={0.1} onChange={shadow => setDesign('shape', { shadow })} show={v => `${Math.round(v * 100)}%`} />
              <Slider label="Border thickness" value={d.shape.border} min={0} max={3} step={0.5} onChange={border => setDesign('shape', { border })} show={v => `${v}px`} />
            </div>
          )}

          <button type="button" onClick={() => { setSpec(fromTheme(THEMES.find(t => t.id === themeId) ?? THEMES[0])); setNotice(null); }}
            className="btn-ghost self-start text-xs"><RotateCcw size={14} /> Start over</button>
        </div>
      </div>
    </div>
  );
}
