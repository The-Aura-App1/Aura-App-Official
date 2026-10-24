import React, { useState, useEffect } from 'react';

// A button that needs a second tap within a few seconds, for actions that are
// hard to undo (the app can't use window.confirm)
export default function ConfirmButton({ label, confirmLabel, onConfirm, disabled, className = '', danger = true }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50
        ${armed
          ? (danger ? 'bg-red-500 border-red-500 text-white' : 'bg-aura-500 border-aura-500 text-white')
          : (danger ? 'border-red-400/30 text-red-400 hover:bg-red-400/10' : 'border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]')}
        ${className}`}>
      {armed ? (confirmLabel ?? `${label}?`) : label}
    </button>
  );
}
