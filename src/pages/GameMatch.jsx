import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, Timer, Trophy, Swords } from 'lucide-react';
import { ROLL_MS } from '../components/games/DiceTray';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { BOARDS } from '../components/games/Boards';
import { StakeBadge } from '../components/games/GroupGames';
import { GAME_BY_ID, TIME_BY_ID, CLOCK_LAG_MS, clock, timeLabel, gameTile, seatsOf, logText } from '../components/games/gameInfo';
import '../components/games/games.css';

// How often to check for the other player's move. Faster while waiting on
// them (fastest against a chess clock); slower on your own turn (only a
// resign or timeout claim can land then). A poll for a match that hasn't
// changed gets a tiny answer, so these stay cheap.
const POLL_THEIRS = 1500;
const POLL_CLOCK  = 800;
const POLL_MINE   = 8000;
const POLL_OPEN   = 4000;

function useNow(active, every = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [active, every]);
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

// Confetti in the theme's colors when you win: a short shower over the
// result, or a full-screen burst when the game has just ended
const CONFETTI = Array.from({ length: 70 }, (_, i) => ({
  left: `${(i * 37) % 100}%`, delay: `${(i % 9) * 0.11}s`, drift: `${((i * 53) % 120) - 60}px`,
  spin: `${360 + ((i * 97) % 720)}deg`, time: `${2.2 + (i % 6) * 0.3}s`, wide: i % 3 === 0,
  color: ['var(--brand-1)', 'var(--brand-2)', 'var(--brand-3)', '#fcd34d', '#ffffff', '#f472b6'][i % 6],
}));
function Confetti({ full = false }) {
  return (
    <div className={`${full ? 'fixed' : 'absolute'} inset-0 pointer-events-none overflow-hidden z-[60]`} aria-hidden="true">
      {CONFETTI.slice(0, full ? 70 : 26).map((c, i) => (
        <span key={i} className={`game-confetti ${full ? 'game-confetti-full' : ''}`}
          style={{ left: c.left, background: c.color, width: c.wide ? 12 : 8, '--delay': c.delay, '--drift': c.drift, '--spin': c.spin, '--fall-time': c.time }} />
      ))}
    </div>
  );
}

// Counts up to a number over about a second
function useCountUp(target, active) {
  const [value, setValue] = useState(active ? 0 : target);
  useEffect(() => {
    if (!active) { setValue(target); return undefined; }
    const start = performance.now();
    let raf;
    const tick = now => {
      const f = Math.min(1, (now - start) / 1100);
      setValue(Math.round(target * (1 - (1 - f) ** 3)));
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return value;
}

// How the game ended, for the viewer: a headline, a line under it, and the aura change
function outcome(match, seat, players) {
  const pot = match.stake * players.length;
  const me = seat === null ? null : players[seat]?.userId;
  const split = match.winnerUserIds?.length > 1 ? match.winnerUserIds : null;
  const how = match.endReason === 'resign' ? 'by resignation' : match.endReason === 'timeout' ? 'on time' : '';
  if (split) {
    const share = Math.floor(pot / split.length);
    const mine = me && split.includes(me);
    const names = split.map(id => (id === me ? 'You' : players.find(p => p.userId === id)?.displayName)).join(' and ');
    return { kind: mine ? 'win' : 'loss', title: mine ? 'You tied for the win!' : 'A tie at the top', line: `${names} share the pot.`, aura: mine && pot ? share : match.stake && me ? -match.stake : 0 };
  }
  if (!match.winnerUserId) return { kind: 'draw', title: 'It\'s a draw', line: match.stake ? 'Every stake went back.' : '', aura: 0 };
  const winner = players.find(p => p.userId === match.winnerUserId);
  if (match.winnerUserId === me) return { kind: 'win', title: 'You won!', line: how ? `You won ${how}.` : players.length > 2 ? `You beat ${players.length - 1} players.` : `You beat ${players.find(p => p.userId !== me)?.displayName}.`, aura: pot };
  if (me) return { kind: 'loss', title: `${winner?.displayName ?? 'They'} won`, line: how ? `They won ${how}.` : 'Better luck next game.', aura: match.stake ? -match.stake : 0 };
  return { kind: 'watch', title: `${winner?.displayName ?? 'Someone'} won`, line: how ? `Won ${how}.` : '', aura: 0 };
}

function AuraChange({ amount, animate }) {
  const shown = useCountUp(Math.abs(amount), animate);
  if (!amount) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-base font-bold tabular-nums
      ${amount > 0 ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]'}`}>
      {amount > 0 ? '+' : '−'}{shown} aura
    </span>
  );
}

// The big card when a game ends while you're watching: hard to miss, with the
// way back to the group's games right there
function ResultCard({ result, gamesLink, onClose }) {
  const close = useRef(null);
  useEffect(() => {
    close.current?.focus();
    const key = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const win = result.kind === 'win';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm game-result-backdrop"
      role="dialog" aria-modal="true" aria-labelledby="game-result-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {win && <Confetti full />}
      <div className={`card relative w-full max-w-sm flex flex-col items-center gap-3 text-center py-8 game-result-card ${win ? 'game-result-win' : ''}`}>
        <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${win ? 'game-result-medal' : 'bg-[var(--bg-elevated)]'}`}>
          {win && <span className="game-result-rays" aria-hidden="true" />}
          <Trophy size={win ? 48 : 36} className={`relative ${win ? 'text-amber-300 game-trophy' : 'text-[var(--text-muted)]'}`} aria-hidden="true" />
        </div>
        <h2 id="game-result-title" className={`font-extrabold text-[var(--text-primary)] ${win ? 'text-3xl' : 'text-2xl'}`}>{result.title}</h2>
        {result.line && <p className="text-sm text-[var(--text-secondary)]">{result.line}</p>}
        <AuraChange amount={result.aura} animate />
        <div className="flex flex-col gap-2 w-full mt-3">
          <Link ref={close} to={gamesLink} className="btn-primary justify-center">Back to games</Link>
          <button type="button" onClick={onClose} className="btn-ghost justify-center">See the board</button>
        </div>
      </div>
    </div>
  );
}

// How long to hold the result back so the last move plays out first
function revealDelay(game, view) {
  if (game === 'dice') return ROLL_MS + 400;
  if (game === 'pool') return (view?.shot?.frames?.length ?? 0) * 50 + 500;
  if (game === 'coinflip') return 2300;
  if (game === 'poker') return 1400;
  if (game === 'golf') return ((view?.shot?.frames?.length ?? 0) / 2) * 50 + 600;
  return 900;
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
  // When a game ends while the page is open, the result waits for the last
  // move to play out, then shows as a big card
  const lastStatus = useRef(null);
  const revealTimer = useRef(0);
  const [revealing, setRevealing] = useState(false);
  const [showCard, setShowCard] = useState(false);
  useEffect(() => () => clearTimeout(revealTimer.current), []);
  useEffect(() => {
    const status = data?.match?.status;
    if (!status) return;
    const was = lastStatus.current;
    lastStatus.current = status;
    if (status === 'finished' && (was === 'active' || was === 'open')) {
      setRevealing(true);
      clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => { setRevealing(false); setShowCard(true); }, revealDelay(data.match.game, data.view));
    }
  }, [data]);

  const version = useRef(null); // the match version on screen
  const apply = useCallback(result => {
    offset.current = (result.now ?? Date.now()) - Date.now();
    if (result.same) return;      // nothing changed since the version we show
    if (result.view?.shot?.frames) shotNo.current = result.view.shot.no;
    version.current = result.version ?? null;
    setData(result);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api.getGame(matchId, shotNo.current, version.current));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [matchId, apply]);

  useEffect(() => { setData(null); shotNo.current = null; version.current = null; load(); }, [load]);

  const match = data?.match;
  const seat = data?.seat ?? null;
  const live = match?.status === 'active' || match?.status === 'open';
  const myTurn = match?.status === 'active' && match.turnUserId === user?.userId;
  const timing = TIME_BY_ID[match?.time] ?? null;
  const chessClock = timing?.kind === 'clock' && Array.isArray(match?.clocks);

  useEffect(() => {
    if (!live) return undefined;
    const every = match.status === 'open' ? POLL_OPEN : myTurn ? POLL_MINE : chessClock ? POLL_CLOCK : POLL_THEIRS;
    const t = setInterval(() => { if (!document.hidden && !busy) load(); }, every);
    return () => clearInterval(t);
  }, [live, match?.status, myTurn, chessClock, busy, load]);

  const now = useNow(match?.status === 'active', chessClock ? 100 : 1000);

  // Against a chess clock, a flag that falls ends the game by itself: the
  // waiting player's page claims it as soon as the server will agree
  const claimed = useRef(null);
  const serverNow = now + offset.current;
  const flagFell = chessClock && match.status === 'active' && match.deadline && serverNow - match.deadline > 300;
  const mySeat = data?.seat ?? null;
  const shownVersion = data?.version;
  useEffect(() => {
    if (!flagFell || myTurn || mySeat === null || busy || claimed.current === shownVersion) return;
    claimed.current = shownVersion;
    api.gameAction(matchId, 'claim').then(apply).catch(() => load());
  }, [flagFell, myTurn, mySeat, busy, shownVersion, matchId, apply, load]);

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
  // Each player's clock, ticking for whoever is on turn
  const clocks = chessClock ? match.clocks.map((ms, s) => {
    if (match.status !== 'active' || !match.clockRunning || players[s]?.userId !== match.turnUserId) return ms;
    return Math.max(0, ms - Math.max(0, now + offset.current - match.turnStartedAt - CLOCK_LAG_MS));
  }) : null;
  const showTurnTimer = !(chessClock && match.clockRunning);
  const canClaim = match.status === 'active' && seat !== null && !imOut && !myTurn && left !== null && left <= 0 && !flagFell;
  const invitedMe = match.status === 'open' && match.invited?.userId === user?.userId;
  const canAccept = match.status === 'open' && seat === null && players.length < seats && (!match.invited || invitedMe);
  const turnName = players.find(p => p.userId === match.turnUserId)?.displayName ?? 'Someone';
  const playerName = s => (s === seat ? 'You' : players[s]?.displayName ?? 'Someone');
  const gamesLink = `/groups/${encodeURIComponent(match.groupId)}?tab=games`;
  const finished = match.status === 'finished' && !revealing;
  const ended = finished || match.status === 'cancelled' || match.status === 'declined';
  const result = finished ? outcome(match, seat, players) : null;
  const won = result?.kind === 'win';

  return (
    <div className="flex flex-col gap-4 pb-8 max-w-xl mx-auto w-full">
      <Link to={gamesLink}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] w-fit">
        <ArrowLeft size={16} /> Back to games
      </Link>

      {showCard && result && <ResultCard result={result} gamesLink={gamesLink} onClose={() => setShowCard(false)} />}

      <section className={`card relative overflow-hidden flex flex-col gap-3 ${won ? 'game-result-win' : ''}`}>
        {won && !showCard && <Confetti />}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={gameTile(match.game)}>
            <Icon size={20} className="text-white" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--text-primary)] leading-tight">{info?.name ?? match.game}</h1>
            {match.time && <p className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Timer size={12} aria-hidden="true" /> {timeLabel(match.time)}</p>}
          </div>
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
            {left !== null && showTurnTimer && (
              <span className="tabular-nums font-normal text-[var(--text-muted)]">
                · {left > 0 ? `${chessClock ? 'first move ' : ''}${clock(left)}` : 'time\'s up'}
              </span>
            )}
          </p>
        )}
        {match.status === 'finished' && revealing && (
          <p className="text-center text-sm font-semibold text-[var(--text-secondary)] animate-pulse" aria-live="polite">And the result is…</p>
        )}
        {ended && (
          <div className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-4 text-center ${won ? 'bg-amber-400/10 border border-amber-400/40' : 'bg-[var(--bg-elevated)] border border-[var(--border)]'}`} role="status">
            {result ? (
              <>
                <p className={`flex items-center gap-2 font-extrabold text-[var(--text-primary)] ${won ? 'text-2xl' : 'text-xl'}`}>
                  <Trophy size={won ? 26 : 20} className={won ? 'text-amber-300 game-trophy' : 'text-[var(--text-muted)]'} aria-hidden="true" />
                  {result.title}
                </p>
                {result.line && <p className="text-sm text-[var(--text-secondary)]">{result.line}</p>}
                <AuraChange amount={result.aura} animate={false} />
              </>
            ) : (
              <p className="text-base font-bold text-[var(--text-primary)]">{resultText(match, seat, players)}</p>
            )}
            <Link to={gamesLink} className="btn-primary mt-1">Back to games</Link>
          </div>
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
          <Board view={view} seat={seat} players={players} busy={busy} myTurn={myTurn} clocks={clocks}
            live={match.status === 'active'} move={m => run(() => api.gameMove(match.matchId, m))} />
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
