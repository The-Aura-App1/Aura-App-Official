import { CircleDot, Spade, Fish, Club, Dice5, Coins } from 'lucide-react';

// The group games, in the order they're offered (skill games first). The ids
// match GAMES in backend/lambdas/aura-aura/gameRules.mjs (a test keeps them equal).
export const GAME_LIST = [
  { id: 'connect4', name: 'Connect 4',    Icon: CircleDot, kind: 'Skill', blurb: 'Drop discs and line up four in a row.' },
  { id: 'poker',    name: 'Poker',        Icon: Spade,     kind: 'Skill', blurb: 'Heads-up Texas Hold\'em. Win every chip.' },
  { id: 'crazy8s',  name: 'Crazy Eights', Icon: Club,      kind: 'Skill', blurb: 'Match the suit or rank. Eights are wild.' },
  { id: 'gofish',   name: 'Go Fish',      Icon: Fish,      kind: 'Skill', blurb: 'Ask for ranks and collect books of four.' },
  { id: 'dice',     name: 'Dice Duel',    Icon: Dice5,     kind: 'Luck',  blurb: 'Two dice each, best of three rounds.' },
  { id: 'coinflip', name: 'Flip a Coin',  Icon: Coins,     kind: 'Luck',  blurb: 'Call it. One flip settles it.' },
];

export const GAME_BY_ID = Object.fromEntries(GAME_LIST.map(g => [g.id, g]));

// Most aura one game can be for (and per day in stakes); keep in sync with STAKE_CAP in games.mjs
export const STAKE_CAP = { regular: 500, premium: 2000 };

export const TURN_SECONDS = 120;

export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function statusText(match, viewerId) {
  const me = match.players.findIndex(p => p.userId === viewerId);
  if (match.status === 'open') {
    if (match.invited) return match.invited.userId === viewerId ? 'Challenged you' : `Waiting for @${match.invited.username}`;
    return me === 0 ? 'Waiting for someone to accept' : 'Open challenge';
  }
  if (match.status === 'active') {
    if (me === -1) return 'In play';
    return match.turnUserId === viewerId ? 'Your turn' : 'Their turn';
  }
  if (match.status === 'cancelled') return 'Withdrawn';
  if (match.status === 'declined') return 'Declined';
  if (!match.winnerUserId) return 'Draw';
  const winner = match.players.find(p => p.userId === match.winnerUserId);
  if (me !== -1) return match.winnerUserId === viewerId ? 'You won' : 'You lost';
  return `${winner?.displayName ?? 'Someone'} won`;
}
