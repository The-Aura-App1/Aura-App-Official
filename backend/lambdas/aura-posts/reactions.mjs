// Emoji reactions and group reaction pins on posts.
//
// Anyone who can see a post can react with up to MAX_PER_USER emoji of their
// choice (any emoji except the letter-like ones, see isReactionEmoji). A post
// shows at most MAX_KINDS different reactions. REACTION_EMOJIS is only the
// quick picks the app offers first.
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

// Any single emoji (one grapheme, including skin tones, ZWJ families and
// variation selectors), except the ones that are really letters, digits or
// flags, so reactions still can't spell out words: regional-indicator flags,
// keycaps (1️⃣ #️⃣), enclosed letters (🅰️ Ⓜ️ 🆗 🆒), and ™ © ® ℹ️ ㊗️ ㊙️.
// The same check runs in the app (src/utils/reactions.js) and on the server
// (aura-posts reactions.mjs); a test keeps the two equal.
const LETTERLIKE = /[A-Za-z0-9#*\u00A9\u00AE\u2122\u2139\u24B6-\u24E9\u24C2\u3297\u3299\u{1F170}-\u{1F1FF}\u20E3]/u;
let segmenter = null;
export function isReactionEmoji(value) {
  if (typeof value !== 'string' || !value || value.length > 32) return false;
  if (!/\p{Extended_Pictographic}/u.test(value) || LETTERLIKE.test(value)) return false;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    segmenter = segmenter ?? new Intl.Segmenter('en', { granularity: 'grapheme' });
    return [...segmenter.segment(value)].length === 1;
  }
  return [...value].filter(c => /\p{Extended_Pictographic}/u.test(c)).length === 1 && !/\s/.test(value);
}

const PIN = /^pin:([A-Za-z0-9-]{1,64}):([a-z0-9]{6,24})$/;

// { kind: 'emoji' } or { kind: 'pin', groupId, pinId }, or null if not allowed
export function parseReaction(value) {
  if (typeof value !== 'string') return null;
  if (isReactionEmoji(value)) return { kind: 'emoji' };
  const m = PIN.exec(value);
  return m ? { kind: 'pin', groupId: m[1], pinId: m[2] } : null;
}

export const reactionKey = postId => `react#${postId}`;

// The counts a viewer sees: only reactions someone still has on
export function visibleCounts(map) {
  return Object.fromEntries(Object.entries(map ?? {}).filter(([, n]) => n > 0));
}
