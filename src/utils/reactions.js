// Emoji reactions and group reaction pins on posts. The emoji list and the
// limits match backend/lambdas/aura-posts/reactions.mjs (a test keeps them
// equal). Only these emoji are allowed: no letters, numbers or flags, so
// reactions can't spell out words.
export const REACTION_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏', '🎉', '💯', '🙏', '😍',
  '🤔', '👀', '✨', '💀', '🥹', '😎', '🤯', '🥳', '💜', '💙', '💚', '🖤',
  '⭐', '🌈', '🍀', '☕', '🎮', '🎵', '📸', '🌙', '☀️', '🌊', '🌸', '🍕',
  '🐐', '👑', '💎', '🚀', '🫶', '🤝', '😴', '🙌', '💪', '🤣', '😭', '😤',
];
export const MAX_PER_USER = 3;
export const MAX_KINDS = 20;

// A group pin is written pin:<groupId>:<pinId>
export const pinReaction = (groupId, pinId) => `pin:${groupId}:${pinId}`;
export const isPin = reaction => typeof reaction === 'string' && reaction.startsWith('pin:');
