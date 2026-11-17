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
// variation selectors) or a country flag, except the ones that are really
// letters or digits, so reactions still can't spell out words: lone letter
// tiles, keycaps (1️⃣ #️⃣ 🔟), enclosed letters (🅰️ Ⓜ️ 🆗 🆒 🈁), word signs
// (🔙 🔝 🔠 🏧 🚾 🔞), and ™ © ® ℹ️ ㊗️ ㊙️. 💯 stays allowed.
// The same check runs in the app (src/utils/reactions.js) and on the server
// (aura-posts reactions.mjs); a test keeps the two equal.
const LETTERLIKE = /[A-Za-z0-9#*©®™ℹⒶ-ⓩⓂ㊗㊙\u{1F170}-\u{1F1E5}\u{1F200}-\u{1F2FF}\u{1F519}-\u{1F524}\u{1F3E7}\u{1F6BE}⃣]/u;
// Emoji that never work as reactions or stickers, however they're written
// (skin tones included): rude, sexual, weapons, and ones often used to be
// racist. The app's copy must match.
export const REACTION_DENY = [
  '🖕', '🍆', '🍑', '💦', '👅', '🔫', '🔪', '🗡️', '💣', '🪓', '🧨', '🐒', '🦍', '🦧',
];
const bare = value => value.replace(/[\u{1F3FB}-\u{1F3FF}︎️]/gu, '');

// Country flags are two regional-indicator letters. Only real flags count
// (🇺🇸 yes, 🇦🇦 no: that just shows as the letters), and of the flag
// sequences made with hidden tag letters, only England, Scotland and Wales.
const FLAG_CODES = new Set(('AC AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '
  + 'CA CC CD CF CG CH CI CK CL CM CN CO CP CR CU CV CW CX CY CZ DE DG DJ DK DM DO DZ EA EC EE EG EH ER ES ET EU FI FJ FK FM FO FR '
  + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU IC ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '
  + 'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '
  + 'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ '
  + 'TA TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM UN US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' '));
const flagOf = code => String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
const tagFlag = code => `\u{1F3F4}${String.fromCodePoint(...[...code].map(c => 0xE0000 + c.charCodeAt(0)))}\u{E007F}`;
const TAG_FLAGS = ['gbeng', 'gbsct', 'gbwls'].map(tagFlag);
export const FLAG_EMOJIS = [...[...FLAG_CODES].map(flagOf), ...TAG_FLAGS];
const LETTER_TILE = /[\u{1F1E6}-\u{1F1FF}]/u;
const TAG = /[\u{E0020}-\u{E007F}]/u;
function isFlag(value) {
  const chars = [...value];
  if (chars.length !== 2 || !chars.every(c => LETTER_TILE.test(c))) return false;
  return FLAG_CODES.has(chars.map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 65)).join(''));
}

// ❤ and ❤️ are one reaction: a lone symbol is stored with the emoji marker
// (U+FE0F) when it would otherwise be drawn as text, and without it when it's
// an emoji anyway. Longer sequences (skin tones, ❤️‍🔥, families) stay as sent.
export function normalizeReaction(value) {
  if (typeof value !== 'string') return value;
  const base = value.replace(/[︎️]/g, '');
  if ([...base].length !== 1) return value;
  return /\p{Emoji_Presentation}/u.test(base) ? base : `${base}️`;
}

let segmenter = null;
export function isReactionEmoji(value) {
  if (typeof value !== 'string' || !value || value.length > 32) return false;
  if (isFlag(value) || TAG_FLAGS.includes(value)) return true;
  if (LETTER_TILE.test(value) || TAG.test(value)) return false;
  if (!/\p{Extended_Pictographic}/u.test(value) || LETTERLIKE.test(value)) return false;
  if (REACTION_DENY.some(d => bare(d) === bare(value))) return false;
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
  ['Flags', '🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️'],
].map(([name, list]) => [name, list.split(' ').filter(isReactionEmoji)]);
// Every country flag, A to Z by code, after the special ones
EMOJI_GROUPS[EMOJI_GROUPS.length - 1][1].push(...FLAG_EMOJIS);

// A group pin is written pin:<groupId>:<pinId>
export const pinReaction = (groupId, pinId) => `pin:${groupId}:${pinId}`;
export const isPin = reaction => typeof reaction === 'string' && reaction.startsWith('pin:');
