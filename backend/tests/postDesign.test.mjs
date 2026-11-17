// Patterns, gradients and built frames on posts (aura-posts postStyle.mjs +
// postDesign.mjs): valid ones are stored as parameters, everything else is
// refused. Run: npm run test:games
import assert from 'node:assert/strict';
import { checkStyle } from '../lambdas/aura-posts/postStyle.mjs';

const me = { isPremium: false };
const ok = (style, type = 'text') => { const r = checkStyle(style, type, me); assert.equal(r.error, undefined, `${JSON.stringify(style)}: ${r.error}`); return r.style; };
const bad = (style, type = 'text') => assert.ok(checkStyle(style, type, me).error, JSON.stringify(style));

// stored as parameters
assert.deepEqual(ok({ pat: { id: 'hexagons', c: ['#1e1b4b', '#a78bfa'], s: 'l' } }).pat, { id: 'hexagons', c: ['#1e1b4b', '#a78bfa'], s: 'l' });
assert.deepEqual(ok({ grad: { t: 'mesh', stops: [['#000000', 0], ['#7c3aed', 60]], a: 90, grain: true } }).grad, { t: 'mesh', stops: [['#000000', 0], ['#7c3aed', 60]], a: 90, grain: true });
assert.deepEqual(ok({ fr: { w: 6, c: ['#f59e0b'], line: 'dotted' } }).fr, { w: 6, c: ['#f59e0b'], line: 'dotted', corner: 'round', glow: 0 });
assert.ok(ok({ fr: { w: 3, c: ['#ffffff'] } }, 'image').fr, 'photos can take a built frame');
assert.equal(ok({ frame: 'holo' }).frame, 'holo', 'a new preset frame');

// refused: bad values, raw CSS, two backgrounds, two frames, unreadable text, a pattern on a photo
bad({ pat: { id: 'hexagons', c: ['#1e1b4b', 'red'] } });
bad({ pat: { id: 'nope', c: ['#000000', '#ffffff'] } });
bad({ pat: 'radial-gradient(red, blue)' });
bad({ grad: { t: 'linear', stops: [['#000000', 0], ['#111111', 10], ['#222222', 20], ['#333333', 30], ['#444444', 40]] } });
bad({ grad: { t: 'linear', stops: [['#000000', 0], ['#ffffff', 100]], a: -5 } });
bad({ grad: { t: 'linear', stops: [['javascript:alert(1)', 0], ['#ffffff', 100]] } });
bad({ fr: { w: 40, c: ['#ffffff'] } });
bad({ fr: { w: 3, c: [] } });
bad({ bg: 'dusk', pat: { id: 'dots', c: ['#000000', '#ffffff'] } });
bad({ frame: 'gold', fr: { w: 3, c: ['#ffffff'] } });
bad({ grad: { t: 'linear', stops: [['#fde68a', 0], ['#fef9c3', 100]] }, color: '#ffffff' });
bad({ pat: { id: 'dots', c: ['#000000', '#ffffff'] } }, 'image');
// readable text on a pattern is fine
assert.equal(ok({ pat: { id: 'dots', c: ['#0f172a', '#334155'] }, color: '#f8fafc' }).color, '#f8fafc');
console.log('post designs: ok');
