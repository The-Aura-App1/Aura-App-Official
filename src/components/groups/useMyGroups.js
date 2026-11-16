import { useEffect, useState } from 'react';
import { api } from '../../api';

// The groups you're in (with their level and reaction pins), loaded once and
// shared by every post on the page. refreshMyGroups() reloads it after a
// change, such as new pins.
let cached = null;
const listeners = new Set();

function load() {
  if (!cached) {
    cached = api.getMyGroups()
      .then(d => (d.groups ?? []).filter(g => g.myStatus === 'active'))
      .catch(() => { cached = null; return []; });
  }
  return cached;
}

export function refreshMyGroups() {
  cached = null;
  load().then(groups => listeners.forEach(fn => fn(groups)));
}

export default function useMyGroups(enabled = true) {
  const [groups, setGroups] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    load().then(g => { if (live) setGroups(g); });
    const listen = g => { if (live) setGroups(g); };
    listeners.add(listen);
    return () => { live = false; listeners.delete(listen); };
  }, [enabled]);
  return groups;
}
