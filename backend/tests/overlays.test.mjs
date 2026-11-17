// Things placed on posts: what aura-posts accepts and refuses
import assert from 'node:assert/strict';
import { checkOverlays, cleanUrl, MAX_OVERLAYS } from '../lambdas/aura-posts/overlays.mjs';
import { cleanText } from '../lambdas/aura-posts/text.mjs';

const at = (o) => ({ slide: 0, x: 0.5, y: 0.5, size: 1, color: '#ffffff', ...o });
const ok = list => { const r = checkOverlays(list, 2, cleanText); assert.equal(r.error, undefined, r.error); return r.overlays; };
const bad = (list, slides = 2) => assert.ok(checkOverlays(list, slides, cleanText).error, JSON.stringify(list));

// accepted, normalized
const out = ok([
  at({ kind: 'text', text: 'Hi\u0007 there', bg: 'solid', x: 0.12345 }),
  at({ kind: 'link', url: 'https://shop.example.com/x?y=1', label: ' Shop ' }),
  at({ kind: 'mention', username: '@Bob_1' }),
  at({ kind: 'hashtag', tag: '#café' }),
  at({ kind: 'emoji', emoji: '🔥', slide: 1 }),
  at({ kind: 'text', text: 'extra', evil: '<script>' }),
]);
assert.equal(out[0].x, 0.123);
assert.ok(!out[0].text.includes('\u0007'));
assert.equal(out[1].label, 'Shop');
assert.equal(out[2].username, 'bob_1');
assert.equal(out[3].tag, 'café');
assert.equal(out[5].evil, undefined, 'unknown fields are dropped');
assert.deepEqual(checkOverlays(undefined, 1, cleanText), { overlays: [] });
// Fonts: any from the post catalog, script and handwriting included; emoji get none
const fonts = ok([at({ kind: 'text', text: 'Hi', font: 'pacifico' }), at({ kind: 'mention', username: 'bob', font: 'inter' }), at({ kind: 'emoji', emoji: '🔥', font: 'inter' })]);
assert.equal(fonts[0].font, 'pacifico');
assert.equal(fonts[1].font, 'inter');
assert.equal(fonts[2].font, undefined);
bad([at({ kind: 'text', text: 'Hi', font: 'comic-sans-9000' })]);
bad([at({ kind: 'text', text: 'Hi', font: '<script>' })]);

// refused
for (const url of ['javascript:alert(1)', 'data:text/html,x', 'https://u:p@x.com', 'ftp://x.com', 'https://localhost', 'notaurl', 'https://x.com/' + 'a'.repeat(300)]) {
  assert.equal(cleanUrl(url), null, url);
  bad([at({ kind: 'link', url })]);
}
bad([at({ kind: 'text', text: '   ' })]);
bad([at({ kind: 'text', text: 'x'.repeat(121) })]);
bad([at({ kind: 'text', text: 'x', bg: 'url(evil)' })]);
bad([at({ kind: 'text', text: 'x', color: 'red' })]);
bad([at({ kind: 'text', text: 'x', slide: 2 })]);
bad([at({ kind: 'text', text: 'x', slide: 1 })], 1);
bad([at({ kind: 'text', text: 'x', y: -0.1 })]);
bad([at({ kind: 'text', text: 'x', size: 9 })]);
bad([at({ kind: 'text', text: 'x', x: NaN })]);
bad([at({ kind: 'mention', username: 'no spaces allowed' })]);
bad([at({ kind: 'hashtag', tag: 'two words' })]);
bad([at({ kind: 'emoji', emoji: 'A' })]);
bad([at({ kind: 'html', text: 'x' })]);
bad('not a list');
bad(Array(MAX_OVERLAYS + 1).fill(at({ kind: 'emoji', emoji: '🔥' })));
console.log('overlays: ok');
