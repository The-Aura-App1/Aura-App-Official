import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Hearth from './Hearth';
import RainBanner from './RainBanner';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { getGroupPosts: jest.fn(), spotlightPost: jest.fn(), startRain: jest.fn(), catchRain: jest.fn() } }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'me' }, dbProfile: { auraSpendable: 800 }, refreshUser: jest.fn() }) }));

const status = (extra = {}) => ({
  enabled: true,
  level: { level: 2, xp: 160, floor: 100, next: 300 },
  spotlight: null, rain: null, lastRain: null,
  board: { week: '2026-W46', top: [
    { rank: 1, userId: 'ann', username: 'ann', displayName: 'Ann', given: 120 },
    { rank: 2, userId: 'me', username: 'me_here', displayName: 'Me', given: 40 },
  ], me: { given: 40, rank: 2 } },
  ...extra,
});

function renderHearth(data) {
  const reload = jest.fn();
  render(<MemoryRouter><Hearth groupId="g1" powerUps={{ data, error: '', reload }} /></MemoryRouter>);
  return reload;
}

test('shows the level, progress and the weekly board', async () => {
  api.getGroupPosts.mockResolvedValue({ posts: [] });
  renderHearth(status());
  await act(async () => {});
  expect(screen.getByText('160 XP')).toBeInTheDocument();
  expect(screen.getByText(/140 to level 3/)).toBeInTheDocument();
  expect(screen.getByText('Ann')).toBeInTheDocument();
  expect(screen.getByText('You')).toBeInTheDocument();
  expect(screen.getByText(/Post something in the group first/)).toBeInTheDocument();
});

test('starting a rain sends the chosen pot', async () => {
  api.getGroupPosts.mockResolvedValue({ posts: [] });
  api.startRain.mockResolvedValue({ message: "It's raining 500 aura on the group!" });
  window.confirm = jest.fn(() => true);
  const reload = renderHearth(status());
  fireEvent.click(screen.getByRole('button', { name: '500' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /make it rain/i })); });
  expect(api.startRain).toHaveBeenCalledWith('g1', 500);
  expect(reload).toHaveBeenCalled();
});

test('you can spotlight one of your own group posts', async () => {
  api.getGroupPosts.mockResolvedValue({ posts: [{ postId: 'p1', authorId: 'me', caption: 'My trail photo', type: 'text' }, { postId: 'p2', authorId: 'ann', caption: 'not mine' }] });
  api.spotlightPost.mockResolvedValue({ message: 'Your post is in the Spotlight for 24 hours.' });
  window.confirm = jest.fn(() => true);
  renderHearth(status());
  await act(async () => {});
  expect(screen.queryByText('not mine')).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Spotlight' })); });
  expect(api.spotlightPost).toHaveBeenCalledWith('g1', 'p1');
});

test('the rain banner catches a share and shows it', async () => {
  api.catchRain.mockResolvedValue({ amount: 37 });
  const rain = { rainId: 'r1', pot: 500, remaining: 420, share: 50, endsAt: Date.now() + 300000, byUsername: 'ann', catches: 3, caught: null, eligible: true };
  render(<RainBanner groupId="g1" rain={rain} serverNow={Date.now} />);
  expect(screen.getByText('Aura Rain from @ann')).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Catch' })); });
  expect(api.catchRain).toHaveBeenCalledWith('g1');
  expect(screen.getByText('+37 caught')).toBeInTheDocument();
});

test('a new member is told why they can\'t catch yet', () => {
  const rain = { rainId: 'r1', pot: 500, remaining: 420, share: 50, endsAt: Date.now() + 300000, byUsername: 'ann', catches: 0, caught: null, eligible: "You can catch aura once you've been in the group 3 days." };
  render(<RainBanner groupId="g1" rain={rain} serverNow={Date.now} />);
  expect(screen.queryByRole('button', { name: 'Catch' })).not.toBeInTheDocument();
  expect(screen.getByText(/in the group 3 days/)).toBeInTheDocument();
});
