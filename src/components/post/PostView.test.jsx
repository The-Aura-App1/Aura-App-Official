import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PostView from './PostView';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { getPost: jest.fn(), getComments: jest.fn(), createComment: jest.fn(), getUser: jest.fn() } }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'me' }, dbProfile: { username: 'me_here' } }) }));
jest.mock('./PostCard', () => () => <article>post</article>);
jest.mock('../../utils/tasteProfile', () => ({ recordEngagement: () => {} }));

const at = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
beforeEach(() => {
  api.getPost.mockResolvedValue({ postId: 'p1', authorId: 'a', authorUsername: 'ann', authorDisplay: 'Ann', type: 'text' });
  api.getComments.mockResolvedValue({
    total: 2,
    comments: [{
      commentId: 'c1', authorId: 'b', authorUsername: 'bob', authorDisplay: 'Bob', text: 'Great shot @ann, cc @AuraApp and @lena_cooks', createdAt: at(5),
      replies: [{ commentId: 'r1', parentCommentId: 'c1', authorId: 'm', authorUsername: 'maya', authorDisplay: 'Maya', text: 'agreed', createdAt: at(2) }],
    }],
  });
  api.getUser.mockImplementation(name => (name === 'lena_cooks'
    ? Promise.resolve({ username: 'lena_cooks' }) : Promise.reject(new Error('User not found.'))));
  api.createComment.mockImplementation((postId, text, parent) => Promise.resolve({
    commentId: 'new', parentCommentId: parent, authorId: 'me', authorUsername: 'me_here', text, createdAt: at(0),
  }));
});

async function open() {
  render(
    <MemoryRouter initialEntries={['/post/p1']}>
      <Routes>
        <Route path="/post/:postId" element={<PostView />} />
        <Route path="/profile/:u" element={<p>Profile</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await act(async () => {});
}

test('@mentions link to real profiles only; a name nobody has stays plain text', async () => {
  await open();
  expect(screen.getByRole('link', { name: '@ann' })).toHaveAttribute('href', '/profile/ann');           // in the conversation
  expect(screen.getByRole('link', { name: '@lena_cooks' })).toHaveAttribute('href', '/profile/lena_cooks'); // looked up
  expect(screen.queryByRole('link', { name: '@AuraApp' })).not.toBeInTheDocument();                     // no such account
  expect(screen.getByText(/@AuraApp/)).toBeInTheDocument();
  expect(api.getUser).not.toHaveBeenCalledWith('ann');
});

test('replying to a reply stays in the thread and starts with their @name', async () => {
  await open();
  const replyButtons = screen.getAllByRole('button', { name: /reply/i });
  fireEvent.click(replyButtons[1]);   // the Reply under Maya's reply
  const box = screen.getByLabelText('Reply to @maya...');
  expect(box).toHaveValue('@maya ');

  fireEvent.change(box, { target: { value: '@maya same here', selectionStart: 15 } });
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Reply' }).find(b => b.className.includes('btn-primary'))); });
  expect(api.createComment).toHaveBeenCalledWith('p1', '@maya same here', 'c1');
  expect(screen.getAllByRole('link', { name: '@maya' }).some(a => a.textContent === '@maya')).toBe(true);
});

test('typing @ suggests people in the conversation, and picking one fills it in', async () => {
  await open();
  const box = screen.getByLabelText('Add a comment...');
  fireEvent.change(box, { target: { value: 'thanks @b', selectionStart: 9 } });
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(1);
  expect(options[0]).toHaveTextContent('@bob');
  fireEvent.keyDown(box, { key: 'Enter' });
  expect(box).toHaveValue('thanks @bob ');
});
