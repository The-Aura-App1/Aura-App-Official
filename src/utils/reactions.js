// Emoji reactions and group reaction pins on posts. Any emoji works except
// letter-like ones (isReactionEmoji); REACTION_EMOJIS are the quick picks.
// The limits and the check match backend/lambdas/aura-posts/reactions.mjs
// (a test keeps them equal).
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

// More to pick from in the picker, by kind (any other emoji can be typed in)
export const EMOJI_GROUPS = [
  ['Faces', '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾'],
  ['Hands and people', '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 💪 🦾 🧠 👀 👁️ 👅 👄 💋 🫂 🧑‍💻 🧑‍🎨 🧑‍🍳 🧑‍🚀 🕺 💃'],
  ['Hearts', '❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝'],
  ['Animals and nature', '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦅 🦉 🐺 🐗 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦖 🐙 🦑 🦀 🐠 🐬 🐳 🦈 🐊 🐘 🦒 🐐 🦌 🐕 🐈 🌵 🎄 🌲 🌴 🌱 🍀 🍁 🍂 🌷 🌹 🌺 🌸 🌼 🌻 🌞 🌝 🌚 🌙 ⭐ 🌟 ✨ ⚡ 🔥 🌈 ☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ☃️ 🌊 💧 🌍 🪐'],
  ['Food and drink', '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🌶️ 🌽 🥕 🥐 🍞 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍝 🍜 🍣 🍱 🍤 🍙 🍦 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 🍿 ☕ 🍵 🧋 🥤 🍺 🍻 🥂 🍷 🍹'],
  ['Activities and things', '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🛹 ⛸️ 🎿 🏂 🏆 🥇 🥈 🥉 🏅 🎖️ 🎯 🎮 🕹️ 🎲 ♟️ 🧩 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎉 🎊 🎈 🎁 🎀 🪄 💎 👑 💍 📸 📷 🎥 📱 💻 ⌚ 💡 🔦 📚 📖 ✏️ 📌 📍 ✂️ 🔒 🔑 🔨 🧲 🧪 🔭 💊 🛒 🚀 ✈️ 🚗 🏎️ 🚲 ⛵ 🗺️ 🏝️ 🏔️ 🏕️ 🏠 🏰 🗽 🎡 🎢'],
  ['Symbols', '💯 💢 💥 💫 💦 💨 🕳️ 💬 💭 💤 ✅ ❌ ❗ ❓ ⚠️ 🚫 ♻️ 🔱 ⚜️ 🔆 💠 🌀 ♾️ ☮️ ☯️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🎵 🎶 ➕ ➖ ✖️ ➗ 🔺 🔻 🔸 🔹 🟣 🟢 🔴 🟡 🟠 🔵 ⚫ ⚪'],
].map(([name, list]) => [name, list.split(' ').filter(isReactionEmoji)]);

// A group pin is written pin:<groupId>:<pinId>
export const pinReaction = (groupId, pinId) => `pin:${groupId}:${pinId}`;
export const isPin = reaction => typeof reaction === 'string' && reaction.startsWith('pin:');
