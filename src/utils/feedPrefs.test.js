import { loadPrefs, savePrefs, clearPrefs, cleanPrefs, setTopics, topicChoice } from './feedPrefs';

beforeEach(() => localStorage.clear());

test('nothing saved gives empty preferences', () => {
  expect(loadPrefs('u1')).toEqual({ more: [], less: [] });
});

test('preferences round-trip and are kept per account', () => {
  savePrefs('u1', { more: ['music'], less: ['gaming'] });
  expect(loadPrefs('u1')).toEqual({ more: ['music'], less: ['gaming'] });
  expect(loadPrefs('u2')).toEqual({ more: [], less: [] });
});

test('corrupted storage is ignored instead of crashing', () => {
  localStorage.setItem('aura.feedPrefs.v1.u1', '{not json');
  expect(loadPrefs('u1')).toEqual({ more: [], less: [] });
  localStorage.setItem('aura.feedPrefs.v1.u1', JSON.stringify({ more: 'music', less: [42] }));
  expect(loadPrefs('u1')).toEqual({ more: [], less: [] });
});

test('unknown topics, duplicates and conflicts are cleaned out', () => {
  expect(cleanPrefs({ more: ['music', 'music', 'bogus'], less: ['music', 'art'] }))
    .toEqual({ more: ['music'], less: ['art'] });
});

test('clearPrefs removes saved preferences', () => {
  savePrefs('u1', { more: ['music'], less: [] });
  clearPrefs('u1');
  expect(loadPrefs('u1')).toEqual({ more: [], less: [] });
});

test('setTopics moves topics between more, less and neutral', () => {
  let prefs = { more: [], less: [] };
  prefs = setTopics(prefs, ['music', 'art'], 'more');
  expect(prefs).toEqual({ more: ['music', 'art'], less: [] });
  prefs = setTopics(prefs, ['music'], 'less');
  expect(prefs).toEqual({ more: ['art'], less: ['music'] });
  prefs = setTopics(prefs, ['music'], null);
  expect(prefs).toEqual({ more: ['art'], less: [] });
  expect(topicChoice(prefs, 'art')).toBe('more');
  expect(topicChoice(prefs, 'music')).toBe(null);
});

test('storage errors (private mode) do not throw', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => savePrefs('u1', { more: ['music'], less: [] })).not.toThrow();
  spy.mockRestore();
});
