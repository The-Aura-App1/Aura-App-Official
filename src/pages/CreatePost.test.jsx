import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreatePost from './CreatePost';
import { api } from '../api';

jest.mock('../api', () => ({ api: { createPost: jest.fn(), getGroup: jest.fn(), getUploadUrls: jest.fn() } }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ dbProfile: { username: 'me', displayName: 'Me' } }) }));
jest.mock('../utils/embedClient', () => ({ embedTexts: () => Promise.reject(new Error('no model')), warmUpModel: () => {} }));
jest.mock('../utils/motion', () => ({ prefersReducedMotion: () => true }));

const renderIt = () => render(<MemoryRouter><CreatePost /></MemoryRouter>);

test('a text post goes write, edit, share, with a preview at the end', async () => {
  api.createPost.mockResolvedValue({});
  renderIt();
  // can't move on without writing something
  fireEvent.click(screen.getByRole('button', { name: 'Next: edit' }));
  expect(screen.getByRole('alert').textContent).toContain('Write something first.');
  fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'Hello Aura' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next: edit' }));
  expect(screen.getByRole('heading', { name: 'Edit' })).toBeTruthy();
  expect(screen.getByText(/Pick a background below/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next: share' }));
  expect(screen.getByLabelText('Preview').textContent).toContain('Hello Aura');
  // back keeps what was written
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Your post').value).toBe('Hello Aura');
  fireEvent.click(screen.getByRole('button', { name: 'Next: edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: share' }));
  fireEvent.click(screen.getByRole('button', { name: /Share Post/ }));
  await waitFor(() => expect(api.createPost).toHaveBeenCalled());
  const body = api.createPost.mock.calls[0][0];
  expect(body).toMatchObject({ type: 'text', caption: 'Hello Aura' });
  expect(body.overlays).toBeUndefined();
});

test('photos need picking before Next', () => {
  renderIt();
  fireEvent.click(screen.getByRole('radio', { name: /Photos/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: edit' }));
  expect(screen.getByRole('alert').textContent).toContain('Pick at least one photo.');
});
