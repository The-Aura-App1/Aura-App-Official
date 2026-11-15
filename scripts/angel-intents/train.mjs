// Trains Angel's intent classifier: a small softmax layer on top of the
// MiniLM sentence vectors the app already computes on the device. Writes
// src/angel/intentModel.json (a few KB). Run after editing examples.mjs:
//   node scripts/angel-intents/train.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pipeline, env } from '@huggingface/transformers';
import { EXAMPLES } from './examples.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = path.join(root, 'public', 'models') + path.sep;

const DIM = 384;
const labels = Object.keys(EXAMPLES);
const rows = Object.entries(EXAMPLES).flatMap(([label, list]) => [...new Set(list.map(s => s.toLowerCase().trim()))].map(text => ({ text, y: labels.indexOf(label) })));

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
const vectors = [];
for (let i = 0; i < rows.length; i += 64) {
  const out = await extractor(rows.slice(i, i + 64).map(r => r.text), { pooling: 'mean', normalize: true });
  // the app quantizes vectors to int8 before using them, so train on the same
  for (const v of out.tolist()) vectors.push(v.map(x => Math.max(-127, Math.min(127, Math.round(x * 127))) / 127));
}

// Classes are uneven, so each example is weighted by 1 / its class size
const counts = labels.map((_, k) => rows.filter(r => r.y === k).length);

function train(idx, { epochs = +(process.env.EPOCHS ?? 1500), lr = +(process.env.LR ?? 4), l2 = +(process.env.L2 ?? 1e-5) } = {}) {
  const K = labels.length;
  const W = Array.from({ length: K }, () => new Float64Array(DIM));
  const b = new Float64Array(K);
  const total = idx.reduce((s, i) => s + 1 / counts[rows[i].y], 0);
  for (let e = 0; e < epochs; e++) {
    const gW = Array.from({ length: K }, () => new Float64Array(DIM));
    const gb = new Float64Array(K);
    for (const i of idx) {
      const x = vectors[i];
      const p = softmax(W.map((w, k) => dot(w, x) + b[k]));
      const weight = 1 / counts[rows[i].y] / total;
      for (let k = 0; k < K; k++) {
        const g = (p[k] - (k === rows[i].y ? 1 : 0)) * weight;
        gb[k] += g;
        for (let d = 0; d < DIM; d++) gW[k][d] += g * x[d];
      }
    }
    for (let k = 0; k < K; k++) {
      b[k] -= lr * gb[k];
      for (let d = 0; d < DIM; d++) W[k][d] -= lr * (gW[k][d] + l2 * W[k][d]);
    }
  }
  return { W, b };
}
const dot = (w, x) => { let s = 0; for (let d = 0; d < DIM; d++) s += w[d] * x[d]; return s; };
function softmax(z) {
  const m = Math.max(...z);
  const ex = z.map(v => Math.exp(v - m));
  const s = ex.reduce((a, c) => a + c, 0);
  return ex.map(v => v / s);
}
const predict = (m, x) => softmax(m.W.map((w, k) => dot(w, x) + m.b[k]));

// 5-fold check of how well it does on wording it hasn't seen
const order = rows.map((_, i) => i).sort((a, c) => ((a * 7919) % 1009) - ((c * 7919) % 1009));
let right = 0;
for (let f = 0; f < 5; f++) {
  const test = order.filter((_, j) => j % 5 === f);
  const m = train(order.filter((_, j) => j % 5 !== f));
  for (const i of test) {
    const p = predict(m, vectors[i]);
    if (p.indexOf(Math.max(...p)) === rows[i].y) right++;
  }
}
console.log(`${rows.length} examples, ${labels.length} intents; held-out accuracy ${(100 * right / rows.length).toFixed(1)}%`);

const model = train(order);
// int8 weights with one scale per intent keep the file small
const weights = model.W.map(w => {
  const scale = Math.max(...w.map(Math.abs)) / 127 || 1;
  const bytes = new Int8Array(DIM);
  for (let d = 0; d < DIM; d++) bytes[d] = Math.round(w[d] / scale);
  return { scale: +scale.toPrecision(6), w: Buffer.from(bytes.buffer).toString('base64') };
});
const out = { model: 'Xenova/all-MiniLM-L6-v2', dim: DIM, labels, bias: [...model.b].map(v => +v.toFixed(5)), weights };
writeFileSync(path.join(root, 'src', 'angel', 'intentModel.json'), JSON.stringify(out) + '\n');
console.log('wrote src/angel/intentModel.json');
