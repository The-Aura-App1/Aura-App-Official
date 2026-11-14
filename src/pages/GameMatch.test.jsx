import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GameMatch from './GameMatch';
import GroupGames from '../components/games/GroupGames';
import { api } from '../api';

jest.mock('../api', () => ({ api: {
  getGame: jest.fn(), gameMove: jest.fn(), gameAction: jest.fn(), getGroupGames: jest.fn(), createGame: jest.fn(),
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
  expect(screen.getByRole('status')).toHaveTextContent('You won on time! +100 aura');
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
  expect(api.createGame).toHaveBeenCalledWith('g1', { game: 'poker', stake: 100, opponent: '@ann', options: undefined });
  expect(screen.getByText(/Waiting for someone in the group to accept/)).toBeInTheDocument();
});
