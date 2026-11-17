import { respond } from './angel';

// Angel doing things for people (actions.js), measured on phrasings written
// before any tuning (2026-11-16). Each line: what the person says, and what
// she should offer: an action id (as a card, never done by itself), 'none'
// (no action: a question, a refusal or something else), or 'ask' (she asks
// for what's missing, offering nothing yet). Measured before and after the
// first fixes; the numbers are in the test's name. It's no longer unseen.

const found = {
  shown: 0,
  results: [
    { post: { postId: 'p1', authorId: 'bob', authorUsername: 'bob', caption: 'Sunrise over the ridge', type: 'photo' } },
    { post: { postId: 'p2', authorId: 'me', authorUsername: 'me', caption: 'My lake day', type: 'text', groupId: 'g1' } },
    { post: { postId: 'p3', authorId: 'cy', authorUsername: 'cy', caption: 'Pasta night', type: 'photo' } },
  ],
};
const ctx = () => ({
  me: { userId: 'me', username: 'me', tags: ['hiking'], commentVisibilityDefault: 'anyone',
    today: { freeGive: { used: 10, limit: 50 }, walletGive: { used: 0, limit: 500 }, take: { used: 0, limit: 250 } } },
  lastFind: found,
  lookupUser: async name => (['bob', 'cy', 'dana', 'eli'].includes(name) ? { userId: `u-${name}`, username: name } : null),
  lookupPost: async id => (id === 'post9xyz' ? { postId: 'post9xyz', authorId: 'dana', authorUsername: 'dana', caption: 'Linked post' } : null),
  api: {
    getMyGroups: async () => ({ groups: [{ groupId: 'g1', name: 'Night Owls' }, { groupId: 'g2', name: 'Hiking Crew', ownerId: 'me' }] }),
    listGroups: async () => ({ groups: [{ groupId: 'g3', name: 'Chess Club', joinType: 'open' }, { groupId: 'g4', name: 'Book Nook', joinType: 'request' }] }),
  },
  recentGives: [],
});

export const CASES = [
  ['give it 20 aura', 'give-aura'],
  ['send 15 aura to the first one', 'give-aura'],
  ['tip the third post 5 aura', 'give-aura'],
  ['can you give that post 100 aura', 'give-aura'],
  ['give 30 aura to https://aura.app/post/post9xyz', 'give-aura'],
  ['give it some aura', 'ask'],
  ['take 10 aura from it', 'take-aura'],
  ['take 5 aura from the third one', 'take-aura'],
  ['give 20 aura to all of them', 'none'],
  ['give the second one 10 aura', 'none'],          // that's their own post
  ['like it', 'like-post'],
  ['like the third one', 'like-post'],
  ['unlike that post', 'like-post'],
  ['like Abyss but pink', 'apply-theme'],      // her theme maker, not a like
  ['share it to night owls', 'share-post'],
  ['share the first one with my Night Owls group', 'share-post'],
  ['share it to the chess club', 'ask'],            // not their group
  ['spotlight the second one', 'spotlight'],
  ['spotlight it', 'none'],                         // bob's post, not theirs
  ['start an aura rain of 500 in night owls', 'start-rain'],
  ['start an aura rain in night owls', 'ask'],
  ['start an aura rain of 5000 in night owls', 'ask'],
  ['delete the second one', 'delete-post'],
  ['delete it', 'none'],                            // bob's post
  ['delete all my posts', 'none'],
  ['delete my account', 'none'],
  ['comment "this is gorgeous" on the first one', 'comment'],
  ['reply "same here!" to it', 'comment'],
  ['comment on it: love the colors', 'comment'],
  ['comment something nice on it', 'ask'],
  ['post "first day on Aura #hello"', 'create-post'],
  ['write a post about my weekend', 'none'],
  ['join chess club', 'group'],
  ['join the book nook', 'group'],
  ['leave night owls', 'group'],
  ['leave hiking crew', 'none'],                    // they own it
  ['leave a comment on it', 'ask'],
  ['accept the follow request from @dana', 'answer-request'],
  ['decline eli\'s request', 'answer-request'],
  ['remove @eli from my followers', 'remove-follower'],
  ['mark all my notifications as read', 'read-all'],
  ['set my tags to hiking, photography and coffee', 'set-tags'],
  ['add baking to my tags', 'set-tags'],
  ['only followers can comment on my posts from now on', 'set-profile'],
  ['let anyone comment on my new posts by default', 'none'],   // already the default
  ['how do i give aura?', 'none'],
  ['give me 100 aura', 'none'],
  ['take me to my wallet', 'none'],
  ['like every post from bob', 'none'],
  ['comment "nice" on all of them', 'none'],
];

function outcome(reply) {
  if (reply.autoAction && reply.autoAction.id !== 'go') return `AUTO:${reply.autoAction.id}`;   // never allowed for these
  const id = reply.actions?.[0]?.id;
  if (id) return id;
  return reply.kind === 'action' && /\?|which|how much|how big|put your comment|find it first|couldn't find|anywhere from|is \d+ to/i.test(reply.text) ? 'ask' : 'none';
}

test('actions: unseen set (written before tuning)', async () => {
  const misses = [];
  for (const [say, want] of CASES) {
    const got = outcome(await respond(say, ctx()));
    if (got !== want) misses.push(`${say} → ${got} (wanted ${want})`);
  }
  const hits = CASES.length - misses.length;
  // eslint-disable-next-line no-console
  console.log(`actions unseen: ${hits}/${CASES.length}\n${misses.join('\n')}`);
  expect(misses).toEqual([]);
});
