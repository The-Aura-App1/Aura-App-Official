// Emoji reactions and group reaction pins on posts.
//
// Anyone who can see a post can react with up to MAX_PER_USER of these
// emoji. Only this fixed set is allowed: no letters, numbers or flags, so
// reactions can't be used to spell out words. A post shows at most
// MAX_KINDS different reactions. Keep the list in sync with
// src/utils/reactions.js (a test keeps them equal).
//
// Groups at level 7 (PERKS.pins) can add their own reaction pins
// (`pins` on the group, uploaded by owners and moderators). A pin is
// written `pin:<groupId>:<pinId>`. Members use their group's pins on posts
// in that group; Premium members can also use them on posts anywhere.
//
// Storage: each person's reactions to a post are one item in aura-likes
// ({ userId, postId: 'react#<postId>', reactions: string set }), and the
// post keeps the counts in a `reactions` map. Both change in one
// transaction, so the counts can't drift.
export const REACTION_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏', '🎉', '💯', '🙏', '😍',
  '🤔', '👀', '✨', '💀', '🥹', '😎', '🤯', '🥳', '💜', '💙', '💚', '🖤',
  '⭐', '🌈', '🍀', '☕', '🎮', '🎵', '📸', '🌙', '☀️', '🌊', '🌸', '🍕',
  '🐐', '👑', '💎', '🚀', '🫶', '🤝', '😴', '🙌', '💪', '🤣', '😭', '😤',
];
export const MAX_PER_USER = 3;
export const MAX_KINDS = 20;

const EMOJI = new Set(REACTION_EMOJIS);
const PIN = /^pin:([A-Za-z0-9-]{1,64}):([a-z0-9]{6,24})$/;

// { kind: 'emoji' } or { kind: 'pin', groupId, pinId }, or null if not allowed
export function parseReaction(value) {
  if (typeof value !== 'string') return null;
  if (EMOJI.has(value)) return { kind: 'emoji' };
  const m = PIN.exec(value);
  return m ? { kind: 'pin', groupId: m[1], pinId: m[2] } : null;
}

export const reactionKey = postId => `react#${postId}`;

// The counts a viewer sees: only reactions someone still has on
export function visibleCounts(map) {
  return Object.fromEntries(Object.entries(map ?? {}).filter(([, n]) => n > 0));
}
