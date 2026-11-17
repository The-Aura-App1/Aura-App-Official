import React, { useEffect, useState } from 'react';
import { CloudRain } from 'lucide-react';
import { api } from '../../api';
import './powerups.css';
import AuraMark from '../brand/AuraMark';

// Drops of light falling through the banner, placed once
const DROPS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53) % 100}%`, delay: `${-((i * 0.37) % 2.2).toFixed(2)}s`, dur: `${1.4 + (i % 5) * 0.22}s`, size: 3 + (i % 3),
}));

function useCountdown(endsAt, serverNow) {
  const [left, setLeft] = useState(() => endsAt - serverNow());
  useEffect(() => {
    setLeft(endsAt - serverNow());
    const t = setInterval(() => setLeft(endsAt - serverNow()), 1000);
    return () => clearInterval(t);
  }, [endsAt, serverNow]);
  return Math.max(0, left);
}

const clock = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Shown on every tab of a group while an Aura Rain is falling: who started
// it, how much is left, a countdown and the Catch button.
export default function RainBanner({ groupId, rain, serverNow, onCaught }) {
  const left = useCountdown(rain.endsAt, serverNow);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // { amount } or { error }
  const caught = rain.caught ?? result?.amount ?? null;
  const notEligible = rain.eligible !== true ? rain.eligible : null;

  async function catchIt() {
    setBusy(true);
    try {
      const res = await api.catchRain(groupId);
      setResult({ amount: res.amount });
      onCaught?.(res.amount);
    } catch (err) {
      setResult({ error: err.message });
      onCaught?.(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="aura-rain relative overflow-hidden rounded-2xl p-4 text-white" aria-live="polite">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {DROPS.map((d, i) => (
          <span key={i} className="aura-rain-drop" style={{ left: d.left, width: d.size, height: d.size * 4, animationDelay: d.delay, animationDuration: d.dur }} />
        ))}
      </div>
      <div className="relative flex items-center gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <CloudRain size={22} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <p className="font-bold">Aura Rain from @{rain.byUsername}</p>
          <p className="text-xs text-white/80 tabular-nums">
            {rain.remaining.toLocaleString()} of {rain.pot.toLocaleString()} left · {clock(left)} · {rain.catches} caught so far
          </p>
        </div>
        {caught !== null ? (
          <span key={caught} className="aura-rain-caught inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 font-bold">
            <AuraMark size={15} aria-hidden="true" /> +{caught} caught
          </span>
        ) : notEligible ? (
          <span className="text-xs text-white/85 max-w-[14rem]">{notEligible}</span>
        ) : (
          <button type="button" onClick={catchIt} disabled={busy || rain.remaining <= 0 || left <= 0}
            className="aura-rain-catch px-5 py-2 rounded-xl font-bold bg-white text-[#3b1d78] disabled:opacity-60">
            {busy ? 'Catching…' : 'Catch'}
          </button>
        )}
      </div>
      {result?.error && <p className="relative mt-2 text-xs text-white/90" role="alert">{result.error}</p>}
    </section>
  );
}
