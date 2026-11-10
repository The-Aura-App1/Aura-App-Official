// Tiny landscape pictures for the picker cards, as inline SVGs.
const svg = body => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='none'>${body}</svg>`)}")`;
const PEAKS_ART = svg(
  "<path d='M0 70 L22 42 L34 52 L55 28 L74 50 L92 36 L118 58 L138 34 L160 52 L160 100 L0 100Z' fill='#a5b7de'/>" +
  "<path d='M55 28 L48 37 L54 35 L58 39 L63 35Z M138 34 L132 41 L137 40 L141 43 L145 40Z' fill='#ffffff'/>" +
  "<path d='M0 84 L30 66 L52 78 L80 60 L104 76 L130 64 L160 80 L160 100 L0 100Z' fill='#7f95c6'/>"
);
const DUSK_ART = svg(
  "<ellipse cx='80' cy='55' rx='60' ry='18' fill='#ff9a6a' opacity='0.55'/>" +
  "<rect y='55' width='160' height='25' fill='#24183f'/>" +
  "<path d='M0 78 Q80 72 160 77 L160 100 L0 100Z' fill='#2c1d2f'/>" +
  "<path d='M0 79 Q40 75 80 79 T160 78' stroke='#efe9ff' stroke-opacity='0.7' stroke-width='1.2' fill='none'/>"
);

const CITY_ART = svg(
  "<path d='M10 58 C30 50 50 44 70 46 C90 48 105 58 120 66 L120 100 L10 100Z' fill='#1f1748'/>" +
  "<path d='M22 48 h4 l2 -6 h2 l2 6 h4 M38 43 h5 v6 h-5Z' stroke='#f6f0ff' stroke-width='1.2' fill='none'/>" +
  "<path d='M0 100 V72 h12 V64 h10 V76 h14 V60 h8 V70 h16 V56 h10 V74 h14 V30 l3 -14 l3 14 V66 h12 V58 h14 V70 h18 V62 h12 V100Z' fill='#2b2160'/>" +
  "<rect y='88' width='160' height='12' fill='#0a0618'/>" +
  "<circle cx='132' cy='18' r='7' fill='#f3ebff'/>"
);

// The built-in themes. `base` picks light or dark styling (dark-based themes
// also get the `dark` class, so Tailwind's `dark:` styles apply), `scene` the
// scenery behind the app, and `bar` the browser toolbar color on phones.
// `preview` draws the theme's card in the picker.
export const THEMES = [
  {
    id: 'day', name: 'Day', base: 'light', scene: 'sky', bar: '#ede9fe',
    description: 'A dawn sky with drifting clouds.',
    preview: {
      background: 'linear-gradient(180deg, #cfc3f2 0%, #f2eafb 55%, #fcf6ef 100%)',
      card: '#ffffff', text: '#1a0a2e', muted: '#ddd6fe', accent: '#7c3aed',
    },
  },
  {
    id: 'night', name: 'Night', base: 'dark', scene: 'sky', bar: '#0f0a1f',
    description: 'A starry galaxy with violet nebulae.',
    preview: {
      background: 'radial-gradient(ellipse 70% 50% at 20% 25%, rgba(124, 58, 237, 0.45), transparent 70%), linear-gradient(180deg, #05020d 0%, #170b33 100%)',
      card: '#1a0a2e', text: '#f8f7ff', muted: '#2d1b4e', accent: '#a78bfa',
    },
  },
  {
    id: 'light', name: 'Light', base: 'light', scene: null, bar: '#ffffff',
    description: 'Clean and bright, pure white.',
    preview: { background: '#ffffff', card: '#ffffff', text: '#09090b', muted: '#e4e4e7', accent: '#7c3aed' },
  },
  {
    id: 'dark', name: 'Dark', base: 'dark', scene: null, bar: '#000000',
    description: 'Pure black, easy on OLED screens.',
    preview: { background: '#000000', card: '#0a0a0b', text: '#fafafa', muted: '#27272a', accent: '#a78bfa' },
  },
  {
    id: 'snowy-peaks', name: 'Snowy Peaks', base: 'light', scene: 'peaks', bar: '#dbe7f8',
    description: 'Snowcapped mountains and falling snow.',
    preview: {
      background: `${PEAKS_ART} bottom / 100% 60% no-repeat, linear-gradient(180deg, #a9c8f0 0%, #eaf1fc 100%)`,
      card: '#ffffff', text: '#0f1d33', muted: '#d5e0f0', accent: '#5c70e6',
    },
  },
  {
    id: 'duskfall', name: 'Duskfall', base: 'dark', scene: 'beach', bar: '#0c0a1d',
    description: 'A dark beach at dusk, waves rolling in.',
    preview: {
      background: `${DUSK_ART} bottom / 100% 100% no-repeat, linear-gradient(180deg, #05061a 0%, #3b1f52 55%)`,
      card: '#15102b', text: '#fbf3f0', muted: '#2e2245', accent: '#f4808c',
    },
  },
  {
    id: 'city-skies', name: 'City Skies', base: 'dark', scene: 'city', bar: '#0a0820',
    description: 'A dreamy city at night, seen from a rooftop.',
    preview: {
      background: `${CITY_ART} bottom / 100% 100% no-repeat, linear-gradient(180deg, #04030f 0%, #1c1449 55%, #5e2672 100%)`,
      card: '#120e30', text: '#f6f3ff', muted: '#2a2152', accent: '#c04fd8',
    },
  },
];

// The scenes the welcome and sign-in pages rotate through, in order. Light
// and dark scenes alternate where they can.
export const PUBLIC_ROTATION = ['day', 'city-skies', 'snowy-peaks', 'night', 'duskfall'];

// Every theme id an account can save, including ones still being built.
// aura-users checks saved themes against its own copy (backendContract.test.js
// fails if the two drift apart).
export const THEME_IDS = ['day', 'night', 'light', 'dark', 'snowy-peaks', 'duskfall', 'city-skies', 'custom'];

export function getTheme(id) {
  return THEMES.find(t => t.id === id) ?? null;
}

// New visitors start on Day or Night, matching their device's setting.
export function defaultThemeId() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}
