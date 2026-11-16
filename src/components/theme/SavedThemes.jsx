import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Trash2, Save, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import useChooseTheme from '../../hooks/useChooseTheme';
import {
  loadSavedThemes, saveTheme, renameSavedTheme, deleteSavedTheme, applySavedTheme, onSavedThemesChange,
  loadCustom, customVars, NAME_MAX, SAVED_MAX,
} from '../../themes/customTheme';

function Swatch({ spec }) {
  const v = customVars(spec);
  return (
    <div className="h-14 rounded-lg relative overflow-hidden border border-[var(--border)]" style={{ background: v['--bg-primary'] }} aria-hidden="true">
      <div className="absolute inset-x-3 top-2.5 bottom-2 rounded-md flex items-center gap-1.5 px-2" style={{ background: v['--bg-card'], boxShadow: `0 0 0 1px ${v['--border']}` }}>
        <span className="w-3 h-3 rounded-full" style={{ background: v['--accent'] }} />
        <span className="h-1.5 w-1/2 rounded-full" style={{ background: v['--text-primary'], opacity: 0.7 }} />
      </div>
    </div>
  );
}

// Your saved custom themes, each with whatever name you like: use, rename
// or delete them, and save the custom theme you're using under a new name.
// They're kept on this device, like the custom theme itself.
export default function SavedThemes() {
  const { themeId, refreshCustom } = useTheme();
  const chooseTheme = useChooseTheme();
  const [saved, setSaved] = useState(loadSavedThemes);
  const [current, setCurrent] = useState(loadCustom);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);     // { id, name }
  const [error, setError] = useState('');

  useEffect(() => onSavedThemesChange(() => { setSaved(loadSavedThemes()); setCurrent(loadCustom()); }), []);
  useEffect(() => { setCurrent(loadCustom()); }, [themeId]);

  const inUse = themeId === 'custom' ? current?.savedId : null;
  const alreadySaved = !!current && saved.some(t => t.id === current.savedId);

  function use(id) {
    applySavedTheme(id);
    setCurrent(loadCustom());
    if (themeId === 'custom') refreshCustom();
    else chooseTheme('custom');
  }
  function saveCurrent(e) {
    e.preventDefault();
    const result = saveTheme(current, newName);
    if (result.error) { setError(result.error); return; }
    setError('');
    setNewName('');
    use(result.theme.id);
  }
  function rename(e) {
    e.preventDefault();
    const result = renameSavedTheme(editing.id, editing.name);
    if (result.error) { setError(result.error); return; }
    setError('');
    setEditing(null);
    if (inUse === editing.id) refreshCustom();
  }

  return (
    <div className="flex flex-col gap-3" aria-label="Your themes">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your themes</h3>
        <span className="text-xs text-[var(--text-muted)]">{saved.length}/{SAVED_MAX}</span>
      </div>

      {current && !alreadySaved && saved.length < SAVED_MAX && (
        <form onSubmit={saveCurrent} className="flex flex-col gap-2 p-3 rounded-xl border border-dashed border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">Save your current custom theme{current.name ? ` ("${current.name}")` : ''} so you can switch back to it any time.</p>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={NAME_MAX} placeholder="Name it anything"
              aria-label="Theme name" className="input py-2 flex-1" />
            <button type="submit" disabled={!newName.trim()} className="btn-primary px-3 py-2 text-sm flex-shrink-0"><Save size={15} /> Save</button>
          </div>
        </form>
      )}

      {saved.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">
          No saved themes yet. <Link to="/angel" className="text-[var(--accent)] inline-flex items-center gap-1"><Sparkles size={12} /> Ask Angel</Link> to make you one
          (like "a dark theme with neon green"), then save it here with any name you like.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {saved.map(t => (
            <li key={t.id} className={`flex flex-col gap-2 p-2.5 rounded-xl border ${inUse === t.id ? 'border-aura-500/60 bg-aura-500/5' : 'border-[var(--border)]'}`}>
              <Swatch spec={t} />
              {editing?.id === t.id ? (
                <form onSubmit={rename} className="flex gap-1.5">
                  <input value={editing.name} onChange={e => setEditing(x => ({ ...x, name: e.target.value }))} maxLength={NAME_MAX} autoFocus
                    aria-label="New name" className="input py-1.5 text-sm flex-1 min-w-0" />
                  <button type="submit" className="btn-primary px-2.5 py-1.5 text-xs flex-shrink-0">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="btn-ghost text-xs flex-shrink-0">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5">
                  <p className="flex-1 min-w-0 text-sm font-semibold text-[var(--text-primary)] truncate" title={t.name}>{t.name}</p>
                  <button type="button" onClick={() => setEditing({ id: t.id, name: t.name })} aria-label={`Rename ${t.name}`}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)]"><Pencil size={14} /></button>
                  <button type="button" aria-label={`Delete ${t.name}`}
                    onClick={() => { if (window.confirm(`Delete "${t.name}"? This can't be undone.`)) deleteSavedTheme(t.id); }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400"><Trash2 size={14} /></button>
                  {inUse === t.id ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-aura-400 px-2"><Check size={13} /> In use</span>
                  ) : (
                    <button type="button" onClick={() => use(t.id)} className="btn-secondary px-3 py-1 text-xs text-[var(--text-primary)]">Use</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}
