import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, Timer, Trophy, Swords } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { BOARDS } from '../components/games/Boards';
import { StakeBadge } from '../components/games/GroupGames';
import { GAME_BY_ID, clock, gameTile, seatsOf, logText } from '../components/games/gameInfo';
import '../components/games/games.css';

// How often to check for the other player's move. Faster while waiting on
// them; slower on your own turn (only a resign or timeout claim can land then).
const POLL_THEIRS = 2000;
const POLL_MINE   = 8000;
const POLL_OPEN   = 4000;

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function resultText(match, seat, players) {
  const many = players.length > 2;
  if (match.status === 'cancelled') return many ? 'The table was withdrawn. Every stake went back.' : 'The challenge was withdrawn. The stake went back.';
  if (match.status === 'declined') return 'The challenge was declined. The stake went back.';
  const pot = match.stake * players.length;
  const split = match.winnerUserIds?.length > 1 ? match.winnerUserIds : null;
  if (split) {
    const share = Math.floor(pot / split.length);
    const names = split.map(id => (players[seat]?.userId === id ? 'you' : players.find(p => p.userId === id)?.displayName)).join(' and ');
    return `A tie: ${names} share the pot.${pot && seat !== null && split.includes(players[seat]?.userId) ? ` +${share} aura` : ''}`;
  }
  if (!match.winnerUserId) return match.stake ? `It's a draw. ${many ? 'Every stake' : 'Both stakes'} went back.` : 'It\'s a draw.';
  const winnerSeat = players.findIndex(p => p.userId === match.winnerUserId);
  const how = match.endReason === 'resign' ? ' by resignation' : match.endReason === 'timeout' ? ' on time' : '';
  if (seat === winnerSeat) return `You won${how}!${pot ? ` +${pot} aura` : ''}`;
  if (seat !== null) return `You lost${how}.${match.stake ? ` −${match.stake} aura` : ''}`;
  return `${players[winnerSeat]?.displayName ?? 'Someone'} won${how}.`;
}

// A short shower of confetti in the theme's colors when you win
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37) % 100}%`, delay: `${(i % 7) * 0.12}s`, drift: `${((i * 53) % 80) - 40}px`,
  spin: `${360 + ((i * 97) % 540)}deg`, time: `${2 + (i % 5) * 0.25}s`,
  color: ['var(--brand-1)', 'var(--brand-2)', 'var(--brand-3)', '#fcd34d', '#ffffff'][i % 5],
}));
function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {CONFETTI.map((c, i) => (
        <span key={i} className="game-confetti"
          style={{ left: c.left, background: c.color, '--delay': c.delay, '--drift': c.drift, '--spin': c.spin, '--fall-time': c.time }} />
      ))}
    </div>
  );
}

export default function GameMatch() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const [data, setData]   = useState(null);
  const [error, setError] = useState('');
  const [moveError, setMoveError] = useState('');
  const [busy, setBusy]   = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const offset = useRef(0);   // server clock minus ours, for the turn timer
  const shotNo = useRef(null); // pool: the shot whose recording we already have

  const apply = useCallback(result => {
    offset.current = (result.now ?? Date.now()) - Date.now();
    if (result.view?.shot?.frames) shotNo.current = result.view.shot.no;
    setData(result);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api.getGame(matchId, shotNo.current));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [matchId, apply]);

  useEffect(() => { setData(null); shotNo.current = null; load(); }, [load]);

  const match = data?.match;
  const seat = data?.seat ?? null;
  const live = match?.status === 'active' || match?.status === 'open';
  const myTurn = match?.status === 'active' && match.turnUserId === user?.userId;

  useEffect(() => {
    if (!live) return undefined;
    const every = match.status === 'open' ? POLL_OPEN : myTurn ? POLL_MINE : POLL_THEIRS;
    const t = setInterval(() => { if (!document.hidden && !busy) load(); }, every);
    return () => clearInterval(t);
  }, [live, match?.status, myTurn, busy, load]);

  const now = useNow(match?.status === 'active');

  async function run(request) {
    setBusy(true);
    setMoveError('');
    try {
      apply(await request());
    } catch (err) {
      setMoveError(err.message);
      load();
    } finally {
      setBusy(false);
      setConfirmResign(false);
    }
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-sm text-[var(--text-muted)]">{error}</p>
        <Link to="/groups" className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Back to groups</Link>
      </div>
    );
  }
  if (!data) return <LoadingSpinner />;

  const info = GAME_BY_ID[match.game];
  const Icon = info?.Icon ?? Swords;
  const Board = BOARDS[match.game];
  const players = match.players;
  const view = data.view;
  const seats = seatsOf(match);
  const many = seats > 2;
  const imOut = seat !== null && !!match.outUserIds?.includes(user?.userId);
  const left = match.deadline ? match.deadline - (now + offset.current) : null;
  const canClaim = match.status === 'active' && seat !== null && !imOut && !myTurn && left !== null && left <= 0;
  const invitedMe = match.status === 'open' && match.invited?.userId === user?.userId;
  const canAccept = match.status === 'open' && seat === null && players.length < seats && (!match.invited || invitedMe);
  const won = match.status === 'finished' && seat !== null && (match.winnerUserIds ?? [match.winnerUserId]).includes(user?.userId);
  const turnName = players.find(p => p.userId === match.turnUserId)?.displayName ?? 'Someone';
  const playerName = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Someone');

  return (
    <div className="flex flex-col gap-4 pb-8 max-w-xl mx-auto w-full">
      <Link to={`/groups/${encodeURIComponent(match.groupId)}`}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] w-fit">
        <ArrowLeft size={16} /> Back to the group
      </Link>

      <section className="card relative overflow-hidden flex flex-col gap-3">
        {won && <Confetti />}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={gameTile(match.game)}>
            <Icon size={20} className="text-white" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] flex-1">{info?.name ?? match.game}</h1>
          <StakeBadge stake={match.stake} />
        </div>

        {many ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Players">
            {Array.from({ length: seats }, (_, s) => {
              const p = players[s];
              const onTurn = match.status === 'active' && p && match.turnUserId === p.userId;
              const out = p && match.outUserIds?.includes(p.userId);
              const winner = p && match.status === 'finished' && (match.winnerUserIds ?? []).includes(p.userId);
              return (
                <li key={s} className={`flex items-center gap-2 min-w-0 px-2.5 py-2 rounded-xl border
                  ${onTurn ? 'border-aura-500/60 bg-aura-500/10' : 'border-[var(--border)]'} ${out ? 'opacity-50' : ''}`}>
                  {p ? (
                    <>
                      <Avatar name={p.displayName} picKey={p.picKey} size="w-8 h-8" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate flex items-center gap-1">
                          {winner && <Trophy size={13} className="text-amber-400 flex-shrink-0" aria-label="Winner" />}
                          {seat === s ? 'You' : p.displayName}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">{out ? 'Out' : `@${p.username}`}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)] px-1">{match.status === 'open' ? 'Open seat' : 'Empty'}</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {[0, 1].map(s => {
            const p = players[s];
            const onTurn = match.status === 'active' && p && match.turnUserId === p.userId;
            const cell = (
              <div key={s} className={`flex items-center gap-2 min-w-0 px-2.5 py-2 rounded-xl border
                ${s === 1 ? 'flex-row-reverse text-right' : ''}
                ${onTurn ? 'border-aura-500/60 bg-aura-500/10' : 'border-[var(--border)]'}`}>
                {p ? (
                  <>
                    <Avatar name={p.displayName} picKey={p.picKey} size="w-8 h-8" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{seat === s ? 'You' : p.displayName}</p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">@{p.username}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] px-1">{match.invited ? `@${match.invited.username}` : 'Anyone'}</p>
                )}
              </div>
            );
            return s === 0 ? [cell, <span key="vs" className="text-xs font-bold text-[var(--text-muted)]">VS</span>] : cell;
          })}
        </div>
        )}

        {match.status === 'active' && (
          <p className={`flex items-center justify-center gap-1.5 text-sm font-semibold ${myTurn ? 'text-aura-400' : 'text-[var(--text-secondary)]'}`} aria-live="polite">
            <Timer size={15} aria-hidden="true" />
            {myTurn ? 'Your turn' : seat === null || many ? `${turnName}'s turn` : 'Their turn'}
            {left !== null && <span className="tabular-nums font-normal text-[var(--text-muted)]">· {left > 0 ? clock(left) : 'time\'s up'}</span>}
          </p>
        )}
        {(match.status === 'finished' || match.status === 'cancelled' || match.status === 'declined') && (
          <p className="flex items-center justify-center gap-2 text-base font-bold text-[var(--text-primary)]" role="status">
            {match.status === 'finished' && <Trophy size={won ? 22 : 18} className={`text-amber-400 ${won ? 'game-trophy' : ''}`} aria-hidden="true" />}
            {resultText(match, seat, players)}
          </p>
        )}
      </section>

      {match.status === 'open' && many && (
        <section className="card flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {players.length} of {seats} seated.{' '}
            {seat === 0
              ? `It starts by itself when the table fills, or start it now${players.length < 2 ? ' once someone joins' : ''}.`
              : seat !== null
                ? `You're in. Waiting for ${players[0].displayName} to start, or for the table to fill.`
                : `${players[0].displayName} opened a ${info?.name} table.`}
            {match.stake ? ` Everyone puts in ${match.stake} aura; the winner takes it all.` : ' Just for fun.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {seat === 0 && (
              <>
                <button type="button" disabled={busy || players.length < 2} onClick={() => run(() => api.gameAction(match.matchId, 'start'))} className="btn-primary">
                  Start with {players.length}
                </button>
                <button type="button" disabled={busy} onClick={() => run(() => api.gameAction(match.matchId, 'cancel'))}
                  className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Withdraw table</button>
              </>
            )}
            {seat !== null && seat > 0 && (
              <button type="button" disabled={busy} onClick={() => run(() => api.gameAction(match.matchId, 'leave'))}
                className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Leave table</button>
            )}
            {canAccept && (
              <button type="button" disabled={busy} onClick={() => run(() => api.gameAction(match.matchId, 'join'))} className="btn-primary">
                Join{match.stake ? ` for ${match.stake} aura` : ''}
              </button>
            )}
          </div>
        </section>
      )}

      {match.status === 'open' && !many && (
        <section className="card flex flex-col items-center gap-3 text-center">
          {seat === 0 ? (
            <>
              <p className="text-sm text-[var(--text-secondary)]">
                {match.invited ? `Waiting for @${match.invited.username} to accept.` : 'Waiting for someone in the group to accept.'}
                {match.stake ? ` Your ${match.stake} aura is held until then.` : ''}
              </p>
              <button type="button" disabled={busy} onClick={() => run(() => api.gameAction(match.matchId, 'cancel'))}
                className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Withdraw challenge</button>
            </>
          ) : canAccept ? (
            <>
              <p className="text-sm text-[var(--text-secondary)]">
                {players[0].displayName} challenged {invitedMe ? 'you' : 'the group'} to {info?.name}.
                {match.stake ? ` Accepting puts in ${match.stake} aura; the winner takes ${match.stake * 2}.` : ' Just for fun.'}
                {match.game === 'coinflip' && ` They called ${match.options?.call}.`}
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => run(() => api.gameAction(match.matchId, 'join'))} className="btn-primary">Accept</button>
                {invitedMe && (
                  <button type="button" disabled={busy} onClick={() => run(() => api.gameAction(match.matchId, 'decline'))}
                    className="btn-secondary px-4 py-2 text-[var(--text-primary)]">Decline</button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">This challenge is for @{match.invited?.username}.</p>
          )}
        </section>
      )}

      {view && Board && (
        <section className="card p-3 sm:p-4" aria-label="Game board">
          <Board view={view} seat={seat} players={players} busy={busy} myTurn={myTurn}
            move={m => run(() => api.gameMove(match.matchId, m))} />
        </section>
      )}

      {moveError && <p className="text-sm text-red-400 text-center" role="alert">{moveError}</p>}

      {match.status === 'active' && imOut && (
        <p className="text-sm text-[var(--text-muted)] text-center">You're out of this game. You can keep watching.</p>
      )}

      {match.status === 'active' && seat !== null && !imOut && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canClaim && (
            <button type="button" disabled={busy} onClick={() => run(() => api.gameAction(match.matchId, 'claim'))} className="btn-primary">
              <Trophy size={16} aria-hidden="true" />
              {many && players.length - (match.outUserIds?.length ?? 0) > 2 ? `${turnName}'s time ran out. Take them out` : 'Their time ran out. Claim the win'}
            </button>
          )}
          {confirmResign ? (
            <>
              <span className="text-sm text-[var(--text-secondary)]">
                {many ? 'Leave the game? Your stake stays in the pot.' : 'Resign and give them the win?'}
              </span>
              <button type="button" disabled={busy} onClick={() => run(() => api.gameAction(match.matchId, 'resign'))}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30">Resign</button>
              <button type="button" onClick={() => setConfirmResign(false)} className="text-sm text-[var(--text-muted)]">Keep playing</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmResign(true)} className="btn-ghost">
              <Flag size={15} aria-hidden="true" /> Resign
            </button>
          )}
        </div>
      )}

      {view?.log?.length > 0 && (
        <section className="card p-3" aria-label="What happened">
          <ol className="flex flex-col-reverse gap-1 text-xs text-[var(--text-secondary)] max-h-48 overflow-y-auto">
            {view.log.map((entry, i) => (
              <li key={i}>
                {entry.s !== null && entry.s !== undefined && (
                  <span className="font-semibold text-[var(--text-primary)]">{playerName(entry.s)} </span>
                )}
                {logText(entry, s => (s === seat ? 'you' : players[s]?.displayName ?? 'someone'))}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
