import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api';

// The group's level, Spotlight, Aura Rain and weekly board. Polls gently,
// and quickly while a rain is falling so the drops left stay current.
const SLOW_MS = 30000;
const RAIN_MS = 4000;

export default function usePowerUps(groupId, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const offset = useRef(0);   // server clock minus ours, for countdowns

  const load = useCallback(async () => {
    try {
      const next = await api.getPowerUps(groupId);
      offset.current = (next.now ?? Date.now()) - Date.now();
      setData(next);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [groupId]);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  const raining = !!data?.rain;
  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, raining ? RAIN_MS : SLOW_MS);
    return () => clearInterval(t);
  }, [enabled, raining, load]);

  return { data, error, reload: load, serverNow: () => Date.now() + offset.current, setData };
}
