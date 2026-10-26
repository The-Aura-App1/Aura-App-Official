import {
  loadPrefs, savePrefs, clearPrefs, cleanPrefs, setTopics, topicChoice,
  addKeyword, removeKeyword, hasKeyword, MAX_KEYWORDS,
} from './feedPrefs';
import { encodeVector, EMBED_DIM } from './embeddings';

const EMPTY = { more: [], less: [], words: [] };
const unit  = i => encodeVector(Array.from({ length: EMBED_DIM }, (_, j) => (j === i ? 1 : 0)));

beforeEach(() => localStorage.clear());

test('nothing saved gives empty preferences', () => {
  expect(loadPrefs('u1')).toEqual(EMPTY);
});

test('preferences round-trip and are kept per account', () => {
  const prefs = { more: ['music'], less: ['gaming'], words: [{ text: 'jazz', vec: unit(0), choice: 'more' }] };
  savePrefs('u1', prefs);
  expect(loadPrefs('u1')).toEqual(prefs);
  expect(loadPrefs('u2')).toEqual(EMPTY);
});

test('preferences saved before keywords existed still load', () => {
  localStorage.setItem('aura.feedPrefs.v1.u1', JSON.stringify({ more: ['music'], less: [] }));
  expect(loadPrefs('u1')).toEqual({ more: ['music'], less: [], words: [] });
});

test('corrupted storage is ignored instead of crashing', () => {
  localStorage.setItem('aura.feedPrefs.v1.u1', '{not json');
  expect(loadPrefs('u1')).toEqual(EMPTY);
  localStorage.setItem('aura.feedPrefs.v1.u1', JSON.stringify({ more: 'music', less: [42], words: 'jazz' }));
  expect(loadPrefs('u1')).toEqual(EMPTY);
});

test('unknown topics, duplicates and conflicts are cleaned out', () => {
  expect(cleanPrefs({ more: ['music', 'music', 'bogus'], less: ['music', 'art'] }))
    .toEqual({ more: ['music'], less: ['art'], words: [] });
});

test('keywords with bad vectors, bad choices, duplicates or too much text are dropped', () => {
  const words = [
    { text: 'jazz', vec: unit(0), choice: 'more' },
    { text: 'JAZZ', vec: unit(1), choice: 'less' },
    { text: 'broken', vec: 'not-a-vector', choice: 'more' },
    { text: 'sideways', vec: unit(2), choice: 'maybe' },
    { text: 'x'.repeat(41), vec: unit(3), choice: 'more' },
    { text: '   ', vec: unit(4), choice: 'more' },
  ];
  expect(cleanPrefs({ words }).words).toEqual([{ text: 'jazz', vec: unit(0), choice: 'more' }]);
});

test(`at most ${MAX_KEYWORDS} keywords are kept`, () => {
  const words = Array.from({ length: MAX_KEYWORDS + 3 }, (_, i) => ({ text: `w${i}`, vec: unit(i), choice: 'more' }));
  expect(cleanPrefs({ words }).words).toHaveLength(MAX_KEYWORDS);
});

test('adding, replacing and removing keywords', () => {
  let prefs = addKeyword(EMPTY, 'jazz', unit(0), 'more');
  expect(hasKeyword(prefs, ' Jazz ')).toBe(true);
  prefs = addKeyword(prefs, 'Jazz', unit(0), 'less');
  expect(prefs.words).toEqual([{ text: 'Jazz', vec: unit(0), choice: 'less' }]);
  prefs = removeKeyword(prefs, 'Jazz');
  expect(prefs.words).toEqual([]);
});

test('clearPrefs removes saved preferences', () => {
  savePrefs('u1', { more: ['music'], less: [] });
  clearPrefs('u1');
  expect(loadPrefs('u1')).toEqual(EMPTY);
});

test('setTopics moves topics between more, less and neutral and keeps keywords', () => {
  const words = [{ text: 'jazz', vec: unit(0), choice: 'more' }];
  let prefs = { more: [], less: [], words };
  prefs = setTopics(prefs, ['music', 'art'], 'more');
  expect(prefs).toEqual({ more: ['music', 'art'], less: [], words });
  prefs = setTopics(prefs, ['music'], 'less');
  expect(prefs).toEqual({ more: ['art'], less: ['music'], words });
  prefs = setTopics(prefs, ['music'], null);
  expect(prefs).toEqual({ more: ['art'], less: [], words });
  expect(topicChoice(prefs, 'art')).toBe('more');
  expect(topicChoice(prefs, 'music')).toBe(null);
});

test('storage errors (private mode) do not throw', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => savePrefs('u1', { more: ['music'], less: [] })).not.toThrow();
  spy.mockRestore();
});
