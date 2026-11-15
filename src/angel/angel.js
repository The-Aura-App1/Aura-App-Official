import { TOPICS } from '../utils/topics';
import { decodeVector, similarity } from '../utils/embeddings';
import { textMatch, fold } from '../utils/searchRanking';
import { hashtagKey } from '../utils/hashtags';
import { KNOWLEDGE } from './knowledge';
import { describeTheme } from './themeMaker';

// Angel: Aura's helper. Everything here runs on the person's device; nothing
// they type is sent anywhere. She doesn't generate free text: she works out
// which of her five jobs a message is about, then answers from real data
// (the feed's public posts, the person's own feed settings) or from a fixed,
// checked guide (knowledge.js). That keeps her on topic by construction, so
// she can't be talked into other things, and she never writes content.
//
// Her jobs: tune the feed, look up trends, answer app questions, make a
// custom theme, and give feedback on a post someone is writing.
// Anything else gets a polite "Sorry, I can't help you with that."

export const MAX_MESSAGE = 600;

const REFUSALS = [
  "Sorry, I can't help you with that.",
  "Sorry, that's not something I can help with.",
  "I can't help with that one, sorry.",
];
let refusalTurn = 0;
export function refusal(extra = '') {
  const text = REFUSALS[refusalTurn++ % REFUSALS.length];
  return { kind: 'refuse', text: extra ? `${text} ${extra}` : text };
}
const WHAT_I_DO = 'I can help you tune your feed, look up trends, answer questions about Aura, make you a custom theme, or give feedback on a post you\'re writing.';

// ── Reading a message ─────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex -- strips invisible and control characters on purpose
export const clean = text => String(text ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g, ' ').slice(0, MAX_MESSAGE).trim();
const lower = text => fold(text).replace(/[’]/g, "'");
const has = (text, re) => re.test(text);

// Words for topics people commonly use instead of the topic's own name
const TOPIC_WORDS = {
  sports: ['sport', 'sports', 'nfl', 'nba', 'mlb', 'nhl', 'football', 'soccer', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'f1', 'ufc', 'boxing', 'athletes', 'team', 'teams'],
  photography: ['photo', 'photos', 'photography', 'camera', 'photographers'],
  art: ['art', 'painting', 'drawing', 'illustration', 'sketch', 'artists'],
  music: ['music', 'songs', 'song', 'band', 'bands', 'concert', 'albums', 'rap', 'hiphop', 'jazz', 'rock'],
  film: ['film', 'films', 'movie', 'movies', 'cinema', 'tv', 'shows', 'series'],
  design: ['design', 'ui', 'ux', 'graphic'],
  writing: ['writing', 'poetry', 'poems', 'stories'],
  gaming: ['gaming', 'games', 'videogames', 'esports', 'gamer'],
  comedy: ['comedy', 'memes', 'meme', 'funny', 'jokes', 'humor'],
  fitness: ['fitness', 'gym', 'workout', 'workouts', 'running', 'lifting', 'yoga'],
  cooking: ['cooking', 'recipes', 'recipe', 'baking', 'chef'],
  food: ['food', 'foodie', 'restaurants', 'eating'],
  travel: ['travel', 'traveling', 'trips', 'vacation'],
  fashion: ['fashion', 'outfits', 'clothes', 'style'],
  beauty: ['beauty', 'makeup', 'skincare'],
  tech: ['tech', 'technology', 'gadgets', 'ai', 'phones'],
  science: ['science', 'space', 'physics', 'biology', 'astronomy'],
  finance: ['finance', 'money', 'investing', 'stocks', 'crypto'],
  coding: ['coding', 'programming', 'code', 'developers', 'javascript', 'python'],
  books: ['books', 'book', 'reading', 'novels'],
  education: ['education', 'learning', 'school', 'study'],
  business: ['business', 'startups', 'entrepreneurs', 'marketing'],
  pets: ['pets', 'pet', 'dogs', 'dog', 'cats', 'cat', 'puppies', 'animals'],
  motivation: ['motivation', 'inspiration', 'mindset', 'selfcare'],
  sustainability: ['sustainability', 'climate', 'environment', 'eco'],
  outdoors: ['outdoors', 'hiking', 'camping', 'nature', 'climbing'],
  cars: ['cars', 'car', 'automotive', 'racing'],
  diy: ['diy', 'crafts', 'woodworking', 'building'],
};
for (const t of TOPICS) (TOPIC_WORDS[t.id] ??= []).push(...fold(t.label).split(/\s+/));

const STOP = new Set(('a an the and or but of to for in on at by with about from into my me i im i\'m you your it its this that these those is are was be '
  + 'am do does did can could would should will want wanna like love more less fewer see seeing show shows showing posts post content stuff things thing '
  + 'some any lot lots please pls feed get getting got not dont don\'t no none less fewer stop too much many really very just also what which who how '
  + 'why when where there their them they he she we us our more of tired hate hide avoid need needs missing interested into enjoy lately anymore '
  + 'kind type types sort sorts generating most least top trending trend trends popular unpopular attention aura engagement right now today week '
  + 'tune tuning recommend recommended timeline give gives giving find out space creator creators team teams player players '
  + 'getting gets doing does well best worst hottest hot').split(/\s+/));

// The topic ids a message names, and the other meaningful words in it
export function subjectsOf(text) {
  // a quoted phrase is one keyword, so its words aren't counted again
  const unquoted = String(text).replace(/["“']([^"”']{2,40})["”']/g, ' ');
  const words = lower(unquoted).split(/[^\p{L}\p{N}#']+/u).filter(Boolean);
  const topics = new Set();
  const keywords = [];
  for (const raw of words) {
    const w = raw.replace(/^#/, '');
    const topic = Object.keys(TOPIC_WORDS).find(id => TOPIC_WORDS[id].includes(w));
    if (topic) topics.add(topic);
    // a specific word (nfl, chiefs) is also worth keeping as a keyword
    if (!STOP.has(w) && w.length >= 2 && !TOPICS.some(t => fold(t.label) === w)) keywords.push(w);
  }
  const quoted = [...String(text).matchAll(/["“']([^"”']{2,40})["”']/g)].map(m => m[1].trim());
  return { topics: [...topics], keywords: [...new Set([...quoted.map(q => q.toLowerCase()), ...keywords])].slice(0, 5) };
}

// ── Deciding what a message is about ──────────────────────────────────

const INTENT_RULES = {
  theme: /\b(theme|palette|colou?r scheme|colou?rs? for (the )?app|app('s)? (look|colou?rs?|font)|make (the )?app (look|feel)|custom theme|dark mode|light mode)\b/,
  trends: /\b(trend|trending|popular|unpopular|most (aura|attention|engagement|liked|popular)|least (aura|attention|engagement|popular)|what'?s hot|hottest|top (posts?|hashtags?|topics?|teams?)|performing|generating (the )?most|getting (the )?most|blowing up|which .{1,40} (most|least))\b/,
  feed: /\b(my feed|feed|timeline|see more|see less|show me (more|less|fewer)|show (more|less|fewer)|more (posts|content|stuff) (about|on|from)|less (posts|content|stuff)|fewer|stop showing|not getting|not seeing|keep seeing|tune|recommend(ed|ations)?|reset my)\b/,
  post: /\b(my (post|caption|draft)|this (post|caption|draft)|a post i'?m|caption|draft|feedback on|improve my|review my|help (me )?with (a|my|this) post|what topics? (should|for)|which topics?|hashtags? (should|for)|before i post)\b/,
};

// Requests to write or generate content for someone: Angel only helps with posts
const CREATE = /\b(write|generate|compose|come up with|think of|make me|create me|draft me|give me (a|an|some|my))\b.{0,30}\b(caption|post|tweet|poem|story|bio|comment|message|reply|essay|song|lyrics|joke|text|status|description|hashtags)\b/;
const WRITE_FOR_ME = /\b(write (me|it|this|a|an|my)|rewrite|reword|rephrase|paraphrase|fix my (post|caption)|edit my (post|caption) for me)\b/;
// Looking into other people (beyond public trend totals) is off limits
const PEOPLE = /(@[a-z0-9_]{2,}|\b(who is|who's|where does|where do|address|phone|email|password|real name|dox|stalk|private (account|posts?) of|what does \S+ like|someone'?s)\b)/;

const INTENT_EXAMPLES = {
  feed: ['I want to see more cooking posts', 'stop showing me so much politics', 'my feed is boring', 'I am not seeing posts about soccer', 'how do I get more photography in my feed'],
  trends: ['what is trending right now', 'which team is getting the most aura', 'what hashtags are popular', 'which topics are getting the least attention', 'what kind of posts do well'],
  theme: ['make me a dark purple theme', 'I want the app to look like a sunset', 'can you make a theme with a serif font', 'give the app ocean colors'],
  post: ['can you give me feedback on my caption', 'what topic should my post be in', 'is my post too long', 'how can I make my post better'],
};

let exampleVecs = null;
async function nearestIntent(text, embed) {
  if (!embed) return null;
  try {
    if (!exampleVecs) {
      const entries = [
        ...Object.entries(INTENT_EXAMPLES).flatMap(([intent, list]) => list.map(q => ({ intent, q }))),
        ...KNOWLEDGE.map(k => ({ intent: 'app', q: k.q, k })),
      ];
      const vecs = await embed(entries.map(e => e.q));
      if (!vecs) return null;
      exampleVecs = entries.map((e, i) => ({ ...e, vec: decodeVector(vecs[i]) }));
    }
    const [mine] = (await embed([text])) ?? [];
    const vec = decodeVector(mine);
    if (!vec) return null;
    let best = null;
    for (const e of exampleVecs) {
      const sim = similarity(vec, e.vec);
      if (!best || sim > best.sim) best = { ...e, sim };
    }
    return best && best.sim >= 0.55 ? best : null;
  } catch {
    return null;
  }
}

function knowledgeByKeys(text) {
  let best = null;
  for (const k of KNOWLEDGE) {
    const hits = k.keys.filter(key => text.includes(key)).reduce((n, key) => n + key.length, 0);
    if (hits && (!best || hits > best.hits)) best = { k, hits };
  }
  return best?.k ?? null;
}

// ── The five jobs ─────────────────────────────────────────────────────

const label = id => TOPICS.find(t => t.id === id)?.label ?? id;
// short keywords are usually acronyms (NFL, NBA, UFC)
const shown = k => (k.length <= 4 && /^[a-z0-9]+$/.test(k) ? k.toUpperCase() : k);

function feedReply(text, ctx) {
  if (has(text, /\b(reset|start over|clear)\b/) && has(text, /\b(feed|preferences|settings|choices)\b/)) {
    return {
      kind: 'feed', text: 'I can clear your topic and keyword choices so your feed starts fresh. What it has learned from your gives and likes stays (Settings > Privacy can reset that).',
      actions: [{ id: 'reset-feed', label: 'Clear my feed choices' }],
    };
  }
  if (has(text, /\b(what|which|show)\b.{0,20}\b(my )?(preferences|choices|settings|topics i)\b/)) {
    const p = ctx.prefs ?? { more: [], less: [], words: [] };
    const list = arr => (arr.length ? arr.map(label).join(', ') : 'none');
    return {
      kind: 'feed',
      text: `More of: ${list(p.more)}. Less of: ${list(p.less)}. Keywords: ${p.words.length ? p.words.map(w => `${w.text} (${w.choice})`).join(', ') : 'none'}.`,
    };
  }
  const less = has(text, /\b(less|fewer|stop|don'?t want|no more|tired of|hate|hide|avoid|too much|too many|sick of|keep seeing)\b/);
  const { topics, keywords } = subjectsOf(text);
  if (!topics.length && !keywords.length) {
    return {
      kind: 'feed',
      text: 'Tell me what you\'d like more or less of, like "more cooking and NFL" or "less politics". I\'ll set it up for you to confirm. Your choices stay on this device.',
    };
  }
  const choice = less ? 'less' : 'more';
  const parts = [...topics.map(t => `the ${label(t)} topic`), ...keywords.map(k => `"${shown(k)}"`)];
  return {
    kind: 'feed',
    text: `Here's what I'd change: show ${choice === 'more' ? 'more' : 'less'} of ${parts.join(', ')}. Keywords match by meaning too, so related posts count. Want me to apply it?`,
    actions: [{ id: 'apply-feed', label: 'Apply', payload: { topics, keywords, choice } }],
  };
}

async function trendsReply(text, ctx) {
  let posts = [];
  try { posts = (await ctx.getPool?.()) ?? []; } catch { posts = []; }
  posts = posts.filter(p => p && p.status !== 'removed');
  if (!posts.length) return { kind: 'trends', text: 'I couldn\'t load the public posts just now, so I can\'t look at trends. Try again in a moment.' };
  const { topics, keywords } = subjectsOf(text);
  const leastFirst = has(text, /\b(least|lowest|unpopular|worst|dying|ignored|underrated|not doing well|losing)\b/);
  const words = keywords.map(w => fold(w));
  // Within the topic, prefer posts that also mention the specific words (NFL
  // inside Sports); without a topic, the words alone decide
  let pool = topics.length ? posts.filter(p => (p.tags ?? []).some(t => topics.includes(t))) : posts;
  if (words.length) {
    const matching = pool.filter(p => textMatch(p, words) >= 0.7);
    if (matching.length || !topics.length) pool = matching;
  }
  if (!pool.length) {
    return { kind: 'trends', text: `None of the public posts I can see right now match ${[...topics.map(label), ...keywords].join(', ')}. Try a broader topic.` };
  }
  // Group by hashtag (the clearest signal of a team, show or theme), else by topic
  const groups = new Map();
  for (const p of pool) {
    const keys = (p.hashtags ?? []).map(hashtagKey).filter(h => !words.includes(h));
    for (const key of keys.length ? keys.map(h => `#${h}`) : (p.tags ?? []).map(label)) {
      const g = groups.get(key) ?? { key, aura: 0, posts: 0 };
      g.aura += Math.max(0, p.auraScore ?? 0);
      g.posts += 1;
      groups.set(key, g);
    }
  }
  const ranked = [...groups.values()].sort((a, b) => b.aura - a.aura || b.posts - a.posts);
  const top = ranked.slice(0, 5);
  const bottom = ranked.filter(g => !top.includes(g)).slice(-3).reverse();
  const scope = topics.length || keywords.length ? ` about ${[...topics.map(label), ...keywords.map(shown)].join(', ')}` : '';
  const line = g => `${g.key}: ${g.aura.toLocaleString()} aura across ${g.posts} post${g.posts === 1 ? '' : 's'}`;
  const items = leastFirst
    ? [{ title: 'Getting the least attention', rows: [...ranked].reverse().slice(0, 5).map(line) }, { title: 'For comparison, the most', rows: top.slice(0, 3).map(line) }]
    : [{ title: 'Getting the most aura', rows: top.map(line) }, ...(bottom.length ? [{ title: 'Getting the least', rows: bottom.map(line) }] : [])];
  return {
    kind: 'trends',
    text: `From the ${pool.length} public post${pool.length === 1 ? '' : 's'}${scope} in today's trending pool:`,
    items,
    note: 'This counts aura given to public posts in the feed\'s current pool (the most active posts right now), not every post, and never anyone\'s private activity.',
  };
}

function appReply(k) {
  return { kind: 'app', text: k.a };
}

function themeReply(text, ctx) {
  const result = describeTheme(text, ctx.lastTheme);
  if (!result) {
    return { kind: 'theme', text: 'Describe the look you want, like "a dark ocean theme with a serif font" or "warm sunset colors, light". I\'ll make it and you can try it on.' };
  }
  return {
    kind: 'theme', text: result.summary, theme: result.spec, note: result.note,
    actions: [{ id: 'apply-theme', label: 'Try it on', payload: result.spec }],
  };
}

async function postReply(text, raw, ctx) {
  // the draft: quoted, or after a colon or line break
  const draft = (raw.match(/["“]([\s\S]{8,})["”]/)?.[1] ?? raw.split(/:\s|\n/).slice(1).join(' ')).trim();
  if (has(text, /\b(best time|when should i post|what time)\b/)) {
    return { kind: 'post', text: 'I can\'t tell you the best time to post: Aura doesn\'t track when people look at the app, by design. Posts stay in the trending pool by how much aura they get, so a strong post does well whenever you share it.' };
  }
  if (draft.length < 8) {
    return {
      kind: 'post',
      text: 'Paste your draft after a colon, like "feedback on my caption: …", and I\'ll point out what could be stronger and suggest topics and hashtags. I won\'t write it for you; it\'s your voice.',
    };
  }
  const notes = [];
  const good = [];
  const sentences = draft.split(/[.!?]+\s/).filter(Boolean);
  const words = draft.split(/\s+/).filter(Boolean);
  const letters = draft.replace(/[^\p{L}]/gu, '');
  const caps = letters.replace(/[^\p{Lu}]/gu, '').length / Math.max(1, letters.length);
  const emoji = (draft.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const tags = (draft.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const mentions = (draft.match(/@[\w]+/g) ?? []).length;
  if (words.length < 4) notes.push('It\'s very short. A line of context (what, where or why) gives people something to respond to.');
  if (draft.length > 600) notes.push('It\'s long. The first line shows first, so put the most important part up front.');
  if (sentences[0] && sentences[0].length > 140) notes.push('The opening sentence is long; a shorter first line draws people in.');
  if (words.length / Math.max(1, sentences.length) > 28) notes.push('Some sentences run long. Breaking them up makes it easier to read on a phone.');
  if (caps > 0.5 && letters.length > 12) notes.push('Most of it is in capitals, which reads as shouting.');
  if (/([!?])\1{2,}/.test(draft)) notes.push('Lots of repeated !!! or ??? can feel noisy; one usually lands better.');
  if (emoji > 8) notes.push(`There are ${emoji} emoji; a few go further than many.`);
  if (tags > 0) notes.push('Hashtags work best in the post\'s hashtag field (up to 10), where people can tap them, rather than in the caption.');
  if (mentions > 3) notes.push('Tagging many people notifies each of them; tag only people who are part of the post.');
  if (/\?/.test(draft)) good.push('Ending on a question invites comments.');
  else notes.push('Consider asking people something; questions get more replies.');
  if (words.length >= 8 && words.length <= 80 && caps < 0.3) good.push('The length is comfortable to read.');

  // Topic and hashtag suggestions from real data: on-device meaning, and
  // hashtags already used on similar public posts
  const { topics } = subjectsOf(draft);
  let topicIds = topics;
  if (!topicIds.length && ctx.embed) {
    try {
      const vecs = await ctx.embed([draft, ...TOPICS.map(t => t.label)]);
      const [d, ...rest] = (vecs ?? []).map(decodeVector);
      if (d) topicIds = rest.map((v, i) => [TOPICS[i].id, similarity(d, v)]).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(([, s]) => s > 0.2).map(([id]) => id);
    } catch { /* suggestions are a bonus */ }
  }
  let hashtags = [];
  try {
    const posts = (await ctx.getPool?.()) ?? [];
    const draftWords = subjectsOf(draft).keywords.map(fold);
    const counts = new Map();
    for (const p of posts) {
      if (!draftWords.length || textMatch(p, draftWords) < 0.5) continue;
      for (const h of p.hashtags ?? []) counts.set(hashtagKey(h), (counts.get(hashtagKey(h)) ?? 0) + 1);
    }
    hashtags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h]) => `#${h}`);
  } catch { /* optional */ }

  const items = [];
  if (notes.length) items.push({ title: 'Could be stronger', rows: notes });
  if (good.length) items.push({ title: 'Working well', rows: good });
  if (topicIds.length) items.push({ title: 'Topics that fit', rows: [topicIds.map(label).join(', ')] });
  if (hashtags.length) items.push({ title: 'Hashtags on similar public posts', rows: [hashtags.join('  ')] });
  return { kind: 'post', text: 'Here\'s my feedback. I won\'t rewrite it; it should sound like you.', items };
}

// ── Answering ─────────────────────────────────────────────────────────

/**
 * @param {string} message  what the person typed
 * @param {object} ctx      { prefs, getPool(): Promise<post[]>, embed(texts): Promise<string[]|null>, lastTheme }
 */
export async function respond(message, ctx = {}) {
  const raw = clean(message);
  if (!raw) return { kind: 'hint', text: WHAT_I_DO };
  const text = lower(raw);

  if (/^(hi|hey|hello|yo|hiya|good (morning|afternoon|evening))\b[\s!.]*$/.test(text)) {
    return { kind: 'hello', text: `Hi! I'm Angel. ${WHAT_I_DO}` };
  }
  if (/^(thanks|thank you|thx|ty|cheers|appreciate it)\b/.test(text)) return { kind: 'hello', text: 'Happy to help!' };

  // Limits first: a theme request may say "make", so it's checked before writing
  if (!INTENT_RULES.theme.test(text) && (CREATE.test(text) || WRITE_FOR_ME.test(text))) {
    return refusal('I don\'t write posts for people, but paste your draft and I\'ll give you feedback on it.');
  }
  if (PEOPLE.test(text)) return refusal('I don\'t look into other people\'s accounts or activity.');

  // Follow-ups to a theme she just made ("darker", "use a serif font")
  if (ctx.lastTheme && /\b(darker|lighter|brighter|muted|vivid|softer|bolder|warmer|cooler|font|serif|mono|sans|accent|background)\b/.test(text)) {
    return themeReply(text, ctx);
  }

  for (const [intent, rule] of Object.entries(INTENT_RULES)) {
    if (!rule.test(text)) continue;
    if (intent === 'theme') return themeReply(text, ctx);
    if (intent === 'trends') return trendsReply(text, ctx);
    if (intent === 'feed') return feedReply(text, ctx);
    if (intent === 'post') return postReply(text, raw, ctx);
  }
  const known = knowledgeByKeys(text);
  if (known) return appReply(known);

  // No clear words: match by meaning, on the device
  const near = await nearestIntent(raw, ctx.embed);
  if (near?.intent === 'app') return appReply(near.k);
  if (near?.intent === 'feed') return feedReply(text, ctx);
  if (near?.intent === 'trends') return trendsReply(text, ctx);
  if (near?.intent === 'theme') return themeReply(text, ctx);
  if (near?.intent === 'post') return postReply(text, raw, ctx);
  return refusal();
}
