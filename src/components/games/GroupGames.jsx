import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Swords, Sparkles, X } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import { GAME_LIST, GAME_BY_ID, STAKE_CAP, statusText, gameTile, seatsOf } from './gameInfo';

const QUICK_STAKES = [0, 25, 50, 100, 250];
const REFRESH_MS = 10000;

export function StakeBadge({ stake }) {
  return stake
    ? <span className="aura-badge whitespace-nowrap"><Sparkles size={11} aria-hidden="true" />{stake} each</span>
    : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-[var(--text-muted)] border border-[var(--border)]">Friendly</span>;
}

function ChallengeForm({ groupId, onClose }) {
  const navigate = useNavigate();
  const { dbProfile } = useAuth();
  const cap = dbProfile?.isPremium ? STAKE_CAP.premium : STAKE_CAP.regular;
  const have = (dbProfile?.auraSpendable ?? 0) + (dbProfile?.auraEarned ?? 0);
  const [game, setGame]         = useState('connect4');
  const [stake, setStake]       = useState(0);
  const [call, setCall]         = useState('heads');
  const [opponent, setOpponent] = useState('');
  const [seats, setSeats]       = useState(2);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const maxSeats = GAME_BY_ID[game]?.maxPlayers ?? 2;
  const table = Math.min(seats, maxSeats);   // switching to a two-player game drops back to 2

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!Number.isInteger(stake) || stake < 0 || stake > cap) { setError(`Pick a stake from 0 to ${cap}.`); return; }
    setBusy(true);
    try {
      const result = await api.createGame(groupId, {
        game, stake, seats: table, opponent: table === 2 ? opponent.trim() || undefined : undefined,
        options: game === 'coinflip' ? { call } : undefined,
      });
      navigate(`/games/${encodeURIComponent(result.match.matchId)}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4" aria-label="New challenge">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">New challenge</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--text-muted)] mb-2">Game</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {GAME_LIST.map(({ id, name, Icon, kind, blurb }) => (
            <label key={id} className={`relative flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition-colors
              ${game === id ? 'border-aura-500/60 bg-aura-500/10' : 'border-[var(--border)] hover:border-aura-500/30'}`}>
              <input type="radio" name="game" value={id} checked={game === id} onChange={() => setGame(id)} className="sr-only" />
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={gameTile(id)}>
                  <Icon size={15} className="text-white" aria-hidden="true" />
                </span>{name}
              </span>
              <span className="text-[11px] leading-snug text-[var(--text-muted)]">{blurb}</span>
              <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{kind}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {game === 'coinflip' && (
        <fieldset>
          <legend className="text-xs font-semibold text-[var(--text-muted)] mb-2">Your call</legend>
          <div className="flex gap-2">
            {['heads', 'tails'].map(side => (
              <button key={side} type="button" aria-pressed={call === side} onClick={() => setCall(side)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border capitalize
                  ${call === side ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                {side}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {maxSeats > 2 && (
        <fieldset>
          <legend className="text-xs font-semibold text-[var(--text-muted)] mb-2">Players</legend>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: maxSeats - 1 }, (_, i) => i + 2).map(n => (
              <button key={n} type="button" aria-pressed={table === n} onClick={() => setSeats(n)}
                className={`w-10 py-1.5 rounded-lg text-sm font-semibold border
                  ${table === n ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                {n}
              </button>
            ))}
          </div>
          {table > 2 && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Open to everyone in the group. It starts when all {table} seats fill, or you can start it once at least one other player joins.
            </p>
          )}
        </fieldset>
      )}

      <div>
        <label htmlFor="game-stake" className="text-xs font-semibold text-[var(--text-muted)]">Stake (aura each)</label>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {QUICK_STAKES.filter(v => v <= cap).map(v => (
            <button key={v} type="button" aria-pressed={stake === v} onClick={() => setStake(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border
                ${stake === v ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
              {v === 0 ? 'Friendly' : v}
            </button>
          ))}
          <input id="game-stake" type="number" min={0} max={cap} step={1} inputMode="numeric" value={stake}
            onChange={e => setStake(e.target.value === '' ? 0 : Math.floor(Number(e.target.value)))}
            className="input w-24 py-1.5" />
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {!stake
            ? 'Just for fun. No aura changes hands.'
            : table === 2
              ? `You both put in ${stake}. The winner takes all ${stake * 2} as spendable aura; a draw gives it back.`
              : `Everyone puts in ${stake}. The winner takes it all (${stake * table} with a full table) as spendable aura; players who tie share it.`}
          {' '}Up to {cap} a game{dbProfile ? `; you have ${have}` : ''}.
        </p>
      </div>

      {table === 2 && (
        <div>
          <label htmlFor="game-opponent" className="text-xs font-semibold text-[var(--text-muted)]">Opponent (optional)</label>
          <input id="game-opponent" value={opponent} onChange={e => setOpponent(e.target.value)} maxLength={31}
            placeholder="@username, or leave empty for anyone in the group" className="input mt-2" autoComplete="off" />
        </div>
      )}

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary self-start">
        <Swords size={16} aria-hidden="true" /> {busy ? 'Sending…' : table === 2 ? 'Send challenge' : `Open a table for ${table}`}
      </button>
    </form>
  );
}

function GameRow({ match, viewerId, onAccept, busy }) {
  const info = GAME_BY_ID[match.game];
  const Icon = info?.Icon ?? Swords;
  const mine = match.players.some(p => p.userId === viewerId);
  const seats = seatsOf(match);
  const canAccept = match.status === 'open' && !mine && match.players.length < seats && (!match.invited || match.invited.userId === viewerId);
  const status = statusText(match, viewerId);
  const highlight = status === 'Your turn' || status === 'Challenged you';
  return (
    <li className="card relative flex items-center gap-3 p-3 hover:border-aura-500/30">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={gameTile(match.game)}>
        <Icon size={20} className="text-white" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <Link to={`/games/${encodeURIComponent(match.matchId)}`}
          className="text-sm font-semibold text-[var(--text-primary)] after:absolute after:inset-0 after:content-['']">
          {info?.name ?? match.game}
        </Link>
        {seats > 2 ? (
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--text-muted)] min-w-0">
            <span className="flex -space-x-1.5 flex-shrink-0">
              {match.players.slice(0, 6).map(p => <Avatar key={p.userId} name={p.displayName} picKey={p.picKey} size="w-4 h-4" />)}
            </span>
            <span className="truncate">
              {match.players.map(p => (p.userId === viewerId ? 'You' : p.displayName)).join(', ')}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--text-muted)] min-w-0">
            {match.players.map((p, i) => (
              <React.Fragment key={p.userId}>
                {i > 0 && <span>vs</span>}
                <Avatar name={p.displayName} picKey={p.picKey} size="w-4 h-4" />
                <span className="truncate">{p.userId === viewerId ? 'You' : p.displayName}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <StakeBadge stake={match.stake} />
        <span className={`text-xs font-semibold ${highlight ? 'text-aura-400' : 'text-[var(--text-muted)]'}`}>{status}</span>
      </div>
      {canAccept && (
        <button type="button" disabled={busy} onClick={() => onAccept(match)} className="btn-primary relative z-10 px-3 py-1.5 text-xs">
          {seats > 2 ? 'Join' : 'Accept'}
        </button>
      )}
    </li>
  );
}

// The Games tab on a group page: challenge someone, accept open challenges,
// and jump back into games in progress
export default function GroupGames({ groupId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const viewerId = user?.userId;
  const [games, setGames]     = useState(null);
  const [error, setError]     = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy]       = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getGroupGames(groupId);
      setGames(data.games ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [groupId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function accept(match) {
    setBusy(true);
    setError('');
    try {
      await api.gameAction(match.matchId, 'join');
      navigate(`/games/${encodeURIComponent(match.matchId)}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
      load();
    }
  }

  const list = games ?? [];
  const mine = m => m.players.some(p => p.userId === viewerId);
  const sections = [
    ['Your games', list.filter(m => (m.status === 'open' || m.status === 'active') && mine(m))],
    ['Open challenges', list.filter(m => m.status === 'open' && !mine(m) && m.players.length < seatsOf(m) && (!m.invited || m.invited.userId === viewerId))],
    ['Being played', list.filter(m => m.status === 'active' && !mine(m))],
    ['Recent results', list.filter(m => m.status === 'finished').slice(0, 10)],
  ];

  return (
    <div className="flex flex-col gap-4">
      {creating
        ? <ChallengeForm groupId={groupId} onClose={() => setCreating(false)} />
        : (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary self-start">
            <Swords size={16} aria-hidden="true" /> Challenge someone
          </button>
        )}

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      {games === null && !error && <p className="text-sm text-[var(--text-muted)]">Loading games…</p>}
      {games && !list.length && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">
          No games yet. Challenge a member to Connect 4, 8-Ball Pool, Poker, Go Fish, Dice Duel or a coin flip.
          Poker, Go Fish and Dice Duel can seat more players.
        </p>
      )}

      {sections.filter(([, items]) => items.length).map(([title, items]) => (
        <section key={title} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h2>
          <ul className="flex flex-col gap-2">
            {items.map(m => <GameRow key={m.matchId} match={m} viewerId={viewerId} onAccept={accept} busy={busy} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
