import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, Lock } from 'lucide-react';
import { TOPICS } from '../../utils/topics';
import { setTopics, topicChoice, EMPTY_PREFS } from '../../utils/feedPrefs';

const NEXT_CHOICE = { null: 'more', more: 'less', less: null };

const CHIP_STYLES = {
  more: 'bg-aura-500/20 border-aura-500/50 text-aura-400',
  less: 'bg-red-500/10 border-red-500/40 text-red-400 line-through',
  null: 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:border-aura-500/30',
};

export default function TuneFeed({ prefs, onChange }) {
  const [open, setOpen] = useState(false);
  const picked = prefs.more.length + prefs.less.length;

  function cycle(topic) {
    onChange(setTopics(prefs, [topic], NEXT_CHOICE[topicChoice(prefs, topic)]));
  }

  return (
    <section className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold
                   text-[var(--text-primary)] hover:bg-[var(--accent-subtle)] transition-colors">
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-aura-400" />
          Tune your feed
          {picked > 0 && (
            <span className="text-xs font-normal text-[var(--text-muted)]">
              {prefs.more.length} more · {prefs.less.length} less
            </span>
          )}
        </span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Tap a topic once to see <span className="text-aura-400 font-semibold">more</span> of it,
            again to see <span className="text-red-400 font-semibold">less</span>, and again to reset.
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map(topic => {
              const choice = topicChoice(prefs, topic.id);
              return (
                <button
                  key={topic.id}
                  onClick={() => cycle(topic.id)}
                  aria-label={`${topic.label}: ${choice ?? 'neutral'}`}
                  className={`px-3 py-1 rounded-full border text-xs font-medium transition-all ${CHIP_STYLES[choice]}`}>
                  {choice === 'more' ? '+ ' : choice === 'less' ? '− ' : ''}{topic.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 mt-4">
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Lock size={12} className="flex-shrink-0" />
              Saved only on this device. Aura never sees your choices.
            </p>
            {picked > 0 && (
              <button
                onClick={() => onChange(EMPTY_PREFS)}
                className="text-xs font-semibold text-[var(--text-muted)] hover:text-red-400 flex-shrink-0">
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
