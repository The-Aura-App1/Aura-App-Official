import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import GuidedTour from './GuidedTour';
import { placeCard } from './placement';
import { TOUR_STEPS, stepsFor } from './tourSteps';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ username: 'me' }) }));

// jsdom has no layout: give every tagged element a box
const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function rect() {
    return this.dataset?.tour
      ? { top: 100, left: 40, width: 120, height: 40, right: 160, bottom: 140, x: 40, y: 100 }
      : realRect.call(this);
  };
  window.scrollTo = () => {};
});
afterAll(() => { Element.prototype.getBoundingClientRect = realRect; });
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const Nav = () => (
  <nav>
    <Link to="/create" data-tour="nav-post">Post</Link>
    <Link to="/groups" data-tour="nav-groups">Groups</Link>
    <span data-tour="nav-notifications" /><span data-tour="nav-more" /><span data-tour="search" />
  </nav>
);
const Page = ({ tags }) => <div>{tags.map(t => <div key={t} data-tour={t}>{t}</div>)}</div>;

function renderTour(onClose = jest.fn()) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Nav />
      <Where />
      <Routes>
        <Route path="/" element={<Page tags={['tune-feed']} />} />
        <Route path="/create" element={<Page tags={['post-type', 'post-caption', 'post-topics', 'post-takes', 'post-share']} />} />
        <Route path="/groups" element={<Page tags={['group-discover', 'group-create']} />} />
        <Route path="/profile/:u" element={<Page tags={['profile-edit']} />} />
        <Route path="/wallet" element={<Page tags={['wallet-today']} />} />
        <Route path="/settings" element={<Page tags={['settings-appearance']} />} />
      </Routes>
      <GuidedTour onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

// Effects start new timers after each render, so advance in slices
const settle = async (ms = 8000) => {
  for (let t = 0; t < ms; t += 500) await act(async () => { jest.advanceTimersByTime(500); });
};
const title = () => screen.getByRole('heading', { level: 2 }).textContent;
const next  = async () => { fireEvent.click(screen.getByRole('button', { name: /^(next|show me around|take me there|i’ll post later|done|start exploring)$/i })); await settle(); };

test('walks page by page, spotlighting real elements and skipping missing ones', async () => {
  const onClose = renderTour();
  expect(title()).toBe('Welcome to Aura');
  await next();
  expect(title()).toBe('Tune your feed');
  expect(document.querySelector('.aura-tour-spot')).toBeInTheDocument();
  await next();   // no posts on this test feed: the aura and menu steps skip themselves
  expect(title()).toBe('Search');
  await next();
  expect(title()).toBe('Make your first post');

  // Tapping the real Post button opens the page and moves the tour on
  fireEvent.click(screen.getByText('Post'));
  await settle();
  expect(screen.getByTestId('where')).toHaveTextContent('/create');
  expect(title()).toBe('Words, photos or video');
  await next(); await next(); await next(); await next();
  expect(title()).toBe('Share it');
  await next();   // "I'll post later"
  expect(title()).toBe('Groups');
  await next();   // "Take me there"
  expect(screen.getByTestId('where')).toHaveTextContent('/groups');
  expect(title()).toBe('Find your people');
  await next(); await next(); await next();
  expect(title()).toBe('Make it yours');
  expect(screen.getByTestId('where')).toHaveTextContent('/profile/me');
  await next();
  expect(screen.getByTestId('where')).toHaveTextContent('/wallet');
  await next(); await next();
  expect(screen.getByTestId('where')).toHaveTextContent('/settings');
  await next();
  expect(title()).toBe('You’re all set');
  await next();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('posting from the post page celebrates it and carries on', async () => {
  renderTour();
  await next(); await next(); await next();
  fireEvent.click(screen.getByRole('button', { name: 'Take me there' }));
  await settle();
  expect(title()).toBe('Words, photos or video');
  await act(async () => { window.dispatchEvent(new CustomEvent('aura:post-created')); });
  await settle(1000);
  expect(title()).toBe('Your first post is live');
  await next();
  expect(title()).toBe('Groups');
});

test('skip and Escape end the tour', async () => {
  const onClose = renderTour();
  fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('the "post is live" step only shows after posting', () => {
  expect(stepsFor({ posted: false }).map(s => s.id)).not.toContain('posted');
  expect(stepsFor({ posted: true }).map(s => s.id)).toContain('posted');
  expect(new Set(TOUR_STEPS.map(s => s.id)).size).toBe(TOUR_STEPS.length);
});

describe('placing the note', () => {
  const view = { width: 400, height: 800 };
  const card = { width: 300, height: 150 };
  const box = (top, left, width, height) => ({ top, left, width, height, right: left + width, bottom: top + height });

  test('below when there is room, pointing at the middle', () => {
    const p = placeCard(box(100, 50, 100, 40), card, view);
    expect(p.side).toBe('below');
    expect(p.top).toBe(154);
    expect(p.left + p.arrow).toBe(100);
  });
  test('above an element near the bottom (the phone tab bar)', () => {
    const p = placeCard(box(740, 160, 60, 50), card, view);
    expect(p.side).toBe('above');
    expect(p.top + card.height).toBeLessThanOrEqual(740);
    expect(p.left).toBeGreaterThanOrEqual(12);
    expect(p.left + card.width).toBeLessThanOrEqual(388);
  });
  test('beside a sidebar item on a wide screen', () => {
    const p = placeCard(box(30, 20, 200, 740), card, { width: 1200, height: 800 });
    expect(p.side).toBe('right');
  });
  test('over the roomier end of a section that fills the screen', () => {
    expect(placeCard(box(20, 10, 380, 760), card, view).side).toMatch(/^inside/);
  });
  test('in the middle with nothing to point at', () => {
    const p = placeCard(null, card, view);
    expect(p).toMatchObject({ side: 'none', top: 325, left: 50 });
  });
});
