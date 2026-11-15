import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AuraTimelineGraph, { buildSeries } from './AuraTimelineGraph';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { getAuraHistory: jest.fn() } }));

const days = nets => nets.map((net, i) => ({ date: `2026-11-${String(9 + i).padStart(2, '0')}`, net }));

test('buildSeries works backwards from today\'s balance', () => {
  const series = buildSeries(500, days([100, 0, -40, 90]), 'day');
  expect(series.map(p => p.value)).toEqual([350, 450, 450, 410, 500]);
  expect(series[0].start).toBe(true);
  expect(series[series.length - 1].value).toBe(500);
});

test('monthly points start at the first day of the first month', () => {
  const series = buildSeries(80, [{ date: '2026-10', net: 30 }, { date: '2026-11', net: 50 }], 'month');
  expect(series.map(p => p.value)).toEqual([0, 30, 80]);
  expect(new Date(series[0].t).toISOString()).toBe('2026-10-01T00:00:00.000Z');
});

test('shows the balance and the change for the period, and asks for a new range', async () => {
  api.getAuraHistory.mockResolvedValue({ balance: 1200, unit: 'day', points: days([0, 200, 0, -50, 250]) });
  render(<AuraTimelineGraph userId="u1" balance={1200} />);
  await act(async () => {});
  expect(api.getAuraHistory).toHaveBeenLastCalledWith('u1', '1m');
  expect(screen.getByText('1,200', { selector: 'p' })).toBeInTheDocument();
  expect(screen.getByText('+400')).toBeInTheDocument();
  expect(screen.getByText('(+50.0%)')).toBeInTheDocument();
  expect(screen.getByText('Best day')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '1W' }));
  await act(async () => {});
  expect(api.getAuraHistory).toHaveBeenLastCalledWith('u1', '1w');
});

test('a private account says so instead of drawing', async () => {
  api.getAuraHistory.mockRejectedValue(Object.assign(new Error('This account is private.'), { status: 403 }));
  render(<AuraTimelineGraph userId="u2" />);
  await act(async () => {});
  expect(screen.getByText(/This account is private/)).toBeInTheDocument();
});

test('a failed load can be retried', async () => {
  api.getAuraHistory.mockRejectedValueOnce(new Error('Network down'));
  api.getAuraHistory.mockResolvedValueOnce({ balance: 10, unit: 'day', points: days([0, 0]) });
  render(<AuraTimelineGraph userId="u3" balance={10} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  await act(async () => {});
  expect(screen.getByText('No aura changes in this period.')).toBeInTheDocument();
});
