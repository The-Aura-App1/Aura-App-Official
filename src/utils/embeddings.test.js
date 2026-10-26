import { encodeVector, decodeVector, similarity, postEmbeddingText, EMBED_DIM } from './embeddings';

function randomUnit(seed) {
  let x = seed;
  const v = Array.from({ length: EMBED_DIM }, () => { x = (x * 16807) % 2147483647; return x / 2147483647 - 0.5; });
  const norm = Math.hypot(...v);
  return v.map(n => n / norm);
}

test('vectors survive encoding with only rounding error', () => {
  const v = randomUnit(7);
  const encoded = encodeVector(v);
  expect(encoded).toHaveLength(512);
  const decoded = decodeVector(encoded);
  for (let i = 0; i < EMBED_DIM; i++) expect(Math.abs(decoded[i] - v[i])).toBeLessThanOrEqual(0.5 / 127 + 1e-6);
});

test('similarity is about 1 with itself and about -1 with its opposite', () => {
  const v = randomUnit(1);
  const a = decodeVector(encodeVector(v));
  const b = decodeVector(encodeVector(v.map(n => -n)));
  expect(similarity(a, a)).toBeCloseTo(1, 1);
  expect(similarity(a, b)).toBeCloseTo(-1, 1);
});

test('invalid input decodes to null', () => {
  expect(decodeVector(undefined)).toBeNull();
  expect(decodeVector('!!!not base64')).toBeNull();
  expect(decodeVector(btoa('short'))).toBeNull();
});

test('post text combines caption and topic labels, skipping empty parts', () => {
  expect(postEmbeddingText(' Sax solo tonight ', ['Music'])).toBe('Sax solo tonight\nMusic');
  expect(postEmbeddingText('', ['Music', 'Art'])).toBe('Music, Art');
  expect(postEmbeddingText('   ', [])).toBe('');
});

test('hashtags are added as readable words', () => {
  expect(postEmbeddingText('Sax solo', ['Music'], ['jazz', 'LiveMusic'])).toBe('Sax solo\nMusic\njazz, Live Music');
  expect(postEmbeddingText('', [], ['street_photo'])).toBe('street photo');
});
