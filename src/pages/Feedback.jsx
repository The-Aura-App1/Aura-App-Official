import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lightbulb, Star, ChevronUp, MessageSquareHeart } from 'lucide-react';
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

function Notice({ error, children }) {
  return (
    <p className={`text-sm rounded-xl px-3 py-2 border ${error
      ? 'text-red-400 bg-red-400/10 border-red-400/20'
      : 'text-aura-400 bg-aura-500/10 border-aura-500/20'}`}>
      {children}
    </p>
  );
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

function Suggestions() {
  const [items, setItems]   = useState(null);
  const [error, setError]   = useState('');
  const [text, setText]     = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    api.getSuggestions()
      .then(data => setItems(data.suggestions ?? []))
      .catch(err => setError(err.message || 'Suggestions didn’t load.'));
  }, []);

  async function send(e) {
    e.preventDefault();
    const clean = text.trim();
    if (clean.length < SUGGESTION_MIN || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const created = await api.createSuggestion(clean);
      setItems(list => [created, ...(list ?? [])]);
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
    const flip = list => list.map(s => (s.suggestionId === item.suggestionId
      ? { ...s, votedByMe: on, votes: s.votes + (on ? 1 : -1) } : s));
    setItems(flip);
    try {
      await api.voteSuggestion(item.suggestionId, on);
    } catch (err) {
      setItems(list => list.map(s => (s.suggestionId === item.suggestionId ? item : s)));
      setNotice({ error: true, message: err.message });
    }
  }, []);

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
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Top suggestions</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Vote for the ones you want most. You get 3 suggestions a day.</p>
        {error && <div className="mt-3"><Notice error>{error}</Notice></div>}
        {!items && !error && <div className="mt-4"><CommentSkeleton count={4} /></div>}
        {items?.length === 0 && <p className="mt-4 text-sm text-[var(--text-muted)]">No suggestions yet. Be the first.</p>}
        {items?.length > 0 && (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {items.map((item, i) => <Suggestion key={item.suggestionId} item={item} index={i} onVote={vote} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ReviewList({ data }) {
  if (!data) return <CommentSkeleton count={3} />;
  if (!data.reviews.length) return <p className="text-sm text-[var(--text-muted)]">No reviews yet.</p>;
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

function Reviews() {
  const [mine, setMine]       = useState(undefined);   // undefined while loading, null when none
  const [rating, setRating]   = useState(0);
  const [text, setText]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [notice, setNotice]   = useState(null);
  const [publicData, setPublicData] = useState(null);

  useEffect(() => {
    api.getMyReview()
      .then(({ review }) => {
        setMine(review);
        if (review) { setRating(review.rating); setText(review.text); }
      })
      .catch(() => setMine(null));
    api.getPublicReviews().then(setPublicData).catch(() => setPublicData({ reviews: [], count: 0, average: 0 }));
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

      <section className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">What people are saying</h2>
          {publicData?.count > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Stars value={publicData.average} size={12} /> {publicData.average} · {publicData.count}
            </span>
          )}
        </div>
        <ReviewList data={publicData} />
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
