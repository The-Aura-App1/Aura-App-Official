import { TOPIC_IDS } from './topics';
import { decodeVector } from './embeddings';

// Feed preferences live only in this browser's localStorage and are never sent
// to the server. Keyed per account so people sharing a device don't mix them.
const storageKey = userId => `aura.feedPrefs.v1.${userId ?? 'anon'}`;

export const MAX_KEYWORDS   = 10;
export const MAX_KEYWORD_LENGTH = 40;

// words: [{ text, vec, choice }] where vec is the keyword's base64 vector
export const EMPTY_PREFS = Object.freeze({ more: [], less: [], words: [] });

function cleanWords(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const words = [];
  for (const word of list) {
    const text = typeof word?.text === 'string' ? word.text.trim() : '';
    const key  = text.toLowerCase();
    if (!text || text.length > MAX_KEYWORD_LENGTH || seen.has(key)) continue;
    if (!['more', 'less'].includes(word.choice) || !decodeVector(word.vec)) continue;
    seen.add(key);
    words.push({ text, vec: word.vec, choice: word.choice });
  }
  return words.slice(0, MAX_KEYWORDS);
}

export function cleanPrefs(raw) {
  const pick = list => (Array.isArray(list) ? [...new Set(list.filter(t => TOPIC_IDS.has(t)))] : []);
  const more = pick(raw?.more);
  const less = pick(raw?.less).filter(t => !more.includes(t));
  return { more, less, words: cleanWords(raw?.words) };
}

export function hasKeyword(prefs, text) {
  const key = text.trim().toLowerCase();
  return prefs.words.some(w => w.text.toLowerCase() === key);
}

export function addKeyword(prefs, text, vec, choice) {
  const words = prefs.words.filter(w => w.text.toLowerCase() !== text.trim().toLowerCase());
  return cleanPrefs({ ...prefs, words: [...words, { text, vec, choice }] });
}

export function removeKeyword(prefs, text) {
  return cleanPrefs({ ...prefs, words: prefs.words.filter(w => w.text !== text) });
}

export function loadPrefs(userId) {
  try {
    return cleanPrefs(JSON.parse(localStorage.getItem(storageKey(userId))));
  } catch {
    return EMPTY_PREFS;
  }
}

export function savePrefs(userId, prefs) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(cleanPrefs(prefs)));
  } catch {}
}

export function clearPrefs(userId) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {}
}

// choice is 'more', 'less' or null (neutral)
export function setTopics(prefs, topics, choice) {
  const more = prefs.more.filter(t => !topics.includes(t));
  const less = prefs.less.filter(t => !topics.includes(t));
  if (choice === 'more') more.push(...topics);
  if (choice === 'less') less.push(...topics);
  return cleanPrefs({ ...prefs, more, less });
}

export function topicChoice(prefs, topic) {
  if (prefs.more.includes(topic)) return 'more';
  if (prefs.less.includes(topic)) return 'less';
  return null;
}
