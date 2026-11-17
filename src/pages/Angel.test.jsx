import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Angel from './Angel';
import { api } from '../api';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({
  user: { userId: 'me' }, refreshUser: jest.fn(), logout: jest.fn(),
  dbProfile: { userId: 'me', username: 'me', today: { freeGive: { used: 0, limit: 50 }, walletGive: { used: 0, limit: 500 }, take: { used: 0, limit: 250 } } },
}) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ themeId: 'night', refreshCustom: jest.fn(), skyDetails: true, setSkyDetails: jest.fn() }) }));
jest.mock('../hooks/useChooseTheme', () => () => jest.fn());
jest.mock('../utils/embedClient', () => ({ embedTexts: () => Promise.resolve(null), warmUpModel: () => new Promise(() => {}) }));
jest.mock('../api', () => ({ api: {
  getFeed: jest.fn(), getPost: jest.fn(), getUser: jest.fn(), getNotifications: jest.fn(), getMyGroups: jest.fn(), listGroups: jest.fn(),
  getLikedPosts: jest.fn(), getGroupPosts: jest.fn(), giveAura: jest.fn(), createPost: jest.fn(),
} }));

beforeEach(() => {
  localStorage.clear();
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  api.getPost.mockResolvedValue({ postId: 'sunset123', authorId: 'bob', authorUsername: 'bob', caption: 'Sunset over the harbour' });
  api.giveAura.mockResolvedValue({});
  api.createPost.mockResolvedValue({ post: { postId: 'new1' } });
});

async function tell(text) {
  fireEvent.change(screen.getByLabelText('Message Angel'), { target: { value: text } });
  await act(async () => { fireEvent.submit(screen.getByLabelText('Message Angel').closest('form')); });
}

test('aura is only given after the tap, with the exact amount and post', async () => {
  render(<MemoryRouter><Angel /></MemoryRouter>);
  await tell('give 12 aura to https://aura.app/post/sunset123');
  expect(screen.getByText(/Give 12 aura to @bob's post "Sunset over the harbour"\?/)).toBeInTheDocument();
  expect(api.giveAura).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Give 12 aura' })); });
  expect(api.giveAura).toHaveBeenCalledWith('sunset123', 12);
  expect(screen.getByText(/Gave 12 aura to @bob's post/)).toBeInTheDocument();
  // the same account again in this chat: no second card
  await tell('give 5 aura to https://aura.app/post/sunset123');
  expect(screen.getByText(/already given aura to @bob/)).toBeInTheDocument();
});

test('a post in their own words shows the exact words, and posts on yes', async () => {
  render(<MemoryRouter><Angel /></MemoryRouter>);
  await tell('post "Home again. #travel"');
  expect(screen.getByText('Home again. #travel', { selector: 'blockquote' })).toBeInTheDocument();
  await tell('yes');
  expect(api.createPost).toHaveBeenCalledWith({ type: 'text', caption: 'Home again. #travel', mediaKeys: [], tags: [], hashtags: ['travel'] });
});

test('with changes off in Settings, nothing is offered', async () => {
  localStorage.setItem('aura-angel-changes', 'off');
  render(<MemoryRouter><Angel /></MemoryRouter>);
  await tell('give 12 aura to https://aura.app/post/sunset123');
  expect(screen.queryByRole('button', { name: 'Give 12 aura' })).toBeNull();
  expect(screen.getByText(/Let Angel make changes/)).toBeInTheDocument();
});
