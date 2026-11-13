import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FollowButton, FollowRequests } from './FollowBits';
import { api } from '../../api';

jest.mock('../../api', () => ({
  api: { follow: jest.fn(), unfollow: jest.fn(), getFollowRequests: jest.fn(), answerFollowRequest: jest.fn() },
}));

test('follow, then the button shows the new state from the server', async () => {
  const onChange = jest.fn();
  api.follow.mockResolvedValue({ status: 'pending' });
  render(<FollowButton username="carol" rel={{ status: 'none', followsYou: true }} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /follow back/i }));
  await act(async () => {});
  expect(api.follow).toHaveBeenCalledWith('carol');
  expect(onChange).toHaveBeenCalledWith({ status: 'pending' });
});

test('requested and following states unfollow; nothing shows on your own profile', async () => {
  api.unfollow.mockResolvedValue({ status: 'none' });
  const { rerender, container } = render(
    <FollowButton username="bob" rel={{ status: 'pending' }} onChange={() => {}} />);
  expect(screen.getByRole('button')).toHaveTextContent('Requested');
  fireEvent.click(screen.getByRole('button'));
  await act(async () => {});
  expect(api.unfollow).toHaveBeenCalledWith('bob');

  rerender(<FollowButton username="bob" rel={{ status: 'active' }} onChange={() => {}} />);
  expect(screen.getByRole('button')).toHaveTextContent('Following');

  rerender(<FollowButton username="me" rel={{ status: 'self' }} onChange={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test('follow requests can be approved and disappear', async () => {
  api.getFollowRequests.mockResolvedValue({ users: [{ userId: 'a1', username: 'alice', displayName: 'Alice' }] });
  api.answerFollowRequest.mockResolvedValue({ status: 'approved' });
  render(<MemoryRouter><FollowRequests /></MemoryRouter>);
  expect(await screen.findByText('Follow requests (1)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  await act(async () => {});
  expect(api.answerFollowRequest).toHaveBeenCalledWith('a1', true);
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
});

test('no requests (or no route yet) shows nothing', async () => {
  api.getFollowRequests.mockRejectedValue(new Error('Not Found'));
  const { container } = render(<MemoryRouter><FollowRequests /></MemoryRouter>);
  await act(async () => {});
  expect(container).toBeEmptyDOMElement();
});
