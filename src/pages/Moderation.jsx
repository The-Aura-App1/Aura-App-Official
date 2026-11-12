import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, UserX, Trash2, MessageSquareX, MessageSquareHeart } from 'lucide-react';
import Stars from '../components/common/Stars';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

// Site moderation, shown only to moderator accounts. The Lambdas check the
// moderator list on every request, so hiding this page is a convenience, not
// the protection.

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="card mb-4">
      <h2 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
        <Icon size={18} className="text-aura-400" /> {title}
      </h2>
      {hint && <p className="text-xs text-[var(--text-muted)] mt-1">{hint}</p>}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Result({ result }) {
  if (!result) return null;
  return (
    <p className={`text-sm rounded-xl px-3 py-2 border ${result.error
      ? 'text-red-400 bg-red-400/10 border-red-400/20'
      : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'}`}>
      {result.error ?? result.message}
    </p>
  );
}

// Accepts a full post link (…/post/<id>) or a bare ID
function idFrom(input, segment) {
  const trimmed = input.trim();
  const match = trimmed.match(new RegExp(`/${segment}/([^/?#]+)`));
  return match ? decodeURIComponent(match[1]) : trimmed;
}

// Reviews waiting for approval, and suggestion statuses. Approved reviews show
// on the welcome page, so nothing goes public without a moderator's OK.
function FeedbackQueue() {
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getFeedbackQueue().then(setQueue).catch(err => setError(err.message));
  }, []);

  async function act(kind, itemId, action) {
    setError('');
    try {
      await api.moderateFeedback(kind, itemId, action);
      setQueue(q => (kind === 'review'
        ? { ...q, reviews: q.reviews.filter(r => r.reviewId !== itemId) }
        : { ...q, suggestions: action === 'remove'
            ? q.suggestions.filter(s => s.suggestionId !== itemId)
            : q.suggestions.map(s => (s.suggestionId === itemId ? { ...s, status: action } : s)) }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Section icon={MessageSquareHeart} title="Suggestions & reviews"
      hint="Approve reviews before they appear on the welcome page. Editing a review sends it back here.">
      {error && <Result result={{ error }} />}
      {!queue && !error && <p className="text-sm text-[var(--text-muted)]">Loading...</p>}
      {queue && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Reviews waiting ({queue.reviews.length})
          </h3>
          {queue.reviews.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nothing waiting.</p>}
          {queue.reviews.map(r => (
            <div key={r.reviewId} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-[var(--text-primary)]">@{r.authorUsername}</span>
                <Stars value={r.rating} size={13} />
              </div>
              {r.text && <p className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words">{r.text}</p>}
              <div className="mt-2 flex gap-2">
                <button onClick={() => act('review', r.reviewId, 'approve')} className="btn-primary px-4 py-1.5 text-xs">Approve</button>
                <button onClick={() => act('review', r.reviewId, 'reject')} className="btn-secondary px-4 py-1.5 text-xs text-[var(--text-primary)]">Reject</button>
              </div>
            </div>
          ))}

          <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Suggestions ({queue.suggestions.length})
          </h3>
          {queue.suggestions.map(sg => (
            <div key={sg.suggestionId} className="rounded-xl border border-[var(--border)] p-3">
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">{sg.text}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">@{sg.authorUsername} · {sg.votes} votes</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={sg.status} onChange={e => act('suggestion', sg.suggestionId, e.target.value)}
                  className="input !w-auto !py-1.5 text-xs" aria-label="Status">
                  <option value="open">Open</option>
                  <option value="planned">Planned</option>
                  <option value="done">Shipped</option>
                </select>
                <button onClick={() => window.confirm('Remove this suggestion?') && act('suggestion', sg.suggestionId, 'remove')}
                  className="btn-ghost text-xs text-red-400">Remove</button>
              </div>
            </div>
          ))}
        </>
      )}
    </Section>
  );
}

export default function Moderation() {
  const { dbProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [reason, setReason]     = useState('');
  const [postInput, setPostInput]       = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [busy, setBusy]       = useState('');
  const [results, setResults] = useState({});

  if (dbProfile && !dbProfile.isAdmin) return <Navigate to="/" replace />;

  async function run(key, request) {
    setBusy(key);
    setResults(r => ({ ...r, [key]: null }));
    try {
      const res = await request();
      setResults(r => ({ ...r, [key]: { message: res.message ?? 'Done.' } }));
      return true;
    } catch (err) {
      setResults(r => ({ ...r, [key]: { error: err.message } }));
      return false;
    } finally {
      setBusy('');
    }
  }

  function ban(banned) {
    const name = username.trim().replace(/^@/, '');
    if (!name) return;
    if (banned && !window.confirm(`Ban @${name}? Their profile, posts and comments will be hidden.`)) return;
    run('ban', () => api.setBanned(name, banned, reason.trim() || undefined));
  }

  async function removePost() {
    const id = idFrom(postInput, 'post');
    if (!id) return;
    if (await run('post', () => api.deletePost(id))) setPostInput('');
  }

  async function removeComment() {
    const id = idFrom(commentInput, 'comments');
    if (!id) return;
    if (await run('comment', () => api.deleteComment(id))) setCommentInput('');
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)] mb-1">
        <ShieldAlert size={24} className="text-aura-400" /> Moderation
      </h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Only moderator accounts can see this page or use these actions. You can also remove any
        post from its ⋯ menu.
      </p>

      <Section icon={UserX} title="Ban or unban an account"
        hint="Banning hides their profile, posts and comments and stops them posting, commenting and giving aura. Unbanning restores what the ban hid.">
        <input value={username} onChange={e => setUsername(e.target.value)}
          placeholder="@username" className="input" autoCapitalize="none" autoCorrect="off" />
        <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300}
          placeholder="Reason (optional, for your records)" className="input" />
        <div className="flex gap-2">
          <button onClick={() => ban(true)} disabled={!username.trim() || !!busy}
            className="btn-primary !bg-none !bg-red-600 hover:!bg-red-700">
            {busy === 'ban' ? 'Working...' : 'Ban'}
          </button>
          <button onClick={() => ban(false)} disabled={!username.trim() || !!busy}
            className="btn-secondary text-[var(--text-primary)]">
            Unban
          </button>
        </div>
        <Result result={results.ban} />
      </Section>

      <Section icon={Trash2} title="Remove a post"
        hint="Paste the post's link (Share → copy, or the address bar on the post page) or its ID.">
        <input value={postInput} onChange={e => setPostInput(e.target.value)}
          placeholder="https://…/post/1793… or post ID" className="input" />
        <div>
          <button onClick={removePost} disabled={!postInput.trim() || !!busy} className="btn-primary">
            {busy === 'post' ? 'Removing...' : 'Remove post'}
          </button>
        </div>
        <Result result={results.post} />
      </Section>

      <Section icon={MessageSquareX} title="Remove a comment"
        hint="Paste the comment's ID. Comments get their own Remove button once comments are in the app.">
        <input value={commentInput} onChange={e => setCommentInput(e.target.value)}
          placeholder="Comment ID" className="input" />
        <div>
          <button onClick={removeComment} disabled={!commentInput.trim() || !!busy} className="btn-primary">
            {busy === 'comment' ? 'Removing...' : 'Remove comment'}
          </button>
        </div>
        <Result result={results.comment} />
      </Section>

      <FeedbackQueue />
    </div>
  );
}
