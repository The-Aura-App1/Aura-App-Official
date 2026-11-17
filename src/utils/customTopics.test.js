import fs from 'fs';
import path from 'path';
import { checkCustomTopic, topicKey, topicDisplay, postTopicList } from './customTopics';
import { postTopicIds, isTopicId, topicLabel, TOPIC_IDS } from './topics';
import { cleanPrefs, setTopics } from './feedPrefs';
import { scorePost } from './feedRanking';

const curated = [...TOPIC_IDS];

test('one key per topic, however it is typed', () => {
  expect(topicKey('Cookin ')).toBe('cookin');
  expect(topicKey('  Home   Baking ')).toBe('home baking');
  expect(topicKey('lo_fi')).toBe('lo fi');
  expect(topicKey('Ｈｏｍｅ')).toBe('home');          // full-width letters (NFKC)
  expect(checkCustomTopic('Cookin ').key).toBe(checkCustomTopic('cookin').key);
  expect(topicDisplay('home baking')).toBe('Home baking');
});

test('good topics pass, in any language', () => {
  for (const ok of ['home baking', 'K-pop', 'film photography', 'café culture', 'аниме', 'f1', 'retro gaming 90s']) {
    expect(checkCustomTopic(ok, curated)).toEqual({ key: topicKey(ok) });
  }
});

test('each rule turns away what it should, with a reason', () => {
  const why = raw => checkCustomTopic(raw, curated).error;
  expect(why('a')).toMatch(/2 to 24/);
  expect(why('x'.repeat(25))).toMatch(/2 to 24/);
  expect(why('https://spam.example')).toMatch(/links/);
  expect(why('buy at shop.com')).toMatch(/links/);
  expect(why('me@mail.com')).toMatch(/@names or email/);
  expect(why('@bob')).toMatch(/@names/);
  expect(why('call 555 123 4567')).toMatch(/phone/);
  expect(why('cook​ing')).toMatch(/hidden characters/);
  expect(why('cookin!')).toMatch(/letters, numbers/);
  expect(why('pаypal')).toMatch(/one alphabet/);     // a Cyrillic "а" hiding in Latin
  expect(why('1234')).toMatch(/at least one letter/);
  expect(why('aura team')).toMatch(/isn't allowed/);
  expect(why('Official news')).toMatch(/isn't allowed/);
  expect(why('nsfw pics')).toMatch(/isn't allowed/);
  expect(checkCustomTopic('modern', curated).key).toBe('modern');   // "mod" alone in a word is fine
  // a #hashtag gets offered as a hashtag instead
  expect(checkCustomTopic('#jazz', curated)).toMatchObject({ hashtag: 'jazz' });
  // one of Aura's own topics is pointed back to the list
  expect(checkCustomTopic('Cooking', curated)).toEqual({ key: 'cooking', curated: true });
});

test('custom topics join curated ones wherever topics are used, without colliding', () => {
  const post = { tags: ['cooking'], customTopics: ['home baking'] };
  expect(postTopicIds(post)).toEqual(['cooking', 'c:home baking']);
  expect(postTopicList(post, id => id)).toEqual([{ key: 'cooking', label: 'cooking', custom: false }, { key: 'home baking', label: 'Home baking', custom: true }]);
  expect(topicLabel('c:home baking')).toBe('Home baking');
  expect(isTopicId('c:home baking')).toBe(true);
  expect(isTopicId('c:https://x.com')).toBe(false);
  // followable and mutable in Tune your feed, kept on the device
  const prefs = setTopics(cleanPrefs({}), ['c:home baking'], 'more');
  expect(cleanPrefs(prefs).more).toEqual(['c:home baking']);
  expect(scorePost(post, prefs)).toBeGreaterThan(scorePost({ tags: ['cooking'] }, prefs));
  // old posts with no customTopics load exactly as before
  expect(postTopicIds({ tags: ['art'] })).toEqual(['art']);
  expect(postTopicIds({})).toEqual([]);
});

test('the app and aura-posts use the same rules file', () => {
  const app = fs.readFileSync(path.join(__dirname, 'customTopics.js'), 'utf8').replace(/\r\n/g, '\n');
  const server = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'lambdas', 'aura-posts', 'customTopics.mjs'), 'utf8').replace(/\r\n/g, '\n');
  expect(server).toBe(app);
});
