import React, { useEffect, useRef, useState } from 'react';
import { AtSign, MapPin, X } from 'lucide-react';
import { api } from '../../api';
import { MAX_TAGGED, LOCATION_MAX } from '../../utils/postExtras';

// The composer's "Tag people" and "Add a place" boxes. Tagging searches
// people as you type (the same search as the Search page); aura-posts checks
// every name again (real, active, not blocked either way).
export default function PeopleAndPlace({ people, onPeople, location, onLocation, me }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [error, setError] = useState('');
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (q.length < 2) { setFound([]); return undefined; }
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      api.searchPeople(q).then(r => {
        if (ticket !== latest.current) return;
        setFound((r?.people ?? r?.users ?? []).filter(p => p.username && p.username !== me && !people.includes(p.username)).slice(0, 5));
      }).catch(() => { if (ticket === latest.current) setFound([]); });
    }, 220);
    return () => clearTimeout(timer);
  }, [query, people, me]);

  function tag(username) {
    const name = String(username).toLowerCase().replace(/^@/, '').trim();
    if (!/^[a-z0-9_]{3,30}$/.test(name)) { setError('Tag people by their username.'); return; }
    if (name === me) { setError('You don\'t need to tag yourself.'); return; }
    if (people.includes(name)) { setQuery(''); return; }
    if (people.length >= MAX_TAGGED) { setError(`Tag up to ${MAX_TAGGED} people.`); return; }
    onPeople([...people, name]);
    setQuery('');
    setFound([]);
    setError('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
          Tag people <span className="text-[var(--text-muted)] font-normal">({people.length}/{MAX_TAGGED}, optional)</span>
        </p>
        <form onSubmit={e => { e.preventDefault(); if (query.trim()) tag(found[0]?.username ?? query); }} className="relative flex gap-2">
          <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input value={query} onChange={e => { setQuery(e.target.value.slice(0, 31)); setError(''); }}
            disabled={people.length >= MAX_TAGGED} placeholder={people.length >= MAX_TAGGED ? 'That\'s everyone you can tag' : 'Search a username'}
            aria-label="Tag people" autoComplete="off" className="input flex-1 min-w-0 py-1.5 pl-8 text-sm" />
        </form>
        {found.length > 0 && (
          <ul className="mt-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden" aria-label="People matching">
            {found.map(p => (
              <li key={p.username}>
                <button type="button" onClick={() => tag(p.username)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--accent-subtle)] flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-[var(--text-primary)] truncate">{p.displayName || p.username}</span>
                  <span className="text-xs text-[var(--text-muted)] truncate">@{p.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-xs text-red-400 mt-1.5" role="alert">{error}</p>}
        {people.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {people.map(name => (
              <span key={name} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border text-xs font-medium bg-aura-500/20 border-aura-500/50 text-aura-400">
                @{name}
                <button type="button" onClick={() => onPeople(people.filter(n => n !== name))} aria-label={`Untag @${name}`}
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/20"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="post-location" className="block text-sm font-medium text-[var(--text-primary)] mb-1">
          Where was it taken? <span className="text-[var(--text-muted)] font-normal">(optional)</span>
        </label>
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input id="post-location" value={location} onChange={e => onLocation(e.target.value.slice(0, LOCATION_MAX))}
            placeholder="A place, like Mount Rainier or Lisbon" autoComplete="off" className="input w-full py-1.5 pl-8 text-sm" />
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-1">Only the name you type is shared, never your exact position.</p>
      </div>
    </div>
  );
}
