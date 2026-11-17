// Serves a built copy of the app (default build-audit/) on a port, sending
// unknown paths to index.html like the real host does. Gzips text files so
// the phone-speed measurements see realistic download sizes.
//   node scripts/serve-build.mjs [folder] [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] ?? 'build-audit');
const port = Number(process.argv[3] ?? 3124);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.txt': 'text/plain' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const ext = path.extname(file);
  const body = fs.readFileSync(file);
  const text = /^(text|application\/(json|javascript))/.test(TYPES[ext] ?? '') || ext === '.svg';
  const headers = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000' };
  if (text && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
    res.end(zlib.gzipSync(body));
  } else {
    res.writeHead(200, headers);
    res.end(body);
  }
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
