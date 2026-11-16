import { respond } from './angel';

// Angel's reports, support messages and in-app actions
const me = { username: 'me_here', email: 'me@example.com', isPrivate: false, hideAuraRank: false, hideFromSearch: false };
const people = { bob: { userId: 'u-bob', username: 'bob' } };
const base = {
  me,
  lookupUser: async name => people[name.toLowerCase()] ?? null,
  lookupPost: async id => (id === 'p123abc' ? { postId: id, authorUsername: 'bob' } : null),
};
// Plays a conversation, carrying the flow from each reply into the next message
async function chat(...messages) {
  let flow = null;
  const replies = [];
  for (const m of messages) {
    const reply = await respond(m, { ...base, flow });
    flow = reply.flow ?? null;
    replies.push(reply);
  }
  return replies;
}

describe('support', () => {
  test('category, message, email, then a confirmed send', async () => {
    const [start, cat, msg, email, confirm] = await chat(
      'I want to contact support',
      'Something isn\'t working',
      'My wallet shows 0 aura after I won a pool game last night.',
      'Use me@example.com',
      'send it',
    );
    expect(start.flow).toMatchObject({ type: 'support', step: 'category' });
    expect(start.followUps).toContain('Something isn\'t working');
    expect(cat.flow.step).toBe('message');
    expect(msg.flow.step).toBe('email');
    expect(msg.followUps).toEqual(['Use me@example.com']);
    expect(email.flow.step).toBe('confirm');
    expect(email.actions[0]).toMatchObject({ id: 'send-support', payload: { category: 'bug', contactEmail: 'me@example.com', message: 'My wallet shows 0 aura after I won a pool game last night.' } });
    expect(confirm.autoAction).toMatchObject({ id: 'send-support' });
  });

  test('a problem in the first message picks the category; a typed email works; bad ones are asked again', async () => {
    const [start, msg, bad, good] = await chat('I need to file a complaint, my account got hacked', 'Someone changed my password and posted spam from my account.', 'not an email', 'reply to me at alex.w@gmail.com please');
    expect(start.flow.step).toBe('message');
    expect(start.flow.data.category).toBe('account');
    expect(msg.flow.step).toBe('email');
    expect(bad.flow.step).toBe('email');
    expect(bad.text).toMatch(/doesn't look like an email/);
    expect(good.actions[0].payload.contactEmail).toBe('alex.w@gmail.com');
  });

  test('too-short messages are asked again, edits go back a step, and cancel sends nothing', async () => {
    const [, , short, , , edit, cancel] = await chat('customer service', 'other', 'help', 'The game page froze during a chess match.', 'me@example.com', 'change the message', 'cancel');
    expect(short.flow.step).toBe('message');
    expect(edit.flow.step).toBe('message');
    expect(cancel.flow).toBeNull();
    expect(cancel.text).toMatch(/Nothing was sent/);
  });

  test('a question about support gets the answer and a way to start', async () => {
    const reply = await respond('how do I contact support', base);
    expect(reply.kind).toBe('app');
    expect(reply.followUps).toContain('Contact Aura support');
  });
});

describe('reports', () => {
  test('who, why, then a confirmed report', async () => {
    const [start, why, yes] = await chat('I want to report @bob', 'Harassment or bullying', 'yes');
    expect(start.flow.step).toBe('reason');
    expect(why.actions[0]).toMatchObject({ id: 'send-report', payload: { kind: 'user', id: 'bob', reason: 'harassment', userId: 'u-bob' } });
    expect(yes.autoAction.id).toBe('send-report');
  });

  test('the reason can come with the request, and a post link works', async () => {
    const [reply] = await chat('report this post for spam https://aura.app/post/p123abc');
    expect(reply.flow.step).toBe('confirm');
    expect(reply.actions[0].payload).toMatchObject({ kind: 'post', id: 'p123abc', reason: 'spam' });
  });

  test('unknown people, yourself, and "someone is harassing me"', async () => {
    const [ask, unknown, self] = await chat('someone is harassing me', '@nobody_here', '@me_here');
    expect(ask.flow.step).toBe('target');
    expect(unknown.text).toMatch(/couldn't find @nobody_here/);
    expect(self.text).toMatch(/your own account/);
    expect(self.flow.step).toBe('target');
  });
});

describe('doing things in the app', () => {
  test('settings change at once, with an Undo', async () => {
    const notif = await respond('turn off game notifications', base);
    expect(notif.autoAction).toEqual({ id: 'set-notifications', payload: { keys: ['games'], value: false } });
    expect(notif.actions[0]).toMatchObject({ label: 'Undo', payload: { value: true, undo: true } });
    const all = await respond('mute all notifications', base);
    expect(all.autoAction.payload.keys.length).toBeGreaterThan(5);
    const priv = await respond('make my account private', base);
    expect(priv.autoAction).toEqual({ id: 'set-setting', payload: { field: 'isPrivate', value: true } });
    expect((await respond('hide me from search', base)).autoAction.payload).toEqual({ field: 'hideFromSearch', value: true });
    expect((await respond('hide my aura rank', base)).autoAction.payload).toEqual({ field: 'hideAuraRank', value: true });
    expect((await respond('make my account public', base)).text).toMatch(/already public/);
  });

  test('questions get answers, not changes', async () => {
    const reply = await respond('how do I make my account private?', base);
    expect(reply.autoAction).toBeUndefined();
    expect(reply.kind).toBe('app');
  });

  test('people, your bio and signing out wait for a tap', async () => {
    const follow = await respond('follow @bob', base);
    expect(follow.autoAction).toBeUndefined();
    expect(follow.actions[0]).toMatchObject({ id: 'person', payload: { verb: 'follow', username: 'bob' } });
    expect((await respond('block bob', base)).actions[0].payload.verb).toBe('block');
    expect((await respond('follow @ghost_user', base)).text).toMatch(/couldn't find/);
    const bio = await respond('change my bio to "Sunsets and synths"', base);
    expect(bio.actions[0]).toMatchObject({ id: 'set-bio', payload: { bio: 'Sunsets and synths' } });
    expect((await respond('log me out', base)).actions[0].id).toBe('sign-out');
  });

  test('the daily bonus, search, and the composer', async () => {
    expect((await respond('claim my daily bonus', base)).autoAction.id).toBe('daily-bonus');
    expect((await respond('search for sunsets', base)).links[0].to).toBe('/search?q=sunsets');
    expect((await respond('find @bob', base)).links[0].to).toBe('/profile/bob');
    expect((await respond('I want to make a post', base)).links[0].to).toBe('/create');
  });
});
