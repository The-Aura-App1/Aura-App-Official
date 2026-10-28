import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Palette } from 'lucide-react';
import { THEMES } from '../../themes';
import { useTheme } from '../../context/ThemeContext';
import useChooseTheme from '../../hooks/useChooseTheme';

// A tiny picture of the app in the theme: its background, a post card with
// a couple of text lines, and an accent dot.
function ThemePreview({ theme, className = '' }) {
  const p = theme.preview;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: p.background }} aria-hidden="true">
      <div className="absolute inset-x-[14%] top-[22%] bottom-[18%] rounded-lg p-[8%] flex flex-col gap-[10%]"
        style={{ background: p.card, boxShadow: `0 0 0 1px ${p.muted}` }}>
        <div className="flex items-center gap-[8%]">
          <span className="w-[18%] aspect-square rounded-full" style={{ background: p.accent }} />
          <span className="h-[5px] w-1/2 rounded-full" style={{ background: p.text, opacity: 0.8 }} />
        </div>
        <span className="h-[4px] w-4/5 rounded-full" style={{ background: p.muted }} />
        <span className="h-[4px] w-3/5 rounded-full" style={{ background: p.muted }} />
      </div>
    </div>
  );
}

// Big preview cards, for Settings and onboarding. Picking one switches the
// whole app straight away, so people see it before moving on.
export function ThemeCards({ onPick }) {
  const { themeId } = useTheme();
  const chooseTheme = useChooseTheme();
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
      {THEMES.map(theme => {
        const selected = theme.id === themeId;
        return (
          <button key={theme.id} type="button" role="radio" aria-checked={selected}
            onClick={() => { chooseTheme(theme.id); onPick?.(theme.id); }}
            className={`text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-[var(--bg-card)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-500
              ${selected ? 'border-aura-500 shadow-aura-sm' : 'border-[var(--border)] hover:border-aura-500/50'}`}>
            <ThemePreview theme={theme} className="h-24" />
            <div className="px-3 py-2.5 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{theme.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{theme.description}</p>
              </div>
              {selected && (
                <span className="shrink-0 w-5 h-5 rounded-full bg-aura-500 text-white flex items-center justify-center">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// A compact theme switcher for the top bar and sidebar. `children` renders
// the button; `placement` decides whether the menu opens below or above it.
export function ThemeMenu({ placement = 'below', align = 'right', children, buttonClassName = '' }) {
  const { themeId } = useTheme();
  const chooseTheme = useChooseTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on a click elsewhere or on Escape
  useEffect(() => {
    if (!open) return;
    const onClick = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey   = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label="Change theme" className={buttonClassName}>
        {children}
      </button>
      {open && (
        <div role="menu"
          className={`absolute z-40 w-56 p-1.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl animate-fade-in
            ${placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'} ${align === 'left' ? 'left-0' : 'right-0'}`}>
          {THEMES.map(theme => (
            <button key={theme.id} type="button" role="menuitemradio" aria-checked={theme.id === themeId}
              onClick={() => { chooseTheme(theme.id); setOpen(false); }}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]">
              <ThemePreview theme={theme} className="w-9 h-7 rounded-md border border-[var(--border)] shrink-0" />
              <span className="flex-1 text-left">{theme.name}</span>
              {theme.id === themeId && <Check size={16} className="text-aura-400" />}
            </button>
          ))}
          <div className="border-t border-[var(--border)] my-1.5" />
          <Link to="/settings#appearance" onClick={() => setOpen(false)} role="menuitem"
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)]">
            <Palette size={16} /> More appearance settings
          </Link>
        </div>
      )}
    </div>
  );
}
