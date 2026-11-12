import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lightbulb, Star, ChevronUp, MessageSquareHeart, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import Stars from '../components/common/Stars';
import { CommentSkeleton } from '../components/motion/Skeleton';
import { timeAgo } from '../utils/format';

// Same limits as aura-users (feedback.mjs), which checks them again.
const SUGGESTION_MIN = 10;
const SUGGESTION_MAX = 500;
const REVIEW_MAX     = 600;

const STATUS_LABEL = { planned: 'Planned', done: 'Shipped' };
const REVIEW_STATUS = {
  pending:  'Waiting for approval. It shows on the welcome page once a moderator approves it.',
  approved: 'Live on the welcome page.',
  rejected: "This review wasn't approved. You can edit it and send it again.",
};

const TABS = [
  { id: 'suggestions', label: 'Suggestions', icon: Lightbulb },
  { id: 'reviews',     label: 'Reviews',     icon: Star },
];

const SUGGESTION_SORTS = [{ id: 'top', label: 'Top' }, { id: 'new', label: 'New' }];
const SUGGESTION_FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'open',    label: 'Open' },
  { id: 'planned', label: 'Planned' },
  { id: 'done',    label: 'Shipped' },
];
const EMPTY_SUGGESTIONS = {
  all:     'No suggestions yet. Be the first.',
  open:    'No open suggestions right now.',
  planned: 'Nothing planned yet. Vote for what you want next.',
  done:    'Nothing shipped from here yet.',
};
const REVIEW_SORTS = [
  { id: 'newest',  label: 'Newest' },
  { id: 'highest', label: 'Highest' },
  { id: 'lowest',  label: 'Lowest' },
];

function Notice({ error, children }) {
  return (
    <p className={`text-sm rounded-xl px-3 py-2 border ${error
      ? 'text-red-400 bg-red-400/10 border-red-400/20'
      : 'text-aura-400 bg-aura-500/10 border-aura-500/20'}`}>
      {children}
    </p>
  );
}

// A row of pill buttons where one is chosen (sort order, status filter)
function Chips({ options, value, onChange, label, counts }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(({ id, label: text }) => {
        const on = value === id;
        return (
          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => onChange(id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200
              ${on
                ? 'aura-fill text-white border-transparent'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-aura-500/50 hover:text-[var(--accent)]'}`}>
            {text}
            {counts && counts[id] !== undefined && (
              <span className={`ml-1.5 tabular-nums ${on ? 'text-white/80' : 'opacity-70'}`}>{counts[id]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Loads `load(params)` whenever params change. The last result stays on screen
// (dimmed) while the next loads, and a slow, older answer never replaces a newer one.
function useFiltered(load, params) {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    const ticket = ++latest.current;
    setLoading(true);
    setError('');
    load(JSON.parse(key))
      .then(result => { if (ticket === latest.current) setData(result); })
      .catch(err => { if (ticket === latest.current) setError(err.message || 'This didn’t load. Try again.'); })
      .finally(() => { if (ticket === latest.current) setLoading(false); });
  }, [load, key]);

  return { data, setData, error, loading };
}

function Suggestion({ item, index, onVote }) {
  return (
    <li className="aura-arrive flex gap-3 py-3" style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <button onClick={() => onVote(item)} aria-pressed={item.votedByMe}
        aria-label={item.votedByMe ? 'Remove your vote' : 'Vote for this'}
        className={`flex flex-col items-center justify-center w-12 h-14 flex-shrink-0 rounded-xl border text-xs font-bold tabular-nums transition-all duration-200
          ${item.votedByMe
            ? 'aura-fill text-white border-transparent'
            : 'border-[var(--border)] text-[var(--text-muted)] hover:border-aura-500/50 hover:text-[var(--accent)]'}`}>
        <ChevronUp size={18} strokeWidth={2.4} className={item.votedByMe ? 'aura-like-pop' : ''} />
        {item.votes}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">{item.text}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Avatar name={item.authorDisplay} picKey={item.authorPicKey} size="w-5 h-5" />
          <span className="truncate">@{item.authorUsername || 'member'}</span>
          <span aria-hidden="true">·</span>
          <span>{timeAgo(item.createdAt)}</span>
          {STATUS_LABEL[item.status] && <span className="aura-badge !py-0.5 !px-2">{STATUS_LABEL[item.status]}</span>}
        </div>
      </div>
    </li>
  );
}

const loadSuggestions = params => api.getSuggestions(params);

function Suggestions() {
  const [sort, setSort]       = useState('top');
  const [status, setStatus]   = useState('all');
  const { data, setData, error, loading } = useFiltered(loadSuggestions, { sort, status: status === 'all' ? '' : status });
  const [text, setText]       = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice]   = useState(null);
  const items = data?.suggestions;

  async function send(e) {
    e.preventDefault();
    const clean = text.trim();
    if (clean.length < SUGGESTION_MIN || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const created = await api.createSuggestion(clean);
      setData(d => d && {
        ...d,
        // New suggestions are open, so they belong in "All" and "Open"
        suggestions: status === 'all' || status === 'open' ? [created, ...d.suggestions] : d.suggestions,
        counts: d.counts && { ...d.counts, all: d.counts.all + 1, open: d.counts.open + 1 },
      });
      setText('');
      setNotice({ message: 'Thanks! Others can vote on it now.' });
    } catch (err) {
      setNotice({ error: true, message: err.message });
    } finally {
      setSending(false);
    }
  }

  // Updates straight away and rolls back if the request fails
  const vote = useCallback(async item => {
    const on = !item.votedByMe;
    const swap = next => d => d && { ...d, suggestions: d.suggestions.map(s => (s.suggestionId === item.suggestionId ? next(s) : s)) };
    setData(swap(s => ({ ...s, votedByMe: on, votes: s.votes + (on ? 1 : -1) })));
    try {
      await api.voteSuggestion(item.suggestionId, on);
    } catch (err) {
      setData(swap(() => item));
      setNotice({ error: true, message: err.message });
    }
  }, [setData]);

  const left = SUGGESTION_MAX - text.length;
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={send} className="card flex flex-col gap-3">
        <label htmlFor="suggestion" className="text-sm font-semibold text-[var(--text-primary)]">
          What would make Aura better?
        </label>
        <textarea id="suggestion" value={text} onChange={e => setText(e.target.value.slice(0, SUGGESTION_MAX))}
          rows={3} placeholder="A feature, a fix, a new theme idea..." className="input resize-none" />
        <div className="flex items-center justify-between gap-3">
          <span className={`text-xs ${left < 50 ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
            {text.trim().length < SUGGESTION_MIN ? `At least ${SUGGESTION_MIN} characters` : `${left} left`}
          </span>
          <button type="submit" disabled={text.trim().length < SUGGESTION_MIN || sending} className="btn-primary px-5 py-2 text-sm">
            {sending ? 'Sending...' : 'Suggest'}
          </button>
        </div>
        {notice && <Notice error={notice.error}>{notice.message}</Notice>}
      </form>

      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Suggestions</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Vote for the ones you want most. You get 3 suggestions a day.</p>
          </div>
          <Chips label="Sort suggestions" options={SUGGESTION_SORTS} value={sort} onChange={setSort} />
        </div>
        <div className="mt-3">
          <Chips label="Show" options={SUGGESTION_FILTERS} value={status} onChange={setStatus} counts={data?.counts} />
        </div>

        {error && <div className="mt-3"><Notice error>{error}</Notice></div>}
        {!items && !error && <div className="mt-4"><CommentSkeleton count={4} /></div>}
        {items?.length === 0 && !loading && <p className="mt-4 text-sm text-[var(--text-muted)]">{EMPTY_SUGGESTIONS[status]}</p>}
        {items?.length > 0 && (
          <ul key={`${sort}-${status}`} aria-busy={loading}
            className={`mt-2 divide-y divide-[var(--border)] transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
            {items.map((item, i) => <Suggestion key={item.suggestionId} item={item} index={i} onVote={vote} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ReviewList({ data, empty = 'No reviews yet.' }) {
  if (!data) return <CommentSkeleton count={3} />;
  if (!data.reviews.length) return <p className="text-sm text-[var(--text-muted)]">{empty}</p>;
  return (
    <ul className="flex flex-col gap-4">
      {data.reviews.map((review, i) => (
        <li key={`${review.authorUsername}-${review.createdAt}`} className="aura-arrive flex gap-3"
          style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
          <Avatar name={review.authorDisplay} picKey={review.authorPicKey} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{review.authorDisplay}</span>
              <Stars value={review.rating} size={13} />
              {review.createdAt && <span className="text-xs text-[var(--text-muted)]">{timeAgo(review.createdAt)}</span>}
            </div>
            {review.text && (
              <p className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words">{review.text}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Average on the left, a bar for each star on the right. Tapping a bar shows
// only reviews with that many stars; tapping it again shows them all.
function RatingSummary({ data, stars, onStars }) {
  const breakdown = data?.breakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const most = Math.max(1, ...Object.values(breakdown));
  return (
    <div className="flex items-center gap-5">
      <div className="flex flex-col items-center flex-shrink-0 w-20">
        <span className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">{data?.count ? data.average.toFixed(1) : '–'}</span>
        <Stars value={data?.average ?? 0} size={12} />
        <span className="mt-1 text-xs text-[var(--text-muted)]">{data?.count ?? 0} review{data?.count === 1 ? '' : 's'}</span>
      </div>
      <div className="flex-1 flex flex-col gap-1" role="group" aria-label="Filter by stars">
        {[5, 4, 3, 2, 1].map(n => {
          const count = breakdown[n] ?? 0;
          const on = stars === n;
          return (
            <button key={n} type="button" onClick={() => onStars(on ? null : n)} aria-pressed={on}
              disabled={!count && !on}
              aria-label={`${n} star reviews: ${count}${on ? ', showing only these' : ''}`}
              className={`group flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors duration-200
                ${on ? 'bg-[var(--accent-subtle)]' : 'enabled:hover:bg-[var(--accent-subtle)]'}
                disabled:opacity-40 disabled:cursor-default`}>
              <span className={`w-6 flex items-center gap-0.5 font-semibold tabular-nums ${on ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                {n}<Star size={10} className="text-amber-400" fill="currentColor" />
              </span>
              <span className="flex-1 h-2 rounded-full bg-[var(--border)] overflow-hidden">
                <span className="block h-full rounded-full bg-amber-400 transition-[width] duration-500 ease-out"
                  style={{ width: `${(count / most) * 100}%` }} />
              </span>
              <span className={`w-6 text-right tabular-nums ${on ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)]'}`}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const loadReviews = params => api.getPublicReviews(params);

function Reviews() {
  const [mine, setMine]       = useState(undefined);   // undefined while loading, null when none
  const [rating, setRating]   = useState(0);
  const [text, setText]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [notice, setNotice]   = useState(null);
  const [stars, setStars]     = useState(null);
  const [sort, setSort]       = useState('newest');
  const { data, error, loading } = useFiltered(loadReviews, { stars, sort });

  useEffect(() => {
    api.getMyReview()
      .then(({ review }) => {
        setMine(review);
        if (review) { setRating(review.rating); setText(review.text); }
      })
      .catch(() => setMine(null));
  }, []);

  async function save(e) {
    e.preventDefault();
    if (!rating || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const { review } = await api.saveMyReview(rating, text.trim());
      setMine(review);
      setNotice({ message: 'Saved. Thank you!' });
    } catch (err) {
      setNotice({ error: true, message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete your review?')) return;
    try {
      await api.deleteMyReview();
      setMine(null); setRating(0); setText('');
      setNotice({ message: 'Your review was deleted.' });
    } catch (err) {
      setNotice({ error: true, message: err.message });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={save} className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{mine ? 'Your review' : 'How are you finding Aura?'}</h2>
          <Stars value={rating} onChange={setRating} size={22} />
        </div>
        <textarea value={text} onChange={e => setText(e.target.value.slice(0, REVIEW_MAX))} rows={3}
          placeholder="Tell others what you think (optional)" className="input resize-none" aria-label="Your review" />
        {mine?.status && <p className="text-xs text-[var(--text-muted)]">{REVIEW_STATUS[mine.status]}</p>}
        <div className="flex items-center justify-end gap-2">
          {mine && <button type="button" onClick={remove} className="btn-ghost text-sm text-red-400">Delete</button>}
          <button type="submit" disabled={!rating || saving} className="btn-primary px-5 py-2 text-sm">
            {saving ? 'Saving...' : mine ? 'Update review' : 'Post review'}
          </button>
        </div>
        {notice && <Notice error={notice.error}>{notice.message}</Notice>}
      </form>

      <section className="card flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">What people are saying</h2>
        <RatingSummary data={data} stars={stars} onStars={setStars} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          {stars ? (
            <button type="button" onClick={() => setStars(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold aura-fill text-white">
              {stars}-star reviews <X size={12} aria-label="Show all reviews" />
            </button>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">All reviews</span>
          )}
          <Chips label="Sort reviews" options={REVIEW_SORTS} value={sort} onChange={setSort} />
        </div>

        {error && <Notice error>{error}</Notice>}
        {!error && (
          <div key={`${stars}-${sort}`} aria-busy={loading}
            className={`transition-opacity duration-200 ${loading && data ? 'opacity-50' : ''}`}>
            <ReviewList data={data}
              empty={stars ? `No ${stars}-star reviews yet.` : 'No reviews yet. Yours could be the first.'} />
          </div>
        )}
      </section>
    </div>
  );
}

// Suggestions & Reviews: one page, two tabs (?tab=reviews).
export default function Feedback() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'reviews' ? 'reviews' : 'suggestions';
  const { dbProfile } = useAuth();

  return (
    <div className="mx-auto w-full max-w-2xl flex flex-col gap-5 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
          <MessageSquareHeart size={22} className="text-aura-400" /> Suggestions & Reviews
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {dbProfile?.displayName ? `${dbProfile.displayName}, help` : 'Help'} shape what Aura becomes.
        </p>
      </div>

      <div role="tablist" className="relative grid grid-cols-2 p-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)]">
        <span aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-xl aura-fill transition-transform duration-300 ease-out"
          style={{ transform: tab === 'reviews' ? 'translateX(100%)' : 'none' }} />
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id}
            onClick={() => setParams(id === 'reviews' ? { tab: 'reviews' } : {}, { replace: true })}
            className={`relative z-[1] flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors duration-300
              ${tab === id ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div key={tab} className="aura-arrive">
        {tab === 'suggestions' ? <Suggestions /> : <Reviews />}
      </div>
    </div>
  );
}
