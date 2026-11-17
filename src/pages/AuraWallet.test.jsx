import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuraWallet from './AuraWallet';
import { api } from '../api';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({
  dbProfile: { userId: 'u1', auraBalance: 1200, auraSpendable: 500, auraEarned: 700, today: { bonus: { amount: 200, claimed: false }, freeGive: { used: 0, limit: 50 }, walletGive: { used: 0, limit: 500 }, take: { used: 0, limit: 250 } } },
  refreshUser: jest.fn(),
}) }));
jest.mock('../ads/rewarded', () => ({ watchRewardedAd: jest.fn() }));
jest.mock('../api', () => ({ api: { getAuraHistory: jest.fn(), claimDailyBonus: jest.fn() } }));

test('the wallet shows your aura over time, all time first', async () => {
  api.getAuraHistory.mockResolvedValue({ balance: 1200, unit: 'month', points: [{ date: '2026-10', net: 400 }, { date: '2026-11', net: 800 }] });
  render(<MemoryRouter><AuraWallet /></MemoryRouter>);
  await act(async () => {});
  expect(screen.getByRole('heading', { name: 'Your aura over time' })).toBeInTheDocument();
  expect(api.getAuraHistory).toHaveBeenCalledWith('u1', 'all');
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
});
