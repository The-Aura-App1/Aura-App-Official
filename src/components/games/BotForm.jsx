import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X } from 'lucide-react';
import { api } from '../../api';
import { GAME_LIST, gameTile, BOT_GAMES, BOT_LEVELS } from './gameInfo';

// Play a bot for fun: any skill game (not the luck ones), easy to hard. No
// aura, no XP and no champions board; it starts straight away and only you
// see it in the group's list.
export default function BotForm({ groupId, onClose }) {
  const navigate = useNavigate();
  const [game, setGame] = useState('chess');
  const [level, setLevel] = useState('medium');
  const [holes, setHoles] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const games = GAME_LIST.filter(g => BOT_GAMES.includes(g.id));

  async function start(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.createGame(groupId, { game, bot: level, ...(game === 'golf' && { options: { holes } }) });
      navigate(`/games/${encodeURIComponent(result.match.matchId)}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={start} className="card flex flex-col gap-4" aria-label="Play a bot">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><Bot size={18} className="text-aura-400" /> Play a bot</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--text-muted)] mb-2">Game</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {games.map(({ id, name, Icon }) => (
            <label key={id} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-sm font-semibold text-[var(--text-primary)]
              ${game === id ? 'border-aura-500/60 bg-aura-500/10' : 'border-[var(--border)] hover:border-aura-500/30'}`}>
              <input type="radio" name="bot-game" value={id} checked={game === id} onChange={() => setGame(id)} className="sr-only" />
              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={gameTile(id)}><Icon size={15} className="text-white" aria-hidden="true" /></span>
              {name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--text-muted)] mb-2">Difficulty</legend>
        <div className="grid grid-cols-3 gap-2">
          {BOT_LEVELS.map(({ id, label, name, hint }) => (
            <button key={id} type="button" aria-pressed={level === id} onClick={() => setLevel(id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-center
                ${level === id ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{name} · {hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {game === 'golf' && (
        <fieldset>
          <legend className="text-xs font-semibold text-[var(--text-muted)] mb-2">Holes</legend>
          <div className="flex gap-2">
            {[3, 5, 9].map(h => (
              <button key={h} type="button" aria-pressed={holes === h} onClick={() => setHoles(h)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${holes === h ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                {h} holes
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-xs text-[var(--text-muted)]">Just for fun: no aura, and it doesn't count toward the group's level or champions. Dice and coin flips are pure luck, so there's no bot for them.</p>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary self-start"><Bot size={16} aria-hidden="true" /> {busy ? 'Starting…' : 'Start'}</button>
    </form>
  );
}
