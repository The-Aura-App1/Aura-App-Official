import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Lock, UserPlus, UserCheck, Clock } from 'lucide-react';
import { api } from '../../api';
import Avatar from '../common/Avatar';
import LoadingSpinner from '../common/LoadingSpinner';

// Follow / Requested / Following, for someone else's profile.
// `rel` comes from api.getFollowStatus; onChange gets the server's new answer.
export function FollowButton({ username, rel, onChange }) {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(false);

  if (!rel || rel.status === 'self') return null;

  async function toggle() {
    const leaving = rel.status === 'active' || rel.status === 'pending';
    if (rel.status === 'active' && rel.isPrivate
        && !window.confirm(`Unfollow @${username}? You'll need to ask again to see their posts.`)) return;
    setBusy(true);
    setError('');
    try {
      onChange(await (leaving ? api.unfollow(username) : api.follow(username)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  let label = rel.followsYou ? 'Follow back' : 'Follow';
  let Icon  = UserPlus;
  let style = 'btn-primary';
  if (rel.status === 'active')  { label = hover ? 'Unfollow' : 'Following'; Icon = UserCheck; style = 'btn-secondary'; }
  if (rel.status === 'pending') { label = hover ? 'Cancel request' : 'Requested'; Icon = Clock; style = 'btn-secondary'; }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={toggle} disabled={busy}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        className={`${style} flex items-center gap-2 text-sm px-5 py-2 min-w-[8.5rem] justify-center`}>
        <Icon size={15} /> {busy ? '…' : label}
      </button>
      {error && <p className="text-xs text-red-400 max-w-[14rem] text-right">{error}</p>}
    </div>
  );
}

// A clickable "123 Followers" style count
export function FollowCount({ value, label, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className="text-center enabled:hover:opacity-80 transition-opacity">
      <p className="font-bold text-[var(--text-primary)]">{(value ?? 0).toLocaleString('en-US')}</p>
      <p className="text-[var(--text-muted)] text-xs">{label}</p>
    </button>
  );
}

function PersonLine({ person, onOpen, action }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link to={`/profile/${encodeURIComponent(person.username)}`} onClick={onOpen}
        className="flex items-center gap-3 min-w-0 flex-1 group">
        <Avatar name={person.displayName || person.username} picKey={person.profilePicKey} size="w-10 h-10" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-aura-400 flex items-center gap-1">
            {person.displayName || person.username}
            {person.isPrivate && <Lock size={11} className="text-[var(--text-muted)]" aria-label="Private account" />}
          </p>
          <p className="text-xs text-[var(--text-muted)] truncate">@{person.username}</p>
        </div>
      </Link>
      {action}
    </div>
  );
}

// Followers or following, in a sheet. Owners can remove their followers.
export function FollowListSheet({ username, which, isOwner, onClose, onRemoved }) {
  const [users, setUsers]   = useState(null);
  const [next, setNext]     = useState(null);
  const [error, setError]   = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let live = true;
    api.getFollowList(username, which)
      .then(data => { if (live) { setUsers(data.users ?? []); setNext(data.next ?? null); } })
      .catch(err => live && setError(err.message));
    return () => { live = false; };
  }, [username, which]);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function more() {
    setLoadingMore(true);
    try {
      const data = await api.getFollowList(username, which, next);
      setUsers(prev => [...prev, ...(data.users ?? [])]);
      setNext(data.next ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(person) {
    if (!window.confirm(`Remove @${person.username} from your followers? They won't be told.`)) return;
    try {
      await api.removeFollower(person.userId);
      setUsers(prev => prev.filter(u => u.userId !== person.userId));
      onRemoved?.();
    } catch (err) {
      setError(err.message);
    }
  }

  const title = which === 'followers' ? 'Followers' : 'Following';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[80vh] flex flex-col bg-[var(--bg-secondary)]
                      rounded-t-3xl sm:rounded-2xl border border-[var(--border)] animate-slide-up z-10">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-2 divide-y divide-[var(--border)]">
          {error && <p className="text-sm text-red-400 py-3">{error}</p>}
          {!users && !error && <div className="py-8 flex justify-center"><LoadingSpinner /></div>}
          {users?.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">
              {which === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          )}
          {users?.map(person => (
            <PersonLine key={person.userId} person={person} onOpen={onClose}
              action={isOwner && which === 'followers' && (
                <button type="button" onClick={() => remove(person)} className="btn-secondary text-xs px-3 py-1.5">
                  Remove
                </button>
              )} />
          ))}
          {next && (
            <div className="py-3 flex justify-center">
              <button type="button" onClick={more} disabled={loadingMore} className="btn-secondary text-sm px-4 py-1.5">
                {loadingMore ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Waiting follow requests, with approve and decline (for private accounts)
export function FollowRequests({ onAnswered }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(null);

  useEffect(() => {
    let live = true;
    api.getFollowRequests()
      .then(data => live && setUsers(data.users ?? []))
      .catch(() => live && setUsers([]));   // no route yet, or offline: just show nothing
    return () => { live = false; };
  }, []);

  async function answer(person, approve) {
    setBusy(person.userId);
    setError('');
    try {
      await api.answerFollowRequest(person.userId, approve);
      setUsers(prev => prev.filter(u => u.userId !== person.userId));
      onAnswered?.(approve);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (!users?.length) return null;
  return (
    <section className="card flex flex-col gap-1" aria-label="Follow requests">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
        <UserPlus size={14} /> Follow requests ({users.length})
      </h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="divide-y divide-[var(--border)]">
        {users.map(person => (
          <PersonLine key={person.userId} person={person}
            action={(
              <div className="flex gap-2">
                <button type="button" disabled={busy === person.userId} onClick={() => answer(person, true)}
                  className="btn-primary text-xs px-3 py-1.5">Approve</button>
                <button type="button" disabled={busy === person.userId} onClick={() => answer(person, false)}
                  className="btn-secondary text-xs px-3 py-1.5">Decline</button>
              </div>
            )} />
        ))}
      </div>
    </section>
  );
}
