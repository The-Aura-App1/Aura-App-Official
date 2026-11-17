import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { signInWithRedirect } from 'aws-amplify/auth';
import GoogleButton from './GoogleButton';

let mockGoogleOn = false;
jest.mock('aws-amplify/auth', () => ({ signInWithRedirect: jest.fn() }));
jest.mock('../../amplifyConfigure', () => ({ get GOOGLE_SIGN_IN() { return mockGoogleOn; } }));

test('hidden until Google is set up in Cognito', () => {
  mockGoogleOn = false;
  const { container } = render(<GoogleButton />);
  expect(container).toBeEmptyDOMElement();
});

test('once set up, it starts Google sign-in', async () => {
  mockGoogleOn = true;
  signInWithRedirect.mockResolvedValue();
  render(<GoogleButton />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ })); });
  expect(signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' });
});
