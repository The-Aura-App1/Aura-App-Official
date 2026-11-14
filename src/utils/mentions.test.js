import { splitMentions, mentionAt, suggestPeople } from './mentions';

test('finds @mentions, lowercased for the profile link, but not emails', () => {
  expect(splitMentions('hey @Maya_Shoots love this, mail me at a@b.com @x')).toEqual([
    'hey ', { username: 'maya_shoots', raw: '@Maya_Shoots' }, ' love this, mail me at a@b.com @x',
  ]);
  expect(splitMentions('@ann @bob')).toEqual([{ username: 'ann', raw: '@ann' }, ' ', { username: 'bob', raw: '@bob' }]);
  expect(splitMentions('no tags')).toEqual(['no tags']);
});

test('knows when an @name is being typed at the cursor', () => {
  expect(mentionAt('hi @ma', 6)).toEqual({ start: 3, query: 'ma' });
  expect(mentionAt('hi @', 4)).toEqual({ start: 3, query: '' });
  expect(mentionAt('mail a@b', 8)).toBeNull();
  expect(mentionAt('hi @ma done', 11)).toBeNull();
});

test('suggests people whose username starts with what was typed', () => {
  const people = [{ username: 'maya_shoots' }, { username: 'marco_on_wheels' }, { username: 'ben' }];
  expect(suggestPeople(people, 'ma').map(p => p.username)).toEqual(['maya_shoots', 'marco_on_wheels']);
  expect(suggestPeople(people, '').length).toBe(3);
});
