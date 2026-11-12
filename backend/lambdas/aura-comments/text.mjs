// Text rules shared by the Lambdas. Identical copies live in aura-users,
// aura-posts, aura-comments and aura-groups (each deploys on its own), and
// src/backendContract.test.js fails if they drift apart.

// Characters that render as nothing or flip the direction of the text around
// them, which can hide words or make one name look like another: format
// controls (bidi overrides, zero-width spaces, soft hyphens, word joiners),
// the combining grapheme joiner, and blank "filler" letters. The zero-width
// joiner and the emoji tag characters stay, because emoji like 👩‍💻 and 🏴󠁧󠁢󠁳󠁣󠁴󠁿
// are built from them.
const INVISIBLE = /(?![‍\u{E0020}-\u{E007F}])[\p{Cf}͏ᅟᅠㅤﾠ⠀]/gu;
// Control characters other than line breaks and tabs
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// One line of text (names): no invisible characters, single spaces, trimmed
export function cleanLine(value) {
  return String(value)
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(CONTROL, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Several lines (bios, captions, comments, descriptions): line breaks are
// kept, but at most one blank line in a row
export function cleanText(value) {
  return String(value)
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .replace(CONTROL, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// True when the text has something you can actually see
export function hasVisibleText(value) {
  return /[^\s‍︀-️]/u.test(value);
}

// Names that pose as the app or its staff: "Aura Team", "aura_official",
// "AURA Supp0rt", "Admin", "the moderators". Accents, spacing, punctuation and
// number-for-letter swaps are ignored, so "Âura-T3am" is caught too.
const LOOKALIKES = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '|': 'i' };
const STAFF = '(?:team|official|support|staff|admin|administrator|mod|mods|moderator|moderators|moderation|help|helpdesk|safety|security|trust|hq|news|updates|bot|system)';
const IMPERSONATION = new RegExp(
  `^(?:the)?(?:aura(?:app)?(?:${STAFF})*|${STAFF}+(?:aura(?:app)?)?)(?:account|team)?$`,
);

export function squash(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[0134579@$!|]/g, c => LOOKALIKES[c] ?? c)
    .replace(/[^a-z]/g, '');
}

export function impersonatesStaff(value) {
  const letters = squash(value);
  return letters.length > 0 && IMPERSONATION.test(letters);
}
