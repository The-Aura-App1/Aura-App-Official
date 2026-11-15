import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SafetyActions, { useBlockedAuthor } from './SafetyActions';
import { announceBlocked } from '../../utils/reportReasons';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { reportPost: jest.fn(), reportComment: jest.fn(), reportUser: jest.fn(), blockUser: jest.fn() } }));

function Card({ authorId }) {
  const blocked = useBlockedAuthor(authorId);
  return blocked ? null : <p>post by {authorId}</p>;
}

test('reporting a post asks why and sends the reason', async () => {
  api.reportPost.mockResolvedValue({ message: 'Post reported.' });
  const onNotice = jest.fn();
  render(<SafetyActions kind="post" targetId="p1" username="ann" userId="u-ann" onNotice={onNotice} />);
  fireEvent.click(screen.getByRole('button', { name: 'Report post' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hate speech or symbols' }));
  await act(async () => {});
  expect(api.reportPost).toHaveBeenCalledWith('p1', 'hate');
  expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/moderator will take a look/));
});

test('reporting an account goes by username', async () => {
  api.reportUser.mockResolvedValue({});
  render(<SafetyActions kind="user" username="bob" userId="u-bob" />);
  fireEvent.click(screen.getByRole('button', { name: 'Report account' }));
  fireEvent.click(screen.getByRole('button', { name: 'Spam or scam' }));
  await act(async () => {});
  expect(api.reportUser).toHaveBeenCalledWith('bob', 'spam');
});

test('blocking asks first, then hides that account everywhere on the page', async () => {
  api.blockUser.mockResolvedValue({ blocked: true });
  render(<>
    <SafetyActions kind="comment" targetId="c1" username="cat" userId="u-cat" />
    <Card authorId="u-cat" />
    <Card authorId="u-dan" />
  </>);
  expect(screen.getByText('post by u-cat')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Block @cat' }));
  expect(screen.getByText('Block @cat?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Block' }));
  await act(async () => {});
  expect(api.blockUser).toHaveBeenCalledWith('cat');
  expect(screen.queryByText('post by u-cat')).not.toBeInTheDocument();
  expect(screen.getByText('post by u-dan')).toBeInTheDocument();
});

test('a block announced elsewhere hides matching cards', () => {
  render(<Card authorId="u-eve" />);
  act(() => announceBlocked('u-eve'));
  expect(screen.queryByText('post by u-eve')).not.toBeInTheDocument();
});
