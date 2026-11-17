import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PeopleAndPlace from './PeopleAndPlace';
import { api } from '../../api';

jest.mock('../../api', () => ({ api: { searchPeople: jest.fn() } }));

function Harness() {
  const [people, setPeople] = useState([]);
  const [location, setLocation] = useState('');
  return <PeopleAndPlace people={people} onPeople={setPeople} location={location} onLocation={setLocation} me="me_here" />;
}

beforeEach(() => {
  jest.useFakeTimers();
  api.searchPeople.mockResolvedValue({ people: [{ username: 'annie', displayName: 'Annie' }, { username: 'me_here', displayName: 'Me' }] });
});
afterEach(() => jest.useRealTimers());

test('search people as you type, tag them, untag them; never yourself', async () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Tag people'), { target: { value: 'ann' } });
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(screen.queryByRole('button', { name: /Me @me_here/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Annie @annie/ }));
  expect(screen.getByText('@annie')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Untag @annie' }));
  expect(screen.queryByText('@annie')).toBeNull();
});

test('a place is a short name you type', () => {
  render(<Harness />);
  const box = screen.getByLabelText(/Where was it taken/);
  fireEvent.change(box, { target: { value: 'x'.repeat(80) } });
  expect(box.value).toHaveLength(60);
});
