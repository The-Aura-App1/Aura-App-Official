import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudRain, Crown, Lock, Sparkles, Star, Trophy, Check, Rocket } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import { POWER_UPS, XP, XP_DAILY_CAP, LEVEL_UNLOCKS, BOOSTS, MAX_LEVEL } from '../../utils/powerUps';
import './powerups.css';

// The Hearth tab on a group page (docs/group-power-ups.md, Stage A): the
// group's level, the weekly Top Supporters board, Aura Rain and Spotlight.
// Everything here is checked again by aura-aura; this only shows and asks.

function Card({ icon: Icon, title, children, aside }) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-aura-400" aria-hidden="true" />
        <h2 className="font-semibold text-[var(--text-primary)] flex-1">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function LevelRing({ level }) {
  const span = Math.max(1, (level.next ?? level.floor) - level.floor);
  const progress = level.max ? 1 : Math.min(1, (level.xp - level.floor) / span);
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="hearth-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-1)" />
            <stop offset="100%" stopColor="var(--brand-3)" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="url(#hearth-ring)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - progress)} className="hearth-ring" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Level</span>
        <span className="text-2xl font-bold text-[var(--text-primary)] leading-none">{level.level}</span>
      </div>
    </div>
  );
}

function LevelCard({ level }) {
  return (
    <Card icon={Star} title="Group level">
      <div className="flex items-center gap-4">
        <LevelRing level={level} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--text-primary)] font-semibold tabular-nums">
            {level.xp.toLocaleString()} XP <span className="font-normal text-[var(--text-muted)]">· {level.max ? `max level (${MAX_LEVEL})` : `${(level.next - level.xp).toLocaleString()} to level ${level.level + 1}`}</span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            The group levels up together: {XP.post} XP a post, {XP.comment} a comment, {XP.give} a give and {XP.game} a game, up to {XP_DAILY_CAP} XP per member a day.
          </p>
        </div>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {LEVEL_UNLOCKS.map(u => {
          const reached = level.level >= u.level && !u.soon;
          return (
            <li key={u.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs
              ${reached ? 'border-aura-500/40 bg-aura-500/10 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
              {reached ? <Check size={13} className="text-aura-400 flex-shrink-0" aria-hidden="true" /> : <Lock size={12} className="flex-shrink-0" aria-hidden="true" />}
              <span><span className="font-semibold">Lv {u.level}</span> {u.label}{u.soon && <span className="opacity-70"> (coming soon)</span>}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-[var(--text-muted)]">Owners and moderators set up the group picture, pins and backgrounds in Manage.</p>
    </Card>
  );
}

// Premium members boost groups for free: more XP from everything members do
function BoostCard({ groupId, boost, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const daysLeft = boost.mine ? Math.max(1, Math.ceil((boost.mine - Date.now()) / 86400000)) : 0;
  const bonus = Math.round((boost.multiplier - 1) * 100);

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: (await api.boostGroup(groupId)).message });
      onChanged();
    } catch (err) {
      setMsg({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={Rocket} title="Boosts" aside={boost.active > 0 && <span className="aura-badge">+{bonus}% XP</span>}>
      <p className="text-sm text-[var(--text-secondary)]">
        {boost.active > 0
          ? `${boost.active} boost${boost.active === 1 ? '' : 's'} active: this group earns ${bonus}% more XP from everything members do.`
          : 'No boosts yet. Each Premium boost adds ' + Math.round(BOOSTS.bonus * 100) + '% XP for ' + BOOSTS.days + ' days.'}
      </p>
      {boost.premium ? (
        boost.mine ? (
          <p className="text-xs text-[var(--text-muted)]">You're boosting this group for {daysLeft} more day{daysLeft === 1 ? '' : 's'}. You have {boost.left} of {BOOSTS.perMonth} boosts left this month.</p>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={go} disabled={busy || boost.left < 1} className="btn-primary px-4 py-2">
              <Rocket size={15} aria-hidden="true" /> {busy ? 'Boosting…' : 'Boost this group'}
            </button>
            <span className="text-xs text-[var(--text-muted)]">{boost.left} of {BOOSTS.perMonth} boosts left this month. Free with Premium.</span>
          </div>
        )
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Premium members can boost up to {BOOSTS.perMonth} groups a month, free. Up to {BOOSTS.maxStack} boosts count at once.</p>
      )}
      {msg && <p className={`text-sm ${msg.error ? 'text-red-400' : 'text-emerald-400'}`} role={msg.error ? 'alert' : 'status'}>{msg.error ?? msg.ok}</p>}
    </Card>
  );
}

const MEDALS = ['#f5c542', '#c9d2e0', '#d99a62'];

function Supporters({ board, me }) {
  return (
    <Card icon={Trophy} title="Top Supporters" aside={<span className="text-xs text-[var(--text-muted)]">this week</span>}>
      {board.top.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nobody has given aura in the group this week yet. Be the first.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {board.top.map(r => (
            <li key={r.userId} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${r.userId === me ? 'bg-aura-500/10 border border-aura-500/30' : 'border border-transparent'}`}>
              <span className="w-6 text-center font-bold tabular-nums" style={r.rank <= 3 ? { color: MEDALS[r.rank - 1] } : undefined}>
                {r.rank <= 3 ? <Crown size={16} className="inline" aria-label={`Rank ${r.rank}`} /> : r.rank}
              </span>
              <Avatar name={r.displayName || r.username} picKey={r.picKey} size="w-8 h-8" />
              <Link to={`/profile/${encodeURIComponent(r.username)}`} className="flex-1 min-w-0 text-sm font-semibold text-[var(--text-primary)] truncate hover:text-[var(--accent)]">
                {r.userId === me ? 'You' : (r.displayName || r.username)}
              </Link>
              <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{r.given.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
      {board.me && (
        <p className="text-xs text-[var(--text-muted)]">
          {board.me.hidden ? `You gave ${board.me.given} this week. You're hidden from the board (Settings > Privacy).`
            : board.me.rank > board.top.length ? `You gave ${board.me.given} this week, rank ${board.me.rank}.` : null}
        </p>
      )}
      <p className="text-[11px] text-[var(--text-muted)]">Ranks aura given to posts and comments in this group. It starts over every Monday.</p>
    </Card>
  );
}

function RainCard({ groupId, data, onChanged }) {
  const { dbProfile, refreshUser } = useAuth();
  const [pot, setPot] = useState(250);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const spendable = dbProfile?.auraSpendable ?? 0;

  async function start() {
    if (!window.confirm(`Drop ${pot} of your spendable aura on the group? Members catch shares for ${POWER_UPS.rainMinutes} minutes; anything left comes back to you.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.startRain(groupId, pot);
      setMsg({ ok: res.message });
      refreshUser?.();
      onChanged();
    } catch (err) {
      setMsg({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={CloudRain} title="Aura Rain">
      {data.rain ? (
        <p className="text-sm text-[var(--text-secondary)]">It's raining now. Catch your share from the banner at the top.</p>
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]">
            Make it rain: drop {POWER_UPS.rainMin}–{POWER_UPS.rainMax.toLocaleString()} of your spendable aura on the group. Everyone gets {POWER_UPS.rainMinutes} minutes to catch a share (up to a tenth of the pot each), and what nobody catches comes back to you.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[100, 250, 500, 1000].map(v => (
              <button key={v} type="button" aria-pressed={pot === v} onClick={() => setPot(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${pot === v ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                {v}
              </button>
            ))}
            <input type="number" min={POWER_UPS.rainMin} max={POWER_UPS.rainMax} value={pot} aria-label="Rain amount"
              onChange={e => setPot(Math.floor(Number(e.target.value) || 0))} className="input w-24 py-1.5" />
            <button type="button" onClick={start} disabled={busy || !data.enabled || pot < POWER_UPS.rainMin || pot > POWER_UPS.rainMax || pot > spendable}
              className="btn-primary px-4 py-2">
              <CloudRain size={15} aria-hidden="true" /> {busy ? 'Starting…' : 'Make it rain'}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">You have {spendable.toLocaleString()} spendable. A group can rain up to {POWER_UPS.rainDailyCap.toLocaleString()} a day. To catch, accounts must be {POWER_UPS.minAccountDays} days old and in the group {POWER_UPS.minMemberDays} days.</p>
          {data.lastRain && <p className="text-xs text-[var(--text-muted)]">Last rain: {data.lastRain.pot} from @{data.lastRain.byUsername}, caught by {data.lastRain.catches}.</p>}
        </>
      )}
      {msg && <p className={`text-sm ${msg.error ? 'text-red-400' : 'text-emerald-400'}`} role={msg.error ? 'alert' : 'status'}>{msg.error ?? msg.ok}</p>}
    </Card>
  );
}

function SpotlightCard({ groupId, data, onChanged }) {
  const { user, refreshUser } = useAuth();
  const [mine, setMine] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const spot = data.spotlight;

  useEffect(() => {
    if (spot) return;
    api.getGroupPosts(groupId).then(d => setMine((d.posts ?? []).filter(p => p.authorId === user?.userId).slice(0, 5)), () => setMine([]));
  }, [groupId, spot, user?.userId]);

  async function pick(post) {
    if (!window.confirm(`Spotlight this post for ${POWER_UPS.spotlightHours} hours for ${POWER_UPS.spotlightCost} spendable aura?`)) return;
    setBusy(post.postId);
    setMsg(null);
    try {
      const res = await api.spotlightPost(groupId, post.postId);
      setMsg({ ok: res.message });
      refreshUser?.();
      onChanged();
    } catch (err) {
      setMsg({ error: err.message });
    } finally {
      setBusy(null);
    }
  }

  const hoursLeft = spot ? Math.max(1, Math.round((spot.until - Date.now()) / 3600000)) : 0;
  return (
    <Card icon={Sparkles} title="Spotlight" aside={<span className="text-xs text-[var(--text-muted)]">{POWER_UPS.spotlightCost} aura · {POWER_UPS.spotlightHours} h</span>}>
      {spot ? (
        <p className="text-sm text-[var(--text-secondary)]">
          <Link to={`/post/${encodeURIComponent(spot.postId)}`} className="font-semibold text-[var(--accent)]">A post by @{spot.byUsername}</Link> leads the group feed for about {hoursLeft} more hour{hoursLeft === 1 ? '' : 's'}. One post can be in the Spotlight at a time.
        </p>
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]">Pin one of your posts to the top of the group feed, glowing, for {POWER_UPS.spotlightHours} hours.</p>
          {mine === null && <p className="text-xs text-[var(--text-muted)]">Loading your posts…</p>}
          {mine?.length === 0 && <p className="text-xs text-[var(--text-muted)]">Post something in the group first, then come back to spotlight it.</p>}
          {mine?.map(p => (
            <div key={p.postId} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[var(--border)]">
              <p className="flex-1 min-w-0 text-sm text-[var(--text-primary)] truncate">{p.caption || `(${p.type} post)`}</p>
              <button type="button" disabled={!!busy || !data.enabled} onClick={() => pick(p)} className="btn-secondary px-3 py-1.5 text-xs flex-shrink-0">
                {busy === p.postId ? 'Pinning…' : 'Spotlight'}
              </button>
            </div>
          ))}
        </>
      )}
      {msg && <p className={`text-sm ${msg.error ? 'text-red-400' : 'text-emerald-400'}`} role={msg.error ? 'alert' : 'status'}>{msg.error ?? msg.ok}</p>}
    </Card>
  );
}

export default function Hearth({ groupId, powerUps }) {
  const { user } = useAuth();
  const { data, error, reload } = powerUps;
  if (error && !data) return <p className="text-sm text-[var(--text-muted)] text-center py-8">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--text-muted)] text-center py-8">Loading…</p>;
  return (
    <div className="flex flex-col gap-4">
      {!data.enabled && (
        <p className="text-sm text-center text-[var(--text-muted)] px-4 py-3 rounded-xl border border-[var(--border)]">
          The owner has turned power-ups off in this group. Levels and the board still count.
        </p>
      )}
      <LevelCard level={data.level} />
      {data.boost && <BoostCard groupId={groupId} boost={data.boost} onChanged={reload} />}
      <Supporters board={data.board} me={user?.userId} />
      <RainCard groupId={groupId} data={data} onChanged={reload} />
      <SpotlightCard groupId={groupId} data={data} onChanged={reload} />
    </div>
  );
}
