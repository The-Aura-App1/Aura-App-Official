import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Eye, Sparkles, Heart, MessageCircle, SmilePlus, FileText, Users, Wallet, Trophy, LineChart, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { timeAgo } from '../utils/format';
import { PERIODS, SORTS, postStats, inPeriod, totals, sortStats, topPost, canUseCreator } from '../utils/creatorStats';
import AuraTimelineGraph from '../components/profile/AuraTimelineGraph';
import { CommentSkeleton } from '../components/motion/Skeleton';

// The Creator dashboard (phase 1): how a creator's posts are doing, from the
// counts Aura already keeps. Daily charts, top supporters, follower growth,
// share counts and cashing out come later.

const whole = v => Math.round(v).toLocaleString();
const rateText = r => (r === null ? '–' : r.toFixed(r < 10 ? 1 : 0));
const snippet = (p, max = 90) => {
  const text = p.caption.trim().replace(/\s+/g, ' ');
  if (text) return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  return { photo: 'A photo post', video: 'A video post', text: 'A text post' }[p.type] ?? 'A post';
};

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Icon size={13} aria-hidden="true" /> {label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
      {hint && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{hint}</p>}
    </div>
  );
}

function Chips({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`px-3 h-9 rounded-full text-sm border transition-colors ${value === o.id
            ? 'aura-fill text-white border-transparent' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-aura-500/50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PostRow({ p }) {
  const cells = [
    ['Views', whole(p.views)], ['Aura', whole(p.aura)], ['Likes', whole(p.likes)],
    ['Comments', whole(p.comments)], ['Reactions', whole(p.reactions)], ['Aura / 100 views', rateText(p.rate)],
  ];
  return (
    <li>
      <Link to={`/post/${encodeURIComponent(p.postId)}`} className="block py-3 hover:bg-[var(--accent-subtle)] rounded-xl px-2 -mx-2">
        <p className="text-sm text-[var(--text-primary)] break-words">{snippet(p)}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{timeAgo(p.createdAt)}{p.inGroup ? ' · in a group' : ''}</p>
        <dl className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-1">
          {cells.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] text-[var(--text-muted)] truncate">{k}</dt>
              <dd className="text-sm font-semibold tabular-nums text-[var(--text-secondary)]">{v}</dd>
            </div>
          ))}
        </dl>
      </Link>
    </li>
  );
}

export default function Creator() {
  const { dbProfile } = useAuth();
  const allowed = canUseCreator(dbProfile);
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30d');
  const [sort, setSort] = useState('views');
  const [shown, setShown] = useState(20);

  useEffect(() => {
    if (!allowed || !dbProfile?.userId) return;
    let live = true;
    api.getMyPostStats(dbProfile.userId)
      .then(r => { if (live) setPosts((r.posts ?? []).map(postStats)); })
      .catch(err => { if (live) setError(err.message || 'Your stats didn\'t load. Try again.'); });
    return () => { live = false; };
  }, [allowed, dbProfile?.userId]);

  const view = useMemo(() => {
    if (!posts) return null;
    const these = inPeriod(posts, period);
    return { these, sum: totals(these), top: topPost(these), sorted: sortStats(these, sort) };
  }, [posts, period, sort]);

  if (!dbProfile) return null;

  const heading = (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
        <BarChart3 size={22} className="text-aura-400" /> Creator
      </h1>
      <p className="text-sm text-[var(--text-muted)] mt-1">How your posts are doing, from the counts Aura keeps for you.</p>
    </div>
  );

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-4 pb-10">
        {heading}
        <div className="card flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Lock size={16} className="text-aura-400" /> For creator accounts</p>
          <p className="text-sm text-[var(--text-secondary)]">
            The Creator page shows how each of your posts does: views, aura received, likes, comments and reactions, your best post, and your aura over time.
            Creator accounts are $20 a year and also get cashing out (coming later). Buying one isn't open yet.
          </p>
          <Link to="/premium" className="btn-secondary self-start text-[var(--text-secondary)]">About creator accounts</Link>
        </div>
      </div>
    );
  }

  const periodWord = period === 'all' ? 'all your posts' : `posts from the last ${PERIODS.find(p => p.id === period).label}`;
  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-4 pb-10">
      {heading}
      <Chips label="Period" options={PERIODS} value={period} onChange={p => { setPeriod(p); setShown(20); }} />

      {error && <p className="text-sm rounded-xl px-3 py-2 border text-red-400 bg-red-400/10 border-red-400/20">{error}</p>}
      {!view && !error && <div className="card"><CommentSkeleton count={3} /></div>}

      {view && (
        <>
          <section className="card flex flex-col gap-3" aria-label="Overview">
            <p className="text-xs text-[var(--text-muted)]">Totals on {periodWord}.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat icon={Eye} label="Views" value={whole(view.sum.views)} hint="By other people" />
              <Stat icon={Sparkles} label="Aura received" value={whole(view.sum.aura)} />
              <Stat icon={Heart} label="Likes" value={whole(view.sum.likes)} />
              <Stat icon={MessageCircle} label="Comments" value={whole(view.sum.comments)} />
              <Stat icon={SmilePlus} label="Reactions" value={whole(view.sum.reactions)} />
              <Stat icon={FileText} label="Posts" value={whole(view.sum.posts)} />
              <Stat icon={LineChart} label="Aura / 100 views" value={rateText(view.sum.rate)} hint={view.sum.rate === null ? 'Needs 10+ views' : undefined} />
              <Stat icon={Users} label="Followers" value={whole(dbProfile.followerCount ?? 0)} hint="Right now" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Wallet size={13} aria-hidden="true" /> Earned aura (cashable once cashing out opens): <span className="font-semibold text-[var(--text-secondary)] tabular-nums">{whole(dbProfile.auraEarned ?? 0)}</span>
            </p>
          </section>

          {view.top && (view.top.aura > 0 || view.top.views > 0) && (
            <section className="card" aria-label="Your top post">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Trophy size={16} className="text-amber-400" /> Your top post</p>
              <ul><PostRow p={view.top} /></ul>
            </section>
          )}

          <section className="card flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><LineChart size={16} className="text-aura-400" /> Your aura over time</h2>
            <AuraTimelineGraph userId={dbProfile.userId} balance={dbProfile.auraBalance ?? 0} initialRange="all" />
          </section>

          <section className="card flex flex-col gap-3" aria-label="Your posts">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Your posts ({view.these.length})</h2>
              <Chips label="Sort posts by" options={SORTS} value={sort} onChange={setSort} />
            </div>
            {view.these.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No posts in this period yet.</p>
            ) : (
              <>
                <ul className="divide-y divide-[var(--border)]">
                  {view.sorted.slice(0, shown).map(p => <PostRow key={p.postId} p={p} />)}
                </ul>
                {view.sorted.length > shown && (
                  <button type="button" onClick={() => setShown(s => s + 20)} className="btn-ghost self-center">Show more</button>
                )}
              </>
            )}
          </section>

          <p className="text-xs text-[var(--text-muted)]">
            Views count other people opening a post; yours don't count. Daily charts for each post, your top supporters, follower growth and share counts are coming next.
          </p>
        </>
      )}
    </div>
  );
}
