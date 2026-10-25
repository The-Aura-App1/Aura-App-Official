import { TOPIC_IDS } from './topics';

// Feed preferences live only in this browser's localStorage and are never sent
// to the server. Keyed per account so people sharing a device don't mix them.
const storageKey = userId => `aura.feedPrefs.v1.${userId ?? 'anon'}`;

export const EMPTY_PREFS = Object.freeze({ more: [], less: [] });

export function cleanPrefs(raw) {
  const pick = list => (Array.isArray(list) ? [...new Set(list.filter(t => TOPIC_IDS.has(t)))] : []);
  const more = pick(raw?.more);
  const less = pick(raw?.less).filter(t => !more.includes(t));
  return { more, less };
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
  return cleanPrefs({ more, less });
}

export function topicChoice(prefs, topic) {
  if (prefs.more.includes(topic)) return 'more';
  if (prefs.less.includes(topic)) return 'less';
  return null;
}
