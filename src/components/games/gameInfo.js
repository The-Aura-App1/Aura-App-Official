import { CircleDot, Spade, Fish, Disc, Dice5, Coins, Crown, Club, Flag } from 'lucide-react';

// The group games, in the order they're offered (skill games first). The ids
// match GAMES in backend/lambdas/aura-aura/gameRules.mjs, and maxPlayers its
// MAX_PLAYERS (a test keeps them equal). Games without maxPlayers are two-player.
export const GAME_LIST = [
  { id: 'connect4', name: 'Connect 4',    Icon: CircleDot, kind: 'Skill', blurb: 'Drop discs and line up four in a row.', tint: ['#7c3aed', '#312e81'] },
  { id: 'pool',     name: '8-Ball Pool',  Icon: Disc,      kind: 'Skill', blurb: 'Aim, set your power, sink your group, then the 8.', tint: ['#0f766e', '#134e4a'] },
  { id: 'chess',    name: 'Chess',        Icon: Crown,     kind: 'Skill', blurb: 'The classic. Checkmate their king.', tint: ['#92400e', '#3b2414'] },
  { id: 'golf',     name: 'Mini Golf',    Icon: Flag,      kind: 'Skill', blurb: 'A new random course every game. 2 to 4 players.', maxPlayers: 4, tint: ['#15803d', '#14532d'] },
  { id: 'poker',    name: 'Poker',        Icon: Spade,     kind: 'Skill', blurb: 'Texas Hold\'em for 2 to 6. Win every chip.', maxPlayers: 6, tint: ['#047857', '#3b1f3f'] },
  { id: 'gofish',   name: 'Go Fish',      Icon: Fish,      kind: 'Skill', blurb: 'Ask for ranks and collect books of four. 2 to 5 players.', maxPlayers: 5, tint: ['#0369a1', '#0c4a6e'] },
  { id: 'crazy8',   name: 'Crazy 8',      Icon: Club,      kind: 'Skill', blurb: 'Match suit or rank; 8s are wild. 2 to 4 players.', maxPlayers: 4, tint: ['#1d4ed8', '#172554'] },
  { id: 'dice',     name: 'Dice Duel',    Icon: Dice5,     kind: 'Luck',  blurb: 'Two dice each, first to two rounds. 2 to 6 players.', maxPlayers: 6, tint: ['#be123c', '#4c0519'] },
  { id: 'coinflip', name: 'Flip a Coin',  Icon: Coins,     kind: 'Luck',  blurb: 'Call it. One flip settles it.', tint: ['#d97706', '#78350f'] },
];

export const GAME_BY_ID = Object.fromEntries(GAME_LIST.map(g => [g.id, g]));

// Games you can play against a bot, and its levels; ids match BOT_GAMES,
// BOT_LEVELS and BOT_NAMES in aura-aura/bots.mjs (a test keeps them equal)
export const BOT_GAMES = ['connect4', 'pool', 'chess', 'gofish', 'crazy8', 'poker', 'golf'];
export const BOT_LEVELS = [
  { id: 'easy',   label: 'Easy',   name: 'Pip',   hint: 'learning' },
  { id: 'medium', label: 'Medium', name: 'Nova',  hint: 'a fair game' },
  { id: 'hard',   label: 'Hard',   name: 'Atlas', hint: 'plays to win' },
];

// The tile behind a game's icon, in the colors of its table
export function gameTile(game) {
  const [a, b] = GAME_BY_ID[game]?.tint ?? ['var(--brand-1)', 'var(--brand-3)'];
  return { background: `linear-gradient(140deg, ${a}, ${b})`, boxShadow: `0 6px 16px -8px ${a}` };
}

// Most aura one game can be for (and per day in stakes); keep in sync with STAKE_CAP in games.mjs
export const STAKE_CAP = { regular: 500, premium: 2000 };

export const TURN_SECONDS = 120;

// Time limits to pick from when setting up a game; ids and kinds match
// TIME_CHOICES in gameRules.mjs (a test keeps them equal). Chess clocks are
// chess only. CLOCK_LAG_MS matches the server's: each turn's first half
// second isn't charged.
export const TIME_CHOICES = [
  { id: 'm30',    kind: 'move',  label: '30 sec', note: 'a move' },
  { id: 'm60',    kind: 'move',  label: '1 min',  note: 'a move' },
  { id: 'm120',   kind: 'move',  label: '2 min',  note: 'a move' },
  { id: 'm300',   kind: 'move',  label: '5 min',  note: 'a move' },
  { id: 'm900',   kind: 'move',  label: '15 min', note: 'a move' },
  { id: 'c1+0',   kind: 'clock', label: '1 min',  note: 'Bullet',   base: 60000,  inc: 0 },
  { id: 'c3+0',   kind: 'clock', label: '3 min',  note: 'Blitz',    base: 180000, inc: 0 },
  { id: 'c3+2',   kind: 'clock', label: '3 | 2',  note: 'Blitz',    base: 180000, inc: 2000 },
  { id: 'c5+0',   kind: 'clock', label: '5 min',  note: 'Blitz',    base: 300000, inc: 0 },
  { id: 'c10+0',  kind: 'clock', label: '10 min', note: 'Rapid',    base: 600000, inc: 0 },
  { id: 'c15+10', kind: 'clock', label: '15 | 10', note: 'Rapid',   base: 900000, inc: 10000 },
];
export const TIME_BY_ID = Object.fromEntries(TIME_CHOICES.map(t => [t.id, t]));
export const CLOCK_GAMES = ['chess'];
export const defaultTime = game => (CLOCK_GAMES.includes(game) ? 'c10+0' : 'm120');
export const CLOCK_LAG_MS = 500;

// A short name for a match's time limit: "3 | 2" or "1 min a move"
export function timeLabel(id) {
  const t = TIME_BY_ID[id];
  if (!t) return '2 min a move';
  return t.kind === 'clock' ? `${t.note} ${t.label}` : `${t.label} a move`;
}

export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// A chess clock's face: tenths under 10 seconds, like a real one
export function clockFace(ms) {
  if (ms > 0 && ms < 10000) return `0:0${(Math.floor(ms / 100) / 10).toFixed(1)}`;
  return clock(ms);
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
