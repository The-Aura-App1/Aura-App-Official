import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Star, Sparkles } from 'lucide-react';
import { api } from '../../api';
import { GroupAvatar } from './GroupBits';

// The top groups across Aura, by level or by all the aura given inside them.
// Invite-only groups, and groups whose owner turned it off, never show.
const MEDALS = ['#facc15', '#cbd5e1', '#d97706'];

export default function GroupLeaderboard() {
  const [by, setBy] = useState('level');
  const [data, setData] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (data[by]) return;
    let live = true;
    api.getGroupLeaderboard(by)
      .then(d => { if (live) setData(prev => ({ ...prev, [by]: d.groups ?? [] })); })
      .catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [by, data]);

  const list = data[by];
  return (
    <section className="card flex flex-col gap-3" aria-label="Top groups">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><Trophy size={17} className="text-amber-400" /> Top groups</h2>
        <div className="flex rounded-xl border border-[var(--border)] p-0.5 text-xs font-semibold" role="tablist">
          {[['level', 'Level', Star], ['aura', 'Most aura', Sparkles]].map(([key, label, Icon]) => (
            <button key={key} type="button" role="tab" aria-selected={by === key} onClick={() => setBy(key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${by === key ? 'bg-aura-500/15 text-aura-400' : 'text-[var(--text-muted)]'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>
      {error && !list && <p className="text-sm text-red-400">{error}</p>}
      {!list && !error && <p className="text-sm text-[var(--text-muted)]">Loading…</p>}
      {list?.length === 0 && <p className="text-sm text-[var(--text-muted)]">No groups on the board yet.</p>}
      {list?.length > 0 && (
        <ol className="flex flex-col divide-y divide-[var(--border)]">
          {list.slice(0, 20).map(g => (
            <li key={g.groupId}>
              <Link to={`/groups/${encodeURIComponent(g.groupId)}`} className="flex items-center gap-3 py-2.5 group">
                <span className="w-6 text-center text-sm font-bold tabular-nums" style={{ color: MEDALS[g.rank - 1] ?? 'var(--text-muted)' }}>{g.rank}</span>
                <GroupAvatar name={g.name} picKey={g.picKey} size="xs" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-aura-400">{g.name}</span>
                  {g.memberCount !== null && <span className="block text-[11px] text-[var(--text-muted)]">{g.memberCount.toLocaleString()} member{g.memberCount === 1 ? '' : 's'}</span>}
                </span>
                <span className="text-right flex-shrink-0">
                  {by === 'level' ? (
                    <>
                      <span className="block text-sm font-bold text-[var(--text-primary)]">Lv {g.level}</span>
                      <span className="block text-[11px] text-[var(--text-muted)] tabular-nums">{g.xp.toLocaleString()} XP</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-sm font-bold text-[var(--text-primary)] tabular-nums">{g.aura.toLocaleString()}</span>
                      <span className="block text-[11px] text-[var(--text-muted)]">aura given</span>
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[11px] text-[var(--text-muted)]">Owners can take their group off the board in Manage.</p>
    </section>
  );
}
