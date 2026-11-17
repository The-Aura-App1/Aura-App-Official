import fs from 'fs';
import path from 'path';

// Every route in App.jsx has to be on the phone audit's list
// (scripts/phone-audit-routes.json), so a new page can't skip the phone check.
test('the phone audit covers every route', () => {
  const app = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  const { pages } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'phone-audit-routes.json'), 'utf8'));
  const covered = new Set(pages.map(p => p.route));
  const routes = [...app.matchAll(/<Route\s+(?:path="([^"]+)"|index)/g)]
    .map(m => (m[1] === undefined ? '/' : m[1]))
    .filter(r => r !== '*' && r !== '/')
    .map(r => (r.startsWith('/') ? r : `/${r}`));
  routes.push('/');
  expect(routes.length).toBeGreaterThan(20);   // the pattern really found them
  const missing = [...new Set(routes)].filter(r => !covered.has(r));
  expect(missing).toEqual([]);
});
