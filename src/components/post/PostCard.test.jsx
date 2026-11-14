import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PostCard from './PostCard';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'me' } }) }));
jest.mock('../../api', () => ({ api: {} }));
jest.mock('./AuraModal', () => () => <div role="dialog">aura</div>);

const post = { postId: 'p1', authorId: 'a', authorUsername: 'ann', authorDisplay: 'Ann', type: 'text', caption: 'Hello there', createdAt: new Date().toISOString(), auraScore: 0 };

function renderCard(props = {}) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PostCard post={post} {...props} />} />
        <Route path="/post/:id" element={<p>Post page</p>} />
        <Route path="/profile/:u" element={<p>Profile page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

test('tapping the post opens it', () => {
  renderCard();
  fireEvent.click(screen.getByText('Hello there'));
  expect(screen.getByText('Post page')).toBeInTheDocument();
});

test('buttons and links on the post keep their own job', () => {
  renderCard();
  fireEvent.click(screen.getByRole('button', { name: /give/i }));
  expect(screen.queryByText('Post page')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: /ann/i }));
  expect(screen.getByText('Profile page')).toBeInTheDocument();
});

test('on the post page itself, tapping does nothing', () => {
  renderCard({ onComment: () => {} });
  fireEvent.click(screen.getByText('Hello there'));
  expect(screen.queryByText('Post page')).not.toBeInTheDocument();
});
