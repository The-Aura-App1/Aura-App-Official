import { addHashtags, hashtagKey, hashtagWords, MAX_HASHTAGS } from './hashtags';

test('typed input splits on spaces, commas and # into separate tags', () => {
  expect(addHashtags([], '#jazz, LiveMusic #sax')).toEqual({ list: ['jazz', 'LiveMusic', 'sax'], error: '' });
});

test('duplicates are skipped regardless of case', () => {
  expect(addHashtags(['Jazz'], 'jazz JAZZ blues').list).toEqual(['Jazz', 'blues']);
});

test('invalid tags are skipped with an error, valid ones still added', () => {
  const { list, error } = addHashtags([], 'ok no-dashes café x'.concat('y'.repeat(30)));
  expect(list).toEqual(['ok', 'café']);
  expect(error).toMatch(/letters, numbers/);
});

test(`stops at ${MAX_HASHTAGS} tags`, () => {
  const full = Array.from({ length: MAX_HASHTAGS }, (_, i) => `t${i}`);
  const { list, error } = addHashtags(full, 'extra');
  expect(list).toHaveLength(MAX_HASHTAGS);
  expect(error).toMatch(/up to 10/);
});

test('keys ignore case, spaces and underscores', () => {
  expect(hashtagKey('Live_Music')).toBe('livemusic');
  expect(hashtagKey('live music')).toBe('livemusic');
});

test('camelCase and underscores become separate words for the model', () => {
  expect(hashtagWords('StreetPhoto')).toBe('Street Photo');
  expect(hashtagWords('street_photo')).toBe('street photo');
  expect(hashtagWords('jazz')).toBe('jazz');
});
