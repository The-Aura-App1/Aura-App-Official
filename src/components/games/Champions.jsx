import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Trophy } from 'lucide-react';
import { api } from '../../api';
import Avatar from '../common/Avatar';
import { GAME_LIST, gameTile } from './gameInfo';

const MEDALS = ['#facc15', '#cbd5e1', '#d97706'];

function Row({ r, me }) {
  return (
    <li className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${r.userId === me ? 'bg-aura-500/10' : ''}`}>
      <span className="w-5 text-center text-xs font-bold tabular-nums" style={{ color: MEDALS[r.rank - 1] ?? 'var(--text-muted)' }}>
        {r.rank === 1 ? <Crown size={13} className="inline" aria-label="First" /> : r.rank}
      </span>
      <Avatar name={r.displayName || r.username} picKey={r.picKey} size="w-6 h-6" />
      <Link to={`/profile/${encodeURIComponent(r.username ?? '')}`} className="flex-1 min-w-0 text-sm text-[var(--text-primary)] truncate hover:text-[var(--accent)]">
        {r.userId === me ? 'You' : r.displayName || r.username}
      </Link>
      <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">{r.wins} win{r.wins === 1 ? '' : 's'}</span>
    </li>
  );
}

// Who has won the most games in this group: overall, and for each game
export default function Champions({ groupId, viewerId }) {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState('overall');

  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => api.getGameChampions(groupId))
      .then(d => { if (live) setData(d?.overall ? d : { overall: [], byGame: {} }); }, () => { if (live) setData({ overall: [], byGame: {} }); });
    return () => { live = false; };
  }, [groupId]);

  if (!data || !data.overall.length) return null;
  const games = GAME_LIST.filter(g => data.byGame[g.id]?.length);
  const list = pick === 'overall' ? data.overall : data.byGame[pick] ?? [];
  return (
    <section className="card flex flex-col gap-3" aria-label="Game champions">
      <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><Trophy size={17} className="text-amber-400" /> Champions</h2>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1" role="tablist">
        <button type="button" role="tab" aria-selected={pick === 'overall'} onClick={() => setPick('overall')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex-shrink-0 ${pick === 'overall' ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
          All games
        </button>
        {games.map(g => (
          <button key={g.id} type="button" role="tab" aria-selected={pick === g.id} onClick={() => setPick(g.id)}
            className={`flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${pick === g.id ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center" style={gameTile(g.id)}><g.Icon size={11} className="text-white" aria-hidden="true" /></span>
            {g.name}
          </button>
        ))}
      </div>
      <ol className="flex flex-col">
        {list.map(r => <Row key={r.userId} r={r} me={viewerId} />)}
      </ol>
    </section>
  );
}
