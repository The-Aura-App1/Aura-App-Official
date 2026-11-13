import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppTour, { STEPS } from './AppTour';
import { hasSeenTour, markTourSeen } from '../../utils/tour';

function renderTour(onClose = jest.fn()) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AppTour onClose={onClose} />} />
        <Route path="/create" element={<p>Create page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return onClose;
}

test('walks through every step and finishes', () => {
  const onClose = renderTour();
  expect(screen.getByRole('heading', { name: 'Welcome to Aura' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /show me around/i }));
  for (let i = 1; i < STEPS.length - 1; i++) {
    expect(screen.getByRole('heading', { name: STEPS[i].title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
  }
  expect(screen.getByRole('heading', { name: 'You’re ready' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /skip tour/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /start exploring/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('can be skipped from the first step, by button or Escape', () => {
  const onClose = renderTour();
  fireEvent.click(screen.getByRole('button', { name: /skip tour/i }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('back, arrow keys and the dots move between steps', () => {
  renderTour();
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByRole('heading', { name: STEPS[1].title })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /back/i }));
  expect(screen.getByRole('heading', { name: STEPS[0].title })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: `Step 4: ${STEPS[3].title}` }));
  expect(screen.getByRole('heading', { name: STEPS[3].title })).toBeInTheDocument();
});

test('the last step links into the app and closes the tour', () => {
  const onClose = renderTour();
  fireEvent.click(screen.getByRole('tab', { name: `Step ${STEPS.length}: ${STEPS.at(-1).title}` }));
  fireEvent.click(screen.getByRole('button', { name: 'Make a post' }));
  expect(onClose).toHaveBeenCalled();
  expect(screen.getByText('Create page')).toBeInTheDocument();
});

test('the tour is remembered per account', () => {
  expect(hasSeenTour('u1')).toBe(false);
  markTourSeen('u1');
  expect(hasSeenTour('u1')).toBe(true);
  expect(hasSeenTour('u2')).toBe(false);
});
