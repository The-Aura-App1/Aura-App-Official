// Group power-ups and levels (docs/group-power-ups.md, Stage A). The numbers
// match POWER_UPS in backend/lambdas/aura-aura/powerups.mjs and the level
// curve in groupStats.mjs; src/backendContract.test.js fails if they drift.
export const POWER_UPS = {
  spotlightCost:  150,
  spotlightHours: 24,
  rainMin:        100,
  rainMax:        2000,
  rainDailyCap:   2000,
  rainMinutes:    10,
  rainShare:      10,
  minAccountDays: 7,
  minMemberDays:  3,
};

export const XP = { post: 10, comment: 3, give: 2, game: 5 };
export const XP_DAILY_CAP = 60;

// XP needed to reach a level: 0, 100, 300, 600, 1000, 1500 ... up to MAX_LEVEL
export const levelFloor = level => 50 * level * (level - 1);
export const MAX_LEVEL = 15;

// Level perks and boosts; the same numbers as groupStats.mjs (a test keeps them equal)
export const PERKS = { picture: 2, pins: 7, glow: 10, backgrounds: 10 };
export const MAX_PINS = 12;
export const MAX_BACKGROUNDS = 8;
export const BOOSTS = { perMonth: 5, days: 30, bonus: 0.25, maxStack: 4 };

// What each level unlocks (soon: planned, not built yet)
export const LEVEL_UNLOCKS = [
  { level: 2,  label: 'A group picture' },
  { level: 2,  label: 'Group accent color', soon: true },
  { level: 3,  label: 'A second pinned post', soon: true },
  { level: 5,  label: 'Animated group banner frame', soon: true },
  { level: 7,  label: `Custom reaction pins (up to ${MAX_PINS}); Premium members can use them anywhere` },
  { level: 10, label: 'Group glow on its posts' },
  { level: 10, label: `Custom post backgrounds (up to ${MAX_BACKGROUNDS})` },
  { level: 15, label: 'Max level. Season trophy shelf', soon: true },
];
