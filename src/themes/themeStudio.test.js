import { cleanDesign, cleanAccountTheme, DESIGN_MAX_CHARS } from './themeDesign';
import { customVars, cleanCustom, readableKeys, contrast, setStudioAllowed, customThemeInfo, saveCustom } from './customTheme';

const design = {
  colors: { background: '#101820', surface: '#1d2a36', text: '#203040', brand1: '#ff5500', bogus: '#ffffff', border: 'red' },
  backdrop: { kind: 'gradient', type: 'conic', angle: 999, stops: ['#ff0000', '#00ff00', 'nope', '#0000ff', '#ffffff', '#000000'], dim: 3, blur: -4 },
  fonts: { heading: 'not a font!', scale: 4, weight: 650 },
  shape: { radius: 9, cardOpacity: 0.1, cardBlur: 12.4, shadow: 'x', border: 2 },
};

test('designs are cleaned: known keys, real colors, values kept in range', () => {
  const d = cleanDesign(design);
  expect(Object.keys(d.colors).sort()).toEqual(['background', 'brand1', 'surface', 'text']);
  expect(d.backdrop).toMatchObject({ kind: 'gradient', type: 'conic', angle: 360, stops: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'], dim: 0.85, blur: 0 });
  expect(d.fonts).toEqual({ heading: null, scale: 1.2, weight: 700 });
  expect(d.shape).toEqual({ radius: 2, cardOpacity: 0.35, cardBlur: 12, shadow: 1, border: 2 });
  expect(cleanDesign({ backdrop: { kind: 'gradient', stops: ['#ffffff'] } }).backdrop.kind).toBe('glow');
  expect(cleanDesign('nope')).toBeNull();
  expect(cleanDesign([])).toBeNull();
});

test('an account theme needs a design and stays small', () => {
  expect(cleanAccountTheme({ name: 'x', base: 'dark' })).toBeNull();
  const t = cleanAccountTheme({ name: ' Neon​  Nights ', base: 'dark', background: '#000000', accent: '#22ff88', font: 'inter', design });
  expect(t).toMatchObject({ name: 'Neon Nights', base: 'dark', accent: '#22ff88' });
  expect(JSON.stringify(t).length).toBeLessThanOrEqual(DESIGN_MAX_CHARS);
});

test('a design sets every variable, and text stays readable whatever was picked', () => {
  const spec = cleanCustom({ name: 'Test', base: 'dark', background: '#101820', accent: '#7c3aed', design });
  const v = customVars(spec, { studio: true });
  expect(v['--bg-primary']).toBe('#101820');
  expect(v['--brand-1']).toBe('#ff5500');
  expect(v['--radius-scale']).toBe('2');
  expect(v['--card-blur']).toBe('12px');
  expect(v['--bg-card']).toMatch(/^rgba\(29, 42, 54, 0.35\)$/);
  // dark text on a dark card was asked for: it's lightened until it reads
  expect(contrast(v['--text-primary'], '#1d2a36')).toBeGreaterThanOrEqual(7);
  expect(readableKeys(spec)).toContain('text');
  // the same keys with or without a design, so switching clears everything
  expect(Object.keys(customVars({ base: 'light' })).sort()).toEqual(Object.keys(v).sort());
});

test('a design shows only while the account has Premium', () => {
  saveCustom({ name: 'Mine', base: 'dark', background: '#000000', accent: '#22ff88', design: { ...design, backdrop: { kind: 'scene', scene: 'aurora' } } });
  setStudioAllowed(false);
  expect(customThemeInfo().backdrop).toBeNull();
  expect(customThemeInfo().scene).toBeNull();
  expect(customVars(cleanCustom({ base: 'dark', design }))['--radius-scale']).toBe('1');
  setStudioAllowed(true);
  expect(customThemeInfo().scene).toBe('aurora');
  expect(customThemeInfo().backdrop.kind).toBe('scene');
});

test('fonts in a design are limited to the readable kinds', () => {
  const spec = cleanCustom({ base: 'light', design: { fonts: { heading: 'dancing-script' } } });
  expect(spec.design.fonts.heading).toBeNull();
});

test('readable fonts are kept as heading fonts', () => {
  expect(cleanCustom({ base: 'light', design: { fonts: { heading: 'inter' } } }).design.fonts.heading).toBe('inter');
});
