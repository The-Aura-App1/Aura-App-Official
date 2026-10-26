import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, Lock, X } from 'lucide-react';
import { TOPICS } from '../../utils/topics';
import {
  setTopics, topicChoice, addKeyword, removeKeyword, hasKeyword,
  EMPTY_PREFS, MAX_KEYWORDS, MAX_KEYWORD_LENGTH,
} from '../../utils/feedPrefs';
import { embedTexts } from '../../utils/embedClient';

const NEXT_CHOICE = { null: 'more', more: 'less', less: null };

const CHIP_STYLES = {
  more: 'bg-aura-500/20 border-aura-500/50 text-aura-400',
  less: 'bg-red-500/10 border-red-500/40 text-red-400 line-through',
  null: 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:border-aura-500/30',
};

// onChange takes a function of the latest prefs, since adding a keyword waits on the model
export default function TuneFeed({ prefs, onChange }) {
  const [open, setOpen]       = useState(false);
  const [keyword, setKeyword] = useState('');
  const [adding, setAdding]   = useState(false);
  const [error, setError]     = useState('');
  const picked = prefs.more.length + prefs.less.length + prefs.words.length;
  const moreCount = prefs.more.length + prefs.words.filter(w => w.choice === 'more').length;
  const lessCount = prefs.less.length + prefs.words.filter(w => w.choice === 'less').length;

  function cycle(topic) {
    onChange(current => setTopics(current, [topic], NEXT_CHOICE[topicChoice(current, topic)]));
  }

  async function addWord(choice) {
    const text = keyword.trim();
    setError('');
    if (!text) return;
    if (hasKeyword(prefs, text)) { setError('You already added that.'); return; }
    if (prefs.words.length >= MAX_KEYWORDS) { setError(`You can add up to ${MAX_KEYWORDS} keywords.`); return; }

    setAdding(true);
    try {
      const [vec] = await embedTexts([text]);
      onChange(current => addKeyword(current, text, vec, choice));
      setKeyword('');
    } catch (err) {
      setError(`Couldn't add that keyword: ${err.message}`);
    } finally {
      setAdding(false);
    }
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
              {moreCount} more · {lessCount} less
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

          <p className="text-xs text-[var(--text-muted)] mt-5 mb-2">
            Or describe it in your own words, like "jazz", "street photography" or "vegan recipes".
          </p>
          <form onSubmit={e => { e.preventDefault(); addWord('more'); }} className="flex gap-2">
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              maxLength={MAX_KEYWORD_LENGTH}
              disabled={adding}
              placeholder="Add a keyword"
              aria-label="Keyword"
              className="input flex-1 min-w-0 py-1.5 text-sm"
            />
            <button type="submit" disabled={adding || !keyword.trim()}
              className="px-3 rounded-xl text-xs font-semibold bg-aura-500/15 text-aura-400 border border-aura-500/30 disabled:opacity-40">
              More
            </button>
            <button type="button" onClick={() => addWord('less')} disabled={adding || !keyword.trim()}
              className="px-3 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 disabled:opacity-40">
              Less
            </button>
          </form>
          {adding && (
            <p className="text-xs text-aura-400 mt-2">
              Reading your keyword on this device. The first time, this downloads a small model (about 23 MB).
            </p>
          )}
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          {prefs.words.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {prefs.words.map(word => (
                <span key={word.text}
                  className={`flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border text-xs font-medium ${CHIP_STYLES[word.choice].replace(' line-through', '')}`}>
                  {word.choice === 'more' ? '+ ' : '− '}{word.text}
                  <button
                    onClick={() => onChange(current => removeKeyword(current, word.text))}
                    aria-label={`Remove ${word.text}`}
                    className="p-0.5 rounded-full hover:bg-black/20">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mt-4">
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Lock size={12} className="flex-shrink-0" />
              Saved only on this device. Aura never sees your choices.
            </p>
            {picked > 0 && (
              <button
                onClick={() => onChange(() => EMPTY_PREFS)}
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
