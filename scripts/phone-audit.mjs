// Phone audit: opens every page in scripts/phone-audit-routes.json at every
// viewport in headless Chrome (through its DevTools protocol, no extra
// packages), measures layout problems and takes screenshots.
//
// 1. Start the app in audit mode (sample data, a made-up signed-in account,
//    nothing sent to the real server):
//      PowerShell:  $env:REACT_APP_PHONE_AUDIT='1'; $env:BROWSER='none'; $env:PORT='3123'; npx react-scripts start
// 2. Run:  node scripts/phone-audit.mjs [--url http://localhost:3123] [--only feed,post] [--themes night,light] [--out phone-audit-out]
//
// Fails (exit code 1) when a page scrolls sideways or something sticks out
// past the screen's edge. Also lists, without failing: tap targets under
// 32px, text inputs under 16px (iPhones zoom in on those), crashes, missing
// sample data and error messages on the page. Writes report.json, report.md
// and screenshots (360 and 390 wide) to the out folder.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const BASE = arg('url', 'http://localhost:3123');
const OUT = path.resolve(arg('out', 'phone-audit-out'));
const ONLY = arg('only', '')?.split(',').filter(Boolean);
const THEMES = arg('themes', 'night,light').split(',');
const SHOTS = new Set(arg('shots', '360,390').split(','));
const VIEWPORTS = arg('viewports', '')?.split(',').filter(Boolean);
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const { pages, viewports } = JSON.parse(fs.readFileSync(path.join(here, 'phone-audit-routes.json'), 'utf8'));
const todo = pages.filter(p => !ONLY.length || ONLY.includes(p.name));
const sizes = viewports.filter(v => !VIEWPORTS.length || VIEWPORTS.includes(v.name));
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9400 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-audit-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

// What's measured on each page, in the page itself
const MEASURE = `(() => {
  const W = innerWidth;
  const label = el => {
    const cls = typeof el.className === 'string' ? el.className.split(/\\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    const text = (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (text ? ' "' + text + '"' : '');
  };
  const decorative = el => !!el.closest('[aria-hidden="true"]');
  const clippedInside = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(hidden|auto|scroll|clip)/.test(s.overflowX + s.overflow)) {
        const r = p.getBoundingClientRect();
        if (r.right <= W + 1 && r.left >= -1) return true;
      }
    }
    return false;
  };
  const visible = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; };
  const sticking = [], smallTaps = [], smallInputs = [];
  let chain = null;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || decorative(el) || !visible(el)) continue;
    if ((r.right > W + 1 || r.left < -1) && !clippedInside(el)) {
      sticking.push(label(el) + ' (' + Math.round(r.left) + '..' + Math.round(r.right) + ')');
      // where the width comes from: the first offender's parents
      if (!chain) { chain = []; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const b = p.getBoundingClientRect(); chain.push(label(p).slice(0, 60) + ' ' + Math.round(b.left) + '..' + Math.round(b.right)); } }
    }
    if (el.matches('a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, [role="tab"], [role="radio"]') && (r.width < 32 || r.height < 32)) smallTaps.push(label(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), textarea, select') && parseFloat(getComputedStyle(el).fontSize) < 16) smallInputs.push(label(el) + ' ' + getComputedStyle(el).fontSize);
  }
  // only the outermost offenders matter (children of a wide box are wide too)
  const text = document.body.innerText;
  const errors = (text.match(/[^\\n]*(Something went wrong|didn.t load|couldn.t load|Try again|Internal server error)[^\\n]*/gi) || []).slice(0, 3);
  return JSON.stringify({
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - W,
    sticking: sticking.slice(0, 6), stickingCount: sticking.length,
    smallTaps: smallTaps.slice(0, 6), smallTapCount: smallTaps.length,
    smallInputs: smallInputs.slice(0, 4), smallInputCount: smallInputs.length,
    errors, chain, path: location.pathname + location.search, innerWidth: W, clientWidth: document.documentElement.clientWidth,
  });
})()`;

async function connect() {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* starting */ }
  }
  if (!target) throw new Error('Chrome did not start.');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let n = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') events.push(`crash: ${m.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails?.text}`);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      const msg = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (/\[audit\]|Error|Uncaught|is not a function|undefined/.test(msg) && !/React Router Future|DevTools|Download the React/.test(msg)) events.push(`${m.params.type}: ${msg.slice(0, 160)}`);
    }
  });
  const send = (method, params = {}) => new Promise(r => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  return { send, events, close: () => ws.close() };
}

const results = [];
try {
  const { send, events, close } = await connect();
  await send('Page.navigate', { url: BASE });
  await sleep(4000);
  for (const theme of THEMES) {
    for (const page of todo) {
      for (const vp of sizes) {
        events.length = 0;
        // a clean slate each time: a phone's emulation must not leak into the next size
        await send('Emulation.clearDeviceMetricsOverride');
        await send('Page.navigate', { url: 'about:blank' });
        await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.width < 600 });
        await send('Emulation.setTouchEmulationEnabled', { enabled: vp.width < 900 });
        const storage = {
          'aura-theme-id': theme, 'aura-theme-base': theme === 'light' || theme === 'day' ? 'light' : 'dark',
          'aura.tour.v2.audit-me': page.path.includes('tour=1') ? '' : 'done',
          'aura-audit-signed-out': page.signedOut ? '1' : '0',
          'aura.feedView': 'posts', 'aura-scenery-paused': theme,
          ...(page.storage ?? {}),
        };
        // storage belongs to the app's origin, so open a small file from it first
        await send('Page.navigate', { url: `${BASE}/favicon.ico` });
        await sleep(250);
        await send('Runtime.evaluate', { expression: `localStorage.clear(); Object.entries(${JSON.stringify(storage)}).forEach(([k, v]) => localStorage.setItem(k, v)); true` });
        await send('Page.navigate', { url: BASE + page.path });
        await sleep(page.name.startsWith('game-') || page.name === 'angel' ? 3200 : 2200);
        const m = JSON.parse((await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true })).result.result.value);
        const fail = m.overflow > 1 || m.stickingCount > 0;
        let shot = null;
        if (SHOTS.has(vp.name)) {
          const img = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          shot = `${page.name}-${vp.name}-${theme}.png`;
          fs.writeFileSync(path.join(OUT, shot), Buffer.from(img.result.data, 'base64'));
        }
        results.push({ page: page.name, viewport: vp.name, theme, fail, ...m, events: [...new Set(events)].slice(0, 5), shot });
        process.stdout.write(fail ? 'x' : '.');
      }
    }
  }
  close();
} finally {
  chrome.kill();
}

// ── Report ──
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
const vpNames = sizes.map(v => v.name);
const lines = ['# Phone audit', '', `${new Date().toISOString()} · ${BASE} · themes: ${THEMES.join(', ')}`, ''];
for (const theme of THEMES) {
  lines.push(`## ${theme}`, '', `| Page | ${vpNames.join(' | ')} |`, `|---|${vpNames.map(() => '---').join('|')}|`);
  for (const page of todo) {
    const row = vpNames.map(v => {
      const r = results.find(x => x.page === page.name && x.viewport === v && x.theme === theme);
      return !r ? '–' : r.fail ? `**fail** (${Math.max(r.overflow, 0)}px)` : 'pass';
    });
    lines.push(`| ${page.name} | ${row.join(' | ')} |`);
  }
  lines.push('');
}
lines.push('## Details', '');
for (const r of results.filter(x => x.fail || x.events.length || x.errors.length || (x.viewport === '360' && (x.smallTapCount || x.smallInputCount)))) {
  lines.push(`### ${r.page} · ${r.viewport} · ${r.theme}`);
  if (r.fail) lines.push(`- Sideways overflow ${r.overflow}px; sticking out: ${r.sticking.join('; ') || 'none listed'}`, `  - inside: ${(r.chain ?? []).join(' < ')}`);
  if (r.viewport === '360' && r.smallTapCount) lines.push(`- ${r.smallTapCount} small tap targets, e.g. ${r.smallTaps.join('; ')}`);
  if (r.viewport === '360' && r.smallInputCount) lines.push(`- ${r.smallInputCount} inputs under 16px: ${r.smallInputs.join('; ')}`);
  if (r.errors.length) lines.push(`- On the page: ${r.errors.join(' | ')}`);
  if (r.events.length) lines.push(`- Console: ${r.events.join(' | ')}`);
  lines.push('');
}
fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n'));
const failed = results.filter(r => r.fail);
console.log(`\n${results.length} checks, ${failed.length} failed. Report: ${path.join(OUT, 'report.md')}`);
process.exit(failed.length ? 1 : 0);
