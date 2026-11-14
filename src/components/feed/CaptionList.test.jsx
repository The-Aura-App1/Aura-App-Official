import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CaptionRow, captionMatches, ViewSwitch, loadView, saveView } from './CaptionList';

const post = {
  postId: 'p1', type: 'video', caption: 'Sunset over the Ridge', hashtags: ['goldenhour'],
  authorUsername: 'ray', authorDisplay: 'Ray', auraScore: 12, commentCount: 3, createdAt: new Date().toISOString(),
};

test('captions filter by the start of any word, ignoring case and accents, plus hashtags', () => {
  expect(captionMatches(post, 'sun')).toBe(true);
  expect(captionMatches(post, 'RIDGE sunset')).toBe(true);
  expect(captionMatches(post, 'golden')).toBe(true);
  expect(captionMatches(post, 'set')).toBe(false);          // middle of a word
  expect(captionMatches(post, 'sunset beach')).toBe(false); // every word must match
  expect(captionMatches(post, '  ')).toBe(true);
  expect(captionMatches({ caption: 'Café crawl' }, 'cafe')).toBe(true);
  expect(captionMatches({ caption: null }, 'x1')).toBe(false);
});

test('a caption row shows the caption first and opens the post when clicked', () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CaptionRow post={post} />} />
        <Route path="/post/:id" element={<p>Post page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Sunset over the Ridge' })).toBeInTheDocument();
  expect(screen.getByText('Video')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Ray/ })).toHaveAttribute('href', '/profile/ray');
  fireEvent.click(screen.getByRole('heading', { name: 'Sunset over the Ridge' }));
  expect(screen.getByText('Post page')).toBeInTheDocument();
});

test('a post with no caption still gets a row', () => {
  render(<MemoryRouter><CaptionRow post={{ ...post, type: 'image', caption: '' }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Photo post with no caption' })).toBeInTheDocument();
});

test('the view switch reports the choice, and it is remembered', () => {
  const onChange = jest.fn();
  render(<ViewSwitch view="posts" onChange={onChange} />);
  expect(screen.getByRole('radio', { name: 'Posts' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'Captions' }));
  expect(onChange).toHaveBeenCalledWith('captions');
  saveView('captions');
  expect(loadView()).toBe('captions');
  saveView('posts');
  expect(loadView()).toBe('posts');
});
