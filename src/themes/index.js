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

const AURORA_ART = svg(
  "<path d='M-10 52 Q 30 20 70 40 T 170 30 L 170 0 L -10 0Z' fill='#3ee6a8' opacity='0.35'/>" +
  "<path d='M-10 50 Q 30 22 70 42 T 170 32' stroke='#8dffd2' stroke-width='3' fill='none' opacity='0.8'/>" +
  "<path d='M0 70 L22 56 L38 64 L60 50 L84 64 L110 52 L136 66 L160 58 L160 74 L0 74Z' fill='#16304a'/>" +
  "<rect y='74' width='160' height='26' fill='#06182a'/>" +
  "<path d='M10 82 Q 60 78 150 84' stroke='#8dffd2' stroke-opacity='0.35' stroke-width='2' fill='none'/>"
);
const GROVE_ART = svg(
  "<circle cx='124' cy='22' r='10' fill='#f4f1de'/>" +
  "<path d='M0 70 Q 20 50 40 66 Q 60 46 80 64 Q 100 44 120 62 Q 140 48 160 64 L160 100 L0 100Z' fill='#163a40'/>" +
  "<path d='M0 86 Q 50 78 100 86 T 160 84 L160 100 L0 100Z' fill='#06100f'/>" +
  "<circle cx='40' cy='60' r='2' fill='#e8ff8a'/><circle cx='88' cy='72' r='1.6' fill='#e8ff8a'/><circle cx='120' cy='56' r='1.8' fill='#ffd36b'/><circle cx='64' cy='80' r='1.5' fill='#e8ff8a'/>"
);
const ISLES_ART = svg(
  "<path d='M30 48 L80 48 L60 70Z' fill='#9b7a63'/><path d='M28 48 Q 55 40 82 48Z' fill='#6fcf8a'/>" +
  "<circle cx='50' cy='36' r='9' fill='#5fbf7f'/>" +
  "<path d='M100 34 L136 34 L120 52Z' fill='#9b7a63'/><path d='M98 34 Q 118 28 138 34Z' fill='#6fcf8a'/>" +
  "<rect x='128' y='34' width='4' height='40' fill='#cfeaff' opacity='0.9'/>" +
  "<path d='M0 80 a12 8 0 0 1 24 0 a14 10 0 0 1 28 0 a12 8 0 0 1 24 0 a16 10 0 0 1 32 0 a14 9 0 0 1 28 0 a12 8 0 0 1 24 0 L160 100 L0 100Z' fill='#ffffff'/>"
);
const ABYSS_ART = svg(
  "<path d='M30 0 L44 0 L64 100 L46 100Z M90 0 L100 0 L118 100 L104 100Z' fill='#bdf4ff' opacity='0.12'/>" +
  "<path d='M70 46 C 70 34 90 34 90 46 C 86 48 74 48 70 46Z' fill='#c084fc' opacity='0.85'/>" +
  "<path d='M74 48 q 2 10 -1 18 M80 48 q 2 12 0 22 M86 48 q -2 10 1 18' stroke='#c084fc' stroke-opacity='0.6' fill='none'/>" +
  "<circle cx='30' cy='70' r='2' fill='none' stroke='#cffafe'/><circle cx='34' cy='58' r='1.4' fill='none' stroke='#cffafe'/><circle cx='130' cy='62' r='2.4' fill='none' stroke='#cffafe'/>" +
  "<path d='M0 92 Q 40 84 80 90 T 160 88 L160 100 L0 100Z' fill='#04101f'/>"
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
  {
    id: 'northern-lights', name: 'Northern Lights', base: 'dark', scene: 'aurora', bar: '#030c1c',
    description: 'Aurora over a frozen lake, a campfire on the shore.',
    preview: {
      background: `${AURORA_ART} bottom / 100% 100% no-repeat, linear-gradient(180deg, #01030b 0%, #072238 100%)`,
      card: '#0a1a2c', text: '#eefcf7', muted: '#173048', accent: '#34d3a6',
    },
  },
  {
    id: 'firefly-grove', name: 'Firefly Grove', base: 'dark', scene: 'grove', bar: '#06120f',
    description: 'A moonlit forest with fireflies and glowing moss.',
    preview: {
      background: `${GROVE_ART} bottom / 100% 100% no-repeat, linear-gradient(180deg, #040a14 0%, #12383a 100%)`,
      card: '#0c1c1a', text: '#f3fbe9', muted: '#1d3532', accent: '#b5e05a',
    },
  },
  {
    id: 'sky-isles', name: 'Sky Isles', base: 'light', scene: 'isles', bar: '#e6f0fb',
    description: 'Floating islands and waterfalls above the clouds.',
    preview: {
      background: `${ISLES_ART} bottom / 100% 100% no-repeat, linear-gradient(180deg, #8ebff3 0%, #fdf2e6 100%)`,
      card: '#ffffff', text: '#122340', muted: '#d7e3f3', accent: '#2f6fe0',
    },
  },
  {
    id: 'abyss', name: 'Abyss', base: 'dark', scene: 'deep', bar: '#041227',
    description: 'Deep sea light, drifting jellyfish and a passing whale.',
    preview: {
      background: `${ABYSS_ART} bottom / 100% 100% no-repeat, linear-gradient(180deg, #0b5675 0%, #041227 70%)`,
      card: '#071a30', text: '#ecfbff', muted: '#12304c', accent: '#22b8d6',
    },
  },
];

// The scenes the welcome and sign-in pages rotate through, in order. Light
// and dark scenes alternate where they can.
export const PUBLIC_ROTATION = ['day', 'city-skies', 'snowy-peaks', 'night', 'duskfall'];

// Every theme id an account can save, including ones still being built.
// aura-users checks saved themes against its own copy (backendContract.test.js
// fails if the two drift apart).
export const THEME_IDS = ['day', 'night', 'light', 'dark', 'snowy-peaks', 'duskfall', 'city-skies', 'northern-lights', 'firefly-grove', 'sky-isles', 'abyss', 'custom'];

export function getTheme(id) {
  return THEMES.find(t => t.id === id) ?? null;
}

// New visitors start on Day or Night, matching their device's setting.
export function defaultThemeId() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}
