import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GameMatch from './GameMatch';
import GroupGames from '../components/games/GroupGames';
import { api } from '../api';

jest.mock('../api', () => ({ api: {
  getGame: jest.fn(), gameMove: jest.fn(), gameAction: jest.fn(), getGroupGames: jest.fn(), createGame: jest.fn(),
  getGameChampions: jest.fn(),
} }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'me' }, dbProfile: { auraSpendable: 300, auraEarned: 0 } }) }));

const players = [
  { userId: 'me', username: 'me_here', displayName: 'Me' },
  { userId: 'ann', username: 'ann', displayName: 'Ann' },
];
const base = { matchId: 'm1', groupId: 'g1', game: 'connect4', stake: 50, players, invited: null, createdAt: '2026-11-13T00:00:00Z' };
const c4 = (cols, extra = {}) => ({ cols, turn: 0, last: null, line: null, log: [], over: false, winner: null, draw: false, ...extra });

async function open(path = '/games/m1') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/games/:matchId" element={<GameMatch />} />
        <Route path="/groups/:groupId" element={<GroupGames groupId="g1" />} />
      </Routes>
    </MemoryRouter>,
  );
  await act(async () => {});
}

test('on your turn, tapping a column sends the move and shows the new board', async () => {
  api.getGame.mockResolvedValue({ match: { ...base, status: 'active', turnUserId: 'me', deadline: Date.now() + 90000 }, seat: 0, view: c4([[], [], [], [], [], [], []]), now: Date.now() });
  api.gameMove.mockResolvedValue({ match: { ...base, status: 'active', turnUserId: 'ann', deadline: Date.now() + 120000 }, seat: 0, view: c4([[], [], [], [0], [], [], []], { turn: 1, last: [3, 0] }), now: Date.now() });
  await open();
  expect(screen.getByText('Your turn')).toBeInTheDocument();
  expect(screen.getByText(/1:(29|30)/)).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Drop in column 4' })); });
  expect(api.gameMove).toHaveBeenCalledWith('m1', { col: 3 });
  expect(screen.getByText('Their turn')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Drop in column 1' })).toBeDisabled();
});

test('when their timer runs out you can claim the win, and the result shows the pot', async () => {
  api.getGame.mockResolvedValue({ match: { ...base, status: 'active', turnUserId: 'ann', deadline: Date.now() - 1000 }, seat: 0, view: c4([[], [], [], [], [], [], []], { turn: 1 }), now: Date.now() });
  api.gameAction.mockResolvedValue({ match: { ...base, status: 'finished', winnerUserId: 'me', endReason: 'timeout' }, seat: 0, view: c4([[], [], [], [], [], [], []], { turn: null, over: true, winner: 0 }), now: Date.now() });
  await open();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /claim the win/i })); });
  expect(api.gameAction).toHaveBeenCalledWith('m1', 'claim');
  // the result waits a moment for the last move to play out, then shows big
  expect(screen.getByText('And the result is…')).toBeInTheDocument();
  await act(async () => { await new Promise(r => setTimeout(r, 950)); });
  const card = screen.getByRole('dialog', { name: 'You won!' });
  expect(card).toHaveTextContent('You won on time.');
  expect(screen.getAllByRole('link', { name: 'Back to games' }).map(a => a.getAttribute('href'))).toContain('/groups/g1?tab=games');
  fireEvent.click(screen.getByRole('button', { name: 'See the board' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('You won!');
  expect(screen.getByRole('status')).toHaveTextContent('+100 aura');
});

test('opening a game that already ended shows the result and the way back, without the big card', async () => {
  api.getGame.mockResolvedValue({ match: { ...base, status: 'finished', winnerUserId: 'ann', endReason: 'game' }, seat: 0, view: c4([[], [], [], [], [], [], []], { turn: null, over: true, winner: 1 }), now: Date.now() });
  await open();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Ann won');
  expect(screen.getByRole('status')).toHaveTextContent('−50 aura');
  // one at the top, and a big one with the result
  expect(screen.getAllByRole('link', { name: 'Back to games' })).toHaveLength(2);
});

test('resigning asks first', async () => {
  api.getGame.mockResolvedValue({ match: { ...base, status: 'active', turnUserId: 'me', deadline: Date.now() + 60000 }, seat: 0, view: c4([[], [], [], [], [], [], []]), now: Date.now() });
  await open();
  fireEvent.click(screen.getByRole('button', { name: /resign/i }));
  expect(api.gameAction).not.toHaveBeenCalled();
  expect(screen.getByText('Resign and give them the win?')).toBeInTheDocument();
});

test('an open challenge to you can be accepted or declined', async () => {
  api.getGame.mockResolvedValue({ match: { ...base, game: 'coinflip', options: { call: 'tails' }, status: 'open', players: [players[1]], invited: { userId: 'me', username: 'me_here' } }, seat: null, view: null, now: Date.now() });
  await open();
  expect(screen.getByText(/Ann challenged you to Flip a Coin\. Accepting puts in 50 aura; the winner takes 100\. They called tails\./)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Accept' })); });
  expect(api.gameAction).toHaveBeenCalledWith('m1', 'join');
});

test('cards you hold are shown to you; a poker opponent\'s are not', async () => {
  api.getGame.mockResolvedValue({
    match: { ...base, game: 'poker', status: 'active', turnUserId: 'me', deadline: Date.now() + 60000 }, seat: 0, now: Date.now(),
    view: {
      chips: [990, 980], bets: [10, 20], pot: 0, board: [], street: 'preflop', button: 0, blinds: [10, 20], hand: 1,
      hole: ['As', 'Kd'], last: null, log: [], turn: 0, over: false, winner: null, draw: false,
      options: { toCall: 10, canCheck: false, canFold: true, canRaise: true, minRaiseTo: 40, maxRaiseTo: 1000 },
    },
  });
  await open();
  expect(screen.getByRole('img', { name: 'Ace of spades' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Call 10' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Raise to 40' })).toBeInTheDocument();
});

test('the Games tab sends a challenge with the chosen game, stake and opponent', async () => {
  api.getGroupGames.mockResolvedValue({ games: [
    { ...base, matchId: 'o1', status: 'open', players: [players[1]], game: 'dice', stake: 0 },
  ] });
  api.createGame.mockResolvedValue({ match: { matchId: 'new1' } });
  api.getGame.mockResolvedValue({ match: { ...base, matchId: 'new1', status: 'open', players: [players[0]] }, seat: 0, view: null, now: Date.now() });
  await open('/groups/g1');
  expect(screen.getByText('Open challenges')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /challenge someone/i }));
  fireEvent.click(screen.getByLabelText(/Poker/));
  fireEvent.click(screen.getByRole('button', { name: '100' }));
  fireEvent.change(screen.getByLabelText(/Opponent/), { target: { value: '@ann' } });
  expect(screen.getByText(/You both put in 100\. The winner takes all 200/)).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /send challenge/i })); });
  expect(api.createGame).toHaveBeenCalledWith('g1', { game: 'poker', stake: 100, seats: 2, opponent: '@ann', options: undefined, time: 'm120' });
  expect(screen.getByText(/Waiting for someone in the group to accept/)).toBeInTheDocument();
});

test('a bigger table: pick the number of players, and no single opponent', async () => {
  api.getGroupGames.mockResolvedValue({ games: [] });
  api.createGame.mockResolvedValue({ match: { matchId: 'big1' } });
  api.getGame.mockResolvedValue({ match: { ...base, matchId: 'big1', game: 'dice', seats: 4, status: 'open', players: [players[0]] }, seat: 0, view: null, now: Date.now() });
  await open('/groups/g1');
  fireEvent.click(screen.getByRole('button', { name: /challenge someone/i }));
  fireEvent.click(screen.getByLabelText(/Connect 4/));
  expect(screen.queryByRole('button', { name: '4' })).not.toBeInTheDocument();   // two-player only
  fireEvent.click(screen.getByLabelText(/Dice Duel/));
  fireEvent.click(screen.getByRole('button', { name: '4' }));
  fireEvent.click(screen.getByRole('button', { name: '50' }));
  expect(screen.queryByLabelText(/Opponent/)).not.toBeInTheDocument();
  expect(screen.getByText(/Everyone puts in 50\. The winner takes it all \(200 with a full table\)/)).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open a table for 4' })); });
  expect(api.createGame).toHaveBeenCalledWith('g1', { game: 'dice', stake: 50, seats: 4, opponent: undefined, options: undefined, time: 'm120' });
  // the table page: one seat taken, so it can't start yet
  expect(screen.getByText(/1 of 4 seated/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start with 1' })).toBeDisabled();
  expect(screen.getAllByText('Open seat')).toHaveLength(3);
});

test('the player who opened a table can start it once someone joins; others can leave', async () => {
  const three = [...players, { userId: 'bo', username: 'bo', displayName: 'Bo' }];
  api.getGame.mockResolvedValue({ match: { ...base, game: 'gofish', seats: 4, status: 'open', players: three }, seat: 0, view: null, now: Date.now() });
  await open();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start with 3' })); });
  expect(api.gameAction).toHaveBeenCalledWith('m1', 'start');
  api.getGame.mockResolvedValue({ match: { ...base, game: 'gofish', seats: 4, status: 'open', players: [three[1], players[0]] }, seat: 1, view: null, now: Date.now() });
  await open();
  expect(screen.getByText(/You're in\. Waiting for Ann to start/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Leave table' })).toBeInTheDocument();
});

test('a three-way Go Fish: you pick who to ask, and players who left are out', async () => {
  const three = [...players, { userId: 'bo', username: 'bo', displayName: 'Bo' }];
  api.getGame.mockResolvedValue({
    match: { ...base, game: 'gofish', seats: 3, status: 'active', players: three, turnUserId: 'me', deadline: Date.now() + 90000, outUserIds: ['bo'] }, seat: 0, now: Date.now(),
    view: { n: 3, hand: ['5s', '5d', 'Kh'], handCounts: [3, 4, 0], books: [[], ['Q'], []], out: [false, false, true], deckCount: 30,
      askable: ['5', 'K'], log: [{ s: 1, t: 'asked {o} for jacks. Go fish!', o: 0 }], turn: 0, over: false, winner: null, draw: false },
  });
  await open();
  expect(screen.getByText(/Ann/, { selector: 'p span' }).parentElement).toHaveTextContent('Ann asked you for jacks. Go fish!');
  expect(screen.getByRole('radio', { name: /Ann/ })).toHaveAttribute('aria-checked', 'true');
  expect(screen.queryByRole('radio', { name: /Bo/ })).not.toBeInTheDocument();   // out
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ask Ann for 5s/ })); });
  expect(api.gameMove).toHaveBeenCalledWith('m1', { type: 'ask', rank: '5', from: 1 });
});

test('pool: you set the power and shoot; the next poll says which shot it already has', async () => {
  const balls = Array(16).fill(null);
  balls[0] = [500, 1750]; balls[1] = [500, 500]; balls[8] = [540, 460];
  const pool = extra => ({ balls, groups: [null, null], left: { solids: 1, stripes: 0 }, hand: false, kitchen: false, target: 'open', shots: 3,
    shot: { no: 3, by: 1, start: balls, frames: [[], []], potted: [], foul: null }, log: [], turn: 0, over: false, winner: null, draw: false, ...extra });
  api.getGame.mockResolvedValue({ match: { ...base, game: 'pool', status: 'active', turnUserId: 'me', deadline: Date.now() + 90000 }, seat: 0, view: pool(), now: Date.now() });
  api.gameMove.mockResolvedValue({ match: { ...base, game: 'pool', status: 'active', turnUserId: 'ann', deadline: Date.now() + 120000 }, seat: 0,
    view: pool({ turn: 1, shots: 4, shot: { no: 4, by: 0, start: balls, frames: [], potted: [], foul: null } }), now: Date.now() });
  await open();
  expect(api.getGame).toHaveBeenLastCalledWith('m1', null, null);
  expect(screen.getByText(/Open table: pot any ball but the 8/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Power'), { target: { value: '80' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Shoot' })); });
  expect(api.gameMove).toHaveBeenCalledWith('m1', { angle: expect.any(Number), power: 0.8 });
  expect(screen.queryByRole('button', { name: 'Shoot' })).not.toBeInTheDocument();
});

test('chess: tap a piece, then a square, to move', async () => {
  const start = 'RNBQKBNRPPPPPPPP' + '.'.repeat(32) + 'pppppppprnbqkbnr';
  api.getGame.mockResolvedValue({
    match: { ...base, game: 'chess', status: 'active', turnUserId: 'me', deadline: Date.now() + 90000 }, seat: 0, now: Date.now(),
    view: { board: start, side: 'w', white: 0, last: null, check: false, captured: { w: [], b: [] }, moves: 0, legal: ['e2e3', 'e2e4', 'g1f3'], log: [], turn: 0, over: false, winner: null, draw: false },
  });
  api.gameMove.mockClear();
  await open();
  fireEvent.click(screen.getByRole('gridcell', { name: 'e2, white pawn' }));
  expect(screen.getByRole('gridcell', { name: 'e2, white pawn' })).toHaveAttribute('aria-selected', 'true');
  await act(async () => { fireEvent.click(screen.getByRole('gridcell', { name: 'e4' })); });
  expect(api.gameMove).toHaveBeenCalledWith('m1', { from: 'e2', to: 'e4' });
});

test('chess: pick a clock when challenging', async () => {
  api.getGroupGames.mockResolvedValue({ games: [] });
  api.createGame.mockResolvedValue({ match: { matchId: 'ch1' } });
  api.getGame.mockResolvedValue({ match: { ...base, matchId: 'ch1', game: 'chess', status: 'open', players: [players[0]], time: 'c3+2' }, seat: 0, view: null, now: Date.now() });
  await open('/groups/g1');
  fireEvent.click(screen.getByRole('button', { name: /challenge someone/i }));
  fireEvent.click(screen.getByLabelText(/Chess/));
  expect(screen.getByText('Time control')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /3 \| 2/ }));
  expect(screen.getByText(/Each player has 3 minutes for the whole game, plus 2 seconds back after each move/)).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /send challenge/i })); });
  expect(api.createGame).toHaveBeenCalledWith('g1', expect.objectContaining({ game: 'chess', time: 'c3+2' }));
  expect(screen.getByText('Blitz 3 | 2')).toBeInTheDocument();
});

test('chess: clocks tick for the player on turn, and a premove plays when your turn comes', async () => {
  const start = 'RNBQKBNRPPPPPPPP' + '.'.repeat(32) + 'pppppppprnbqkbnr';
  const clockMatch = extra => ({ ...base, game: 'chess', status: 'active', time: 'c1+0', clockRunning: true, turnStartedAt: Date.now(), clocks: [42000, 61000], deadline: Date.now() + 61500, ...extra });
  const view = extra => ({ board: start, side: 'b', white: 0, last: null, check: false, captured: { w: [], b: [] }, moves: 2, legal: [], log: [], turn: 1, over: false, winner: null, draw: false, ...extra });
  api.getGame.mockResolvedValue({ version: 5, match: clockMatch({ turnUserId: 'ann' }), seat: 0, view: view(), now: Date.now() });
  api.gameMove.mockClear();
  api.gameMove.mockResolvedValue({ version: 7, match: clockMatch({ turnUserId: 'ann' }), seat: 0, view: view({ moves: 4 }), now: Date.now() });
  await open();
  expect(screen.getByRole('timer', { name: /Your clock: 0:42/ })).toBeInTheDocument();
  expect(screen.getByRole('timer', { name: /Ann's clock: 1:0[01]/ })).toBeInTheDocument();
  expect(screen.queryByText(/first move/)).not.toBeInTheDocument();
  // their move: queue e2-e4
  fireEvent.click(screen.getByRole('gridcell', { name: 'e2, white pawn' }));
  fireEvent.click(screen.getByRole('gridcell', { name: 'e4' }));
  expect(screen.getByRole('button', { name: /Premove e2–e4/ })).toBeInTheDocument();
  expect(api.gameMove).not.toHaveBeenCalled();
  // the next poll: they've moved, and it's legal, so it goes at once
  api.getGame.mockResolvedValue({ version: 6, match: clockMatch({ turnUserId: 'me' }), seat: 0, view: view({ side: 'w', turn: 0, moves: 3, legal: ['e2e4', 'd2d4'] }), now: Date.now() });
  await act(async () => { await new Promise(r => setTimeout(r, 900)); });
  expect(api.getGame).toHaveBeenCalledWith('m1', null, 5);
  expect(api.gameMove).toHaveBeenCalledWith('m1', { from: 'e2', to: 'e4' });
});

test('crazy 8: an 8 asks which suit comes next', async () => {
  api.getGame.mockResolvedValue({
    match: { ...base, game: 'crazy8', status: 'active', turnUserId: 'me', deadline: Date.now() + 90000 }, seat: 0, now: Date.now(),
    view: { n: 2, hand: ['8s', '3c'], handCounts: [2, 5], top: '5h', suit: 'h', deckCount: 30, out: [false, false], playable: ['8s'],
      canDraw: true, canPass: false, log: [], turn: 0, over: false, winner: null, draw: false },
  });
  api.gameMove.mockClear();
  await open();
  expect(screen.getByRole('button', { name: 'Play the 3 of clubs' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Play the 8 of spades' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'hearts' })); });
  expect(api.gameMove).toHaveBeenCalledWith('m1', { type: 'play', card: '8s', suit: 'h' });
});
