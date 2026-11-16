import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Notifications from './Notifications';
import { api } from '../api';

jest.mock('../api', () => ({ api: {
  getNotifications: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn(), deleteNotification: jest.fn(), starNotification: jest.fn(),
  getFollowRequests: jest.fn(),
} }));
jest.mock('../components/profile/FollowBits', () => ({ FollowRequests: () => null }));

const list = [
  { notificationId: '2#b', type: 'comment', data: { fromUsername: 'bo', postId: 'p1' }, read: false, createdAt: new Date().toISOString() },
  { notificationId: '1#a', type: 'follow', data: { fromUsername: 'cy' }, read: true, starred: true, createdAt: new Date(Date.now() - 1e9).toISOString() },
];

async function open() {
  api.getNotifications.mockResolvedValue({ notifications: list.map(n => ({ ...n })) });
  api.markRead.mockResolvedValue({});
  api.starNotification.mockResolvedValue({});
  render(<MemoryRouter><Notifications /></MemoryRouter>);
  await act(async () => {});
}

test('mark one read or unread, without opening it', async () => {
  await open();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mark as read' })); });
  expect(api.markRead).toHaveBeenCalledWith('2#b', true);
  expect(screen.getAllByRole('button', { name: 'Mark as unread' })).toHaveLength(2);
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Mark as unread' })[1]); });
  expect(api.markRead).toHaveBeenLastCalledWith('1#a', false);
});

test('star one to keep it, and see only starred ones', async () => {
  await open();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Star to keep it' })); });
  expect(api.starNotification).toHaveBeenCalledWith('2#b', true);
  fireEvent.click(screen.getByRole('tab', { name: /Starred/ }));
  expect(screen.getByText('@bo commented on your post')).toBeInTheDocument();
  expect(screen.getByText('@cy started following you')).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Unstar' })[1]); });
  expect(api.starNotification).toHaveBeenLastCalledWith('1#a', false);
  expect(screen.queryByText('@cy started following you')).not.toBeInTheDocument();
});

test('a failed star goes back', async () => {
  await open();
  api.starNotification.mockRejectedValue(new Error('Nope.'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Star to keep it' })); });
  expect(screen.getByRole('button', { name: 'Star to keep it' })).toBeInTheDocument();
  expect(screen.getByText('Nope.')).toBeInTheDocument();
});
