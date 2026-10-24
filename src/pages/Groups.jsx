import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, X, BellOff } from 'lucide-react';
import { api } from '../api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { JOIN_TYPES, JoinTypeBadge, GroupAvatar, memberCountText } from '../components/groups/GroupBits';

function Message({ error, success }) {
  if (!error && !success) return null;
  return (
    <div className={`px-4 py-2.5 rounded-xl text-sm border ${error
      ? 'bg-red-400/10 border-red-400/20 text-red-400'
      : 'bg-aura-500/10 border-aura-500/20 text-aura-400'}`}>
      {error || success}
    </div>
  );
}

function GroupRow({ group, children }) {
  const count = memberCountText(group);
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Link to={`/groups/${group.groupId}`} className="flex items-center gap-3 flex-1 min-w-0 group">
        <GroupAvatar name={group.name} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-aura-400 truncate flex items-center gap-1.5">
            {group.name}
            {group.muted && <BellOff size={13} className="text-[var(--text-muted)]" aria-label="Muted" />}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <JoinTypeBadge joinType={group.joinType} />
            {count && <span className="text-xs text-[var(--text-muted)]">{count}</span>}
          </div>
          {group.description && (
            <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">{group.description}</p>
          )}
        </div>
      </Link>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  );
}

function CreateGroupForm({ onCancel }) {
  const navigate = useNavigate();
  const [form, setForm]     = useState({ name: '', description: '', joinType: 'open', hideMemberList: false });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const group = await api.createGroup({ ...form, name: form.name.trim(), description: form.description.trim() });
      navigate(`/groups/${group.groupId}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">Create a group</h2>
        <button type="button" onClick={onCancel} aria-label="Close" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-subtle)]">
          <X size={16} />
        </button>
      </div>
      <div>
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Group name"
          maxLength={50}
          required
          className="input"
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          3-50 characters. Names are unique and can't use the words aura, admin, official or moderator.
        </p>
      </div>
      <div>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="What's this group about? (optional)"
          maxLength={500}
          rows={3}
          className="input resize-none"
        />
        <p className="text-xs text-[var(--text-muted)] text-right mt-1">{form.description.length} / 500</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-[var(--text-primary)] mb-1">Who can join?</legend>
        {Object.entries(JOIN_TYPES).map(([value, { label, hint, icon: Icon }]) => (
          <label key={value}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
              ${form.joinType === value ? 'border-aura-500 bg-aura-500/10' : 'border-[var(--border)] hover:border-aura-500/50'}`}>
            <input type="radio" name="joinType" value={value} checked={form.joinType === value}
              onChange={() => setForm(f => ({ ...f, joinType: value }))} className="mt-1 accent-[#7c3aed]" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5"><Icon size={14} /> {label}</p>
              <p className="text-xs text-[var(--text-muted)]">{hint}</p>
            </div>
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
        <input type="checkbox" checked={form.hideMemberList}
          onChange={e => setForm(f => ({ ...f, hideMemberList: e.target.checked }))} className="accent-[#7c3aed]" />
        Only owners and moderators can see the member list
      </label>
      <Message error={error} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary text-[var(--text-primary)]">Cancel</button>
        <button type="submit" disabled={saving || form.name.trim().length < 3} className="btn-primary">
          {saving ? 'Creating...' : 'Create group'}
        </button>
      </div>
    </form>
  );
}

export default function Groups() {
  const [mine, setMine]           = useState(null);
  const [discover, setDiscover]   = useState(null);
  const [query, setQuery]         = useState('');
  const [creating, setCreating]   = useState(false);
  const [busy, setBusy]           = useState(null);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const loadMine = useCallback(async () => {
    try {
      setMine((await api.getMyGroups()).groups ?? []);
    } catch (err) {
      setError(err.message);
      setMine([]);
    }
  }, []);

  // Search waits for typing to pause
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setDiscover((await api.listGroups(query.trim())).groups ?? []);
      } catch (err) {
        setError(err.message);
        setDiscover([]);
      }
    }, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => { loadMine(); }, [loadMine]);

  async function act(key, request) {
    setBusy(key);
    setError('');
    setSuccess('');
    try {
      const result = await request();
      setSuccess(result.message ?? '');
      await loadMine();
      setDiscover((await api.listGroups(query.trim())).groups ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const invites  = (mine ?? []).filter(g => g.myStatus === 'invited');
  const requests = (mine ?? []).filter(g => g.myStatus === 'pending');
  const joined   = (mine ?? []).filter(g => g.myStatus === 'active');

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-aura-400" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Groups</h1>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-primary px-4 py-2">
            <Plus size={16} /> Create group
          </button>
        )}
      </div>

      <Message error={error} success={success} />

      {creating && <CreateGroupForm onCancel={() => setCreating(false)} />}

      {mine === null ? <LoadingSpinner size={48} /> : (
        <>
          {(invites.length > 0 || requests.length > 0) && (
            <section className="card flex flex-col">
              <h2 className="font-semibold text-[var(--text-primary)] mb-3">Invites and requests</h2>
              <div className="divide-y divide-[var(--border)]">
                {invites.map(g => (
                  <GroupRow key={g.groupId} group={g}>
                    <button onClick={() => act(`join-${g.groupId}`, () => api.joinGroup(g.groupId))}
                      disabled={busy !== null} className="btn-primary px-3 py-1.5 text-xs">Accept</button>
                    <button onClick={() => act(`leave-${g.groupId}`, () => api.leaveGroup(g.groupId))}
                      disabled={busy !== null} className="btn-secondary px-3 py-1.5 text-xs text-[var(--text-primary)]">Decline</button>
                  </GroupRow>
                ))}
                {requests.map(g => (
                  <GroupRow key={g.groupId} group={g}>
                    <span className="text-xs text-[var(--text-muted)]">Requested</span>
                    <button onClick={() => act(`leave-${g.groupId}`, () => api.leaveGroup(g.groupId))}
                      disabled={busy !== null} className="btn-secondary px-3 py-1.5 text-xs text-[var(--text-primary)]">Cancel</button>
                  </GroupRow>
                ))}
              </div>
            </section>
          )}

          <section className="card flex flex-col">
            <h2 className="font-semibold text-[var(--text-primary)] mb-3">Your groups</h2>
            {joined.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">You haven't joined any groups yet.</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {joined.map(g => (
                  <GroupRow key={g.groupId} group={g}>
                    {g.myRole !== 'member' && (
                      <span className="aura-badge capitalize">{g.myRole}</span>
                    )}
                  </GroupRow>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold text-[var(--text-primary)]">Discover</h2>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search groups"
            aria-label="Search groups"
            className="input pl-9"
          />
        </div>
        {discover === null ? <LoadingSpinner size={48} /> : discover.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {query ? 'No groups match that search.' : 'No groups yet. Create the first one!'}
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {discover.map(g => (
              <GroupRow key={g.groupId} group={g}>
                {g.myStatus === 'active' ? (
                  <span className="text-xs text-[var(--text-muted)]">Joined</span>
                ) : g.myStatus === 'pending' ? (
                  <span className="text-xs text-[var(--text-muted)]">Requested</span>
                ) : g.myStatus === 'banned' ? null : (
                  <button onClick={() => act(`join-${g.groupId}`, () => api.joinGroup(g.groupId))}
                    disabled={busy !== null} className="btn-primary px-3 py-1.5 text-xs">
                    {g.joinType === 'request' && g.myStatus !== 'invited' ? 'Request' : 'Join'}
                  </button>
                )}
              </GroupRow>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
