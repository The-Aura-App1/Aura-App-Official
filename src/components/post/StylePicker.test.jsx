import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import StylePicker from './StylePicker';
import { TextBody, frameProps } from './PostStyle';
import { cleanStyle } from '../../utils/postStyle';

function Harness({ postType = 'text', onStyle }) {
  const [look, setLook] = useState({});
  return <StylePicker style={look} onChange={s => { setLook(s); onStyle(s); }} postType={postType} caption="Hello there" isPremium={false} />;
}

test('picking a font, background, size and frame builds the post style, with a live preview', () => {
  const onStyle = jest.fn();
  render(<Harness onStyle={onStyle} />);
  fireEvent.click(screen.getByRole('button', { name: /customize the look/i }));
  fireEvent.change(screen.getByLabelText('Search fonts'), { target: { value: 'lobs' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lobster' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Background' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sunset' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Size' }));
  fireEvent.click(screen.getByRole('button', { name: 'Huge' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Frame' }));
  fireEvent.click(screen.getByRole('button', { name: 'Neon' }));
  expect(onStyle).toHaveBeenLastCalledWith({ font: 'lobster', bg: 'sunset', size: 'xl', frame: 'neon' });
  const preview = screen.getByLabelText('Preview');
  // a text post with a background is framed on its card, inside the preview
  expect(preview.querySelector('.post-frame')).toBeTruthy();
  expect(preview.className).not.toMatch(/post-frame/);
  expect(screen.getByText('Hello there').closest('div').style.color).toBe('rgb(255, 255, 255)');   // the background's own ink
  expect(screen.getByText('4 changes')).toBeInTheDocument();
});

test('photo posts only offer font, color and frame, and only theme-safe colors', () => {
  render(<Harness postType="image" onStyle={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /customize the look/i }));
  expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Font', 'Color', 'Frame']);
  fireEvent.click(screen.getByRole('tab', { name: 'Color' }));
  expect(screen.queryByRole('button', { name: '#ffffff' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Custom text color')).not.toBeInTheDocument();
});

test('cleanStyle drops what a post type cannot carry', () => {
  expect(cleanStyle({ font: 'inter', bg: 'aura', size: 'l', frame: 'gold' }, 'image')).toEqual({ font: 'inter', frame: 'gold' });
  expect(cleanStyle({ color: '#ffffff' }, 'text')).toBeNull();          // white without a background could vanish on a light theme
  expect(cleanStyle({ color: '#ffffff', bg: 'midnight' }, 'text')).toEqual({ color: '#ffffff', bg: 'midnight' });
  expect(cleanStyle({}, 'text')).toBeNull();
});

test('a styled text post renders as a card in its colors, and a frame paints the border', () => {
  render(<TextBody text="Big news" style={{ bg: 'midnight', size: 'l' }} />);
  const card = screen.getByText('Big news').parentElement;
  expect(card.style.color).toBe('rgb(248, 250, 252)');
  expect(card.style.fontSize).toBe('1.7rem');
  expect(card.style.textAlign).toBe('center');
  expect(frameProps({ frame: 'glow' }).className).toBe('post-frame post-frame-glow');
  expect(frameProps({ frame: '#123456' }).style['--frame-paint']).toBe('#123456');
  expect(frameProps(null).className).toBe('');
});

test('a text post with a background wears its frame on the card itself', () => {
  const { BACKGROUND_KINDS, POST_BACKGROUNDS, POST_FRAMES } = require('../../utils/postStyle');
  for (const kind of BACKGROUND_KINDS) {
    const bg = POST_BACKGROUNDS.find(b => b.kind === kind);
    for (const frame of [POST_FRAMES[0].id, '#123456']) {
      const style = { bg: bg.id, frame };
      const { container, unmount } = render(<TextBody text="Framed" style={style} />);
      const card = container.firstChild;
      expect(card.className).toMatch(/post-frame/);
      expect(card.style.getPropertyValue('--frame-paint')).toBeTruthy();
      unmount();
      // and the outer post card doesn't draw a second one
      expect(frameProps(style, 'text').className).toBe('');
      expect(frameProps(style, 'image').className).toMatch(/post-frame/);
    }
  }
  // a group background (grp:) too
  const { container } = render(<TextBody text="x" style={{ bg: 'grp:a1', frame: 'glow' }} groupBg={{ key: 'k', ink: '#fff' }} />);
  expect(container.firstChild.className).toMatch(/post-frame-glow/);
  // without a background the frame stays on the post card
  expect(frameProps({ frame: 'glow' }, 'text').className).toMatch(/post-frame/);
});

test('patterns, a built gradient and a built frame; one background at a time', () => {
  const onStyle = jest.fn();
  render(<Harness onStyle={onStyle} />);
  fireEvent.click(screen.getByRole('button', { name: /customize the look/i }));
  fireEvent.click(screen.getByRole('tab', { name: 'Background' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Hexagons' }));
  expect(onStyle.mock.lastCall[0].pat).toMatchObject({ id: 'hexagons' });
  fireEvent.click(screen.getByRole('radio', { name: 'Large' }));
  expect(onStyle.mock.lastCall[0].pat.s).toBe('l');
  // a preset background replaces the pattern
  fireEvent.click(screen.getByRole('button', { name: 'Sunset' }));
  expect(onStyle.mock.lastCall[0]).toMatchObject({ bg: 'sunset' });
  expect(onStyle.mock.lastCall[0].pat).toBeUndefined();
  // building a gradient applies it straight away, then edits it
  fireEvent.click(screen.getAllByRole('button', { name: 'Build your own' })[0]);
  expect(onStyle.mock.lastCall[0].grad).toBeTruthy();
  expect(onStyle.mock.lastCall[0].bg).toBeUndefined();
  fireEvent.click(screen.getByRole('radio', { name: 'Soft blobs' }));
  expect(onStyle.mock.lastCall[0].grad.t).toBe('mesh');
  // a built frame
  fireEvent.click(screen.getByRole('tab', { name: 'Frame' }));
  fireEvent.click(screen.getByRole('button', { name: 'Build your own' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Dashed' }));
  expect(onStyle.mock.lastCall[0].fr).toMatchObject({ line: 'dashed' });
  expect(screen.getByLabelText('Preview').querySelector('.post-frame-line')).toBeTruthy();
});
