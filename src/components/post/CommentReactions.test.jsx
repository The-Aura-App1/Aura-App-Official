import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Reactions from './Reactions';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { reactToComment: jest.fn(), reactToPost: jest.fn() } }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'me' }, dbProfile: {} }) }));
jest.mock('../groups/useMyGroups', () => () => []);

test('reacting on a comment goes to the comment route, normalized, with no group pins', async () => {
  api.reactToComment.mockResolvedValue({ reactions: { '❤️': 3 }, myReactions: ['❤️'] });
  const comment = { commentId: 'c1', reactions: { '❤️': 2 }, myReactions: [] };
  render(<Reactions post={{ postId: 'p1' }} comment={comment} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add a reaction to this comment' }));
  // typed without the emoji marker, sent in stored form
  fireEvent.change(screen.getByLabelText('Any emoji'), { target: { value: '❤' } });
  fireEvent.click(screen.getByRole('button', { name: 'React' }));
  await waitFor(() => expect(api.reactToComment).toHaveBeenCalledWith('c1', '❤️', true));
  expect(api.reactToPost).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: /: 3\./ })).toBeTruthy());
  // the recent row remembers it
  fireEvent.click(screen.getByRole('button', { name: 'Add a reaction to this comment' }));
  expect(screen.getByText('Recent')).toBeTruthy();
  expect(screen.getByText(/per comment/)).toBeTruthy();
});
