import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FeedVideo, { resetVideoSound } from './FeedVideo';

// jsdom has no IntersectionObserver or media playback: fake both
let observers = [];
beforeEach(() => {
  observers = [];
  window.IntersectionObserver = class {
    constructor(cb, options) { this.cb = cb; this.options = options; observers.push(this); }
    observe(el) { this.el = el; }
    disconnect() {}
  };
  window.HTMLMediaElement.prototype.play = jest.fn(function play() { this.dispatchEvent(new Event('playing')); return Promise.resolve(); });
  window.HTMLMediaElement.prototype.pause = jest.fn(function pause() { this.dispatchEvent(new Event('pause')); });
  resetVideoSound();
});

// The loader has a rootMargin; the player watches the real viewport
const loader = () => observers.find(o => o.options?.rootMargin);
const player = () => observers.find(o => !o.options?.rootMargin);
const scroll = async (ratio) => {
  await act(async () => {
    loader().cb([{ isIntersecting: true, intersectionRatio: 1 }]);
    player().cb([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  });
};

test('waits off screen without loading, then plays muted and looping with no controls', async () => {
  render(<FeedVideo src="/clip.mp4" />);
  const video = screen.getByLabelText('Video');
  expect(video).not.toHaveAttribute('src');
  expect(video).not.toHaveAttribute('controls');
  expect(video.loop).toBe(true);

  await scroll(0.8);
  expect(video).toHaveAttribute('src', '/clip.mp4');
  expect(video.muted).toBe(true);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

  await scroll(0.3);
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
});

test('tapping the video or the speaker toggles sound for every video', async () => {
  render(<><FeedVideo src="/a.mp4" /><FeedVideo src="/b.mp4" /></>);
  const [a, b] = screen.getAllByLabelText('Video');
  expect(a.muted && b.muted).toBe(true);

  fireEvent.click(screen.getAllByRole('button', { name: 'Turn sound on' })[0]);
  expect(a.muted).toBe(false);
  expect(b.muted).toBe(false);   // the choice carries over, like Instagram

  fireEvent.click(a);            // tapping the video itself
  expect(a.muted).toBe(true);
  expect(screen.getAllByRole('button', { name: 'Turn sound on' })).toHaveLength(2);
});

test('if the phone blocks autoplay, a play button appears and a tap starts it', async () => {
  HTMLMediaElement.prototype.play = jest.fn()
    .mockImplementationOnce(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })))
    .mockImplementation(function play() { this.dispatchEvent(new Event('playing')); return Promise.resolve(); });
  const { container } = render(<FeedVideo src="/clip.mp4" />);
  await scroll(1);
  expect(container.querySelector('.border-l-white')).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByLabelText('Video')); });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  expect(container.querySelector('.border-l-white')).not.toBeInTheDocument();
});
