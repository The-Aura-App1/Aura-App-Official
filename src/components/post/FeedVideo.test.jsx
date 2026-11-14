import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FeedVideo, { resetVideoSound } from './FeedVideo';

// jsdom has no PointerEvent: a mouse event with a pointerId stands in
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId; }
  };
}

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

test('the speaker button toggles sound for every video', async () => {
  render(<><FeedVideo src="/a.mp4" /><FeedVideo src="/b.mp4" /></>);
  const [a, b] = screen.getAllByLabelText('Video');
  expect(a.muted && b.muted).toBe(true);

  fireEvent.click(screen.getAllByRole('button', { name: 'Turn sound on' })[0]);
  expect(a.muted).toBe(false);
  expect(b.muted).toBe(false);   // the choice carries over, like Instagram
  fireEvent.click(screen.getAllByRole('button', { name: 'Mute' })[1]);
  expect(a.muted).toBe(true);
});

test('tapping the video pauses it, tapping again resumes; scrolling away and back restarts it', async () => {
  const { container } = render(<FeedVideo src="/clip.mp4" />);
  await scroll(1);
  const video = screen.getByLabelText('Video');
  Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
  HTMLMediaElement.prototype.play.mockClear();

  await act(async () => { fireEvent.click(video); });
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  expect(container.querySelector('.lucide-play')).toBeInTheDocument();   // stays paused, with a play button
  expect(video.muted).toBe(true);                                         // tapping doesn't touch sound

  Object.defineProperty(video, 'paused', { configurable: true, get: () => true });
  await act(async () => { fireEvent.click(video); });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

  // Paused again, scrolled away and back: it plays on its own
  Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
  await act(async () => { fireEvent.click(video); });
  HTMLMediaElement.prototype.play.mockClear();
  await scroll(0);
  await scroll(1);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
});

test('only the post page gets a seek bar, and it jumps to the tapped point', async () => {
  const { rerender } = render(<FeedVideo src="/clip.mp4" />);
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  rerender(<FeedVideo src="/clip.mp4" seekable />);
  await scroll(1);
  const video = screen.getByLabelText('Video');
  let at = 0;
  Object.defineProperty(video, 'currentTime', { configurable: true, get: () => at, set: v => { at = v; } });
  Object.defineProperty(video, 'duration', { configurable: true, get: () => 8 });
  fireEvent(video, new Event('durationchange'));
  const bar = screen.getByRole('slider', { name: 'Seek' });
  bar.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20 });
  fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1 });
  expect(video.currentTime).toBe(4);
  fireEvent.keyDown(bar, { key: 'ArrowRight' });
  expect(video.currentTime).toBe(8);
});

test('if the phone blocks autoplay, a play button appears and a tap starts it', async () => {
  HTMLMediaElement.prototype.play = jest.fn()
    .mockImplementationOnce(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })))
    .mockImplementation(function play() { this.dispatchEvent(new Event('playing')); return Promise.resolve(); });
  const { container } = render(<FeedVideo src="/clip.mp4" />);
  await scroll(1);
  expect(container.querySelector('.lucide-play')).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByLabelText('Video')); });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  expect(container.querySelectorAll('.lucide-play').length).toBeLessThanOrEqual(1);   // only the brief tap icon, if any
});
