import fs from 'fs';
import path from 'path';
import { PATTERNS, cleanPattern, cleanGradient, cleanFrame, patternCss, gradientCss, customFrameVars, autoInk, inkReads, contrastOf, surfaceColors } from './postDesign';
import { cleanStyle, textCardStyle, frameStyle, hasCard, POST_FRAMES } from './postStyle';

test('a library of 24 or more patterns, each drawn from its two colors and a size', () => {
  expect(PATTERNS.length).toBeGreaterThanOrEqual(24);
  for (const [id] of PATTERNS) for (const s of ['s', 'm', 'l']) {
    const css = patternCss({ id, c: ['#102030', '#f0e0d0'], s });
    expect(css).toBeTruthy();
    expect(css).not.toMatch(/undefined|NaN/);
  }
  expect(POST_FRAMES.length).toBeGreaterThanOrEqual(24);
});

test('anything out of bounds is refused (fail closed)', () => {
  expect(cleanPattern({ id: 'nope', c: ['#000000', '#ffffff'] })).toBeNull();
  expect(cleanPattern({ id: 'dots', c: ['red', '#ffffff'] })).toBeNull();
  expect(cleanPattern({ id: 'dots', c: ['#000000'] })).toBeNull();
  expect(cleanPattern({ id: 'dots', c: ['#000000', '#ffffff'], s: 'xl' })).toBeNull();
  const stops = n => Array.from({ length: n }, (_, i) => ['#112233', i * 20]);
  expect(cleanGradient({ t: 'linear', stops: stops(5) })).toBeNull();
  expect(cleanGradient({ t: 'linear', stops: stops(1) })).toBeNull();
  expect(cleanGradient({ t: 'spiral', stops: stops(2) })).toBeNull();
  expect(cleanGradient({ t: 'linear', stops: [['#000000', 0], ['#ffffff', 101]] })).toBeNull();
  expect(cleanGradient({ t: 'linear', stops: [['#000000', 60], ['#ffffff', 10]] })).toBeNull();
  expect(cleanGradient({ t: 'linear', stops: stops(2), a: 400 })).toBeNull();
  expect(cleanGradient({ t: 'linear', stops: [['url(evil)', 0], ['#ffffff', 100]] })).toBeNull();
  expect(cleanFrame({ w: 1, c: ['#ffffff'] })).toBeNull();
  expect(cleanFrame({ w: 13, c: ['#ffffff'] })).toBeNull();
  expect(cleanFrame({ c: ['#ffffff', '#000000', '#111111', '#222222'] })).toBeNull();
  expect(cleanFrame({ c: ['#ffffff'], line: 'wavy' })).toBeNull();
  expect(cleanFrame({ c: ['#ffffff'], glow: 4 })).toBeNull();
  expect(gradientCss({ t: 'mesh', stops: [['#000000', 0], ['#ff0000', 100]], a: 0, grain: true })).toMatch(/radial-gradient/);
  expect(customFrameVars({ w: 4, c: ['#a855f7', '#22d3ee'], line: 'dashed', corner: 'square', glow: 2 })).toMatchObject({ '--frame-w': '4px', '--frame-line': 'dashed', borderRadius: '4px' });
});

test('text always reads: automatic ink, and colors that fail are dropped', () => {
  expect(autoInk(['#fde68a', '#fef9c3'])).toBe('#111827');
  expect(autoInk(['#020617', '#1e3a8a'])).toBe('#ffffff');
  const style = cleanStyle({ grad: { t: 'linear', stops: [['#fde68a', 0], ['#fef9c3', 100]] }, color: '#ffffff' }, 'text');
  expect(style.color).toBeUndefined();   // white on pale yellow is dropped
  expect(textCardStyle(style).color).toBe('#111827');
  expect(inkReads('#111827', surfaceColors(style))).toBe(true);
  expect(contrastOf('#ffffff', '#000000')).toBeCloseTo(21, 0);
});

test('one background and one frame; old posts render exactly as before', () => {
  const both = cleanStyle({ bg: 'dusk', pat: { id: 'dots', c: ['#000000', '#ffffff'], s: 'm' } }, 'text');
  expect(both.bg).toBeUndefined();
  expect(hasCard(both)).toBe(true);
  expect(cleanStyle({ frame: 'gold', fr: { w: 3, c: ['#ffffff'] } }, 'text').frame).toBeUndefined();
  // an existing post: preset background and frame, unchanged output
  const old = { bg: 'dusk', frame: 'gold', font: 'inter' };
  expect(textCardStyle(old).background).toBe('linear-gradient(160deg, #1e1b4b, #7c3aed 55%, #f472b6)');
  expect(frameStyle(old)['--frame-paint']).toMatch(/#fde68a/);
  // photos and videos can take a built frame but not a pattern
  expect(cleanStyle({ fr: { w: 3, c: ['#ffffff'] }, pat: { id: 'dots', c: ['#000000', '#ffffff'] } }, 'image')).toEqual({ fr: { w: 3, c: ['#ffffff'], line: 'solid', corner: 'round', glow: 0 } });
});

test('the app and aura-posts share the same rules file', () => {
  const app = fs.readFileSync(path.join(__dirname, 'postDesign.js'), 'utf8').replace(/\r\n/g, '\n');
  const server = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'lambdas', 'aura-posts', 'postDesign.mjs'), 'utf8').replace(/\r\n/g, '\n');
  expect(server).toBe(app);
});
