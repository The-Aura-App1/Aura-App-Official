/* eslint-disable no-restricted-globals */
import { pipeline, env } from '@huggingface/transformers';
import { EMBED_MODEL } from '../utils/embeddings';

// Runs the model off the main thread. The model (public/models) and runtime
// (public/ort) are served by Aura itself; nothing loads from third parties and
// the text being embedded never leaves the device.
env.allowRemoteModels = false;
env.allowLocalModels  = true;
env.localModelPath    = '/models/';
env.backends.onnx.wasm.wasmPaths = '/ort/';

let extractor = null;

self.onmessage = async ({ data }) => {
  const { id, texts } = data;
  try {
    extractor ??= pipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' });
    const run    = await extractor;
    const output = texts.length ? await run(texts, { pooling: 'mean', normalize: true }) : null;
    self.postMessage({ id, vectors: output ? output.tolist() : [] });
  } catch (err) {
    extractor = null;
    self.postMessage({ id, error: err.message || 'Embedding failed.' });
  }
};
