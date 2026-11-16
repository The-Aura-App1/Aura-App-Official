import { TOPICS } from '../utils/topics';
import { fold } from '../utils/searchRanking';
import { decodeVector, similarity, postEmbeddingText } from '../utils/embeddings';

// "Find a post by describing it": "the video of a dog on a skateboard",
// "that sunset photo I liked last week", "a funny post in my gym group about
// leg day", "the top cooking posts this week".
//
// Three places to look, each through the normal API with the person's own
// token, so the server's own visibility rules (blocks, bans, private
// accounts, group membership, removed posts) already apply:
//   liked   their Liked list (GET /users/me/likes, owner-only)
//   groups  posts in groups they're an active member of (GET /groups/{id}/posts)
//   global  the public pool of popular posts (GET /posts)
// Nothing is saved; results live in this conversation only. Captions are
// data: they're only scored, never read as instructions.

const lower = t => fold(String(t ?? '')).replace(/[’]/g, "'");
const DAY = 86400000;
const PAGE = 5;
const LIKED_PAGES = 3;
const GROUP_LIMIT = 8;
const EMBED_LIMIT = 60;     // captions the device embeds itself (group posts have no vectors)
const SIM_FLOOR = 0.22, SIM_FULL = 0.5;

export const SCOPE_LABEL = { liked: 'Liked', groups: 'Your groups', global: 'Popular' };

const NOUNS = 'posts?|photos?|pics?|pictures?|images?|videos?|clips?|reels?|vids?|selfies?|memes?|shots?|snaps?';
const MEDIA = new RegExp(`\\b(${NOUNS}|posted|shared|uploaded)\\b`);
const LOOKING = /\b(find|finding|look(?:ing)? for|search(?:ing)?(?: for)?|where(?:'s| is| was| are| did| do)|what was|pull up|show me|bring up|remember|can'?t find|lost|dig up|get me|need|again|see (?:it|that) again)\b/;
// "the deadlift one", "the cucumber cat thing": no media word, but clearly a post
const VAGUE_ONE = /\b(?:the|that)\s+[\p{L}\p{N}' ]{2,40}?\s(?:one|thing)\b/u;
const LIKED = /\b(i (?:have |'ve |had )?liked|i like[ds]|my likes|liked (?:posts?|ones|list|tab|photos?|videos?)|from my likes|i saved)\b/;
const GROUPS = /\b(my groups?|groups? i'?m in|in (?:a |one of )?(?:my |the )?groups?|in (?:my |the |our )?[\p{L}\p{N}' ]{2,30}? group)\b/u;
const GLOBAL = /\b(everywhere|anywhere|global(?:ly)?|all (?:of )?aura|on aura|popular|trending|top|best|hottest)\b/;

// Is this someone describing a post they want found?
export function asksToDescribe(text) {
  if (/^(how|why|can i|is it possible)\b/.test(text) && !/\b(find|show) me\b/.test(text)) return false;
  // (never "the post button is broken", which is for support)
  if (/\b(broken|bug|not working|doesn'?t|won'?t|can'?t (post|upload|see)|error|crash|glitch)/.test(text)) return false;
  const looking = LOOKING.test(text) || LIKED.test(text);
  if (!MEDIA.test(text)) return looking && VAGUE_ONE.test(text);
  if (looking) return true;
  // "the video of a dog on a skateboard", "that vid with the cat", "the aurora pic"
  return new RegExp(`^(?:the|that|this|those|some)\\b.{0,40}\\b(?:${NOUNS})\\b`).test(text)
    || new RegExp(`^(?:a|an)\\b.{0,30}\\b(?:${NOUNS})\\s+(?:of|about|with|from|in|by|where|showing)\\b`).test(text);
}

const FILLER = new Set(('find finding look looking search searching for where wheres is was are pull up show me bring remember cant '
  + 'can not find lost dig get the that this those these a an some any one ones of about with on in from by to at it its '
  + 'i im my mine me we our you your post posts photo photos pic pics picture pictures image images video videos clip clips '
  + 'reel reels vid vids selfie selfies meme memes liked like likes saved save group groups everywhere anywhere global globally '
  + 'all aura popular trending top best hottest today yesterday last week weeks month months this past recent recently new newest '
  + 'old older ago days day few couple saw seen see someone somebody person posted shared was were where showing shows had have '
  + 'just only please again think maybe kind sort really very there here what which who when and or but funny cute cool nice good great '
  + 'over more than above least everyone everybody people need again thing things shot shots snap snaps posted shared uploaded '
  + 'did go went gone loved love made make').split(' '));

const TYPE_WORDS = [['video', /\b(videos?|clips?|reels?|vids?)\b/], ['image', /\b(photos?|pics?|pictures?|images?|selfies?)\b/], ['text', /\b(text posts?|thoughts?|quotes?)\b/]];

// Pulls the scope, filters and the words to match out of a description
export function parseDescription(text) {
  const scopes = new Set();
  if (LIKED.test(text)) scopes.add('liked');
  const groupHit = GROUPS.exec(text);
  if (groupHit) scopes.add('groups');
  if (/\b(everywhere|anywhere|global(?:ly)?|all (?:of )?aura)\b/.test(text)) scopes.add('global');
  const named = /\bin (?:my |the |our )?([\p{L}\p{N}' ]{2,30}?) group\b/u.exec(text)?.[1]?.trim();
  const groupName = named && !/^(a|one|my|the|any)$/.test(named) ? named : null;

  const type = TYPE_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  let since = null;
  if (/\btoday\b/.test(text)) since = DAY;
  else if (/\byesterday\b/.test(text)) since = 2 * DAY;
  else if (/\b(this|last|past) week\b|\bfew days\b/.test(text)) since = 8 * DAY;
  else if (/\b(this|last|past) month\b/.test(text)) since = 31 * DAY;
  const author = /@([a-z0-9_]{3,30})\b/.exec(text)?.[1] ?? null;
  const minAura = Number(/\b(?:over|more than|above|at least) (\d{1,6})(?: aura)?\b/.exec(text)?.[1] ?? 0) || 0;
  const popular = /\b(top|best|most popular|hottest|popular|trending)\b/.test(text);

  const groupWords = new Set(groupName ? lower(groupName).split(/\s+/) : []);
  const words = [...new Set(lower(text.replace(/@[a-z0-9_]+/g, ' '))
    .split(/[^\p{L}\p{N}#]+/u).map(w => w.replace(/^#/, ''))
    .filter(w => w.length >= 3 && !FILLER.has(w) && !groupWords.has(w) && !/^\d+$/.test(w)))].slice(0, 8);
  const topics = TOPICS.filter(t => words.includes(t.id) || words.includes(lower(t.label))).map(t => t.id);
  return { scopes: [...scopes], groupName, type, since, author, minAura, popular, words, topics };
}

// One edit apart ("skatebord" ~ "skateboard"), for words of 5+ letters
function nearly(a, b) {
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
// riding/ride, sunsets/sunset, stories/story, baked/bake all meet in the middle
const stem = w => (w.length <= 4 ? w : w.replace(/ies$/, 'y').replace(/(ing|ed|es|s|e)$/, ''));

function wordScore(post, words, groupName = null) {
  if (!words.length) return 0;
  const tags = (post.hashtags ?? []).map(lower);
  const caption = lower(post.caption).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const topicWords = (post.tags ?? []).flatMap(t => lower(TOPICS.find(x => x.id === t)?.label ?? t).split(/\s+/));
  const author = [lower(post.authorUsername), ...lower(post.authorDisplay).split(/\s+/)];
  // a group post also matches its group's name ("the twist post in book club")
  const pool = [...tags, ...caption, ...(groupName ? lower(groupName).split(/\s+/) : [])];
  // "sour dough" finds "sourdough"
  const joined = new Set();
  for (let i = 0; i + 1 < words.length; i++) {
    if (pool.includes(words[i] + words[i + 1])) { joined.add(i); joined.add(i + 1); }
  }
  let total = 0;
  for (const [i, w] of words.entries()) {
    if (pool.includes(w) || joined.has(i)) total += 1;
    else if (pool.some(p => stem(p) === stem(w) || (w.length >= 4 && p.startsWith(w)))) total += 0.9;
    // "board" in "skateboard"
    else if (w.length >= 4 && pool.some(p => p.length > w.length + 2 && p.endsWith(w))) total += 0.75;
    else if (topicWords.includes(w) || topicWords.some(p => stem(p) === stem(w))) total += 0.8;
    else if (pool.some(p => nearly(w, p))) total += 0.7;
    else if (author.some(a => a && a.startsWith(w))) total += 0.6;
  }
  return total / words.length;
}

const meaning = (vec, postVec) => (vec && postVec ? Math.max(0, Math.min(1, (similarity(vec, postVec) - SIM_FLOOR) / (SIM_FULL - SIM_FLOOR))) : 0);

// Fetches each scope's posts (in parallel), labelled with where they came from
async function gather(scopes, parsed, ctx) {
  const out = [];
  const notes = [];
  const jobs = [];
  if (scopes.includes('liked')) {
    jobs.push((async () => {
      if (!ctx.api?.getLikedPosts) return;
      let cursor = null;
      for (let page = 0; page < LIKED_PAGES; page++) {
        const res = await ctx.api.getLikedPosts(cursor);
        for (const p of res?.posts ?? []) out.push({ post: p, scope: 'liked', where: 'Liked' });
        cursor = res?.nextCursor;
        if (!cursor) break;
      }
    })().catch(() => notes.push('I couldn\'t load your liked posts just now.')));
  }
  if (scopes.includes('groups')) {
    jobs.push((async () => {
      if (!ctx.api?.getMyGroups || !ctx.api?.getGroupPosts) return;
      const mine = ((await ctx.api.getMyGroups())?.groups ?? []).filter(g => !g.myStatus || g.myStatus === 'active');
      let groups = mine;
      if (parsed.groupName) {
        const want = lower(parsed.groupName);
        const hits = mine.filter(g => lower(g.name).includes(want) || want.includes(lower(g.name)));
        if (hits.length) groups = hits;
        else notes.push(`You're not in a group called "${parsed.groupName}", so I looked in all your groups.`);
      }
      if (!mine.length) { notes.push('You\'re not in any groups yet.'); return; }
      await Promise.all(groups.slice(0, GROUP_LIMIT).map(async g => {
        const res = await ctx.api.getGroupPosts(g.groupId).catch(() => null);
        for (const p of res?.posts ?? []) out.push({ post: p, scope: 'groups', where: g.name });
      }));
      if (groups.length > GROUP_LIMIT) notes.push(`I looked in ${GROUP_LIMIT} of your ${groups.length} groups.`);
    })().catch(() => notes.push('I couldn\'t load your groups just now.')));
  }
  if (scopes.includes('global')) {
    jobs.push((async () => {
      for (const p of (await ctx.getPool?.()) ?? []) out.push({ post: p, scope: 'global', where: 'Popular' });
    })().catch(() => notes.push('I couldn\'t load the popular posts just now.')));
  }
  await Promise.all(jobs);
  // The same post found twice keeps its most personal label
  const seen = new Map();
  for (const hit of out) if (!seen.has(hit.post.postId)) seen.set(hit.post.postId, hit);
  return { hits: [...seen.values()], notes };
}

// Scores and filters; returns hits best first, each with `rel` (0-1)
export async function rankHits(hits, parsed, ctx, exclude = new Set()) {
  const now = Date.now();
  let list = hits.filter(({ post }) => !exclude.has(post.postId)
    // with words to match, "video" or "photo" only nudges (people misremember);
    // on its own ("videos I liked") it filters
    && (!parsed.type || parsed.words.length || post.type === parsed.type)
    && (!parsed.since || now - Date.parse(post.createdAt ?? 0) <= parsed.since)
    && (!parsed.author || lower(post.authorUsername) === parsed.author)
    && (!parsed.minAura || (post.auraScore ?? 0) >= parsed.minAura)
    && (!parsed.topics.length || !parsed.popular || (post.tags ?? []).some(t => parsed.topics.includes(t))));

  // Meaning, from the on-device model: the description's vector against each
  // post's (group posts have none, so the device embeds their captions too)
  let vec = null;
  const description = parsed.words.join(' ');
  if (ctx.embed && description) {
    const missing = list.filter(h => !h.post.embedding && (h.post.caption || h.post.hashtags?.length)).slice(0, EMBED_LIMIT);
    try {
      const vecs = await ctx.embed([description, ...missing.map(h => postEmbeddingText(h.post.caption ?? '', [], h.post.hashtags ?? []))]);
      if (vecs) {
        vec = decodeVector(vecs[0]);
        missing.forEach((h, i) => { h.vec = decodeVector(vecs[i + 1]); });
      }
    } catch { vec = null; }
  }

  list = list.map(h => {
    const text = wordScore(h.post, parsed.words, h.scope === 'groups' ? h.where : null);
    const sense = meaning(vec, h.vec ?? decodeVector(h.post.embedding));
    const rel = parsed.words.length ? Math.min(1, Math.max(text, sense * 0.9) + 0.15 * Math.min(text, sense)) : 0.5;
    const age = Math.max(0, now - Date.parse(h.post.createdAt ?? 0)) / DAY;
    const tie = (parsed.popular ? 0.3 : 0.08) * Math.log10(1 + Math.max(0, h.post.auraScore ?? 0)) + 0.1 / (1 + age / 7);
    const kind = parsed.type ? (h.post.type === parsed.type ? 0.4 : -0.4) : 0;
    return { ...h, rel, score: rel * 3 + tie + kind };
  });
  return list.filter(h => h.rel >= 0.35).sort((a, b) => (parsed.newest ? Date.parse(b.post.createdAt ?? 0) - Date.parse(a.post.createdAt ?? 0) : 0) || b.score - a.score);
}

const card = h => ({
  postId: h.post.postId, author: h.post.authorUsername, caption: (h.post.caption ?? '').slice(0, 120),
  aura: h.post.auraScore ?? 0, type: h.post.type, where: h.where, weak: h.rel < 0.6,
});

function present(state, start = 0) {
  const { results, parsed, notes, searched, subject } = state;
  const page = results.slice(start, start + PAGE);
  const where = searched.map(s => SCOPE_LABEL[s].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const searchLink = { to: `/search?q=${encodeURIComponent(subject)}`, label: `Search Aura for "${subject}"` };
  const honest = searched.includes('global') ? ' (for everyone\'s posts I can only see today\'s popular ones)' : '';
  if (!page.length) {
    return {
      kind: 'find-posts',
      text: start ? 'That\'s everything I found.' : `Nothing about "${subject}" in ${where}${honest}.${notes.length ? ` ${notes.join(' ')}` : ''}`,
      links: subject ? [searchLink] : [],
      followUps: start ? [] : nextScopes(searched),
      find: { ...state, shown: start },
    };
  }
  const strong = !page[0].weak;
  const lead = start ? 'More:' : strong
    ? `Here ${page.length === 1 ? 'is what I found' : `are the best ${page.length}`} from ${where}${honest}:`
    : `Nothing matched closely, so these are the closest I found in ${where}${honest}:`;
  const more = results.length > start + PAGE;
  return {
    kind: 'find-posts',
    text: `${lead}${notes.length ? `\n${notes.join(' ')}` : ''}`,
    posts: page.map(card),
    links: subject ? [searchLink] : [],
    followUps: [...(more ? ['Show more'] : []), ...(start ? [] : nextScopes(searched)), ...(parsed.newest ? [] : ['Newer ones'])].slice(0, 4),
    find: { ...state, shown: start },
    subjects: { topics: parsed.topics, keywords: [] },
  };
}

function nextScopes(searched) {
  const all = ['liked', 'groups', 'global'];
  if (searched.length === all.length) return ['Only my groups', 'Only posts I liked'];
  return all.filter(s => !searched.includes(s)).map(s => (s === 'global' ? 'Look everywhere' : s === 'groups' ? 'Look in my groups' : 'Look in my likes'));
}

async function run(parsed, ctx, exclude = new Set()) {
  // No scope named: look in all three and label each result
  const can = { liked: !!ctx.api?.getLikedPosts, groups: !!(ctx.api?.getMyGroups && ctx.api?.getGroupPosts), global: !!ctx.getPool };
  const wanted = parsed.scopes.length ? parsed.scopes : ['liked', 'groups', 'global'];
  const scopes = wanted.filter(s => can[s]).length ? wanted.filter(s => can[s]) : ['global'];
  const { hits, notes } = await gather(scopes, parsed, ctx);
  const results = await rankHits(hits, parsed, ctx, exclude);
  const subject = parsed.words.join(' ') || parsed.topics.join(' ');
  return present({ parsed, results, notes, searched: scopes, subject, exclude: [...exclude] });
}

export async function describeReply(text, ctx) {
  return run(parseDescription(text), ctx);
}

// ─── Follow-ups on the last search ────────────────────────────
const ORDINALS = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4 };
const ORDINAL = /^(?:open |show me |take me to |go to )?(?:the )?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|top) (?:one|post|result|video|photo)?\s*(?:please)?$/;
const MORE = /^(?:show |see )?(?:me )?more(?: results| ones| of them| posts)?(?: please)?$|^next(?: ones| page| 5)?$/;
const SCOPE_ONLY = /^(?:(?:just|only)(?: in| look in| search)?|look in|search) (my groups?|my likes|(?:the )?posts? i liked|liked(?: posts)?|everywhere|popular(?: posts)?)$|^(?:look|search) everywhere$|^(?:look|search) in my (groups?|likes)$|^only posts i liked$/;
const NEWER = /^(?:show me )?(?:newer|more recent|recent|latest|newest)(?: ones| posts| first)?$/;
const NOT_THAT = /^(?:no|nope|not (?:that|those|it|this)(?: one)?)[,.!]?\s*(?:(?:the|a|one|it) )?(?:one |post )?(?:with|about|of|where|that has)?\s*(.*)$/;

export function isFindFollowUp(text, last) {
  if (!last) return false;
  return ORDINAL.test(text) || MORE.test(text) || SCOPE_ONLY.test(text) || NEWER.test(text) || (NOT_THAT.test(text) && /^(no|nope|not)\b/.test(text));
}

export async function findFollowUp(text, ctx) {
  const last = ctx.lastFind;
  const ord = ORDINAL.exec(text);
  if (ord) {
    const shown = last.results.slice(last.shown, last.shown + PAGE);
    const pick = ord[1] === 'last' ? shown[shown.length - 1] : shown[ORDINALS[ord[1]] ?? 0];
    if (!pick) return { kind: 'find-posts', text: 'There isn\'t one there. Pick from the list above.', find: last };
    return { kind: 'find-posts', text: `Opening the post by @${pick.post.authorUsername}.`, autoAction: { id: 'go', payload: { to: `/post/${encodeURIComponent(pick.post.postId)}` } }, find: last };
  }
  if (MORE.test(text)) return present(last, last.shown + PAGE);
  if (NEWER.test(text)) {
    const parsed = { ...last.parsed, newest: true };
    return present({ ...last, parsed, results: [...last.results].sort((a, b) => Date.parse(b.post.createdAt ?? 0) - Date.parse(a.post.createdAt ?? 0)) });
  }
  if (SCOPE_ONLY.test(text)) {
    const scope = /group/.test(text) ? 'groups' : /lik/.test(text) ? 'liked' : 'global';
    return run({ ...last.parsed, scopes: [scope] }, ctx, new Set(last.exclude ?? []));
  }
  // "not that, one with a dog": drop what was on top, add the new words
  const extra = NOT_THAT.exec(text)?.[1] ?? '';
  const more = parseDescription(extra);
  const exclude = new Set([...(last.exclude ?? []), ...last.results.slice(last.shown, last.shown + 1).map(h => h.post.postId)]);
  const parsed = { ...last.parsed, words: [...new Set([...last.parsed.words, ...more.words])].slice(0, 8), type: more.type ?? last.parsed.type };
  return run(parsed, ctx, exclude);
}
