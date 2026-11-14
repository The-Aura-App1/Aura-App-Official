// @mentions in comments. Usernames follow the account rules (3–30 letters,
// numbers and underscores, stored lowercase). An @ inside a word, like an
// email address, isn't a mention.
const MENTION = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,30})(?![A-Za-z0-9_])/g;

// Splits text into plain strings and { username } pieces, in order
export function splitMentions(text) {
  const parts = [];
  let last = 0;
  for (const match of String(text ?? '').matchAll(MENTION)) {
    const start = match.index + match[1].length;
    if (start > last) parts.push(text.slice(last, start));
    parts.push({ username: match[2].toLowerCase(), raw: `@${match[2]}` });
    last = start + match[2].length + 1;
  }
  if (last < String(text ?? '').length) parts.push(text.slice(last));
  return parts;
}

// The @word being typed right before the cursor, if any: { start, query }
export function mentionAt(text, cursor) {
  const before = text.slice(0, cursor);
  const match = before.match(/(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{0,30})$/);
  if (!match) return null;
  return { start: cursor - match[2].length - 1, query: match[2].toLowerCase() };
}

// Letters and numbers only, lowercased, so "Aura App" and "auraapp" compare equal
const squash = value => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// People worth suggesting from the conversation: usernames that start with
// what was typed first, then display names (typing "@Aura" offers @aura_app)
export function suggestPeople(people, query, limit = 5) {
  const q = query.toLowerCase();
  const byName = people.filter(p => p.username && p.username.toLowerCase().startsWith(q));
  const byDisplay = people.filter(p => p.username && !byName.includes(p)
    && squash(p.displayName).startsWith(squash(q)));
  return [...byName, ...byDisplay].slice(0, limit);
}
