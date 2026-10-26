// Vectors are stored as base64 of 384 signed bytes (value * 127), about 512
// characters per post. Keep EMBED_DIM and EMBED_MODEL in sync with aura-posts.
import { hashtagWords } from './hashtags';

export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM   = 384;

export function encodeVector(vector) {
  const bytes = new Int8Array(EMBED_DIM);
  for (let i = 0; i < EMBED_DIM; i++) {
    bytes[i] = Math.max(-127, Math.min(127, Math.round(vector[i] * 127)));
  }
  let binary = '';
  for (const b of new Uint8Array(bytes.buffer)) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Returns a Float32Array, or null if the string isn't a valid vector
export function decodeVector(encoded) {
  if (typeof encoded !== 'string') return null;
  let binary;
  try {
    binary = atob(encoded);
  } catch {
    return null;
  }
  if (binary.length !== EMBED_DIM) return null;
  const vector = new Float32Array(EMBED_DIM);
  for (let i = 0; i < EMBED_DIM; i++) {
    const byte = binary.charCodeAt(i);
    vector[i] = (byte > 127 ? byte - 256 : byte) / 127;
  }
  return vector;
}

// Vectors are normalized, so the dot product is the cosine similarity
export function similarity(a, b) {
  let sum = 0;
  for (let i = 0; i < EMBED_DIM; i++) sum += a[i] * b[i];
  return sum;
}

export function postEmbeddingText(caption, topicLabels, hashtags = []) {
  return [caption?.trim().slice(0, 1000), topicLabels.join(', '), hashtags.map(hashtagWords).join(', ')]
    .filter(Boolean).join('\n');
}
