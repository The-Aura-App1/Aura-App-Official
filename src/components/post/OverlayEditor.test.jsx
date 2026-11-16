import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OverlayEditor, { readyOverlays } from './OverlayEditor';
import PostOverlays from './PostOverlays';
import { normalizeUrl } from '../../utils/overlays';

function Harness({ onChange }) {
  const [list, setList] = useState([]);
  return <OverlayEditor overlays={list} onChange={l => { setList(l); onChange(l); }}><div /></OverlayEditor>;
}

test('adds text and a link, edits them, and readies them for the server', () => {
  let latest = [];
  render(<Harness onChange={l => { latest = l; }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Text' }));
  fireEvent.change(screen.getByLabelText('Text on the post'), { target: { value: 'Hello world' } });
  fireEvent.click(screen.getByRole('button', { name: 'Filled' }));
  fireEvent.click(screen.getByRole('button', { name: 'Link' }));
  fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'example.com/shop' } });
  expect(latest).toHaveLength(2);
  const { overlays, error } = readyOverlays(latest);
  expect(error).toBeUndefined();
  expect(overlays[0]).toMatchObject({ kind: 'text', text: 'Hello world', bg: 'solid', slide: 0 });
  expect(overlays[0].id).toBeUndefined();
  expect(overlays[1]).toMatchObject({ kind: 'link', url: 'https://example.com/shop' });
  expect(overlays[1].label).toBeUndefined();
});

test('bad links are caught before posting; empty items are dropped', () => {
  expect(readyOverlays([{ id: 'a', kind: 'link', url: 'not a link', label: '' }]).error).toMatch(/isn't a web address/);
  expect(readyOverlays([{ id: 'a', kind: 'text', text: '  ' }, { id: 'b', kind: 'mention', username: '' }]).overlays).toEqual([]);
  expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  expect(normalizeUrl('https://a:b@x.com')).toBeNull();
});

test('in the feed, links open safely in a new tab and mentions go to profiles', () => {
  render(<MemoryRouter><div style={{ position: 'relative' }}>
    <PostOverlays overlays={[
      { kind: 'link', slide: 0, x: 0.5, y: 0.5, size: 1, color: '#ffffff', url: 'https://www.example.com/a', label: '' },
      { kind: 'mention', slide: 0, x: 0.2, y: 0.2, size: 1, color: '#ffffff', username: 'bob' },
      { kind: 'text', slide: 1, x: 0.2, y: 0.2, size: 1, color: '#ffffff', text: 'other photo' },
    ]} slide={0} />
  </div></MemoryRouter>);
  const link = screen.getByRole('link', { name: /example\.com/ });
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toMatch(/noopener/);
  expect(link.getAttribute('rel')).toMatch(/nofollow/);
  expect(screen.getByRole('link', { name: /bob/ }).getAttribute('href')).toBe('/profile/bob');
  expect(screen.queryByText('other photo')).toBeNull();
});
