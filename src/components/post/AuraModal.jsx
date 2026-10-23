import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api }     from '../../api';
import { formatAura } from '../../utils/format';

const GIVE_PRESETS_REGULAR = [5, 10, 25, 50, 100, 250, 500];
const GIVE_PRESETS_PREMIUM = [5, 10, 25, 50, 100, 250, 500, 1000, 2000];
const TAKE_PRESETS         = [5, 10, 25, 50];

export default function AuraModal({ post, type, onSuccess, onClose }) {
  const { isPremium } = useAuth();
  const isGive        = type === 'give';

  const presets = isGive
    ? (isPremium ? GIVE_PRESETS_PREMIUM : GIVE_PRESETS_REGULAR)
    : TAKE_PRESETS;

  const [selected, setSelected]   = useState(null);
  const [custom, setCustom]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const amount = selected ?? (parseInt(custom) || 0);

  async function handleSubmit() {
    if (!amount || amount < 1) {
      setError('Enter an amount.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fn     = isGive ? api.giveAura : api.takeAura;
      const result = await fn(post.postId, amount);
      onSuccess(isGive ? amount : -amount);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-sm bg-[var(--bg-secondary)]
                      rounded-t-3xl sm:rounded-2xl p-6
                      border border-[var(--border)]
                      animate-slide-up z-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles
              size={20}
              className={isGive ? 'text-aura-400' : 'text-red-400'}
            />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {isGive ? 'Give Aura' : 'Take Aura'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-muted)]
                       hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)]
                       transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Post author */}
        <p className="text-xs text-[var(--text-muted)] mb-4">
          {isGive ? 'Rewarding' : 'Taking from'}{' '}
          <span className="text-[var(--text-primary)] font-medium">
            @{post.authorUsername}
          </span>
        </p>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {presets.map(preset => (
            <button
              key={preset}
              onClick={() => { setSelected(preset); setCustom(''); }}
              className={`py-2.5 rounded-xl text-sm font-bold
                          border transition-all duration-200
                ${selected === preset
                  ? isGive
                    ? 'bg-aura-500 border-aura-500 text-white'
                    : 'bg-red-500 border-red-500 text-white'
                  : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)] hover:border-aura-500/50'
                }`}
            >
              {formatAura(preset)}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="mb-4">
          <input
            type="number"
            value={custom}
            onChange={e => { setCustom(e.target.value); setSelected(null); }}
            placeholder="Custom amount"
            min={1}
            max={isGive ? (isPremium ? 2000 : 500) : 50}
            className="input text-center"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10
                        border border-red-400/20 rounded-xl
                        px-4 py-2.5 mb-4">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !amount}
          className={`w-full py-3 rounded-xl font-bold text-sm text-white
                      transition-all duration-200 disabled:opacity-50
                      ${isGive
                        ? 'bg-aura-500 hover:bg-aura-400'
                        : 'bg-red-500 hover:bg-red-400'
                      }`}
        >
          {loading
            ? 'Processing...'
            : `${isGive ? 'Give' : 'Take'} ${amount ? formatAura(amount) : ''} Aura`
          }
        </button>
      </div>
    </div>
  );
}