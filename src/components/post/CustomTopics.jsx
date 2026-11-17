import React, { useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../../api';
import { TOPICS, TOPIC_IDS } from '../../utils/topics';
import { checkCustomTopic, topicKey, topicDisplay, isHiddenTopic, CUSTOM_TOPIC_MAX, CUSTOM_TOPICS_PER_DAY } from '../../utils/customTopics';

// The composer's "your own topic" box: type a topic, see matching ones as
// you go (Aura's topics and the custom ones already in use, so the same idea
// doesn't split into five spellings), add it as a chip. aura-posts checks
// everything again.
export default function CustomTopics({ value, onChange, room, onCurated, onHashtag }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [inUse, setInUse] = useState([]);
  const loaded = useRef(false);

  // The custom topics on today's popular posts, most used first (loaded once, on focus)
  function loadInUse() {
    if (loaded.current) return;
    loaded.current = true;
    api.getFeed().then(d => {
      const counts = new Map();
      for (const p of d?.posts ?? []) for (const k of p.customTopics ?? []) if (!isHiddenTopic(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
      setInUse([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k));
    }).catch(() => {});
  }

  const suggestions = useMemo(() => {
    const q = topicKey(text);
    if (q.length < 2) return [];
    const curated = TOPICS.filter(t => t.label.toLowerCase().includes(q)).map(t => ({ curated: t.id, label: t.label }));
    const custom = inUse.filter(k => k.includes(q) && !value.includes(k)).map(k => ({ key: k, label: topicDisplay(k) }));
    return [...curated, ...custom].slice(0, 6);
  }, [text, inUse, value]);

  function add(raw) {
    const checked = checkCustomTopic(raw, [...TOPIC_IDS]);
    if (checked.error) { setError(checked); return; }
    if (checked.curated) { onCurated(checked.key); setText(''); setError(null); return; }
    if (value.includes(checked.key)) { setError({ error: 'That topic is already on.' }); return; }
    if (room <= 0) { setError({ error: 'That\'s 3 topics already. Remove one to add another.' }); return; }
    onChange([...value, checked.key]);
    setText('');
    setError(null);
  }

  return (
    <div className="mt-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map(k => (
            <span key={k} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border text-xs font-medium bg-aura-500/20 border-aura-500/50 text-aura-400">
              {topicDisplay(k)}
              <button type="button" onClick={() => onChange(value.filter(x => x !== k))} aria-label={`Remove ${topicDisplay(k)}`}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-aura-500/20"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={e => { e.preventDefault(); if (text.trim()) add(text); }} className="flex gap-2">
        <input value={text} onChange={e => { setText(e.target.value.slice(0, CUSTOM_TOPIC_MAX + 4)); setError(null); }} onFocus={loadInUse}
          placeholder="Or add your own topic" aria-label="Your own topic" disabled={room <= 0 && !text}
          className="input flex-1 !py-2" />
        <button type="submit" disabled={!text.trim()} className="btn-secondary !px-3 !py-2 text-sm text-[var(--text-secondary)]" aria-label="Add topic">
          <Plus size={16} /> Add
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Matching topics">
          {suggestions.map(s => (
            <button key={s.curated ?? s.key} type="button" onClick={() => (s.curated ? (onCurated(s.curated), setText('')) : add(s.key))}
              className="px-3 h-8 rounded-full border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-aura-500/50">
              {s.label}{s.curated ? '' : ' · in use'}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="text-xs text-red-400 mt-1.5" role="alert">
          {error.error}
          {error.hashtag && (
            <button type="button" className="ml-2 underline text-[var(--accent)]" onClick={() => { onHashtag(error.hashtag); setText(''); setError(null); }}>
              Add #{error.hashtag}
            </button>
          )}
        </p>
      )}
      <p className="text-[11px] text-[var(--text-muted)] mt-1">2 to {CUSTOM_TOPIC_MAX} characters: letters, numbers, spaces and hyphens. Up to {CUSTOM_TOPICS_PER_DAY} of your own topics a day.</p>
    </div>
  );
}
