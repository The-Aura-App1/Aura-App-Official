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

const PIN = /^pin:([A-Za-z0-9-]{1,64}):([a-z0-9]{6,24})$/;

// { kind: 'emoji' } or { kind: 'pin', groupId, pinId }, or null if not allowed
export function parseReaction(value) {
  if (typeof value !== 'string') return null;
  if (isReactionEmoji(value)) return { kind: 'emoji' };
  const m = PIN.exec(value);
  return m ? { kind: 'pin', groupId: m[1], pinId: m[2] } : null;
}

export const reactionKey = postId => `react#${postId}`;
// A person's reactions to a comment (aura-likes, like reactionKey for posts)
export const commentReactionKey = commentId => `react#comment#${commentId}`;

// The counts a viewer sees: only reactions someone still has on
export function visibleCounts(map) {
  return Object.fromEntries(Object.entries(map ?? {}).filter(([, n]) => n > 0));
}
