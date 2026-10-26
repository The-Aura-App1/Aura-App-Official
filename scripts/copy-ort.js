// Copies the ONNX runtime files that ship with @huggingface/transformers into
// public/ort so the app serves them itself instead of loading them from a CDN
const fs   = require('fs');
const path = require('path');

const from  = path.join(__dirname, '..', 'node_modules', '@huggingface', 'transformers', 'dist');
const to    = path.join(__dirname, '..', 'public', 'ort');
const files = ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm'];

fs.mkdirSync(to, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(from, file), path.join(to, file));
console.log(`Copied ${files.length} ONNX runtime files to public/ort`);
