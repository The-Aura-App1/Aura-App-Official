// People search for the search page: GET /follows/search?q= (served under
// the /follows/{proxy+} route, which already requires sign-in).
//
// Matches usernames and display names, best first: the exact username, then
// usernames starting with the query, then display names with a word starting
// with it, then either containing it. Banned accounts, anyone who turned off
// "Show me in search" (`hideFromSearch`) and anyone blocked either way never
// appear. Their profiles still open from a link or a tag.
//
// The directory is a scan of aura-users, cached for a minute per Lambda
// instance. Fine at contest scale; move it to a search index before launch.

export const SEARCH_MIN   = 2;
export const SEARCH_MAX   = 30;
export const SEARCH_LIMIT = 8;
const CACHE_MS = 60_000;

const fold = s => String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

export function normalizeQuery(q) {
  return fold(q).trim().replace(/^@+/, '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX);
}

// Lower is better; null means no match
function score(person, q) {
  const username = fold(person.username);
  const name     = fold(person.displayName);
  if (username === q) return 0;
  if (username.startsWith(q)) return 1;
  if (name.startsWith(q) || name.split(/[^\p{L}\p{N}]+/u).some(w => w && w.startsWith(q))) return 2;
  if (username.includes(q.replace(/\s+/g, '_')) || username.includes(q.replace(/\s+/g, ''))) return 3;
  if (name.includes(q)) return 4;
  return null;
}

export function searchable(person) {
  return !!person?.username && !String(person.userId ?? '').startsWith('USERNAME#')
    && !person.isBanned && !person.hideFromSearch;
}

// Pure ranking, so it can be tested without AWS
export function rankPeople(people, rawQuery, limit = SEARCH_LIMIT) {
  const q = normalizeQuery(rawQuery);
  if (q.length < SEARCH_MIN) return [];
  return people
    .filter(searchable)
    .map(p => ({ p, s: score(p, q) }))
    .filter(x => x.s !== null)
    .sort((a, b) => a.s - b.s
      || (Number(b.p.followerCount) || 0) - (Number(a.p.followerCount) || 0)
      || a.p.username.localeCompare(b.p.username))
    .slice(0, limit)
    .map(x => x.p);
}

let directory = { at: 0, people: null };

// loadAll() returns every user record's searchable fields; isBlocked(a, b)
// says whether either has blocked the other
export async function searchPeople({ viewerId, query, loadAll, isBlocked }) {
  const q = normalizeQuery(query);
  if (q.length < SEARCH_MIN) return { people: [] };
  if (!directory.people || Date.now() - directory.at > CACHE_MS) {
    directory = { at: Date.now(), people: await loadAll() };
  }
  // Take a few extra so blocked accounts can be dropped and still fill the list
  const candidates = rankPeople(directory.people, q, SEARCH_LIMIT * 2);
  const blocked = await Promise.all(candidates.map(p => (p.userId === viewerId ? false : isBlocked(viewerId, p.userId))));
  const people = candidates.filter((_, i) => !blocked[i]).slice(0, SEARCH_LIMIT).map(p => ({
    username:      p.username,
    displayName:   p.displayName,
    profilePicKey: p.profilePicKey,
    isPrivate:     !!p.isPrivate,
    followerCount: Math.max(0, Number(p.followerCount) || 0),
  }));
  return { people };
}

// For tests: forget the cached directory
export function resetDirectory() {
  directory = { at: 0, people: null };
}
