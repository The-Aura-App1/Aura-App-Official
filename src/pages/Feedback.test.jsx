import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Feedback from './Feedback';
import { api } from '../api';

const mockRefreshUser = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ dbProfile: { displayName: "Ana" }, refreshUser: mockRefreshUser }) }));
jest.mock('../api', () => ({ api: {
  getSuggestions: jest.fn(), createSuggestion: jest.fn(), voteSuggestion: jest.fn(), claimSuggestionBonus: jest.fn(),
  getMyReview: jest.fn(), getPublicReviews: jest.fn(),
} }));

const listWith = suggestionBonus => ({ sort: 'top', status: 'all', counts: { all: 0, open: 0, planned: 0, done: 0 }, suggestions: [], suggestionBonus });

async function open(bonus) {
  api.getSuggestions.mockResolvedValue(listWith(bonus));
  render(<MemoryRouter><Feedback /></MemoryRouter>);
  await act(async () => {});
}

beforeEach(() => jest.clearAllMocks());

test('offers 500 aura before the first suggestion, and pays it after posting', async () => {
  await open('offer');
  expect(screen.getByText(/Post your first suggestion and get 500 free aura/)).toBeInTheDocument();
  api.createSuggestion.mockResolvedValue({ suggestionId: 's1', text: 'Add a rematch button', votes: 1, status: 'open', isMine: true, votedByMe: true, suggestionBonus: 'due' });
  api.claimSuggestionBonus.mockResolvedValue({ message: 'Thanks! 500 aura added to your wallet.', amount: 500 });
  fireEvent.change(screen.getByLabelText('What would make Aura better?'), { target: { value: 'Add a rematch button' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Suggest' })); });
  expect(api.claimSuggestionBonus).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Thanks! 500 aura added to your wallet.')).toBeInTheDocument();
  expect(screen.queryByText(/Post your first suggestion/)).toBeNull();
  expect(mockRefreshUser).toHaveBeenCalled();
});

test('a bonus that did not come through is asked for again on the next visit', async () => {
  api.claimSuggestionBonus.mockResolvedValue({ message: 'Thanks! 500 aura added to your wallet.' });
  await open('due');
  expect(api.claimSuggestionBonus).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/500 aura added/)).toBeInTheDocument();
});

test('no offer once claimed, for banned accounts, or after a later suggestion', async () => {
  await open('claimed');
  expect(screen.queryByText(/free aura/)).toBeNull();
  api.createSuggestion.mockResolvedValue({ suggestionId: 's2', text: 'Another idea here', votes: 1, status: 'open', suggestionBonus: 'claimed' });
  fireEvent.change(screen.getByLabelText('What would make Aura better?'), { target: { value: 'Another idea here' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Suggest' })); });
  expect(api.claimSuggestionBonus).not.toHaveBeenCalled();
});

test('a failed claim keeps the suggestion and says the aura will follow', async () => {
  api.claimSuggestionBonus.mockRejectedValue(Object.assign(new Error('Internal server error.'), { status: 500 }));
  await open('due');
  expect(screen.getByText(/didn't come through yet/)).toBeInTheDocument();
});
