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

// XP needed to reach a level: 0, 100, 300, 600, 1000, 1500 ...
export const levelFloor = level => 50 * level * (level - 1);

// What each level unlocks. Stage A shows the level; the unlocks arrive with later stages.
export const LEVEL_UNLOCKS = [
  { level: 2,  label: 'Group accent color' },
  { level: 3,  label: 'A second pinned post' },
  { level: 5,  label: 'Animated group banner frame' },
  { level: 7,  label: 'Three custom reactions' },
  { level: 10, label: 'Group glow on its posts in members\' feeds' },
  { level: 15, label: 'Season trophy shelf' },
];
