// Things Angel does in the app for someone, always after they say yes: each
// request becomes a card in plain words with the exact post, person, group
// or amount, and nothing happens until they tap it (or answer "yes"). The
// actions run in pages/Angel.jsx through the same API calls as the rest of
// the app, so the server's rules and limits still decide.
//
// Corey (2026-11-16): she may do "anything in the app as long as there is
// permission given before the action occurs". She still never acts in bulk,
// never gives to the same account twice in one chat, never deletes the
// account, never does moderation, and only ever uses the person's own words.
//
// "it", "that post" or "the second one" mean posts she just found (lastFind);
// a pasted post link works too.

import { POWER_UPS } from '../utils/powerUps';
import { HASHTAG_PATTERN, MAX_HASHTAGS } from '../utils/hashtags';

const ORDINALS = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4 };
const ORDINAL_REF = /\b(?:the )?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|top) (?:one|post|result|photo|video)\b/;
const IT_REF = /\b(it|that|this|that one|this one|that post|this post|the post)\b/;
const POST_LINK = /\/post\/([A-Za-z0-9_-]{4,100})/;
// "all of them", "every post", "everyone's posts": about many posts or people
const BULK = /\b(?:all|every|each|both)\b(?: (?:of )?(?:the |my |his |her |their |these |those )?)?\b(?:of them|them|posts?|ones?|photos?|videos?|comments?|people|followers?|requests?|groups?|results?)\b|\b(?:everyone|everybody|everything|every one|them all|all of them)\b|\bevery post\b/;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;
const COMMENT_MAX = 1000;

const card = (text, action, extra = {}) => ({ kind: 'action', text, actions: [action], followUps: ['Cancel'], ...extra });
const say = (text, extra = {}) => ({ kind: 'action', text, ...extra });
const snippet = (post, max = 60) => {
  const caption = (post.caption ?? '').trim().replace(/\s+/g, ' ');
  if (!caption) return `@${post.authorUsername ?? 'someone'}'s ${post.type === 'photo' ? 'photo' : post.type === 'video' ? 'video' : 'post'}`;
  return `@${post.authorUsername ?? 'someone'}'s post "${caption.length > max ? `${caption.slice(0, max - 1)}…` : caption}"`;
};
const whole = n => Math.round(n).toLocaleString();

// The post a message points at, or { error }
async function targetPost(raw, text, ctx) {
  const link = POST_LINK.exec(raw);
  if (link) {
    const post = await ctx.lookupPost?.(link[1]).catch(() => null);
    return post ? { post } : { error: 'I couldn\'t open that post. Check the link?' };
  }
  const last = ctx.lastFind;
  const shown = last?.results?.slice(last.shown ?? 0) ?? [];
  const ord = ORDINAL_REF.exec(text);
  if (ord && shown.length) {
    const pick = ord[1] === 'last' ? shown[Math.min(shown.length, 5) - 1] : shown[ord[1] === 'top' ? 0 : ORDINALS[ord[1]]];
    return pick ? { post: pick.post } : { error: 'There isn\'t one there. Pick from the posts I found.' };
  }
  if (IT_REF.test(text) && shown.length) return { post: shown[0].post };
  return { error: 'Which post? Find it first (like "find the sunset photo I liked"), then tell me what to do with it, or paste the post\'s link.' };
}

// A group of theirs by name ("my hiking group", "Night Owls")
async function myGroupNamed(name, ctx, { anyGroup = false } = {}) {
  const want = name.toLowerCase().replace(/^(my|the)\s+/, '').replace(/\s+group$/, '').trim();
  if (!want) return null;
  const mine = ((await ctx.api?.getMyGroups?.().catch(() => null))?.groups ?? []).filter(g => !g.myStatus || g.myStatus === 'active');
  const hit = g => (g.name ?? '').toLowerCase();
  const found = mine.find(g => hit(g) === want) ?? mine.find(g => hit(g).includes(want));
  if (found || !anyGroup) return found ? { group: found, member: true } : null;
  const all = (await ctx.api?.listGroups?.(want).catch(() => null))?.groups ?? [];
  const other = all.find(g => hit(g) === want) ?? all.find(g => hit(g).includes(want));
  return other ? { group: other, member: false } : null;
}

// How much they can still give today, from the profile's daily numbers
function giveRoom(me) {
  const t = me?.today;
  if (!t?.freeGive || !t?.walletGive) return '';
  const free = Math.max(0, t.freeGive.limit - t.freeGive.used);
  const wallet = Math.max(0, t.walletGive.limit - t.walletGive.used);
  return ` Today you can still give ${whole(free)} free and ${whole(wallet)} from your wallet.`;
}
function takeRoom(me) {
  const t = me?.today?.take;
  return t ? ` Today you can still take ${whole(Math.max(0, t.limit - t.used))}.` : '';
}

// What starts an action (so ordinary questions and other skills pass by)
const STARTS = /^(?:please |can you |could you |would you |pls |plz )?(give|send|tip|take|like|unlike|share|spotlight|delete|remove|comment|reply|post|join|leave|accept|approve|decline|deny|reject|mark|set|change|update|add|start|make|let|only)\b/;

export async function actionReply(raw, text, ctx) {
  if (/^(how|what|why|where|when|which|who|is|are|does|do|did|can i|could i|should)\b/.test(text)) return null;

  // Never: the account itself, moderation, or other people's accounts
  if (/\b(delete|close|remove|deactivate) (my|the) account\b/.test(text)) {
    return say('I can\'t delete accounts, and there\'s no delete button in the app yet. Ask me to contact support and the Aura team will close it for you.', { followUps: ['Contact Aura support'] });
  }
  if (!STARTS.test(text) || /^(?:please )?(?:give|send|show) me\b/.test(text)) return null;
  const verbs = /\b(give|send|tip|take|like|unlike|share|spotlight|delete|comment|follow|unfollow|block|report)\b/;
  if (BULK.test(text) && verbs.test(text) && !/\b(all )?(my )?notifications\b/.test(text)) {
    return say('I do one thing at a time, and each one needs your yes, so I won\'t do that for a whole batch. Point me at one post or person and tell me what to do.');
  }

  // ── Aura on a post: exact amount, exact post ──
  const aura = /\b(give|send|tip|take)\b.*?\baura\b/.exec(text);
  if (aura && !/\b(give|send|take) me\b|\bwallet\b|\btake (?:a )?look\b/.test(text)) {
    const verb = aura[1] === 'take' ? 'take' : 'give';
    const amountMatch = /\b(\d[\d,]*)\s*(?:aura\b)?/.exec(text.replace(ORDINAL_REF, ''));
    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null;
    const target = await targetPost(raw, text, ctx);
    if (target.error) return say(target.error);
    const { post } = target;
    if (post.authorId && post.authorId === ctx.me?.userId) return say(`You can't ${verb} aura on your own post.`);
    if (!amount) return say(`How much aura should I ${verb} ${verb === 'give' ? 'to' : 'from'} ${snippet(post)}? Say a number, like "${verb} it 10 aura".`);
    if (!Number.isInteger(amount) || amount < 1) return say('That needs to be a whole number of at least 1.');
    if (verb === 'give' && post.authorId && (ctx.recentGives ?? []).includes(post.authorId)) {
      return say(`I've already given aura to @${post.authorUsername} for you in this chat. To give them more, use the give button on their post.`, { links: [{ to: `/post/${encodeURIComponent(post.postId)}`, label: 'Open the post' }] });
    }
    const room = verb === 'give' ? giveRoom(ctx.me) : takeRoom(ctx.me);
    const action = { id: verb === 'give' ? 'give-aura' : 'take-aura', label: `${verb === 'give' ? 'Give' : 'Take'} ${whole(amount)} aura`, payload: { postId: post.postId, amount, authorId: post.authorId ?? null, author: post.authorUsername ?? '' } };
    const note = verb === 'take' ? ' Taking costs you the same amount, and nobody receives it.' : '';
    return card(`${verb === 'give' ? 'Give' : 'Take'} ${whole(amount)} aura ${verb === 'give' ? 'to' : 'from'} ${snippet(post)}?${note}${room}`, action);
  }

  // ── Like or unlike a post (private and free) ──
  // Only "like it", "like the second one" or a link, so "like Abyss but pink" stays a theme
  const like = /^(?:please |can you |could you )?(un)?like (?:it|that|this|that one|this one|that post|this post|the post|(?:the )?(?:first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|top) (?:one|post|result|photo|video)|.*\/post\/\S+)(?: (?:for me|please))?[.!]?$/.exec(text);
  if (like) {
    const target = await targetPost(raw, text, ctx);
    if (target.error) return say(target.error);
    const on = !like[1];
    return card(`${on ? 'Like' : 'Unlike'} ${snippet(target.post)}? Likes are private: only you see what you've liked.`,
      { id: 'like-post', label: on ? 'Like it' : 'Unlike it', payload: { postId: target.post.postId, on } });
  }

  // ── Share a post to one of their groups ──
  const share = /\bshare\b.*?\b(?:to|in|with|into)\s+(.+?)[.!]?$/.exec(text);
  if (share) {
    const target = await targetPost(raw, text, ctx);
    if (target.error) return say(target.error);
    const found = await myGroupNamed(share[1], ctx);
    if (!found) return say(`I couldn't find a group of yours called "${share[1]}". Check the name?`);
    return card(`Share ${snippet(target.post)} to ${found.group.name}? Its members will see it in the group's feed.`,
      { id: 'share-post', label: `Share to ${found.group.name}`, payload: { postId: target.post.postId, groupId: found.group.groupId, groupName: found.group.name } });
  }

  // ── Spotlight their own group post ──
  if (/^(?:please )?spotlight\b/.test(text)) {
    const target = await targetPost(raw, text, ctx);
    if (target.error) return say(target.error);
    const { post } = target;
    if (post.authorId !== ctx.me?.userId || !post.groupId) return say('Spotlight works on your own posts in a group. Find one of yours first.');
    return card(`Spotlight your post ${snippet(post).replace(/^@\S+ /, '')} for ${POWER_UPS.spotlightHours} hours? It costs ${POWER_UPS.spotlightCost} aura and pins it first in the group's feed.`,
      { id: 'spotlight', label: `Spotlight it (${POWER_UPS.spotlightCost} aura)`, payload: { postId: post.postId, groupId: post.groupId } });
  }

  // ── Start an Aura Rain in a group ──
  const rain = /\b(?:start|make|begin) (?:an? )?aura rain\b(?:.*?\b(\d[\d,]*)\b)?(?:.*?\bin\s+(.+?))?[.!]?$/.exec(text);
  if (rain) {
    const pot = rain[1] ? Number(rain[1].replace(/,/g, '')) : null;
    if (!rain[2]) return say('Which group, and how much? Like "start an aura rain of 500 in Night Owls".');
    const found = await myGroupNamed(rain[2].replace(/\b(of|with)\s+\d[\d,]*\s*(aura)?/, ''), ctx);
    if (!found) return say(`I couldn't find a group of yours called "${rain[2]}".`);
    if (!pot) return say(`How big a rain in ${found.group.name}? Anywhere from ${POWER_UPS.rainMin} to ${whole(POWER_UPS.rainMax)} aura.`);
    if (pot < POWER_UPS.rainMin || pot > POWER_UPS.rainMax) return say(`A rain is ${POWER_UPS.rainMin} to ${whole(POWER_UPS.rainMax)} aura.`);
    return card(`Start an Aura Rain of ${whole(pot)} aura in ${found.group.name}? It comes from your spendable aura and lasts ${POWER_UPS.rainMinutes} minutes; members catch shares of it, and whatever's left comes back to you.`,
      { id: 'start-rain', label: `Start the rain (${whole(pot)} aura)`, payload: { groupId: found.group.groupId, groupName: found.group.name, pot } });
  }

  // ── Delete their own post ──
  if (/^(?:please )?(?:delete|remove)\b.*\b(post|it|that|this|one)\b/.test(text) && !/\b(comment|theme|bio|tag|follower|keyword|topic)s?\b/.test(text)) {
    const target = await targetPost(raw, text, ctx);
    if (target.error) return say(target.error);
    if (target.post.authorId !== ctx.me?.userId) return say('I can only delete your own posts. To flag someone else\'s, ask me to report it.');
    return card(`Delete your post ${snippet(target.post).replace(/^@\S+ /, '')}? This can't be undone.`,
      { id: 'delete-post', label: 'Delete my post', payload: { postId: target.post.postId } });
  }

  // ── Comment, in their own exact words ──
  const quoted = /["“](.+?)["”]/s.exec(raw);
  const commentAsk = /^(?:please )?(?:comment|reply|write|say|leave (?:a |my )?(?:comment|reply))\b/.test(text) && /\b(on|under|to)\b/.test(text);
  if (commentAsk) {
    const words = quoted?.[1]?.trim() ?? /[:]\s*(.+)$/s.exec(raw)?.[1]?.trim();
    if (!words) return say('Put your comment in quotes, like: comment "love this!" on it. I post your words exactly as written; I don\'t write comments for you.');
    if (words.length > COMMENT_MAX) return say(`Comments can be up to ${COMMENT_MAX} characters; that one is ${words.length}.`);
    const target = await targetPost(raw, lowerOutside(raw, quoted?.[0]), ctx);
    if (target.error) return say(target.error);
    return card(`Comment on ${snippet(target.post)}, exactly as written?`, { id: 'comment', label: 'Post my comment', payload: { postId: target.post.postId, text: words } }, { preview: words });
  }

  // ── Post, in their own exact words ──
  if (/^(?:please )?post\b/.test(text) && quoted) {
    const words = quoted[1].trim();
    if (words.length < 1) return null;
    if (words.length > 500) return say(`Posts from here can be up to 500 characters; that one is ${words.length}. Use the composer for longer ones.`, { links: [{ to: '/create', label: 'New post' }] });
    const hashtags = [...new Set((words.match(/#[\p{L}\p{N}_]{1,30}/gu) ?? []).map(t => t.slice(1)))].filter(t => HASHTAG_PATTERN.test(t)).slice(0, MAX_HASHTAGS);
    return card('Post this to your profile as a text post, exactly as written? Your followers (or everyone, if you\'re public) will see it.',
      { id: 'create-post', label: 'Post it', payload: { caption: words, hashtags } }, { preview: words });
  }

  // ── Groups: join or leave ──
  const group = /^(?:please |can you |could you )?(join|leave)\s+(.+?)[.!]?$/.exec(text);
  if (group && !/^(?:a |an |my )?(comment|review|note|message|reply|game|match|call|chat)\b/.test(group[2])) {
    const [, verb, name] = group;
    const found = await myGroupNamed(name, ctx, { anyGroup: verb === 'join' });
    if (!found) return say(`I couldn't find ${verb === 'leave' ? 'a group of yours' : 'a group'} called "${name}".`);
    if (verb === 'join' && found.member) return say(`You're already in ${found.group.name}.`);
    if (verb === 'leave' && found.group.ownerId === ctx.me?.userId) return say(`You own ${found.group.name}, so you can't leave it. You can hand it over or delete it from the group's settings.`);
    const extra = verb === 'join' && found.group.joinType && found.group.joinType !== 'open' ? ' It needs approval, so this sends a request.' : '';
    return card(`${verb === 'join' ? 'Join' : 'Leave'} ${found.group.name}?${extra}`,
      { id: 'group', label: `${verb === 'join' ? 'Join' : 'Leave'} ${found.group.name}`, payload: { verb, groupId: found.group.groupId, groupName: found.group.name } });
  }

  // ── Follow requests and followers ──
  const answer = /^(?:please )?(accept|approve|decline|deny|reject)\b.*?@?([a-z0-9_]{3,30})(?:'s)?(?: (?:follow )?request)?[.!]?$/.exec(text);
  if (answer && /\b(request|follow)\b|@/.test(text)) {
    const name = answer[2];
    const found = await ctx.lookupUser?.(name).catch(() => null);
    if (!found) return say(`I couldn't find @${name}.`);
    const approve = /accept|approve/.test(answer[1]);
    return card(`${approve ? 'Accept' : 'Decline'} @${name}'s follow request?`,
      { id: 'answer-request', label: approve ? `Accept @${name}` : `Decline @${name}`, payload: { userId: found.userId, username: name, approve } });
  }
  const removeFollower = /^(?:please )?remove @?([a-z0-9_]{3,30}) (?:as|from) (?:a |my )?followers?\b|^(?:please )?remove (?:my )?follower @?([a-z0-9_]{3,30})/.exec(text);
  if (removeFollower) {
    const name = removeFollower[1] ?? removeFollower[2];
    const found = await ctx.lookupUser?.(name).catch(() => null);
    if (!found) return say(`I couldn't find @${name}.`);
    return card(`Remove @${name} from your followers? They won't be told, and they can follow you again (or ask, if you're private).`,
      { id: 'remove-follower', label: `Remove @${name}`, payload: { userId: found.userId, username: name } });
  }

  // ── Notifications: mark them all read ──
  if (/^(?:please )?mark (?:all )?(?:of )?(?:my )?notifications (?:as )?read\b/.test(text)) {
    return card('Mark all your notifications as read?', { id: 'read-all', label: 'Mark all read' });
  }

  // ── Profile tags ──
  const tags = /^(?:please )?(?:set|change|update|make) my (?:profile )?tags (?:to|:)\s*(.+)$/.exec(raw.trim().toLowerCase());
  const addTag = /^(?:please )?add (?:a |the )?tags? ["“]?(.+?)["”]? to my profile$|^(?:please )?add ["“]?(.+?)["”]? to my (?:profile )?tags$/.exec(raw.trim().toLowerCase());
  if (tags || addTag) {
    const list = (tags?.[1] ?? addTag[1] ?? addTag[2]).split(/,|\band\b/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    const next = [...new Set([...(tags ? [] : (ctx.me?.tags ?? [])), ...list])];
    if (next.length > MAX_TAGS) return say(`Profiles can have up to ${MAX_TAGS} tags; that would be ${next.length}.`);
    const long = next.find(t => t.length > MAX_TAG_LENGTH);
    if (long) return say(`Tags can be up to ${MAX_TAG_LENGTH} characters; "${long}" is longer.`);
    return card(`Set your profile tags to ${next.map(t => `"${t}"`).join(', ')}?`, { id: 'set-tags', label: 'Update my tags', payload: { tags: next } });
  }

  // ── Who can comment on new posts, by default ──
  const cv = /\b(only )?(followers|anyone|everyone|everybody)\b.{0,20}\bcomment\b|\bcomments?\b.{0,30}\b(followers only|only followers|anyone|everyone)\b/.exec(text);
  if (cv && /\b(default|new posts|my posts|from now on)\b/.test(text)) {
    const value = /followers/.test(cv[0]) ? 'followers' : 'anyone';
    if (ctx.me?.commentVisibilityDefault === value) return say(`That's already your default: ${value === 'followers' ? 'only followers' : 'anyone'} can comment on your new posts.`);
    return card(`Make ${value === 'followers' ? 'only your followers' : 'anyone'} able to comment on your new posts by default? Posts you've already made keep their setting.`,
      { id: 'set-profile', label: 'Change the default', payload: { field: 'commentVisibilityDefault', value } });
  }

  return null;
}

// The message with a quoted part taken out (so words inside the quote don't
// count as "it" or "that")
function lowerOutside(raw, quote) {
  return (quote ? raw.replace(quote, ' ') : raw).toLowerCase();
}

// ── The master switch (Settings > Angel: "Let Angel make changes") ──
// On by default; off, she still answers, finds and explains, but offers links
// instead of doing things. Kept on this device.
export const CHANGES_KEY = 'aura-angel-changes';
export function changesAllowed() {
  try { return localStorage.getItem(CHANGES_KEY) !== 'off'; } catch { return true; }
}
export function setChangesAllowed(on) {
  try { localStorage.setItem(CHANGES_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
}
// Actions that only look or move around, which stay on when changes are off
export const READ_ONLY_ACTIONS = new Set(['go']);
