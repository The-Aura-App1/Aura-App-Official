// The built-in themes. `base` picks light or dark styling (dark-based themes
// also get the `dark` class, so Tailwind's `dark:` styles apply), `scene` the
// scenery behind the app, `pair` the theme the light/dark switch on the public
// pages flips to, and `bar` the browser toolbar color on phones. `preview`
// draws the theme's card in the picker.
export const THEMES = [
  {
    id: 'day', name: 'Day', base: 'light', scene: 'sky', pair: 'night', bar: '#ede9fe',
    description: 'A dawn sky with drifting clouds.',
    preview: {
      background: 'linear-gradient(180deg, #c9b6ff 0%, #f1e6ff 55%, #fff6ec 100%)',
      card: '#ffffff', text: '#1a0a2e', muted: '#ddd6fe', accent: '#7c3aed',
    },
  },
  {
    id: 'night', name: 'Night', base: 'dark', scene: 'sky', pair: 'day', bar: '#0f0a1f',
    description: 'A starry galaxy with violet nebulae.',
    preview: {
      background: 'radial-gradient(ellipse 70% 50% at 20% 25%, rgba(124, 58, 237, 0.45), transparent 70%), linear-gradient(180deg, #05020d 0%, #170b33 100%)',
      card: '#1a0a2e', text: '#f8f7ff', muted: '#2d1b4e', accent: '#a78bfa',
    },
  },
  {
    id: 'light', name: 'Light', base: 'light', scene: null, pair: 'dark', bar: '#ffffff',
    description: 'Clean and bright, pure white.',
    preview: { background: '#ffffff', card: '#ffffff', text: '#09090b', muted: '#e4e4e7', accent: '#7c3aed' },
  },
  {
    id: 'dark', name: 'Dark', base: 'dark', scene: null, pair: 'light', bar: '#000000',
    description: 'Pure black, easy on OLED screens.',
    preview: { background: '#000000', card: '#0a0a0a', text: '#fafafa', muted: '#27272a', accent: '#a78bfa' },
  },
];

// Every theme id an account can save, including ones still being built.
// aura-users checks saved themes against its own copy (backendContract.test.js
// fails if the two drift apart).
export const THEME_IDS = ['day', 'night', 'light', 'dark', 'snowy-peaks', 'duskfall', 'custom'];

export function getTheme(id) {
  return THEMES.find(t => t.id === id) ?? null;
}

// New visitors start on Day or Night, matching their device's setting.
export function defaultThemeId() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}
