import { TOPICS } from '../utils/topics';
import { fold } from '../utils/searchRanking';
import { GAME_LIST, BOT_GAMES, BOT_LEVELS } from '../components/games/gameInfo';

// Angel's newer skills, all from the person's own data through the normal
// API (nothing leaves the device that the app wouldn't fetch anyway):
//   catch-up       "what did I miss?": a digest of unread notifications
//   find posts     "show me posts about sunsets": matching posts from the feed pool, inline
//   play a bot     "play chess against a bot": starts one in a group
//   groups         "which groups should I join?": groups matched to their interests
// plus `vocabularyOf`, which grounds feed keywords in words that really
// appear in today's posts, so filler words never become keywords.

const lower = t => fold(String(t ?? '')).replace(/[’]/g, "'");
const label = id => TOPICS.find(t => t.id === id)?.label ?? id;

// ─── Words that really appear in the pool ─────────────────────
// Every hashtag, and caption words seen in at least two posts
export function vocabularyOf(pool = []) {
  const counts = new Map();
  const vocab = new Set();
  for (const post of pool) {
    for (const tag of post.hashtags ?? []) vocab.add(lower(tag));
    const words = new Set(lower(post.caption).split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3));
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  for (const [w, n] of counts) if (n >= 2) vocab.add(w);
  return vocab;
}

// The hashtags most used on posts in these topics, for "you might also like"
export function relatedTags(pool, topics, skip = new Set(), limit = 4) {
  const counts = new Map();
  for (const post of pool) {
    if (!(post.tags ?? []).some(t => topics.includes(t))) continue;
    for (const tag of post.hashtags ?? []) {
      const t = lower(tag);
      if (!skip.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
}

// ─── Catch me up ──────────────────────────────────────────────
export const ASKS_CATCH_UP = /\b(what did i miss|catch me up|anything new|what'?s new( for me| with me)?|any (new )?(notifications|notifs|activity)|what happened (while|since)|did (anyone|someone|anybody) (give|comment|follow|reply|tag|mention|challenge)|who (gave|took|followed|commented|replied|tagged|mentioned))\b/;
const KIND_LABEL = {
  aura_given: 'gave you aura', aura_taken: 'took aura', comment: 'commented', reply: 'replied to you', mention: 'tagged you',
  follow: 'followed you', follow_request: 'asked to follow you', follow_accepted: 'accepted your request',
  game_challenge: 'challenged you to a game', game_accepted: 'accepted a game', group_join: 'joined your group',
  group_request: 'asked to join your group', group_approved: 'approved your group request',
};
export async function catchUpReply(ctx) {
  let list = [];
  try { list = (await ctx.api?.getNotifications(50))?.notifications ?? []; } catch { list = null; }
  if (list === null) return { kind: 'catch-up', text: 'I couldn\'t load your notifications just now. Try again in a moment.', links: [{ to: '/notifications', label: 'Open notifications' }] };
  const unread = list.filter(n => !n.read);
  if (!unread.length) {
    return { kind: 'catch-up', text: 'You\'re all caught up: no unread notifications.', followUps: ['What is my feed like right now?', 'What\'s trending?'] };
  }
  const byKind = new Map();
  for (const n of unread) byKind.set(n.type, [...(byKind.get(n.type) ?? []), n]);
  const rows = [...byKind.entries()].sort((a, b) => b[1].length - a[1].length).map(([type, items]) => {
    const names = [...new Set(items.map(n => n.data?.fromUsername).filter(Boolean))];
    const who = names.length ? `${names.slice(0, 3).map(u => `@${u}`).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}` : `${items.length}`;
    const aura = type === 'aura_given' || type === 'aura_taken' ? ` (${items.reduce((t, n) => t + (n.data?.amount ?? 0), 0)} aura)` : '';
    return `${who} ${KIND_LABEL[type] ?? 'did something'}${items.length > 1 && names.length ? ` (${items.length})` : ''}${aura}`;
  });
  const games = unread.filter(n => n.type === 'game_challenge');
  return {
    kind: 'catch-up',
    text: `You have ${unread.length} unread notification${unread.length === 1 ? '' : 's'}:`,
    items: [{ title: 'Since you last looked', rows }],
    links: [
      { to: '/notifications', label: 'Open notifications' },
      ...(games[0]?.data?.matchId ? [{ to: `/games/${encodeURIComponent(games[0].data.matchId)}`, label: 'Answer the challenge' }] : []),
    ],
  };
}

// ─── Find posts ───────────────────────────────────────────────
const FIND = /^(?:(?:can you |could you |please )?(?:show|find|get|pull up|give) (?:me )?(?:some |a few |any )?|(?:are there )?any )?(?:good |cool |nice |new |recent )?(?:posts?|pictures?|pics|photos?|videos?|stuff|content|things)\s+(?:about|of|on|with|for|tagged|from)\s+(.{2,60}?)[?.!]*$/;
export const asksToFindPosts = text => FIND.test(text);
export async function findPostsReply(text, ctx) {
  const subject = FIND.exec(text)[1].replace(/^(the|a|an)\s+/, '').trim();
  let pool = [];
  try { pool = (await ctx.getPool?.()) ?? []; } catch { pool = []; }
  const words = subject.split(/[^\p{L}\p{N}#]+/u).map(w => w.replace(/^#/, '')).filter(w => w.length >= 2);
  const topic = TOPICS.find(t => words.includes(t.id) || lower(subject).includes(lower(t.label)));
  const score = post => {
    const hay = lower(`${post.caption ?? ''} ${(post.hashtags ?? []).join(' ')}`);
    let s = 0;
    // "sunsets" finds #sunset too
    for (const w of words) if (hay.includes(w) || (w.length > 4 && w.endsWith('s') && hay.includes(w.slice(0, -1)))) s += 2;
    if (topic && (post.tags ?? []).includes(topic.id)) s += 3;
    return s + Math.min(2, Math.log10(Math.max(1, post.auraScore ?? 0)));
  };
  const found = pool.map(p => ({ p, s: score(p) })).filter(x => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 4).map(x => x.p);
  const searchLink = { to: `/search?q=${encodeURIComponent(subject)}`, label: `Search all of Aura for "${subject}"` };
  if (!found.length) {
    return { kind: 'find-posts', text: `Nothing about "${subject}" in today's popular posts. Search looks through everything:`, links: [searchLink] };
  }
  return {
    kind: 'find-posts',
    text: `Here ${found.length === 1 ? 'is a post' : `are ${found.length} posts`} about "${subject}" from today's popular posts:`,
    posts: found.map(p => ({ postId: p.postId, author: p.authorUsername, caption: (p.caption ?? '').slice(0, 120), aura: p.auraScore ?? 0, type: p.type })),
    links: [searchLink],
    followUps: [`More ${topic ? topic.label : subject} in my feed`],
    subjects: { topics: topic ? [topic.id] : [], keywords: [] },
  };
}

// ─── Play a bot ───────────────────────────────────────────────
const GAME_WORDS = [
  ['chess', /\bchess\b/], ['pool', /\b(pool|8[- ]?ball|billiards)\b/], ['connect4', /\bconnect ?(4|four)\b/],
  ['golf', /\b(mini ?golf|golf|putt)\b/], ['poker', /\b(poker|hold ?'?em)\b/], ['gofish', /\bgo ?fish\b/], ['crazy8', /\bcrazy ?(8|eights?)\b/],
];
export const ASKS_PLAY_BOT = /\b(play|game|games|match|challenge|bored|vs|versus|against)\b/;
export const wantsBot = text => ASKS_PLAY_BOT.test(text) && (/\b(bot|bots|computer|cpu|ai|against you|with you|by myself|alone|solo|bored|practice)\b/.test(text));
export async function playBotReply(text, ctx) {
  const game = GAME_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  const level = /\b(easy|beginner|simple)\b/.test(text) ? 'easy' : /\b(hard|difficult|expert|toughest|best)\b/.test(text) ? 'hard' : /\b(medium|normal)\b/.test(text) ? 'medium' : null;
  if (/\b(dice|coin|flip)\b/.test(text) && !game) {
    return { kind: 'bot', text: 'Dice and coin flips are pure luck, so there\'s no bot for them. Want a different game?', followUps: ['Play chess against a bot', 'Play pool against a bot', 'Play Connect 4 against a bot'] };
  }
  if (!game) {
    return { kind: 'bot', text: 'Which game? I can set you up against a bot in any of these.', followUps: GAME_LIST.filter(g => BOT_GAMES.includes(g.id)).map(g => `Play ${g.name} against a bot`) };
  }
  let groups = [];
  try { groups = ((await ctx.api?.getMyGroups())?.groups ?? []).filter(g => g.myStatus === 'active'); } catch { groups = []; }
  const name = GAME_LIST.find(g => g.id === game)?.name ?? game;
  if (!groups.length) {
    return { kind: 'bot', text: `Games live in groups, so join one first and then I can start ${name} for you.`, links: [{ to: '/groups', label: 'Find a group' }] };
  }
  const levels = level ? [BOT_LEVELS.find(l => l.id === level)] : BOT_LEVELS;
  return {
    kind: 'bot',
    text: level ? `${name} against ${levels[0].name}, the ${level} bot. Ready?` : `${name} against a bot. How hard?`,
    actions: levels.map(l => ({ id: 'start-bot', label: `${l.label} (${l.name})`, payload: { game, level: l.id, groupId: groups[0].groupId } })),
    note: 'Just for fun: no aura, and it doesn\'t count toward the group\'s level.',
  };
}

// ─── Groups for you ───────────────────────────────────────────
export const ASKS_GROUPS = /\b(which|what|any|recommend|suggest|find|good)\b.{0,30}\bgroups?\b|\bgroups? (for me|i (should|could|might) join|to join|about|for)\b/;
export async function groupsReply(text, ctx) {
  let groups = [];
  try { groups = (await ctx.api?.listGroups(''))?.groups ?? []; } catch { groups = []; }
  const open = groups.filter(g => !g.myStatus || g.myStatus === 'invited');
  if (!open.length) {
    return { kind: 'groups', text: groups.length ? 'You\'re already in every group I can see. Want to start your own?' : 'I couldn\'t find any groups to suggest right now.', links: [{ to: '/groups', label: 'Open Groups' }] };
  }
  // their interests: what they asked for, what they've chosen, what the feed learned
  const asked = (/\babout (.+)$/.exec(text)?.[1] ?? '').split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3);
  const chosen = (ctx.prefs?.more ?? []).map(label);
  const learned = ctx.taste ? Object.entries(ctx.taste.topics).filter(([, w]) => w > 0.3).map(([id]) => label(id)) : [];
  const interests = [...asked, ...chosen, ...learned].map(lower);
  const scored = open.map(g => {
    const hay = lower(`${g.name} ${g.description ?? ''}`);
    const hits = interests.filter(w => hay.includes(w) || hay.includes(w.replace(/s$/, '')));
    return { g, hits, s: hits.length * 10 + Math.log10(1 + (g.memberCount ?? 0)) };
  }).sort((a, b) => b.s - a.s);
  const top = scored.slice(0, 3);
  const matched = top.some(x => x.hits.length);
  return {
    kind: 'groups',
    text: matched ? 'These look like your kind of thing:' : 'Nothing matches your interests closely yet, so here are the liveliest groups you\'re not in:',
    items: [{ title: 'Groups', rows: top.map(({ g, hits }) => `${g.name}${g.memberCount ? ` · ${g.memberCount} members` : ''}${hits.length ? ` · ${[...new Set(hits)].slice(0, 2).join(', ')}` : ''}`) }],
    links: top.map(({ g }) => ({ to: `/groups/${encodeURIComponent(g.groupId)}`, label: `Open ${g.name}` })),
  };
}
