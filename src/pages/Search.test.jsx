import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Search from './Search';
import { api } from '../api';

jest.mock('../api', () => ({
  api: { getFeed: jest.fn(), getUser: jest.fn(), listGroups: jest.fn() },
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'me' } }) }));
jest.mock('../utils/embedClient', () => ({ embedTexts: () => Promise.reject(new Error('no model in tests')) }));
jest.mock('../components/post/PostCard', () => ({ post }) => <article>{post.caption}</article>);
jest.mock('../components/motion/Reveal', () => ({ children }) => <div>{children}</div>);

const posts = [
  { postId: '1', caption: 'Live jazz on the pier tonight', hashtags: ['LiveMusic'], tags: ['music'], hotScore: 1 },
  { postId: '2', caption: 'My sourdough finally rose', hashtags: ['baking'], tags: ['cooking'], hotScore: 2 },
  { postId: '3', caption: 'Jazz trio rehearsal', hashtags: ['LiveMusic'], tags: [], hotScore: 0 },
];

beforeEach(() => {
  jest.useFakeTimers();
  api.getFeed.mockResolvedValue({ posts });
  api.getUser.mockImplementation(name => (name === 'jazzcat'
    ? Promise.resolve({ username: 'jazzcat', displayName: 'Jazz Cat' })
    : Promise.reject(new Error('User not found.'))));
  api.listGroups.mockResolvedValue({ groups: [{ groupId: 'g1', name: 'Jazz Lovers', joinType: 'open', memberCount: 4 }] });
});
afterEach(() => jest.useRealTimers());

async function typeAndSettle(value) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value } });
  await act(async () => { jest.advanceTimersByTime(400); });
  await act(async () => {});
}

test('shows popular hashtags before anything is typed', async () => {
  render(<MemoryRouter><Search /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: '#LiveMusic' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '#baking' })).toBeInTheDocument();
});

test('finds posts, groups and people, best match first', async () => {
  render(<MemoryRouter><Search /></MemoryRouter>);
  await act(async () => {});
  await typeAndSettle('jazz');
  const found = screen.getAllByRole('article').map(a => a.textContent);
  expect(found).toEqual(['Live jazz on the pier tonight', 'Jazz trio rehearsal']);
  expect(screen.getByText('2 matches')).toBeInTheDocument();
  expect(screen.getByText('Jazz Lovers')).toBeInTheDocument();
  expect(api.listGroups).toHaveBeenLastCalledWith('jazz');

  await typeAndSettle('@jazzcat');
  expect(screen.getByText('Jazz Cat')).toBeInTheDocument();
  expect(api.getUser).toHaveBeenLastCalledWith('jazzcat');
});

test('says so when nothing matches, and the hashtag chips fill the box', async () => {
  render(<MemoryRouter><Search /></MemoryRouter>);
  await act(async () => {});
  await typeAndSettle('volcano');
  expect(screen.getByText('No posts match “volcano”')).toBeInTheDocument();

  await typeAndSettle('');
  fireEvent.click(screen.getByRole('button', { name: '#baking' }));
  await act(async () => { jest.advanceTimersByTime(400); });
  await act(async () => {});
  expect(screen.getAllByRole('article').map(a => a.textContent)).toEqual(['My sourdough finally rose']);
});
