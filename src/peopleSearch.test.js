import { rankPeople, searchPeople, normalizeQuery, resetDirectory } from '../backend/lambdas/aura-users/people.mjs';

const people = [
  { userId: 'u1', username: 'ana_paints', displayName: 'Ana García', followerCount: 40 },
  { userId: 'u2', username: 'anabel', displayName: 'Bel', followerCount: 5 },
  { userId: 'u3', username: 'demo_ana', displayName: 'Ana Demo', followerCount: 900 },
  { userId: 'u4', username: 'ana', displayName: 'A', followerCount: 0 },
  { userId: 'u5', username: 'hidden_ana', displayName: 'Ana Hidden', hideFromSearch: true },
  { userId: 'u6', username: 'banned_ana', displayName: 'Ana Banned', isBanned: true },
  { userId: 'USERNAME#ana', username: 'ana' },
  { userId: 'u7', username: 'marcus', displayName: 'Marcus Lee', followerCount: 12 },
];

test('ranks the exact username, then usernames, then names, then anything containing it', () => {
  expect(rankPeople(people, 'ana').map(p => p.username)).toEqual(['ana', 'ana_paints', 'anabel', 'demo_ana']);
  expect(rankPeople(people, '@Ana').map(p => p.username)[0]).toBe('ana');
  expect(rankPeople(people, 'garcia').map(p => p.username)).toEqual(['ana_paints']);
  expect(rankPeople(people, 'lee').map(p => p.username)).toEqual(['marcus']);
});

test('never shows hidden, banned or reservation records, and ignores tiny queries', () => {
  const names = rankPeople(people, 'an').map(p => p.username);
  expect(names).not.toContain('hidden_ana');
  expect(names).not.toContain('banned_ana');
  expect(rankPeople(people, 'a')).toEqual([]);
  expect(normalizeQuery('  @@Ána   Paints ')).toBe('ana paints');
});

test('drops anyone blocked either way and returns only public fields', async () => {
  resetDirectory();
  const result = await searchPeople({
    viewerId: 'me', query: 'ana',
    loadAll: async () => people,
    isBlocked: async (_, other) => other === 'u2',
  });
  expect(result.people.map(p => p.username)).toEqual(['ana', 'ana_paints', 'demo_ana']);
  for (const p of result.people) expect(Object.keys(p).sort()).toEqual(['displayName', 'followerCount', 'isPrivate', 'profilePicKey', 'username']);
});
