import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Creator from './Creator';
import { api } from '../api';

let mockProfile;
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ dbProfile: mockProfile }) }));
jest.mock('../api', () => ({ api: { getMyPostStats: jest.fn(), getAuraHistory: jest.fn() } }));

const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
const posts = [
  { postId: 'p1', caption: 'Ridge at dawn', createdAt: recent, viewCount: 300, auraReceived: 90, likeCount: 12, commentCount: 4, reactions: { '🔥': 3 } },
  { postId: 'p2', caption: 'Lake day', createdAt: recent, viewCount: 120, auraReceived: 10, likeCount: 30, commentCount: 1 },
  { postId: 'p3', caption: 'Throwback', createdAt: old, viewCount: 900, auraReceived: 400, likeCount: 2, commentCount: 0, groupId: 'g' },
];

beforeEach(() => { jest.clearAllMocks(); api.getAuraHistory.mockReturnValue(new Promise(() => {})); mockProfile = { userId: 'me', isCreator: true, followerCount: 57, auraEarned: 1234, auraBalance: 2000 }; });

test('creators see totals for the period, their top post and every post', async () => {
  api.getMyPostStats.mockResolvedValue({ posts });
  render(<MemoryRouter><Creator /></MemoryRouter>);
  await act(async () => {});
  expect(api.getMyPostStats).toHaveBeenCalledWith('me');
  const overview = screen.getByRole('region', { name: 'Overview' });
  // last 30 days: p1 and p2
  expect(within(overview).getByText('420')).toBeInTheDocument();   // views
  expect(within(overview).getByText('100')).toBeInTheDocument();   // aura
  expect(within(overview).getByText('57')).toBeInTheDocument();    // followers
  expect(within(screen.getByRole('region', { name: 'Your top post' })).getByText('Ridge at dawn')).toBeInTheDocument();
  expect(screen.queryByText('Throwback')).toBeNull();
  // all time brings in the older group post, which becomes the top post
  fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
  expect(within(screen.getByRole('region', { name: 'Your top post' })).getByText('Throwback')).toBeInTheDocument();
  // sorting by likes puts Lake day first
  fireEvent.click(screen.getByRole('radio', { name: 'Likes' }));
  const rows = within(screen.getByRole('region', { name: 'Your posts' })).getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('Lake day');
  expect(rows[0].querySelector('a')).toHaveAttribute('href', '/post/p2');
});

test('everyone else sees what the page is, without loading anything', () => {
  mockProfile = { userId: 'me', isPremium: true };
  render(<MemoryRouter><Creator /></MemoryRouter>);
  expect(screen.getByText('For creator accounts')).toBeInTheDocument();
  expect(api.getMyPostStats).not.toHaveBeenCalled();
});
