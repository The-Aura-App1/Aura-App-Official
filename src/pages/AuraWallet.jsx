import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Gift, Tv, Clock, Coins, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OrbBurst from '../components/motion/OrbBurst';
import useCountUp from '../hooks/useCountUp';

function formatNumber(n) {
  return (n ?? 0).toLocaleString();
}

// Daily limits reset at midnight UTC; show when that is locally
function nextResetTime() {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Re-renders every second while a countdown target is in the future
function useNow(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until || Date.parse(until) <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [until]);
  return now;
}

function Section({ icon: Icon, title, aside, children }) {
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-aura-400" />
          <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
        </div>
        {aside && <span className="text-xs text-[var(--text-muted)]">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

// Balances roll up from 0 when the page opens, and glow when aura lands in them.
const Balance = React.forwardRef(function Balance({ label, amount, description, glow = 0 }, ref) {
  const negative = amount < 0;
  const shown = useCountUp(amount, { duration: 900, fromZero: true });
  return (
    <div ref={ref} key={glow}
      className={`flex-1 min-w-[10rem] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 ${glow ? 'aura-balance-glow' : ''}`}>
      <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${negative ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
        {formatNumber(shown)}
      </p>
      <p className={`text-xs mt-1 ${negative ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>{description}</p>
    </div>
  );
});

function Meter({ label, used, limit }) {
  const left = Math.max(0, limit - used);
  // The bar shows what's left, matching the label
  const percent = limit > 0 ? Math.min(100, (left / limit) * 100) : 0;
  // Starts empty and fills to its level once the page has drawn
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1.5">
        <span className="text-[var(--text-primary)]">{label}</span>
        <span className="text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-primary)]">{formatNumber(left)}</span> of {formatNumber(limit)} left
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden"
        role="progressbar" aria-label={`${label} left`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={left}>
        <div className="h-full rounded-full aura-fill aura-meter-fill" style={{ width: `${filled ? percent : 0}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  const shown = useCountUp(value ?? 0, { duration: 900, fromZero: true });
  return (
    <div>
      <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{formatNumber(shown)}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export default function AuraWallet() {
  const { dbProfile, refreshUser } = useAuth();
  // The backend enforces limits from the user record, not the Cognito attribute
  const isPremium = !!dbProfile?.isPremium;

  const [busy, setBusy]       = useState(null);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const today    = dbProfile?.today;
  const nextAdAt = today?.nextAdAt;
  const now      = useNow(nextAdAt);
  const adReady  = !nextAdAt || Date.parse(nextAdAt) <= now;

  // Claiming floats orbs from the button into the spendable balance
  const spendableRef = useRef(null);
  const [burst, setBurst] = useState(null);   // { from, to }
  const [glow, setGlow]   = useState(0);
  const landed = useCallback(() => { setBurst(null); setGlow(n => n + 1); }, []);

  async function run(action, request, button) {
    setBusy(action);
    setError('');
    setSuccess('');
    try {
      const result = await request();
      setSuccess(result.message);
      const from = button?.getBoundingClientRect();
      const to = spendableRef.current?.getBoundingClientRect();
      if (from && to) setBurst({ from, to });
      else setGlow(n => n + 1);
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (!dbProfile) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-center gap-3">
        <Sparkles size={24} className="text-aura-400" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Aura Wallet</h1>
        <span className="aura-badge">{isPremium ? 'Premium' : 'Regular'}</span>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-2.5 rounded-xl bg-aura-500/10 border border-aura-500/20 text-aura-400 text-sm">
          {success}
        </div>
      )}

      {/* ── Balances ── */}
      <Section icon={Wallet} title="Balances">
        <div className="flex flex-wrap gap-3">
          <Balance
            ref={spendableRef}
            glow={glow}
            label="Spendable"
            amount={dbProfile.auraSpendable ?? 0}
            description={(dbProfile.auraSpendable ?? 0) < 0
              ? 'Below zero. Gifts come from your earned aura until it recovers.'
              : 'Used first for giving and taking, games and power-ups.'}
          />
          <Balance
            label="Earned"
            amount={dbProfile.auraEarned ?? 0}
            description="Given to you by others. Used for giving when spendable runs out."
          />
        </div>
      </Section>

      {/* ── Today ── */}
      {today && (
        <Section icon={Clock} title="Today" aside={`Resets at ${nextResetTime()}`}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Gift size={18} className="text-[var(--text-muted)] flex-shrink-0" />
                <div>
                  <p className="text-sm text-[var(--text-primary)]">Daily bonus</p>
                  <p className="text-xs text-[var(--text-muted)]">{formatNumber(today.bonus.amount)} spendable aura</p>
                </div>
              </div>
              <button
                onClick={e => run('bonus', api.claimDailyBonus, e.currentTarget)}
                disabled={today.bonus.claimed || busy !== null}
                className="btn-primary px-4 py-2 flex-shrink-0">
                {today.bonus.claimed ? 'Claimed' : busy === 'bonus' ? 'Claiming...' : 'Claim'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Tv size={18} className="text-[var(--text-muted)] flex-shrink-0" />
                <div>
                  <p className="text-sm text-[var(--text-primary)]">Watch an ad</p>
                  <p className="text-xs text-[var(--text-muted)]">25 spendable aura, once an hour</p>
                </div>
              </div>
              <button
                onClick={e => run('ad', api.watchAd, e.currentTarget)}
                disabled={!adReady || busy !== null}
                className="btn-secondary px-4 py-2 flex-shrink-0 text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed">
                {!adReady
                  ? `Available in ${formatCountdown(Date.parse(nextAdAt) - now)}`
                  : busy === 'ad' ? 'Loading...' : 'Watch'}
              </button>
            </div>
          </div>

          <div className="divider !my-1" />

          <div className="flex flex-col gap-4">
            <Meter label="Free aura to give" used={today.freeGive.used} limit={today.freeGive.limit} />
            <Meter label="Giving from your wallet" used={today.walletGive.used} limit={today.walletGive.limit} />
            <Meter label="Taking" used={today.take.used} limit={today.take.limit} />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            When you give, free aura is used first, then spendable aura, then earned aura.
            You can take up to 50 aura from any one post or comment.
          </p>
        </Section>
      )}

      {/* ── Lifetime ── */}
      <Section icon={Coins} title="All time">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Stat label="Received" value={dbProfile.lifetimeReceived} />
          <Stat label="Earned"   value={dbProfile.lifetimeEarned} />
          <Stat label="Given"    value={dbProfile.lifetimeGiven} />
          <Stat label="Taken"    value={dbProfile.lifetimeTaken} />
          <Stat label="Lost"     value={dbProfile.lifetimeLost} />
        </div>
      </Section>

      {burst && <OrbBurst from={burst.from} to={burst.to} onDone={landed} />}

      <p className="text-xs text-[var(--text-muted)] px-1">
        Aura has no cash value. Coming later: transaction history. Creator payouts are on the roadmap.
      </p>
    </div>
  );
}
