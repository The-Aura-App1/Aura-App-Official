import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Plus, UserPlus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import GroupPosts from '../components/groups/GroupPosts';
import ConfirmButton from '../components/groups/ConfirmButton';
import { JOIN_TYPES, JoinTypeBadge, GroupAvatar, memberCountText } from '../components/groups/GroupBits';

const S3_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com';

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

function MemberRow({ member, children }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Link to={`/profile/${member.username}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-aura-500/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {member.profilePicKey
            ? <img src={`${S3_URL}/${member.profilePicKey}`} alt="" className="w-full h-full object-cover" />
            : <span className="text-aura-400 text-sm font-bold">{member.displayName?.[0]?.toUpperCase() ?? '?'}</span>}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{member.displayName}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">@{member.username}</p>
        </div>
        {member.role !== 'member' && <span className="aura-badge capitalize">{member.role}</span>}
      </Link>
      {children && <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">{children}</div>}
    </div>
  );
}

// Loads one of the group's member lists and reloads after each action
function useMemberList(groupId, status) {
  const [members, setMembers] = useState(null);
  const [error, setError]     = useState('');
  const load = useCallback(async () => {
    try {
      setMembers((await api.getGroupMembers(groupId, status)).members ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
      setMembers([]);
    }
  }, [groupId, status]);
  useEffect(() => { load(); }, [load]);
  return { members, error, reload: load };
}

function Members({ group, viewerId, onChanged }) {
  const { members, error, reload } = useMemberList(group.groupId, 'active');
  const [busy, setBusy]     = useState(false);
  const [message, setMessage] = useState({});

  // The owner can act on anyone else; moderators only on plain members
  const canActOn = target =>
    target.userId !== viewerId && target.role !== 'owner'
    && (group.isOwner || (group.canModerate && target.role === 'member'));

  async function act(request) {
    setBusy(true);
    setMessage({});
    try {
      setMessage({ success: (await request()).message });
      await reload();
      onChanged();
    } catch (err) {
      setMessage({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (members === null) return <LoadingSpinner size={48} />;
  return (
    <div className="card flex flex-col gap-3">
      <Message error={error || message.error} success={message.success} />
      <div className="divide-y divide-[var(--border)]">
        {members.map(m => (
          <MemberRow key={m.userId} member={m}>
            {canActOn(m) && (
              <>
                {group.isOwner && (m.role === 'moderator'
                  ? <ConfirmButton label="Remove mod" danger={false} disabled={busy}
                      onConfirm={() => act(() => api.demoteMod(group.groupId, m.userId))} />
                  : <ConfirmButton label="Make mod" danger={false} disabled={busy}
                      onConfirm={() => act(() => api.appointMod(group.groupId, m.userId))} />)}
                <ConfirmButton label="Kick" disabled={busy} onConfirm={() => act(() => api.kickMember(group.groupId, m.userId))} />
                <ConfirmButton label="Ban" disabled={busy} onConfirm={() => act(() => api.banMember(group.groupId, m.userId))} />
              </>
            )}
          </MemberRow>
        ))}
      </div>
    </div>
  );
}

function Requests({ group, onChanged }) {
  const { members, error, reload } = useMemberList(group.groupId, 'pending');
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState({});

  async function act(request) {
    setBusy(true);
    setMessage({});
    try {
      setMessage({ success: (await request()).message });
      await reload();
      onChanged();
    } catch (err) {
      setMessage({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (members === null) return <LoadingSpinner size={48} />;
  return (
    <div className="card flex flex-col gap-3">
      <Message error={error || message.error} success={message.success} />
      {members.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No pending requests.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {members.map(m => (
            <MemberRow key={m.userId} member={m}>
              <button disabled={busy} onClick={() => act(() => api.approveRequest(group.groupId, m.userId))}
                className="btn-primary px-3 py-1.5 text-xs">Approve</button>
              <button disabled={busy} onClick={() => act(() => api.declineRequest(group.groupId, m.userId))}
                className="btn-secondary px-3 py-1.5 text-xs text-[var(--text-primary)]">Decline</button>
            </MemberRow>
          ))}
        </div>
      )}
    </div>
  );
}

function Manage({ group, onChanged }) {
  const navigate = useNavigate();
  const banned   = useMemberList(group.groupId, 'banned');
  const invited  = useMemberList(group.groupId, 'invited');
  const [username, setUsername] = useState('');
  const [settings, setSettings] = useState({
    description: group.description ?? '', joinType: group.joinType, hideMemberList: !!group.hideMemberList,
    allowTakes: group.allowTakes !== false,
  });
  const [deleteName, setDeleteName] = useState('');
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState({});

  async function act(request, after) {
    setBusy(true);
    setMessage({});
    try {
      const result = await request();
      setMessage({ success: result.message ?? 'Saved.' });
      await after?.();
      onChanged();
    } catch (err) {
      setMessage({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function invite(e) {
    e.preventDefault();
    await act(() => api.inviteToGroup(group.groupId, username), invited.reload);
    setUsername('');
  }

  async function deleteGroup() {
    setBusy(true);
    try {
      await api.deleteGroup(group.groupId);
      navigate('/groups');
    } catch (err) {
      setMessage({ error: err.message });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Message error={message.error} success={message.success} />

      <section className="card flex flex-col gap-3">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><UserPlus size={16} /> Invite someone</h3>
        <form onSubmit={invite} className="flex gap-2">
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="@username"
            aria-label="Username to invite" className="input py-2" />
          <button type="submit" disabled={busy || !username.trim()} className="btn-primary px-4 py-2 flex-shrink-0">Invite</button>
        </form>
        {invited.members?.length > 0 && (
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-2">Waiting to accept</p>
            <div className="divide-y divide-[var(--border)]">
              {invited.members.map(m => <MemberRow key={m.userId} member={m} />)}
            </div>
          </div>
        )}
      </section>

      <section className="card flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)]">Moments</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {group.momentsEnabled ? 'Members can share Moments in this group.' : 'Moments are off for this group.'}
          </p>
        </div>
        <button disabled={busy} onClick={() => act(() => api.updateGroup(group.groupId, { momentsEnabled: !group.momentsEnabled }))}
          className="btn-secondary px-4 py-2 text-[var(--text-primary)] flex-shrink-0">
          {group.momentsEnabled ? 'Turn off' : 'Turn on'}
        </button>
      </section>

      {group.isOwner && (
        <section className="card flex flex-col gap-3">
          <h3 className="font-semibold text-[var(--text-primary)]">Group settings</h3>
          <textarea value={settings.description} maxLength={500} rows={3}
            onChange={e => setSettings(s => ({ ...s, description: e.target.value }))}
            placeholder="Description" aria-label="Description" className="input resize-none" />
          <label className="text-sm text-[var(--text-primary)] flex flex-col gap-1.5">
            Who can join
            <select value={settings.joinType} onChange={e => setSettings(s => ({ ...s, joinType: e.target.value }))} className="input py-2">
              {Object.entries(JOIN_TYPES).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <span className="text-xs text-[var(--text-muted)]">{JOIN_TYPES[settings.joinType].hint}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" checked={settings.hideMemberList} className="accent-[#7c3aed]"
              onChange={e => setSettings(s => ({ ...s, hideMemberList: e.target.checked }))} />
            Only owners and moderators can see the member list
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" checked={settings.allowTakes} className="accent-[#7c3aed]"
              onChange={e => setSettings(s => ({ ...s, allowTakes: e.target.checked }))} />
            Members can take aura from posts in this group
          </label>
          <div>
            <button disabled={busy} onClick={() => act(() => api.updateGroup(group.groupId, settings))} className="btn-primary px-4 py-2">
              Save settings
            </button>
          </div>
        </section>
      )}

      <section className="card flex flex-col gap-3">
        <h3 className="font-semibold text-[var(--text-primary)]">Banned</h3>
        {banned.members === null ? <LoadingSpinner size={40} /> : banned.members.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nobody is banned.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {banned.members.map(m => (
              <MemberRow key={m.userId} member={m}>
                <ConfirmButton label="Unban" danger={false} disabled={busy}
                  onConfirm={() => act(() => api.unbanMember(group.groupId, m.userId), banned.reload)} />
              </MemberRow>
            ))}
          </div>
        )}
      </section>

      {group.isOwner && (
        <section className="card flex flex-col gap-3 border-red-400/30">
          <h3 className="font-semibold text-red-400">Delete group</h3>
          <p className="text-xs text-[var(--text-muted)]">
            This removes the group for everyone. The name stays reserved. Type the group's name to confirm.
          </p>
          <input value={deleteName} onChange={e => setDeleteName(e.target.value)} placeholder={group.name}
            aria-label="Type the group name to confirm" className="input py-2" />
          <div>
            <button disabled={busy || deleteName.trim() !== group.name} onClick={deleteGroup}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed">
              Delete group
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function GroupPage() {
  const { groupId } = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [group, setGroup]     = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab]         = useState('posts');
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState({});

  const load = useCallback(async () => {
    try {
      setGroup(await api.getGroup(groupId));
    } catch (err) {
      setLoadError(err.message);
    }
  }, [groupId]);
  useEffect(() => { setGroup(null); setLoadError(''); setTab('posts'); load(); }, [load]);

  async function act(request) {
    setBusy(true);
    setMessage({});
    try {
      const result = await request();
      if (result.message) setMessage({ success: result.message });
      await load();
    } catch (err) {
      setMessage({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-sm text-[var(--text-muted)]">{loadError}</p>
        <Link to="/groups" className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Back to groups</Link>
      </div>
    );
  }
  if (!group) return <LoadingSpinner />;

  const count = memberCountText(group);
  const tabs = [
    group.canSeePosts   && { key: 'posts',    label: 'Posts' },
    group.canSeeMembers && { key: 'members',  label: 'Members' },
    group.canModerate   && { key: 'requests', label: 'Requests' },
    group.canModerate   && { key: 'manage',   label: 'Manage' },
  ].filter(Boolean);
  const activeTab = tabs.some(t => t.key === tab) ? tab : tabs[0]?.key;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Link to="/groups" className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] w-fit">
        <ArrowLeft size={16} /> Groups
      </Link>

      <section className="card flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <GroupAvatar name={group.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[var(--text-primary)] break-words">{group.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <JoinTypeBadge joinType={group.joinType} />
              {count && <span className="text-xs text-[var(--text-muted)]">{count}</span>}
              {group.role && group.role !== 'member' && <span className="aura-badge capitalize">{group.role}</span>}
            </div>
          </div>
        </div>
        {group.description && (
          <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{group.description}</p>
        )}

        <Message error={message.error} success={message.success} />

        <div className="flex items-center gap-2 flex-wrap">
          {group.myStatus === 'active' && (
            <>
              <button onClick={() => navigate(`/create?group=${group.groupId}`)} className="btn-primary px-4 py-2">
                <Plus size={16} /> New post
              </button>
              <button disabled={busy} onClick={() => act(() => api.muteGroup(group.groupId, !group.muted))}
                className="btn-secondary px-4 py-2 text-[var(--text-primary)]"
                aria-pressed={group.muted}>
                {group.muted ? <><BellOff size={16} /> Muted</> : <><Bell size={16} /> Notifications on</>}
              </button>
              {!group.isOwner && (
                <ConfirmButton label="Leave group" disabled={busy} className="py-2 px-4 text-sm"
                  onConfirm={() => act(() => api.leaveGroup(group.groupId))} />
              )}
            </>
          )}
          {group.myStatus === 'invited' && (
            <>
              <p className="text-sm text-[var(--text-primary)] w-full">You've been invited to join.</p>
              <button disabled={busy} onClick={() => act(() => api.joinGroup(group.groupId))} className="btn-primary px-4 py-2">Accept invite</button>
              <button disabled={busy} onClick={() => act(() => api.leaveGroup(group.groupId))} className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Decline</button>
            </>
          )}
          {group.myStatus === 'pending' && (
            <>
              <span className="text-sm text-[var(--text-muted)]">Your request is waiting for approval.</span>
              <button disabled={busy} onClick={() => act(() => api.leaveGroup(group.groupId))} className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Cancel request</button>
            </>
          )}
          {group.myStatus === 'banned' && (
            <span className="text-sm text-red-400">You are banned from this group.</span>
          )}
          {!group.myStatus && (
            <button disabled={busy} onClick={() => act(() => api.joinGroup(group.groupId))} className="btn-primary px-4 py-2">
              {group.joinType === 'request' ? 'Request to join' : 'Join group'}
            </button>
          )}
        </div>
      </section>

      {tabs.length > 0 && (
        <div className="flex border-b border-[var(--border)]" role="tablist">
          {tabs.map(t => (
            <button key={t.key} role="tab" aria-selected={activeTab === t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all
                ${activeTab === t.key
                  ? 'border-aura-500 text-aura-400'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'posts'    && <GroupPosts key={group.groupId} groupId={group.groupId} takesOff={group.allowTakes === false} />}
      {activeTab === 'members'  && <Members group={group} viewerId={user?.userId} onChanged={load} />}
      {activeTab === 'requests' && <Requests group={group} onChanged={load} />}
      {activeTab === 'manage'   && <Manage group={group} onChanged={load} />}

      {!group.canSeePosts && group.myStatus !== 'banned' && (
        <p className="text-center text-sm text-[var(--text-muted)] py-6">
          Only members can see this group's posts.
        </p>
      )}
    </div>
  );
}
