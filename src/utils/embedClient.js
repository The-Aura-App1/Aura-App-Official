import { encodeVector } from './embeddings';

let worker  = null;
let nextId  = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/embed.worker.js', import.meta.url));
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data.vectors);
  };
  return worker;
}

// Resolves to one base64 vector per text. Passing [] just loads the model.
export function embedTexts(texts, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('The on-device model took too long to respond.'));
    }, timeoutMs);
    pending.set(id, {
      resolve: vectors => { clearTimeout(timer); resolve(vectors.map(encodeVector)); },
      reject:  err     => { clearTimeout(timer); reject(err); },
    });
    getWorker().postMessage({ id, texts });
  });
}

export function warmUpModel() {
  return embedTexts([]).catch(() => {});
}
