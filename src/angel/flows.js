import { REPORT_REASONS, reasonLabel } from '../utils/reportReasons';

// Angel's two conversations that send something off the device, each only
// after the person confirms:
//   report:  who or what, why, then the same report the ⋯ menu sends
//   support: what it's about, what happened, an email to reply to, then a
//            message to Aura's support inbox (POST /feedback/support)
// A flow is plain data ({ type, step, data }) that the chat hands back with
// the next message; every reply says what the flow is now (null when done).

// Mirrors SUPPORT_CATEGORIES, SUPPORT_MIN and SUPPORT_MAX in aura-users/support.mjs (a test keeps them equal)
export const SUPPORT_CATEGORIES = [
  ['bug', 'Something isn\'t working'],
  ['account', 'My account or sign-in'],
  ['aura', 'Aura, games or purchases'],
  ['safety', 'Safety or another person'],
  ['idea', 'An idea or general feedback'],
  ['other', 'Something else'],
];
export const SUPPORT_MIN = 10;
export const SUPPORT_MAX = 2000;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const EMAIL_IN = /[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
export const validEmail = s => (typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s) ? s : null);
const categoryLabel = id => SUPPORT_CATEGORIES.find(([c]) => c === id)?.[1] ?? id;

// What starts each one
export const WANTS_SUPPORT = /\b(customer (service|support|care)|(contact|reach|email|message|talk to|speak (to|with)|get in touch with|get ahold of|get hold of)\s+(the\s+)?(aura\s+)?(support|team|staff|admins?|developers?|devs|owners?|someone|somebody|a (real )?(human|person)|aura)|support (team|ticket|request)|help ?desk|file (a )?(complaint|ticket)|make a complaint|(i have|i've got|i want to (make|file|send)|submit) an? (complaint|issue|problem)|complain about|i want a refund|refund (me|my)|need help with my account|my account (was|got|is) (hacked|locked|banned|suspended)|i can'?t (log|sign) ?in)\b/;
export const WANTS_REPORT = /\b(report(ing)? (a |an |this |that |the )?(user|account|person|profile|post|comment|someone|somebody|them|him|her|people|@)|i (want|need|would like|'d like) to report|how (do|can) i report @|report @|(someone|somebody|a user|an account|people|this person) (is |are |keeps? )?(harass|bully|bullying|threaten|stalk|spamm|scamm|impersonat)\w*|(being|getting|got) (harassed|bullied|threatened|stalked|scammed))\b/;

const CANCEL = /^(cancel|stop|never ?mind|nvm|forget (it|that|about it)|quit|exit|no thanks|nope|don'?t (send|report)( it)?)\b/;
const YES = /^(yes|yep|yeah|yup|sure|ok(ay)?|send( it)?|confirm|do it|go ahead|submit( it)?|please do|correct|that'?s right|looks good|report( it| them)?)\b/;

const USERNAME = /@([a-z0-9_]{3,30})\b/i;
const POST_LINK = /\/post\/([A-Za-z0-9_-]{4,100})/;

const REASON_WORDS = [
  ['spam', /\b(spam\w*|scam\w*|bot|fake giveaway|phishing|selling)\b/],
  ['harassment', /\b(harass\w*|bully\w*|bullied|stalk\w*|insult\w*|mean to me|picking on)\b/],
  ['hate', /\b(hate|hateful|racis\w*|slurs?|nazi|homophob\w*|transphob\w*|sexis\w*)\b/],
  ['violence', /\b(threat\w*|violen\w*|kill|hurt (me|someone)|weapon|attack)\b/],
  ['nudity', /\b(nud\w*|naked|nsfw|porn\w*|sexual|explicit)\b/],
  ['self_harm', /\b(self[- ]?harm|suicid\w*|kill (him|her|them)sel(f|ves)|cutting)\b/],
  ['misinformation', /\b(fake news|misinformation|false (info|information)|lies|lying|hoax)\b/],
  ['other', /\b(something else|other|none of (those|these))\b/],
];
const reasonIn = text => {
  for (const [id, label] of REPORT_REASONS) if (text.includes(label.toLowerCase())) return id;
  return REASON_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
};
const CATEGORY_WORDS = [
  ['bug', /\b(bug|broken|crash\w*|not working|doesn'?t work|won'?t (load|open|work)|glitch\w*|error|freez\w*|stuck|isn'?t working)\b/],
  ['account', /\b(account|password|log ?in|sign ?in|logged out|email|username|banned|ban|suspended|hacked|locked|verify|verification)\b/],
  ['aura', /\b(aura|game|games|stake|wallet|purchase|premium|refund|payment|paid|charged|money|balance|bonus)\b/],
  ['safety', /\b(harass\w*|unsafe|threat\w*|stalk\w*|bully\w*|abuse|safety|scam\w*|impersonat\w*)\b/],
  ['idea', /\b(idea|suggest\w*|feature|feedback|wish|would be nice|request)\b/],
];
const categoryIn = text => {
  for (const [id, label] of SUPPORT_CATEGORIES) if (text.includes(label.toLowerCase())) return id;
  return null;
};
const guessCategory = text => CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;

const flowReply = (flow, text, extra = {}) => ({ kind: 'flow', text, flow, ...extra });
const cancelled = () => ({ kind: 'flow', text: 'Okay, cancelled. Nothing was sent.', flow: null });

// ─── Reports ──────────────────────────────────────────────────

async function findTarget(raw, ctx) {
  const post = POST_LINK.exec(raw);
  if (post) {
    const found = await ctx.lookupPost?.(post[1]).catch(() => null);
    if (!found) return { error: 'I couldn\'t open that post. Check the link, or send the @username of whoever posted it.' };
    return { kind: 'post', id: post[1], label: `this post by @${found.authorUsername ?? found.username ?? 'someone'}` };
  }
  const user = USERNAME.exec(raw) ?? /^\s*([a-z0-9_]{3,30})\s*$/i.exec(raw);
  if (user) {
    const name = user[1].toLowerCase();
    if (ctx.me?.username && name === ctx.me.username.toLowerCase()) return { error: 'That\'s your own account. Who do you want to report?' };
    const found = await ctx.lookupUser?.(name).catch(() => null);
    if (!found) return { error: `I couldn't find @${name}. Check the spelling and send their username again.` };
    return { kind: 'user', id: name, userId: found.userId ?? null, label: `@${name}` };
  }
  return null;
}

function askReason(data) {
  return flowReply({ type: 'report', step: 'reason', data }, `What's wrong with ${data.target.label}?`, {
    followUps: REPORT_REASONS.map(([, label]) => label),
  });
}

function confirmReport(data) {
  const { target, reason } = data;
  const action = { id: 'send-report', label: 'Send report', payload: { kind: target.kind, id: target.id, userId: target.userId, reason, label: target.label } };
  return flowReply({ type: 'report', step: 'confirm', data }, `Report ${target.label} for "${reasonLabel(reason)}"? Moderators will review it, and ${target.kind === 'user' ? 'they' : 'the poster'} won't know who reported.`, {
    actions: [action],
    followUps: ['Cancel'],
    note: reason === 'self_harm' ? 'If someone may be in danger right now, contact local emergency services or a crisis line.' : undefined,
  });
}

export async function startReport(raw, text, ctx) {
  const data = { target: null, reason: reasonIn(text) === 'other' ? null : reasonIn(text) };
  const found = await findTarget(raw, ctx);
  if (found?.error) return flowReply({ type: 'report', step: 'target', data }, found.error);
  if (found) data.target = found;
  if (!data.target) {
    return flowReply({ type: 'report', step: 'target', data },
      'I can send a report for you. Who or what is it about? Send their @username, or paste a link to the post. (Say "cancel" any time.)');
  }
  return data.reason ? confirmReport(data) : askReason(data);
}

async function continueReport(flow, raw, text, ctx) {
  const data = { ...flow.data };
  if (flow.step === 'target') {
    const found = await findTarget(raw, ctx);
    if (!found) return flowReply(flow, 'Send their @username (like @someone) or paste the post\'s link, or say "cancel".');
    if (found.error) return flowReply(flow, found.error);
    data.target = found;
    return data.reason ? confirmReport(data) : askReason(data);
  }
  if (flow.step === 'reason') {
    const reason = reasonIn(text);
    if (!reason) return askReason(data);
    data.reason = reason;
    return confirmReport(data);
  }
  if (flow.step === 'confirm') {
    if (YES.test(text)) {
      const reply = confirmReport(data);
      return { ...reply, text: 'Sending it now.', autoAction: reply.actions[0], actions: [] };
    }
    const reason = reasonIn(text);
    if (reason) { data.reason = reason; return confirmReport(data); }
    return confirmReport(data);
  }
  return cancelled();
}

// ─── Support ──────────────────────────────────────────────────

function askCategory(data) {
  return flowReply({ type: 'support', step: 'category', data },
    'I\'ll pass your message to Aura\'s support team, word for word. What is it about? (Say "cancel" any time.)', {
      followUps: SUPPORT_CATEGORIES.map(([, label]) => label),
    });
}
function askMessage(data) {
  return flowReply({ type: 'support', step: 'message', data },
    `${categoryLabel(data.category)}: got it. Tell me what happened, with as much detail as helps (what you did, what you expected, what went wrong). I'll send exactly what you write.`);
}
function askEmail(data, ctx) {
  const mine = validEmail(ctx.me?.email ?? '');
  return flowReply({ type: 'support', step: 'email', data },
    'What email should Aura reply to? Support will answer you there.', {
      followUps: mine ? [`Use ${mine}`] : [],
    });
}
function confirmSupport(data) {
  const preview = data.message.length > 280 ? `${data.message.slice(0, 280)}…` : data.message;
  return flowReply({ type: 'support', step: 'confirm', data }, 'Here\'s what I\'ll send to Aura support:', {
    items: [
      { title: 'About', rows: [categoryLabel(data.category)] },
      { title: 'Your message', rows: [preview] },
      { title: 'Reply to', rows: [data.email] },
    ],
    note: 'Aura support will also see your username so they can find your account.',
    actions: [{ id: 'send-support', label: 'Send to Aura support', payload: { category: data.category, message: data.message, contactEmail: data.email } }],
    followUps: ['Change the message', 'Change the email', 'Cancel'],
  });
}

export function startSupport(text, ctx) {
  const data = { category: categoryIn(text) ?? guessCategory(text), message: null, email: null };
  return data.category ? askMessage(data) : askCategory(data);
}

function continueSupport(flow, raw, text, ctx) {
  const data = { ...flow.data };
  if (flow.step === 'category') {
    const category = categoryIn(text) ?? guessCategory(text) ?? (/\b(other|something else)\b/.test(text) ? 'other' : null);
    if (!category) return askCategory(data);
    data.category = category;
    return data.message ? confirmSupport(data) : askMessage(data);
  }
  if (flow.step === 'message') {
    const message = raw.trim();
    if (message.length < SUPPORT_MIN) return flowReply(flow, `Could you say a little more? At least ${SUPPORT_MIN} characters, so the team knows what happened.`);
    data.message = message.slice(0, SUPPORT_MAX);
    return data.email ? confirmSupport(data) : askEmail(data, ctx);
  }
  if (flow.step === 'email') {
    const typed = EMAIL_IN.exec(raw)?.[0];
    const useMine = /\b(use (my|that|this|the account)|same|my account email|that one|this one)\b/.test(text) && validEmail(ctx.me?.email ?? '');
    const email = validEmail(typed ?? '') ?? (useMine || null);
    if (!email) return flowReply(flow, 'That doesn\'t look like an email address. Send the one support should reply to, like name@gmail.com.', { followUps: askEmail(data, ctx).followUps });
    data.email = email;
    return confirmSupport(data);
  }
  if (flow.step === 'confirm') {
    if (/\b(change|edit|fix|rewrite)\b.*\b(message|text|it)\b/.test(text)) return askMessage(data);
    if (/\b(change|edit|fix|different)\b.*\b(email|address)\b/.test(text)) return askEmail(data, ctx);
    if (YES.test(text)) {
      const reply = confirmSupport(data);
      return { ...reply, text: 'Sending it now.', items: undefined, autoAction: reply.actions[0], actions: [] };
    }
    return confirmSupport(data);
  }
  return cancelled();
}

// The next message in a flow that's under way
export async function continueFlow(flow, raw, text, ctx) {
  if (CANCEL.test(text)) return cancelled();
  if (flow.type === 'report') return continueReport(flow, raw, text, ctx);
  if (flow.type === 'support') return continueSupport(flow, raw, text, ctx);
  return cancelled();
}
