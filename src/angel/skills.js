import { THEMES } from '../themes';
import { TOPICS } from '../utils/topics';

// Angel's skills that use the person's own app state, all of it already on
// this device: the built-in themes and which one they're on, the scenery
// switch, their wallet numbers (from their own profile), and what their feed
// is set to and has learned. Nothing here is sent anywhere.

const label = id => TOPICS.find(t => t.id === id)?.label ?? id;
const n = x => Math.round(x ?? 0).toLocaleString();

// ── Forgiving word matching ──────────────────────────────────────────

// Edit distance with swaps counted once ("abbys" → "abyss"), stopping early
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}
// Close enough to be a typo: one slip in a word of five or more letters (the
// first letter must match in five-letter words), two from ten letters up
export function nearWord(word, target) {
  if (word === target) return true;
  if (target.length < 5 || word.length < 5) return false;
  if (target.length === 5 && word[0] !== target[0]) return false;
  const max = target.length >= 10 ? 2 : 1;
  return editDistance(word, target, max) <= max;
}

// ── Built-in themes ──────────────────────────────────────────────────

// Other names people use for the built-in themes (names that are also moods,
// like "desert" or "ocean", stay with the custom theme maker)
const THEME_ALIASES = {
  abyss: 'abyss', 'deep sea': 'abyss', underwater: 'abyss', 'under the sea': 'abyss', jellyfish: 'abyss',
  'northern lights': 'northern-lights', aurora: 'northern-lights', 'aurora borealis': 'northern-lights',
  'firefly grove': 'firefly-grove', firefly: 'firefly-grove', fireflies: 'firefly-grove',
  'sky isles': 'sky-isles', 'floating islands': 'sky-isles', 'sky islands': 'sky-isles',
  'golden dunes': 'golden-dunes', dunes: 'golden-dunes', camels: 'golden-dunes',
  'lantern lake': 'lantern-lake', lanterns: 'lantern-lake', 'lantern festival': 'lantern-lake',
  'city skies': 'city-skies', skyline: 'city-skies', 'city lights': 'city-skies',
  'snowy peaks': 'snowy-peaks', 'snowy mountains': 'snowy-peaks',
  duskfall: 'duskfall', dusk: 'duskfall',
};
// Day, Night, Light and Dark are also everyday words, so they only count
// when someone is plainly asking to switch ("switch to night", "dark mode")
const PLAIN_THEMES = { day: 'day', night: 'night', light: 'light', dark: 'dark', 'light mode': 'light', 'dark mode': 'dark' };
const SWITCH = /\b(switch|change|go|put|set|use|turn|move|swap|apply|give me|i want|try)\b/;

// The built-in theme a message names, and the words that named it. When the
// message is plainly about themes, a name may be two slips off ("abbys").
// "go back to the normal look", "restore the default theme": Day
const BACK_TO_DEFAULT = /\b(back|reset|restore|revert|return|undo)\b.{0,30}\b(normal|default|original|regular|usual|standard|old)\b.{0,12}\b(look|theme|colou?rs?|one|style)\b|\b(go|switch|change|put|set) (it |me )?back to (the )?(normal|default|original|regular|usual|standard)\b/;
export function builtInThemeIn(text) {
  const back = BACK_TO_DEFAULT.exec(text);
  if (back) return { theme: THEMES.find(t => t.id === 'day'), phrase: back[0] };
  const words = text.split(/[^a-z]+/);
  const aboutThemes = /\b(theme|switch|change|use)\b/.test(text);
  const close = (w, phrase) => w === phrase
    || (w.length >= 5 && phrase.length >= 5 && w[0] === phrase[0] && editDistance(w, phrase, 2) <= (aboutThemes ? 2 : 1));
  for (const [phrase, id] of Object.entries(THEME_ALIASES)) {
    const hit = phrase.includes(' ') ? (text.includes(phrase) ? phrase : null) : words.find(w => close(w, phrase));
    if (hit) return { theme: THEMES.find(t => t.id === id), phrase: hit };
  }
  if (SWITCH.test(text) || /^(the )?(light|dark) mode\b/.test(text)) {
    for (const [phrase, id] of Object.entries(PLAIN_THEMES)) {
      // "switch to night", "use the dark theme", "dark mode please", but not "a dark ocean theme"
      if (new RegExp(`\\b(to|the|use|on|try)\\s+(the\\s+)?${phrase}( (theme|mode|one))?\\b(?!\\s+\\w+\\s+theme)`).test(text) || new RegExp(`^(the )?${phrase} mode\\b`).test(text)) {
        return { theme: THEMES.find(t => t.id === id), phrase };
      }
    }
  }
  return null;
}

// A built-in theme's colors as a starting point for a custom one ("like Abyss but pink")
export function specFromBuiltIn(theme) {
  const solid = c => (/^#[0-9a-f]{6}$/i.test(c ?? '') ? c : null);
  return {
    name: `${theme.name} remix`, base: theme.base,
    background: solid(theme.preview?.card) ?? (theme.base === 'dark' ? '#0f0d1a' : '#f8f7ff'),
    accent: solid(theme.preview?.accent) ?? '#7c3aed', font: null,
  };
}

export function builtInThemeReply(theme, ctx) {
  if (ctx.currentThemeId === theme.id) {
    return { kind: 'builtin-theme', text: `You're already using ${theme.name}. Want something different? Ask me for another theme, or describe a custom one.` };
  }
  return {
    kind: 'builtin-theme',
    text: `${theme.name}: ${theme.description} It's a ${theme.base} theme${theme.scene ? ' with moving scenery' : ''}.`,
    builtIn: theme.id,
    actions: [{ id: 'use-theme', label: `Switch to ${theme.name}`, payload: theme.id }],
  };
}

export const ASKS_THEME_LIST = /\b(what|which|show|list|see|all|any|got)\b.{0,25}\bthemes\b|\b(other|more) themes\b|\btheme options\b/;
export const ASKS_CURRENT_THEME = /\b(what|which)( theme| one)? (am i|i'?m) (using|on)\b|\b(my|the) current theme\b|\bwhat('?s| is) my theme\b|\b(what|which) theme is (this|that|it|on)\b|\bwhat('?s| is) this theme\b|^is (this|it|that) (the )?[a-z]+( [a-z]+)? (theme|one)\??$/;

export function themeListReply(text, ctx) {
  const dark = /\bdark\b/.test(text) && !/\blight\b/.test(text);
  const light = /\blight\b/.test(text) && !/\bdark\b/.test(text);
  const scenic = /\b(moving|animated|scenery|scene|scenes|alive)\b/.test(text);
  const pick = THEMES.filter(t => (!dark || t.base === 'dark') && (!light || t.base === 'light') && (!scenic || t.scene));
  const row = t => `${t.name}${t.id === ctx.currentThemeId ? ' (yours now)' : ''}: ${t.description}`;
  const groups = [
    { title: 'Dark', rows: pick.filter(t => t.base === 'dark').map(row) },
    { title: 'Light', rows: pick.filter(t => t.base === 'light').map(row) },
  ].filter(g => g.rows.length);
  const suggestions = pick.filter(t => t.id !== ctx.currentThemeId && t.scene).slice(0, 4);
  return {
    kind: 'builtin-theme',
    text: `There ${pick.length === 1 ? 'is' : 'are'} ${pick.length} ${dark ? 'dark ' : light ? 'light ' : ''}theme${pick.length === 1 ? '' : 's'}. Tap one to see it, or describe your own and I'll make it.`,
    items: groups,
    followUps: suggestions.map(t => `Switch to ${t.name}`),
  };
}

export function currentThemeReply(ctx) {
  const t = THEMES.find(x => x.id === ctx.currentThemeId);
  if (ctx.currentThemeId === 'custom') return { kind: 'builtin-theme', text: 'You\'re using your custom theme. Ask me to change it, or to show you the built-in ones.' };
  return { kind: 'builtin-theme', text: t ? `You're using ${t.name}: ${t.description}` : 'I couldn\'t tell which theme you\'re using.', followUps: ['What themes are there?'] };
}

// ── Scenery ──────────────────────────────────────────────────────────

export const ASKS_SCENERY = /\b(scenery|animations?|animated (background|scenery)|moving (background|stuff|things|scenery)|background (animation|motion)|motion|clouds moving)\b/;
export function sceneryReply(text, ctx) {
  const off = /\b(off|stop|disable|remove|hide|no|less|distracting|too much|annoying|turn it off|get rid)\b/.test(text);
  const on = /\b(on|enable|back|show|bring)\b/.test(text) && !off;
  if (!off && !on) {
    return { kind: 'scenery', text: `Animated scenery is ${ctx.skyDetails === false ? 'off' : 'on'} right now. It's the moving backdrop behind the app (clouds, stars, lanterns and so on). Want it ${ctx.skyDetails === false ? 'on' : 'off'}?`,
      actions: [{ id: 'scenery', label: ctx.skyDetails === false ? 'Turn scenery on' : 'Turn scenery off', payload: ctx.skyDetails === false }] };
  }
  if ((off && ctx.skyDetails === false) || (on && ctx.skyDetails !== false)) {
    return { kind: 'scenery', text: `It's already ${off ? 'off' : 'on'}. You'll find it under Settings > Appearance too.` };
  }
  return {
    kind: 'scenery',
    text: off ? 'I can turn the animated scenery off. Your theme\'s colors stay; only the moving backdrop goes. You can turn it back on any time.' : 'I can turn the animated scenery back on.',
    actions: [{ id: 'scenery', label: off ? 'Turn scenery off' : 'Turn scenery on', payload: !off }],
  };
}

// ── Your wallet ──────────────────────────────────────────────────────

export const ASKS_BALANCE = /\b(how much|how many)\b.{0,20}\b(aura|points)\b.{0,15}\b(do i have|have i got|i have|i got|left|in my wallet)\b|\b(my|check my|show my|what'?s my|whats my|what is my) (aura )?(balance|wallet|aura total|aura count|aura)\b(?! (rank|graph|timeline|history|score))|\b(claim|claimed|get|collect) (my |the |today'?s )?(daily )?bonus\b|\bad (ready|available)\b|\b(how much|what) (more )?(can|could) i (still )?(give|take|spend)\b|\b(have i|did i) (claim|claimed|got|get) (my |the )?(daily )?bonus\b|\bwhen can i (watch|see) (an|another|the next) ad\b|\b(my|today'?s) (limits?|quota)\b|\bhow much (have i|did i) (given|give|taken|take)\b/;

export function balanceReply(ctx, text = "") {
  const me = ctx.me;
  if (!me || me.auraBalance === undefined) {
    return { kind: 'account', text: 'I can\'t see your wallet just now. Your Aura Wallet has your balance and today\'s limits.', links: [{ to: '/wallet', label: 'Open Aura Wallet' }] };
  }
  const t = me.today;
  const rows = [
    `Balance: ${n(me.auraBalance)} aura (${n(me.auraEarned)} earned, ${n(me.auraSpendable)} spendable)`,
  ];
  if (t?.freeGive) rows.push(`Free aura to give today: ${n(t.freeGive.limit - t.freeGive.used)} of ${n(t.freeGive.limit)} left`);
  if (t?.walletGive) rows.push(`Giving from your wallet today: ${n(t.walletGive.limit - t.walletGive.used)} of ${n(t.walletGive.limit)} left`);
  if (t?.take) rows.push(`Taking today: ${n(t.take.limit - t.take.used)} of ${n(t.take.limit)} left`);
  if (t?.bonus) rows.push(t.bonus.claimed ? 'Daily bonus: claimed today' : `Daily bonus: ${n(t.bonus.amount)} waiting to be claimed`);
  if (t?.nextAdAt) {
    const mins = Math.ceil((Date.parse(t.nextAdAt) - Date.now()) / 60000);
    rows.push(mins > 0 ? `Next ad reward: in ${mins} minute${mins === 1 ? '' : 's'}` : 'Ad reward: ready');
  }
  // Answer the exact question first, then show the whole picture
  let lead = `Here's your wallet right now${me.isPremium ? ' (Premium)' : ''}. Earned aura is the kind that may be cashable later; spendable is for giving, games and power-ups.`;
  if (/\bwhy\b/.test(text)) {
    lead = `You have ${n(me.auraBalance)} aura now. It goes down when you give or take aura, stake a game, start a power-up, or when someone takes from one of your posts; it goes up when people give to your posts, from the daily bonus, game wins, Aura Rain and ads. Your profile's Aura tab graphs it day by day.`;
  } else if (/\bbonus\b/.test(text) && t?.bonus) {
    lead = t.bonus.claimed ? 'Yes, you\'ve claimed today\'s bonus. The next one comes at midnight UTC.' : `Not yet: ${n(t.bonus.amount)} spendable aura is waiting for you in your wallet.`;
  } else if (/\bad\b/.test(text) && t) {
    const mins = t.nextAdAt ? Math.ceil((Date.parse(t.nextAdAt) - Date.now()) / 60000) : 0;
    lead = mins > 0 ? `In ${mins} minute${mins === 1 ? '' : 's'}. You can watch one ad an hour for 25 spendable aura.` : 'Right now: an ad is ready in your wallet for 25 spendable aura.';
  } else if (/\b(give|spend)\b/.test(text) && t?.freeGive) {
    lead = `You can give ${n(t.freeGive.limit - t.freeGive.used)} more free aura today, then up to ${n(Math.min(t.walletGive.limit - t.walletGive.used, (me.auraSpendable ?? 0) + (me.auraEarned ?? 0)))} from your wallet.`;
  } else if (/\btake\b/.test(text) && t?.take) {
    lead = `You can take ${n(t.take.limit - t.take.used)} more aura today. Each take costs you the same amount.`;
  } else if (/\b(how much|how many|balance|have)\b/.test(text)) {
    lead = `You have ${n(me.auraBalance)} aura: ${n(me.auraEarned)} earned and ${n(me.auraSpendable)} spendable.`;
  }
  return {
    kind: 'account',
    text: lead,
    items: [{ title: 'Your aura', rows }],
    links: [{ to: '/wallet', label: 'Open Aura Wallet' }],
  };
}

// ── Your feed ────────────────────────────────────────────────────────

export const ASKS_FEED_SUMMARY = /\b(what('?s| is| does)?|how('?s| is| does)?|describe|tell me about|summari[sz]e|explain)\b.{0,25}\b(my|the) (current )?feed\b.{0,20}\b(like|look|show|showing|made of|about|doing|tuned|set|work)?|\bwhat (have you|has my feed|does my feed|has the app) (learn|learned|learnt|know)\w*\b|\bwhat do you know about (me|my taste|my interests)\b|\bmy (taste|interests)\b|\bwhy (am i|do i keep) seeing\b|\b(why|how come) (is|are) there (so much|so many|a lot of|lots of|all this|all these)\b|\bwhy is my (feed|timeline) (so|all|full)\b|\bwhat am i seeing\b/;

export function feedSummaryReply(text, ctx, poolPosts = []) {
  const p = ctx.prefs ?? { more: [], less: [], words: [] };
  const taste = ctx.taste;
  const topTopics = taste ? Object.entries(taste.topics).filter(([, w]) => w > 0.3).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => label(id)) : [];
  const avoided = taste ? Object.entries(taste.topics).filter(([, w]) => w < -0.3).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([id]) => label(id)) : [];
  const topTags = taste ? Object.entries(taste.tags).filter(([, w]) => w > 0.3).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => `#${t}`) : [];

  // "why am I seeing so much X?"
  const why = /\bwhy (am i|do i keep) seeing\b/.test(text);
  if (why) {
    const asked = TOPICS.find(t => text.includes(t.label.toLowerCase()) || text.includes(t.id));
    if (asked) {
      const reasons = [];
      if (p.more.includes(asked.id)) reasons.push(`you asked for more ${asked.label}`);
      if (taste?.topics[asked.id] > 0.3) reasons.push(`you've given aura to or liked ${asked.label} posts, so your feed learned you enjoy them`);
      const share = poolPosts.length ? poolPosts.filter(x => (x.tags ?? []).includes(asked.id)).length / poolPosts.length : 0;
      if (share > 0.15) reasons.push(`${asked.label} is busy right now (${Math.round(share * 100)}% of today's trending posts)`);
      if (!reasons.length) reasons.push(`a few ${asked.label} posts are among today's most popular, and every fifth post is something a little different so you can branch out`);
      return {
        kind: 'feed-summary',
        text: `You're seeing ${asked.label} because ${reasons.join(', and ')}.`,
        actions: [{ id: 'apply-feed', label: `Show less ${asked.label}`, payload: { topics: [asked.id], keywords: [], choice: 'less' } }],
      };
    }
  }

  const rows = [];
  rows.push(p.more.length ? `More of: ${p.more.map(label).join(', ')}` : 'More of: nothing chosen yet');
  if (p.less.length) rows.push(`Less of: ${p.less.map(label).join(', ')}`);
  if (p.words.length) rows.push(`Keywords: ${p.words.map(w => `${w.text} (${w.choice})`).join(', ')}`);
  const learned = [];
  if (ctx.learning === false) learned.push('Learning from what you do is turned off (Settings > Privacy).');
  else if (topTopics.length || topTags.length) {
    if (topTopics.length) learned.push(`Topics you engage with: ${topTopics.join(', ')}`);
    if (topTags.length) learned.push(`Hashtags you engage with: ${topTags.join(' ')}`);
    if (avoided.length) learned.push(`Topics you take aura from: ${avoided.join(', ')}`);
  } else learned.push('Nothing yet: give, take or like a few posts and it starts leaning your way.');
  const mix = new Map();
  for (const post of poolPosts) for (const t of post.tags ?? []) mix.set(t, (mix.get(t) ?? 0) + 1);
  const busiest = [...mix.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => label(id));
  const items = [{ title: 'What you\'ve chosen', rows }, { title: 'What it has learned (on this device)', rows: learned }];
  if (busiest.length) items.push({ title: 'Busiest topics in today\'s trending pool', rows: [busiest.join(', ')] });
  return {
    kind: 'feed-summary',
    text: 'Here\'s what shapes your feed. Your own choices always count most, then what it learns, and every fifth post is something different so you can branch out.',
    items,
    followUps: ['Show me more of something new', 'Reset my feed preferences'],
  };
}
