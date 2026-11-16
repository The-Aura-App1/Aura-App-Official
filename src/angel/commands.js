import { NOTIFICATION_OPTIONS } from '../utils/notificationOptions';

// Things Angel can do in the app when asked. Settings that are easy to undo
// happen at once (with an Undo button); anything about other people, your
// profile or your session waits for a tap on her button. The actions
// themselves run in the chat page (pages/Angel.jsx), through the same API
// calls the rest of the app uses, so the server's checks still apply.

const NAME = '@?([a-z0-9_]{3,30})';
const lower = s => s.toLowerCase();

// Which notifications a message is about
const NOTIFICATION_WORDS = [
  ['auraGiven', /\b(aura given|given aura|gives? (me )?aura|aura gifts?)\b/],
  ['auraTaken', /\b(aura taken|taken aura|takes? (my )?aura)\b/],
  ['comment', /\bcomments?\b/],
  ['reply', /\brepl(y|ies)\b/],
  ['mention', /\b(mentions?|tags?|tagged)\b/],
  ['games', /\b(games?|challenges?)\b/],
  ['followRequest', /\b(follow requests?|new followers?|followers?)\b/],
  ['followAccepted', /\b(accepted|follow accepted)\b/],
  ['groupInvite', /\b(group invites?|invites?)\b/],
  ['groupRequestApproved', /\b(group requests?|approved)\b/],
  ['dailyBonus', /\b(daily|bonus)\b/],
];
const labelOf = key => NOTIFICATION_OPTIONS.find(o => o.key === key)?.label ?? key;
const list = items => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

function notifications(text, ctx) {
  if (!/\b(notifications?|notifs?|alerts?|pings?)\b/.test(text)) return null;
  const off = /\b(off|mute|silence|disable|stop|no more|don'?t (want|need|send)|turn (it|them) off)\b/.test(text);
  const on = /\b(on|unmute|enable|resume|start|back|turn (it|them) on)\b/.test(text);
  if (!off && !on) return null;
  let keys = NOTIFICATION_WORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
  if (keys.includes('auraGiven') || keys.includes('auraTaken')) keys = keys.filter(k => k !== 'dailyBonus' || /\bdaily\b/.test(text));
  if (!keys.length && /\baura\b/.test(text)) keys = ['auraGiven', 'auraTaken'];
  const all = !keys.length || /\b(all|every|everything|any)\b/.test(text);
  if (all) keys = NOTIFICATION_OPTIONS.map(o => o.key);
  const value = !off;
  const what = all ? 'all notifications' : `notifications for ${list(keys.map(k => labelOf(k).toLowerCase()))}`;
  return {
    kind: 'command', text: `Done: ${value ? 'turned on' : 'turned off'} ${what}.`,
    autoAction: { id: 'set-notifications', payload: { keys, value } },
    actions: [{ id: 'set-notifications', label: 'Undo', payload: { keys, value: !value, undo: true } }],
    links: [{ to: '/settings#notifications', label: 'Notification settings' }],
  };
}

// Profile settings that flip on and off
function privacy(text, ctx) {
  const me = ctx.me ?? {};
  let field = null, value = null, done = '';
  if ((/\b(private|public)\b/.test(text) && /\b(account|profile|me|myself)\b/.test(text) && /\b(make|set|turn|switch|change|go|put)\b/.test(text)) || /^(?:please )?go (private|public)\b/.test(text)) {
    field = 'isPrivate';
    value = /\bprivate\b/.test(text) && !/\b(not private|unprivate|public)\b/.test(text);
    done = value ? 'Your account is private now: new followers need your approval, and only followers see your posts.' : 'Your account is public now: anyone can see your posts and follow you.';
  } else if (/\b(hide|show|unhide|display)\b.{0,20}\b(aura )?rank(ing)?\b/.test(text)) {
    field = 'hideAuraRank';
    value = /\bhide\b/.test(text) && !/\bunhide\b/.test(text);
    done = value ? 'Your global aura rank is hidden now.' : 'Your global aura rank shows again.';
  } else if (/\b(hide|remove|take|keep) me (out of|from) (the )?search\b|\b(don'?t|do not|stop) (show|showing|list|listing) me in search\b|\bunsearchable\b|\bhide me in search\b/.test(text)) {
    field = 'hideFromSearch'; value = true; done = 'Done: you won\'t show up when people search for names. People can still open your profile from your posts.';
  } else if (/\b(show|list|put) me (back )?in search\b|\b(let|so) (people|others) (can )?find me\b|\bmake me searchable\b/.test(text)) {
    field = 'hideFromSearch'; value = false; done = 'Done: people can find you in search again.';
  }
  if (!field) return null;
  if (!!me[field] === value) {
    const already = { isPrivate: value ? 'Your account is already private.' : 'Your account is already public.', hideAuraRank: value ? 'Your rank is already hidden.' : 'Your rank already shows.', hideFromSearch: value ? 'You\'re already hidden from search.' : 'You already show up in search.' };
    return { kind: 'command', text: already[field], links: [{ to: '/settings#privacy', label: 'Privacy settings' }] };
  }
  return {
    kind: 'command', text: done,
    autoAction: { id: 'set-setting', payload: { field, value } },
    actions: [{ id: 'set-setting', label: 'Undo', payload: { field, value: !value, undo: true } }],
    links: [{ to: '/settings#privacy', label: 'Privacy settings' }],
  };
}

export async function commandReply(raw, text, ctx) {
  // Questions get answers, not actions ("how do I make my account private?")
  if (/^(how|what|why|where|when|which|who|is|are|does|do|did|have|has|was|were|am|should|would|will|can i|could i|if)\b/.test(text)) return null;
  // Save (or rename) the custom theme in use under any name: "save it as Midnight Drive"
  const named = /^(?:please )?(?:(?:save|keep|store) (?:this|it|that|my|the)?\s*(?:custom )?(?:theme)?\s*(?:as|called|named)|(?:name|call|rename) (?:this|it|that|my)\s*(?:custom )?(?:theme)?\s*(?:to|as)?)\s+["“']?(.+?)["”']?[.!]?$/i.exec(raw.trim());
  if (named) {
    const name = named[1].trim().slice(0, 40);
    if (!ctx.customTheme) return { kind: 'command', text: 'There\'s no custom theme on right now. Ask me to make one first, like "a calm theme with sage green".' };
    return { kind: 'theme', text: `Saving your theme as "${name}"…`, autoAction: { id: 'save-theme', payload: { name } } };
  }

  // Claim the daily bonus
  if (/\b(claim|collect|get|grab|redeem|take)\b.{0,16}\b(daily (bonus|aura|reward)|bonus)\b/.test(text)) {
    return { kind: 'command', text: 'Claiming your daily bonus…', autoAction: { id: 'daily-bonus' } };
  }

  const n = notifications(text, ctx);
  if (n) return n;
  const p = privacy(text, ctx);
  if (p) return p;

  // Follow, unfollow, block or unblock someone, after a tap
  const person = new RegExp(`^(?:please |can you |could you )?(follow|unfollow|block|unblock) ${NAME}(?: for me)?(?: please)?[.!]?$`).exec(text);
  if (person) {
    const [, verb, name] = person;
    if (ctx.me?.username && lower(name) === lower(ctx.me.username)) return { kind: 'command', text: 'That\'s you!' };
    const found = await ctx.lookupUser?.(name).catch(() => null);
    if (!found) return { kind: 'command', text: `I couldn't find @${name}. Check the spelling?` };
    const ask = {
      follow: [`Follow @${name}?`, 'Follow'],
      unfollow: [`Unfollow @${name}?`, 'Unfollow'],
      block: [`Block @${name}? You won't see each other's posts or comments, and they can't follow you or find you in search.`, 'Block'],
      unblock: [`Unblock @${name}?`, 'Unblock'],
    }[verb];
    return { kind: 'command', text: ask[0], actions: [{ id: 'person', label: `${ask[1]} @${name}`, payload: { verb, username: name, userId: found.userId ?? null } }], links: [{ to: `/profile/${name}`, label: `Open @${name}` }] };
  }

  // Your bio, in your own words
  const bio = /^(?:please )?(?:set|change|update|make|edit) my bio (?:to|:|as|=)\s*["“]?(.+?)["”]?$/is.exec(raw.trim());
  if (bio) {
    const value = bio[1].trim();
    if (value.length > 160) return { kind: 'command', text: `Bios can be up to 160 characters; that one is ${value.length}. Want to shorten it and ask again?` };
    return { kind: 'command', text: `Change your bio to "${value}"?`, actions: [{ id: 'set-bio', label: 'Change my bio', payload: { bio: value } }] };
  }
  if (/^(?:please )?(?:clear|remove|delete|erase) my bio[.!]?$/.test(text)) {
    return { kind: 'command', text: 'Clear your bio?', actions: [{ id: 'set-bio', label: 'Clear my bio', payload: { bio: '' } }] };
  }

  // Sign out, after a tap
  if (/^(?:please |can you |could you )?(?:log|sign) (?:me )?out\b/.test(text)) {
    return { kind: 'command', text: 'Sign out of Aura on this device?', actions: [{ id: 'sign-out', label: 'Sign out' }] };
  }

  // Search for something, or open someone's profile
  const search = /^(?:please )?(?:search(?: for)?|look up|lookup|find)\s+(.{2,60}?)[.!?]?$/.exec(text);
  if (search && !/\b(theme|themes|colou?rs?|font|my feed|trend\w*)\b/.test(search[1])) {
    const q = search[1].replace(/^(posts? (about|on)|people (named|called))\s+/, '');
    const at = /^@([a-z0-9_]{3,30})$/.exec(q);
    if (at) return { kind: 'command', text: `Here's @${at[1]}.`, links: [{ to: `/profile/${at[1]}`, label: `Open @${at[1]}` }] };
    return { kind: 'command', text: `Here's what Aura has for "${q}".`, links: [{ to: `/search?q=${encodeURIComponent(q)}`, label: `Search for "${q}"` }] };
  }

  // Start a post (she won't write it, but she'll open the composer)
  if (/\b(make|create|start|open|new|share|upload)\b.{0,12}\b(a |new )?(post|photo|video|moment)\b/.test(text) && !/\bhow\b/.test(text)) {
    return { kind: 'command', text: 'Here\'s the composer. If you want feedback on your caption first, paste it here after a colon.', links: [{ to: '/create', label: 'New post' }] };
  }
  return null;
}
