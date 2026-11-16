import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown, Sparkles, Gift, ShieldOff, Rocket, Smile, AtSign, Palette, Swords, BadgeCheck, Wallet, BarChart3, Share2, Check, Minus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { BOOSTS } from '../utils/powerUps';
import { STAKE_CAP } from '../components/games/gameInfo';
import { STYLE_PREMIUM_ONLY } from '../utils/postStyle';

// What Premium and creator accounts give you. Prices and numbers come from
// the economy rules (CLAUDE.md) and the same constants the app and servers
// use. Payments aren't set up yet, so there's nothing to buy here today.
export const PREMIUM_PRICE = '$4.99';
export const LAUNCH_SPOTS = 100;   // matches LAUNCH_SPOTS in aura-users/premium.mjs
export const CREATOR_PRICE = '$20';

// Regular vs Premium, from the limits aura-aura enforces (RULES in aura-aura/index.mjs)
const COMPARE = [
  ['Free aura every day', '250', '1,000'],
  ['Give in a day', '500', '2,000'],
  ['Take in a day', '250', '1,000'],
  ['Game stakes, per game and per day', STAKE_CAP.regular.toLocaleString(), STAKE_CAP.premium.toLocaleString()],
  ['Ads in your feed', 'Yes', 'None'],
  ['Group boosts', '–', `${BOOSTS.perMonth} a month`],
  ['Group reaction pins on any post', '–', 'Yes'],
  ['Username changes', 'Once', 'Every 24 hours'],
];

const PREMIUM_PERKS = [
  { icon: Gift, title: '4× the free aura', text: 'A 1,000 aura daily allowance (an 800 login bonus plus 200 free gives), instead of 250.' },
  { icon: Sparkles, title: 'Bigger limits', text: 'Give up to 2,000 aura a day and take up to 1,000. Play group games for up to 2,000 aura.' },
  { icon: ShieldOff, title: 'No ads', text: 'Your feed has no sponsored posts.' },
  { icon: Rocket, title: 'Group boosts', text: `Boost up to ${BOOSTS.perMonth} groups a month for free. Each boost gives the group ${Math.round(BOOSTS.bonus * 100)}% more XP for ${BOOSTS.days} days, so it levels up faster.` },
  { icon: Smile, title: 'Your groups\' pins, everywhere', text: 'Use the custom reaction pins from any group you\'re in on posts anywhere on Aura, not just in the group.' },
  { icon: AtSign, title: 'Change your username', text: 'Change it once every 24 hours. Without Premium you get one change.' },
  { icon: Palette, title: 'Post styling', text: STYLE_PREMIUM_ONLY ? 'About 120 fonts, text colors, backgrounds and frames for your posts.' : 'About 120 fonts, text colors, backgrounds and frames for your posts (free for everyone during launch, then part of Premium).' },
  { icon: Swords, title: 'Never pay-to-win', text: 'Premium gives more room and cosmetics, never stronger effects. Games stay pure skill.' },
];

const CREATOR_PERKS = [
  { icon: Wallet, title: 'Cash out earned aura', text: 'Turn the aura people give your posts into money: creators keep 75%. Coming later, with a $20 minimum and for verified adults (18+) only.', soon: true },
  { icon: BadgeCheck, title: 'Verified creator account', text: 'Confirm who you are, which cashing out will need.', soon: true },
  { icon: BarChart3, title: 'Creator analytics', text: 'See how your posts do over time: views, aura received and more.', soon: true },
  { icon: Share2, title: 'Share counts', text: 'See how many times your posts are shared to groups.', soon: true },
];

function Perk({ icon: Icon, title, text, soon }) {
  return (
    <li className="flex gap-3">
      <span className="w-9 h-9 rounded-xl bg-aura-500/15 border border-aura-500/30 flex items-center justify-center flex-shrink-0">
        <Icon size={17} className="text-aura-400" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {title}{soon && <span className="ml-2 text-[10px] uppercase tracking-wide font-bold text-[var(--text-muted)]">Coming soon</span>}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{text}</p>
      </div>
    </li>
  );
}

export default function Premium() {
  const { dbProfile, refreshUser } = useAuth();
  const isPremium = !!dbProfile?.isPremium;
  const isCreator = !!dbProfile?.isCreator;
  // The launch offer: the first LAUNCH_SPOTS people to press the button get Premium free
  const left = dbProfile?.premiumLaunchLeft ?? null;
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState(null);

  async function claim() {
    setClaiming(true);
    setClaimMsg(null);
    try {
      const res = await api.updateProfile({ claimPremium: true });
      setClaimMsg({ ok: res.message });
      await refreshUser?.();
    } catch (err) {
      setClaimMsg({ error: err.message });
      await refreshUser?.();
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-5 pb-10">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-400/15 border border-amber-400/40">
          <Crown size={24} className="text-amber-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Premium and creator accounts</h1>
          <p className="text-xs text-[var(--text-muted)]">Real money only ever buys subscriptions and cosmetics. Aura itself is never sold.</p>
        </div>
      </header>

      {/* ── Premium ── */}
      <section className="card flex flex-col gap-4 premium-card" aria-labelledby="premium-title">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 id="premium-title" className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><Crown size={18} className="text-amber-400" /> Aura Premium</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">More aura, bigger limits, no ads, and extras for your groups.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">{PREMIUM_PRICE}<span className="text-sm font-semibold text-[var(--text-muted)]"> / month</span></p>
          </div>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PREMIUM_PERKS.map(p => <Perk key={p.title} {...p} />)}
        </ul>
        {isPremium ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-400"><Check size={16} /> You have Premium. {dbProfile?.premiumSource === 'launch' ? 'You were one of the first 100. Enjoy!' : 'Thank you!'}</p>
        ) : left > 0 ? (
          <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-amber-400/40 bg-amber-400/10">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Launch offer: the first {LAUNCH_SPOTS} people get Premium free.</p>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums">{left} of {LAUNCH_SPOTS} spots left.</p>
            <button type="button" onClick={claim} disabled={claiming} className="btn-primary self-start mt-1">
              <Crown size={16} aria-hidden="true" /> {claiming ? 'Claiming…' : 'Get Premium free'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <button type="button" disabled className="btn-primary self-start opacity-70 cursor-not-allowed">Get Premium (coming soon)</button>
            <p className="text-[11px] text-[var(--text-muted)]">{left === 0 ? `All ${LAUNCH_SPOTS} free launch spots have been claimed. ` : ''}Subscriptions open once payments are set up.</p>
          </div>
        )}
        {claimMsg && <p className={`text-sm ${claimMsg.error ? 'text-red-400' : 'text-amber-400 font-semibold'}`} role={claimMsg.error ? 'alert' : 'status'}>{claimMsg.error ?? claimMsg.ok}</p>}
      </section>

      {/* ── Comparison ── */}
      <section className="card p-0 overflow-hidden" aria-label="Regular and Premium compared">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-elevated)] text-[var(--text-muted)] text-xs">
              <th className="text-left font-semibold px-4 py-2.5">&nbsp;</th>
              <th className="font-semibold px-3 py-2.5">Regular</th>
              <th className="font-semibold px-3 py-2.5 text-amber-400">Premium</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([label, regular, premium]) => (
              <tr key={label} className="border-t border-[var(--border)]">
                <td className="px-4 py-2.5 text-[var(--text-secondary)]">{label}</td>
                <td className="px-3 py-2.5 text-center text-[var(--text-muted)] tabular-nums">{regular === '–' ? <Minus size={14} className="inline" aria-label="No" /> : regular}</td>
                <td className="px-3 py-2.5 text-center font-semibold text-[var(--text-primary)] tabular-nums">{premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Creator ── */}
      <section className="card flex flex-col gap-4" aria-labelledby="creator-title">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 id="creator-title" className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><BadgeCheck size={18} className="text-aura-400" /> Creator account</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">For people who post for an audience and want to earn from it.</p>
          </div>
          <p className="text-2xl font-extrabold text-[var(--text-primary)] tabular-nums">{CREATOR_PRICE}<span className="text-sm font-semibold text-[var(--text-muted)]"> / year</span></p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CREATOR_PERKS.map(p => <Perk key={p.title} {...p} />)}
        </ul>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Aura has no cash value today, and cashing out isn't available yet: it's on the roadmap and comes once payments and the rules around them are in place.
          Creator accounts work alongside Premium; you can have either or both.
        </p>
        {isCreator ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-aura-400"><Check size={16} /> You have a creator account.</p>
        ) : (
          <button type="button" disabled className="btn-secondary self-start px-4 py-2 opacity-70 cursor-not-allowed text-[var(--text-primary)]">Become a creator (coming soon)</button>
        )}
      </section>

      <p className="text-xs text-[var(--text-muted)] text-center">
        Questions? <Link to="/angel" className="text-[var(--accent)]">Ask Angel</Link> or see <Link to="/about" className="text-[var(--accent)]">About Aura</Link>.
      </p>
    </div>
  );
}
