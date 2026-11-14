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
  expect(preview).toHaveClass('post-frame');
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
