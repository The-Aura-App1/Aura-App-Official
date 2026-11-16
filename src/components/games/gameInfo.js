import { CircleDot, Spade, Fish, Disc, Dice5, Coins } from 'lucide-react';

// The group games, in the order they're offered (skill games first). The ids
// match GAMES in backend/lambdas/aura-aura/gameRules.mjs, and maxPlayers its
// MAX_PLAYERS (a test keeps them equal). Games without maxPlayers are two-player.
export const GAME_LIST = [
  { id: 'connect4', name: 'Connect 4',    Icon: CircleDot, kind: 'Skill', blurb: 'Drop discs and line up four in a row.', tint: ['#7c3aed', '#312e81'] },
  { id: 'pool',     name: '8-Ball Pool',  Icon: Disc,      kind: 'Skill', blurb: 'Aim, set your power, sink your group, then the 8.', tint: ['#0f766e', '#134e4a'] },
  { id: 'poker',    name: 'Poker',        Icon: Spade,     kind: 'Skill', blurb: 'Texas Hold\'em for 2 to 6. Win every chip.', maxPlayers: 6, tint: ['#047857', '#3b1f3f'] },
  { id: 'gofish',   name: 'Go Fish',      Icon: Fish,      kind: 'Skill', blurb: 'Ask for ranks and collect books of four. 2 to 5 players.', maxPlayers: 5, tint: ['#0369a1', '#0c4a6e'] },
  { id: 'dice',     name: 'Dice Duel',    Icon: Dice5,     kind: 'Luck',  blurb: 'Two dice each, first to two rounds. 2 to 6 players.', maxPlayers: 6, tint: ['#be123c', '#4c0519'] },
  { id: 'coinflip', name: 'Flip a Coin',  Icon: Coins,     kind: 'Luck',  blurb: 'Call it. One flip settles it.', tint: ['#d97706', '#78350f'] },
];

export const GAME_BY_ID = Object.fromEntries(GAME_LIST.map(g => [g.id, g]));

// The tile behind a game's icon, in the colors of its table
export function gameTile(game) {
  const [a, b] = GAME_BY_ID[game]?.tint ?? ['var(--brand-1)', 'var(--brand-3)'];
  return { background: `linear-gradient(140deg, ${a}, ${b})`, boxShadow: `0 6px 16px -8px ${a}` };
}

// Most aura one game can be for (and per day in stakes); keep in sync with STAKE_CAP in games.mjs
export const STAKE_CAP = { regular: 500, premium: 2000 };

export const TURN_SECONDS = 120;

export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const seatsOf = match => match.seats ?? 2;

// A log line's text, with "{o}" standing for the other player it names
export function logText(entry, name) {
  return entry.o !== undefined && entry.o !== null ? entry.t.replace('{o}', name(entry.o)) : entry.t;
}

export function statusText(match, viewerId) {
  const me = match.players.findIndex(p => p.userId === viewerId);
  const seats = seatsOf(match);
  if (match.status === 'open') {
    if (match.invited) return match.invited.userId === viewerId ? 'Challenged you' : `Waiting for @${match.invited.username}`;
    if (seats > 2) return `${match.players.length} of ${seats} seated`;
    return me === 0 ? 'Waiting for someone to accept' : 'Open challenge';
  }
  if (match.status === 'active') {
    if (me === -1) return 'In play';
    if (match.outUserIds?.includes(viewerId)) return 'You\'re out';
    if (match.turnUserId === viewerId) return 'Your turn';
    if (seats > 2) return `${match.players.find(p => p.userId === match.turnUserId)?.displayName ?? 'Someone'}'s turn`;
    return 'Their turn';
  }
  if (match.status === 'cancelled') return 'Withdrawn';
  if (match.status === 'declined') return 'Declined';
  if (match.winnerUserIds?.length > 1) return match.winnerUserIds.includes(viewerId) ? 'You split the pot' : 'Split pot';
  if (!match.winnerUserId) return 'Draw';
  const winner = match.players.find(p => p.userId === match.winnerUserId);
  if (me !== -1) return match.winnerUserId === viewerId ? 'You won' : 'You lost';
  return `${winner?.displayName ?? 'Someone'} won`;
}
