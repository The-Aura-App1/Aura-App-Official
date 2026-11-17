// Custom topics: people's own topics, next to the curated ones (phase 1).
// The same file is in the app (src/utils/customTopics.js) and in aura-posts
// (customTopics.mjs); a test keeps the two equal.
//
// A post stores them as `customTopics` (normalized keys, like "home baking"),
// apart from `tags` (curated topic ids); together at most MAX_POST_TOPICS.
// They're searchable, followable and mutable on the device and learned by
// the taste profile, but they never get a server list of their own: the
// feed's per-topic lists stay curated only.

export const CUSTOM_TOPIC_MIN = 2;
export const CUSTOM_TOPIC_MAX = 24;
// How many custom topics one account can put on posts in a day (aura-posts
// counts them; Corey can change it)
export const CUSTOM_TOPICS_PER_DAY = 5;

// Words a custom topic can't use. One easy-to-edit list (whole words, after
// normalizing); the app and aura-posts use the same file.
export const TOPIC_DENY = [
  'admin', 'administrator', 'moderator', 'mod team', 'official', 'aura team', 'aura staff', 'aura support', 'staff', 'verified',
  'nazi', 'kkk', 'porn', 'nsfw', 'nude', 'nudes', 'sex', 'xxx', 'onlyfans', 'gore', 'suicide', 'self harm', 'kill', 'rape',
];

// Topics hidden from search, suggestions and Tune your feed (the moderation
// hook: add a key here to hide it everywhere; posts keep it but don't show it)
export const HIDDEN_TOPICS = [];
export const isHiddenTopic = key => HIDDEN_TOPICS.includes(key);

// The key a topic is stored under: NFKC, lowercase, single spaces, trimmed
export function topicKey(raw) {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFKC').toLowerCase().replace(/[\s_]+/g, ' ').replace(/\s*-\s*/g, '-').trim();
}

// How a key is shown: first letter capitalized
export const topicDisplay = key => (key ? key[0].toUpperCase() + key.slice(1) : '');

// → { key } or { error, hashtag? } (hashtag: offer to make it a hashtag instead)
export function checkCustomTopic(raw, curatedIds = []) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (/^#/.test(text)) return { error: 'That looks like a hashtag. Add it as a hashtag instead?', hashtag: text.slice(1) };
  if (/^@|\s@\w/.test(text) || /@/.test(text)) return { error: 'Topics can\'t include @names or email addresses.' };
  if (/(https?:|www\.|\.[a-z]{2,}(\/|$))/i.test(text)) return { error: 'Topics can\'t be links.' };
  if (/\d[\d\s().-]{6,}\d/.test(text)) return { error: 'Topics can\'t be phone numbers.' };
  // invisible, direction-flipping or lookalike characters
  // eslint-disable-next-line no-control-regex -- finds hidden characters on purpose
  if (/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁤﻿]/.test(text)) return { error: 'That topic has hidden characters in it.' };
  const key = topicKey(text);
  if (key.length < CUSTOM_TOPIC_MIN || key.length > CUSTOM_TOPIC_MAX) return { error: `Topics are ${CUSTOM_TOPIC_MIN} to ${CUSTOM_TOPIC_MAX} characters.` };
  // letters (any language), digits, spaces and hyphens; one script of letters, so no mixed lookalikes
  if (!/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u.test(key)) return { error: 'Topics use letters, numbers, spaces and hyphens only.' };
  const scripts = new Set([...key].filter(c => /\p{L}/u.test(c)).map(c => (/\p{Script=Latin}/u.test(c) ? 'Latin' : /\p{Script=Cyrillic}/u.test(c) ? 'Cyrillic' : /\p{Script=Greek}/u.test(c) ? 'Greek' : 'Other')));
  if (scripts.size > 1) return { error: 'Use one alphabet in a topic.' };
  if (!/\p{L}/u.test(key)) return { error: 'Topics need at least one letter.' };
  const spaced = ` ${key.replace(/-/g, ' ')} `;
  if (TOPIC_DENY.some(word => spaced.includes(` ${word} `))) return { error: 'That topic isn\'t allowed.' };
  if (curatedIds.includes(key)) return { key, curated: true };
  return { key };
}

// A post's topics as one list of { key, label, custom } (curated first)
export function postTopicList(post, labelOf = id => id) {
  return [
    ...(post?.tags ?? []).map(id => ({ key: id, label: labelOf(id), custom: false })),
    ...(post?.customTopics ?? []).map(key => ({ key, label: topicDisplay(key), custom: true })),
  ];
}
