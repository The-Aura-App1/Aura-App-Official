import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ThemeStudio from './ThemeStudio';
import { api } from '../api';
import { loadCustom } from '../themes/customTheme';

let mockProfile = { isPremium: true };
const mockSetThemeId = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ dbProfile: mockProfile, refreshUser: jest.fn() }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ themeId: 'night', setThemeId: mockSetThemeId, refreshCustom: jest.fn() }) }));
jest.mock('../api', () => ({ api: { updateProfile: jest.fn() } }));
jest.mock('../components/auth/AuthBackdrop', () => ({ SceneDecor: () => null }));

beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); mockProfile = { isPremium: true }; });

test('Premium: change colors, shape and fonts, then use it and save it to the account', async () => {
  api.updateProfile.mockResolvedValue({});
  render(<MemoryRouter><ThemeStudio /></MemoryRouter>);
  fireEvent.click(screen.getByRole('tab', { name: 'Colors' }));
  fireEvent.change(screen.getByLabelText('Cards hex code'), { target: { value: '#223344' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Shape' }));
  fireEvent.change(screen.getByLabelText('Corner roundness'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Fonts' }));
  fireEvent.change(screen.getByLabelText('Heading font'), { target: { value: 'inter' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Backdrop' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Gradient' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Use this theme/ })); });
  expect(mockSetThemeId).toHaveBeenCalledWith('custom');
  const sent = api.updateProfile.mock.calls[0][0];
  expect(sent.theme).toBe('custom');
  expect(sent.themeDesign.design).toMatchObject({ colors: { surface: '#223344' }, shape: { radius: 0 }, fonts: { heading: 'inter' }, backdrop: { kind: 'gradient' } });
  expect(sent.themeDesign.design.backdrop.stops.length).toBeGreaterThanOrEqual(2);
  expect(loadCustom().design.shape.radius).toBe(0);
  expect(screen.getByText(/saved to your account/)).toBeInTheDocument();
  // and Undo puts the old theme back
  fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
  expect(mockSetThemeId).toHaveBeenLastCalledWith('night');
});

test('without Premium you can try it in the preview, but not use it', () => {
  mockProfile = { isPremium: false };
  render(<MemoryRouter><ThemeStudio /></MemoryRouter>);
  expect(screen.getByText(/Theme Studio is part of Premium/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Use this theme/ })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'See Premium' })).toHaveAttribute('href', '/premium');
  fireEvent.click(screen.getByRole('tab', { name: 'Shape' }));
  fireEvent.change(screen.getByLabelText('Corner roundness'), { target: { value: '2' } });
  expect(screen.getByRole('img', { name: 'Preview of your theme' }).style.getPropertyValue('--radius-scale')).toBe('2');
  expect(api.updateProfile).not.toHaveBeenCalled();
});
