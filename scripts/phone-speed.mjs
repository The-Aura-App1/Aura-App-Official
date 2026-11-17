// Phone speed: loads key pages in headless Chrome with a phone-sized screen,
// a slowed CPU and a slow 4G connection, and records how they do.
//   1. node scripts/serve-build.mjs build-audit 3124   (a build made with REACT_APP_PHONE_AUDIT=1 BUILD_PATH=build-audit)
//   2. node scripts/phone-speed.mjs [--url http://localhost:3124] [--cpu 4] [--out phone-speed.json]
// Per page: first paint, largest paint, total blocking time (long tasks over
// 50 ms), JS and total bytes downloaded, and on scrolling pages the frame rate
// while scrolling. Each page loads with an empty cache (a first visit).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('url', 'http://localhost:3124');
const CPU = Number(arg('cpu', '4'));
const OUT = arg('out', 'phone-speed.json');
const ONLY = arg('only', '').split(',').filter(Boolean);
const PAGES = [
  { name: 'welcome', path: '/welcome', signedOut: true, scroll: true },
  { name: 'feed', path: '/', scroll: true },
  { name: 'post', path: '/post/p1', scroll: true },
  { name: 'group-games', path: '/groups/g1?tab=games' },
  { name: 'game-pool', path: '/games/m-pool' },
  { name: 'angel', path: '/angel' },
  { name: 'search', path: '/search?q=sunset' },
  { name: 'create', path: '/create' },
  { name: 'feed-abyss', path: '/', theme: 'abyss', scroll: true },
  { name: 'feed-northern-lights', path: '/', theme: 'northern-lights', scroll: true },
  { name: 'feed-light', path: '/', theme: 'light', scroll: true },
].filter(p => !ONLY.length || ONLY.includes(p.name));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 300);

const SETUP = `(() => {
  window.__perf = { lcp: 0, fcp: 0, tbt: 0, longest: 0 };
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__perf.tbt += Math.max(0, e.duration - 50); window.__perf.longest = Math.max(window.__perf.longest, e.duration); } }).observe({ type: 'longtask', buffered: true });
})()`;

const SCROLL = `new Promise(done => {
  let frames = 0, slow = 0, last = performance.now();
  const start = last, step = () => {
    const now = performance.now(); frames++; if (now - last > 50) slow++; last = now;
    window.scrollBy(0, 14);
    if (now - start < 3000) requestAnimationFrame(step); else done(JSON.stringify({ fps: Math.round(frames / ((now - start) / 1000)), slowFrames: slow }));
  };
  requestAnimationFrame(step);
})`;

const COLLECT = `JSON.stringify({ ...window.__perf,
  js: performance.getEntriesByType('resource').filter(r => /\\.m?js$/.test(r.name.split('?')[0])).reduce((s, r) => s + r.transferSize, 0),
  total: performance.getEntriesByType('resource').reduce((s, r) => s + r.transferSize, 0) + (performance.getEntriesByType('navigation')[0]?.transferSize ?? 0),
  requests: performance.getEntriesByType('resource').length,
})`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-speed-'));
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const results = [];
try {
  let t; for (let i = 0; i < 60 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page'); } catch { /* starting */ } }
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let n = 0; const pend = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const send = (method, params = {}) => new Promise(r => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression, awaitPromise = false) => (await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })).result.result.value;
  await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  for (const page of PAGES) {
    await send('Network.clearBrowserCache');
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await send('Page.navigate', { url: `${BASE}/favicon.ico` }); await sleep(300);
    const storage = { 'aura.tour.v2.audit-me': 'done', 'aura-audit-signed-out': page.signedOut ? '1' : '0', 'aura-theme-id': page.theme ?? 'night', 'aura-theme-base': page.theme === 'light' ? 'light' : 'dark', 'aura-scenery-paused': page.theme ?? 'night' };
    await evaluate(`localStorage.clear(); Object.entries(${JSON.stringify(storage)}).forEach(([k, v]) => localStorage.setItem(k, v)); true`);
    await send('Network.clearBrowserCache');
    // Slow 4G (Lighthouse's mobile profile): 150 ms, ~1.6 Mb/s down, 750 Kb/s up
    await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: SETUP });
    const t0 = Date.now();
    await send('Page.navigate', { url: BASE + page.path });
    await sleep(9000);
    const m = JSON.parse(await evaluate(COLLECT));
    if (page.scroll) Object.assign(m, JSON.parse(await evaluate(SCROLL, true)));
    results.push({ page: page.name, cpu: CPU, fcp: Math.round(m.fcp), lcp: Math.round(m.lcp), tbt: Math.round(m.tbt), longestTask: Math.round(m.longest),
      jsKB: Math.round(m.js / 1024), totalKB: Math.round(m.total / 1024), requests: m.requests, fps: m.fps ?? null, slowFrames: m.slowFrames ?? null, wall: Date.now() - t0 });
    console.log(results.at(-1));
  }
  ws.close();
} finally { chrome.kill(); }
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
