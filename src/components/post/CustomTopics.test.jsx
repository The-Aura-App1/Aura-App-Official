import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CustomTopics from './CustomTopics';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { getFeed: jest.fn() } }));

function Harness({ onCurated = jest.fn(), onHashtag = jest.fn(), start = [] }) {
  const [value, setValue] = useState(start);
  return <CustomTopics value={value} onChange={setValue} room={3 - value.length} onCurated={onCurated} onHashtag={onHashtag} />;
}

beforeEach(() => api.getFeed.mockResolvedValue({ posts: [{ customTopics: ['home baking'] }, { customTopics: ['home baking', 'sourdough'] }] }));

async function type(text) {
  const box = screen.getByLabelText('Your own topic');
  await act(async () => { fireEvent.focus(box); });
  fireEvent.change(box, { target: { value: text } });
}

test('adds a topic as a tidy chip, and suggests ones already in use', async () => {
  render(<Harness />);
  await type('home b');
  expect(screen.getByRole('button', { name: 'Home baking · in use' })).toBeInTheDocument();
  await type('  Lo   Fi Beats ');
  fireEvent.click(screen.getByRole('button', { name: 'Add topic' }));
  expect(screen.getByText('Lo fi beats')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Lo fi beats' }));
  expect(screen.queryByText('Lo fi beats')).toBeNull();
});

test('explains what it won\'t take, and offers a hashtag or Aura\'s own topic instead', async () => {
  const onHashtag = jest.fn();
  const onCurated = jest.fn();
  render(<Harness onHashtag={onHashtag} onCurated={onCurated} />);
  await type('www.spam.com');
  fireEvent.click(screen.getByRole('button', { name: 'Add topic' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/links/);
  await type('#jazz');
  fireEvent.click(screen.getByRole('button', { name: 'Add topic' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add #jazz' }));
  expect(onHashtag).toHaveBeenCalledWith('jazz');
  await type('cooking');
  fireEvent.click(screen.getByRole('button', { name: 'Add topic' }));
  expect(onCurated).toHaveBeenCalledWith('cooking');
});

test('no more than 3 topics in all', async () => {
  render(<Harness start={['a b', 'c d', 'e f']} />);
  expect(screen.getByLabelText('Your own topic')).toBeDisabled();
});
