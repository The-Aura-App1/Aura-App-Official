import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useChooseTheme from '../hooks/useChooseTheme';
import { respond, MAX_MESSAGE } from '../angel/angel';
import { changesAllowed } from '../angel/actions';
import { SUPPORT_MAX } from '../angel/flows';
import { reasonLabel, announceBlocked } from '../utils/reportReasons';
import { defaultNotificationPrefs } from '../utils/notificationOptions';
import { embedTexts, warmUpModel } from '../utils/embedClient';
import { loadPrefs, savePrefs, clearPrefs, setTopics, addKeyword, hasKeyword, MAX_KEYWORDS } from '../utils/feedPrefs';
import { saveCustom, customVars, loadCustom, saveTheme, renameSavedTheme, loadSavedThemes } from '../themes/customTheme';
import { getTheme } from '../themes';
import { loadTaste, prepareTaste, isLearningOn } from '../utils/tasteProfile';
import { fontFamily, loadPostFont } from '../utils/postStyle';

// Angel's chat. Everything happens here, on the device: messages are kept in
// memory only (never saved), and the trend data is the same public feed pool
// the feed already loads. What she does in the app goes through the normal
// API (settings at once with an Undo; people, your profile and sign-out after
// a tap). A report or a support message is the only thing that leaves the
// device, and only after the person confirms it.

const STARTERS = [
  'What did I miss?',
  'Show me posts about sunsets',
  'Play chess against a bot',
  'Which groups should I join?',
  'What is my feed like right now?',
  'Contact Aura support',
  'Which NFL teams are getting the most aura?',
  'Make me a black theme that feels spacey',
  'What themes are there?',
  'How much aura do I have?',
  'Feedback on my caption: "Golden hour at the lake. Worth the 5am alarm?"',
];

// A built-in theme's own picker card, so she can show it before switching
function BuiltInSwatch({ id }) {
  const t = getTheme(id);
  if (!t?.preview) return null;
  const p = t.preview;
  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-[var(--border)] h-24 relative" style={{ background: p.background }}>
      <div className="absolute left-3 bottom-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: p.card, color: p.text, border: `1px solid ${p.muted}` }}>
        {t.name} <span style={{ color: p.accent }}>●</span>
      </div>
    </div>
  );
}

function ThemeSwatch({ spec }) {
  const v = customVars(spec);
  useEffect(() => { if (spec.font) loadPostFont(spec.font); }, [spec.font]);
  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-[var(--border)]" style={{ background: v['--bg-primary'] }}>
      <div className="m-3 p-3 rounded-lg" style={{ background: v['--bg-card'], border: `1px solid ${v['--border']}` }}>
        <p className="text-sm font-semibold" style={{ color: v['--text-primary'], fontFamily: spec.font ? fontFamily(spec.font) : undefined }}>A post in your theme</p>
        <p className="text-xs mt-0.5" style={{ color: v['--text-secondary'] }}>Secondary text</p>
        <span className="inline-block mt-2 px-3 py-1 rounded-lg text-xs font-semibold text-white"
          style={{ backgroundImage: `linear-gradient(110deg, ${v['--brand-1']}, ${v['--brand-2']}, ${v['--brand-3']})` }}>Give aura</span>
      </div>
    </div>
  );
}

function Reply({ reply, onAction, onAsk, onGo, busy }) {
  const shown = reply.actions?.filter(a => !(reply.undone && a.payload?.undo)) ?? [];
  return (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-wrap">{reply.text}</p>
      {reply.items?.map((group, i) => (
        <div key={i}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{group.title}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {group.rows.map((row, j) => <li key={j} className="text-sm">• {row}</li>)}
          </ul>
        </div>
      ))}
      {reply.theme && <ThemeSwatch spec={reply.theme} />}
      {reply.builtIn && <BuiltInSwatch id={reply.builtIn} />}
      {reply.posts?.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {reply.posts.map(p => (
            <li key={p.postId}>
              <button type="button" onClick={() => onGo(`/post/${encodeURIComponent(p.postId)}`)}
                className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 hover:border-aura-500/40">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                  {p.where && <span className="px-1.5 py-px rounded-full bg-aura-500/15 text-aura-400 truncate max-w-[45%]">{p.where}</span>}
                  <span className="truncate">@{p.author} · {p.aura} aura{p.type !== 'text' ? ` · ${p.type === 'image' ? 'photo' : p.type}` : ''}</span>
                </span>
                <span className="block text-sm text-[var(--text-primary)] line-clamp-2 mt-0.5">{p.caption || `(${p.type === 'image' ? 'photo' : p.type} post)`}</span>
                <span className="block text-[11px] font-semibold text-aura-400 mt-1">Take me to it →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* the person's own words, exactly as they'll be posted */}
      {reply.preview && (
        <blockquote className="text-sm whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)]">{reply.preview}</blockquote>
      )}
      {reply.note && <p className="text-xs opacity-70">{reply.note}</p>}
      {reply.followUps?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {reply.followUps.map(q => (
            <button key={q} type="button" disabled={busy} onClick={() => onAsk(q)}
              className="px-3 py-1.5 rounded-full text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:border-aura-500/50 text-left">{q}</button>
          ))}
        </div>
      )}
      {reply.links?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {reply.links.map(l => (
            <button key={l.to} type="button" onClick={() => onGo(l.to)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-aura-500/40 text-[var(--brand-ink-2)] hover:bg-aura-500/10">
              {l.label} <ArrowRight size={12} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {shown.length > 0 && !reply.done && (
        <div className="flex flex-wrap gap-2 pt-1">
          {shown.map(a => (
            <button key={a.id + a.label} type="button" disabled={busy} onClick={() => onAction(a)}
              className={a.payload?.undo ? 'btn-secondary px-3 py-1.5 text-xs text-[var(--text-primary)]' : 'btn-primary px-3 py-1.5 text-xs'}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Angel() {
  const { user, dbProfile, refreshUser, logout } = useAuth();
  const { themeId, refreshCustom, skyDetails, setSkyDetails } = useTheme();
  const navigate = useNavigate();
  const chooseTheme = useChooseTheme();
  const [messages, setMessages] = useState([
    { from: 'angel', reply: { kind: 'hello', text: 'Hi, I\'m Angel. I can tune your feed, look up trends, answer questions about Aura, make you a custom theme, give feedback on a post, change your settings, report someone, or pass a message to Aura\'s support team. I can also do things for you, like give aura, like or share a post, or post your own words, always after you say yes. I run on your device: what you tell me stays here, and I only ask Aura\'s servers to do what you say yes to.' } },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const lastTheme = useRef(null);
  // What her last reply was about, so a follow-up ("a different one") continues it
  const lastKind = useRef(null);
  // What her last reply offered and was about, so "yes" or "more of that" follow on
  const pendingActions = useRef([]);
  const lastSubjects = useRef(null);
  const lastFind = useRef(null);   // the posts she just found, for "the second one" or "show more"
  const recentGives = useRef([]);  // whose posts she gave aura to in this chat (once each)
  const pool = useRef(null);
  const endRef = useRef(null);
  // A report or support message under way (see angel/flows.js)
  const [flow, setFlow] = useState(null);
  // The on-device model loads in the background; until it's ready she
  // answers by her rules instead of waiting for it
  const modelReady = useRef(false);

  useEffect(() => { warmUpModel().then(() => { modelReady.current = true; }); }, []);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const getPool = useCallback(async () => {
    if (!pool.current) pool.current = api.getFeed().then(d => d.posts ?? []).catch(err => { pool.current = null; throw err; });
    return pool.current;
  }, []);
  const embed = useCallback(texts => {
    const work = embedTexts(texts, 8000).catch(() => null);
    if (modelReady.current) return work;
    return Promise.race([work, new Promise(resolve => setTimeout(() => resolve(null), 350))]);
  }, []);
  const lookupUser = useCallback(username => api.getUser(username).catch(() => null), []);
  const lookupPost = useCallback(postId => api.getPost(postId).catch(() => null), []);

  const say = (from, reply) => setMessages(m => [...m, { from, reply }]);

  async function send(text) {
    const message = text.trim().slice(0, flow?.step === 'message' ? SUPPORT_MAX : MAX_MESSAGE);
    if (!message || busy) return;
    setInput('');
    say('you', { text: message });
    setBusy(true);
    try {
      const reply = await respond(message, { prefs: loadPrefs(user?.userId), getPool, embed, lastTheme: lastTheme.current, lastKind: lastKind.current,
        // their own app state, all already on this device
        me: dbProfile, currentThemeId: themeId, skyDetails,
        taste: prepareTaste(loadTaste(user?.userId)), learning: isLearningOn(user?.userId),
        flow, lookupUser, lookupPost, customTheme: loadCustom(),
        pendingActions: pendingActions.current, lastSubjects: lastSubjects.current, lastFind: lastFind.current,
        changesAllowed: changesAllowed(), recentGives: recentGives.current,
        api: { getNotifications: api.getNotifications, getMyGroups: api.getMyGroups, listGroups: api.listGroups,
          getLikedPosts: api.getLikedPosts, getGroupPosts: api.getGroupPosts },
      });
      if (reply.theme) lastTheme.current = reply.theme;
      lastKind.current = reply.kind;
      pendingActions.current = (reply.actions ?? []).filter(a => !a.payload?.undo);
      if (reply.subjects) lastSubjects.current = reply.subjects;
      // a card about a post she found keeps "it" pointing at that post
      lastFind.current = reply.find ?? (reply.kind === 'action' ? lastFind.current : null);
      setFlow(reply.flow ?? null);
      say('angel', reply);
      // things she does straight away (a setting, the daily bonus, a confirmed send)
      if (reply.autoAction) await run(reply.autoAction, reply);
    } catch {
      say('angel', { kind: 'error', text: 'Something went wrong on my side. Try asking again.' });
    } finally {
      setBusy(false);
    }
  }

  // Her suggestions only take effect when tapped
  async function onAction(action) {
    setBusy(true);
    try {
      await run(action);
    } finally {
      setBusy(false);
    }
  }

  // Does one of her actions; `from` is the reply that did it by itself
  async function run(action, from = null) {
    const markDone = () => setMessages(m => m.map(x => (x.reply.actions?.includes(action) ? { ...x, reply: { ...x.reply, done: true } } : x)));
    // an Undo is spent once used; a failed automatic change takes its Undo away
    const hideUndo = () => setMessages(m => m.map(x => (x.reply === from || x.reply.actions?.includes(action) ? { ...x, reply: { ...x.reply, undone: true } } : x)));
    const fail = err => say('angel', { kind: 'error', text: `That didn't work: ${err?.message ?? 'something went wrong'}. Nothing was changed.` });
    try {
      if (action.id === 'set-setting') {
        const { field, value, undo } = action.payload;
        try {
          await api.updateProfile({ [field]: value });
          await refreshUser?.();
          if (undo) { hideUndo(); say('angel', { kind: 'command', text: 'Undone.' }); }
        } catch (err) { hideUndo(); fail(err); }
      }
      if (action.id === 'set-notifications') {
        const { keys, value, undo } = action.payload;
        try {
          const prefs = defaultNotificationPrefs(dbProfile?.notificationPrefs);
          for (const k of keys) prefs[k] = value;
          await api.updateProfile({ notificationPrefs: prefs });
          await refreshUser?.();
          if (undo) { hideUndo(); say('angel', { kind: 'command', text: 'Undone.' }); }
        } catch (err) { hideUndo(); fail(err); }
      }
      if (action.id === 'daily-bonus') {
        try {
          const result = await api.claimDailyBonus();
          await refreshUser?.();
          const amount = result?.amount ?? result?.bonus ?? null;
          say('angel', { kind: 'command', text: amount ? `Claimed: +${amount} aura. Come back tomorrow for the next one.` : 'Claimed. Come back tomorrow for the next one.' });
        } catch (err) {
          say('angel', { kind: 'command', text: err?.message ?? 'I couldn\'t claim it right now.', links: [{ to: '/wallet', label: 'Open your wallet' }] });
        }
      }
      if (action.id === 'person') {
        const { verb, username, userId } = action.payload;
        try {
          await { follow: api.follow, unfollow: api.unfollow, block: api.blockUser, unblock: api.unblockUser }[verb](username);
          if (verb === 'block' && userId) announceBlocked(userId);
          markDone();
          say('angel', { kind: 'command', text: { follow: `You're following @${username} now (or your request is sent, if they're private).`, unfollow: `You've unfollowed @${username}.`, block: `@${username} is blocked. You can unblock them in Settings > Privacy.`, unblock: `@${username} is unblocked.` }[verb] });
        } catch (err) { fail(err); }
      }
      if (action.id === 'set-bio') {
        try {
          await api.updateProfile({ bio: action.payload.bio });
          await refreshUser?.();
          markDone();
          say('angel', { kind: 'command', text: action.payload.bio ? 'Your bio is updated.' : 'Your bio is cleared.', links: [{ to: '/profile', label: 'See your profile' }] });
        } catch (err) { fail(err); }
      }
      if (action.id === 'go') {
        navigate(action.payload.to);
      }
      if (action.id === 'start-bot') {
        const { game, level, groupId } = action.payload;
        try {
          const result = await api.createGame(groupId, { game, bot: level });
          markDone();
          navigate(`/games/${encodeURIComponent(result.match.matchId)}`);
        } catch (err) { fail(err); }
      }
      if (action.id === 'sign-out') {
        markDone();
        await logout?.();
        navigate('/welcome');
      }
      if (action.id === 'send-report') {
        const { kind, id: target, reason, label, userId } = action.payload;
        try {
          await (kind === 'post' ? api.reportPost(target, reason) : api.reportUser(target, reason));
          markDone();
          setFlow(null);
          say('angel', { kind: 'command', text: `Reported ${label} for "${reasonLabel(reason)}". Thank you. Moderators will take a look.`
            + (kind === 'user' ? ' Want to stop seeing them too?' : ''),
            actions: kind === 'user' ? [{ id: 'person', label: `Block ${label}`, payload: { verb: 'block', username: target, userId } }] : undefined });
        } catch (err) { fail(err); }
      }
      if (action.id === 'send-support') {
        try {
          const { ticket } = await api.sendSupport(action.payload);
          markDone();
          setFlow(null);
          say('angel', { kind: 'command', text: `Sent to Aura support. Your ticket is ${ticket}. They'll reply to ${action.payload.contactEmail}, usually within a few days.` });
        } catch (err) {
          say('angel', { kind: 'error', text: `I couldn't send it: ${err?.message ?? 'something went wrong'}. Your message is still here; say "send" to try again, or "cancel".` });
        }
      }
      if (action.id === 'apply-feed') {
        const { topics, keywords, choice } = action.payload;
        let prefs = loadPrefs(user?.userId);
        if (topics.length) prefs = setTopics(prefs, topics, choice);
        const fresh = keywords.filter(k => !hasKeyword(prefs, k)).slice(0, Math.max(0, MAX_KEYWORDS - prefs.words.length));
        if (fresh.length) {
          const vecs = await embedTexts(fresh, 30000).catch(() => null);
          fresh.forEach((k, i) => { prefs = addKeyword(prefs, k, vecs?.[i] ?? null, choice); });
        }
        const before = loadPrefs(user?.userId).words.length;
        savePrefs(user?.userId, prefs);
        const keptWords = loadPrefs(user?.userId).words.length - before;
        markDone();
        const missed = fresh.length - keptWords;
        say('angel', { kind: 'feed', text: `Done. Your feed will show ${choice} of that the next time it loads. You can see and change everything in Tune your feed, at the top of your feed.`
          + (missed > 0 ? " I couldn't add the keywords this time because the on-device model didn't load; the topics are set, and you can ask me again in a moment." : '') });
      }
      if (action.id === 'reset-feed') {
        clearPrefs(user?.userId);
        markDone();
        say('angel', { kind: 'feed', text: 'Cleared. Your feed starts fresh the next time it loads.' });
      }
      if (action.id === 'use-theme') {
        chooseTheme(action.payload);
        markDone();
        say('angel', { kind: 'builtin-theme', text: `Switched to ${getTheme(action.payload)?.name ?? 'that theme'}. Want to tweak it? Ask me for a custom version, like "${getTheme(action.payload)?.name ?? 'it'} but pink".` });
      }
      if (action.id === 'scenery') {
        setSkyDetails(action.payload);
        markDone();
        say('angel', { kind: 'scenery', text: action.payload ? 'Scenery is back on.' : 'Scenery is off. Your theme\'s colors stay the same.' });
      }
      if (action.id === 'apply-theme') {
        saveCustom(action.payload);
        if (themeId === 'custom') refreshCustom();
        else chooseTheme('custom');
        const name = action.payload.name || 'My theme';
        say('angel', { kind: 'theme', text: 'It\'s on. Keep tweaking it with me, or save it to your themes. To give it your own name, say "save it as" and the name.',
          actions: [{ id: 'save-theme', label: `Save as "${name}"`, payload: { name } }] });
      }
      // Saves the custom theme in use under a name (or renames it, if it's already saved)
      if (action.id === 'save-theme') {
        const current = loadCustom();
        if (!current) {
          say('angel', { kind: 'theme', text: 'There\'s no custom theme on right now. Ask me to make one first.' });
        } else {
          const already = current.savedId && loadSavedThemes().some(t => t.id === current.savedId);
          const result = already ? renameSavedTheme(current.savedId, action.payload.name) : saveTheme(current, action.payload.name);
          if (result.error) say('angel', { kind: 'theme', text: result.error });
          else {
            if (result.theme) saveCustom({ ...current, name: result.theme.name, savedId: result.theme.id });
            markDone();
            say('angel', { kind: 'theme', text: `Saved as "${action.payload.name.trim()}". It's in Settings > Appearance > Your themes, where you can switch back to it, rename it or delete it.`,
              links: [{ to: '/settings#appearance', label: 'Your themes' }] });
          }
        }
      }
      await runAppAction(action, { markDone, fail });
    } catch {
      say('angel', { kind: 'error', text: 'Something went wrong on my side. Try again.' });
    }
  }

  // The actions from angel/actions.js, each after the person's yes. Every one
  // says what happened and how to undo it, where it can be undone.
  async function runAppAction(action, { markDone, fail }) {
    const p = action.payload ?? {};
    const done = (text, extra = {}) => { markDone(); say('angel', { kind: 'command', text, ...extra }); };
    const post = id => ({ to: `/post/${encodeURIComponent(id)}`, label: 'Open the post' });
    try {
      switch (action.id) {
        case 'give-aura':
          await api.giveAura(p.postId, p.amount);
          if (p.authorId) recentGives.current = [...recentGives.current, p.authorId];
          await refreshUser?.();
          return done(`Gave ${p.amount.toLocaleString()} aura to @${p.author}'s post. Aura that's given can't be taken back.`, { links: [post(p.postId)] });
        case 'take-aura':
          await api.takeAura(p.postId, p.amount);
          await refreshUser?.();
          return done(`Took ${p.amount.toLocaleString()} aura from @${p.author}'s post. It can't be given back.`, { links: [post(p.postId)] });
        case 'like-post':
          await (p.on ? api.likePost(p.postId) : api.unlikePost(p.postId));
          return done(p.on ? 'Liked. Say "unlike it" to undo.' : 'Unliked.', { links: [post(p.postId)] });
        case 'share-post':
          await api.shareToGroup(p.postId, p.groupId);
          return done(`Shared to ${p.groupName}. You can delete the share from the group's feed.`, { links: [{ to: `/groups/${encodeURIComponent(p.groupId)}`, label: `Open ${p.groupName}` }] });
        case 'spotlight':
          await api.spotlightPost(p.groupId, p.postId);
          await refreshUser?.();
          return done('Your post is in the spotlight for the next 24 hours. A spotlight can\'t be undone.', { links: [post(p.postId)] });
        case 'start-rain':
          await api.startRain(p.groupId, p.pot);
          await refreshUser?.();
          return done(`Aura Rain started in ${p.groupName}. Whatever isn't caught comes back to you.`, { links: [{ to: `/groups/${encodeURIComponent(p.groupId)}`, label: `Open ${p.groupName}` }] });
        case 'delete-post':
          await api.deletePost(p.postId);
          return done('Your post is deleted.');
        case 'comment': {
          await api.createComment(p.postId, p.text);
          return done('Your comment is up. You can delete it from the post.', { links: [post(p.postId)] });
        }
        case 'create-post': {
          const created = await api.createPost({ type: 'text', caption: p.caption, mediaKeys: [], tags: [], hashtags: p.hashtags ?? [] });
          const id = created?.post?.postId ?? created?.postId;
          return done('Posted. You can delete it from the post\'s ⋯ menu.', id ? { links: [post(id)] } : {});
        }
        case 'group':
          await (p.verb === 'join' ? api.joinGroup(p.groupId) : api.leaveGroup(p.groupId));
          return done(p.verb === 'join' ? `You're in ${p.groupName} (or your request to join is sent). Say "leave ${p.groupName}" to undo.` : `You've left ${p.groupName}.`,
            { links: [{ to: `/groups/${encodeURIComponent(p.groupId)}`, label: `Open ${p.groupName}` }] });
        case 'answer-request':
          await api.answerFollowRequest(p.userId, p.approve);
          return done(p.approve ? `@${p.username} follows you now. To undo, say "remove @${p.username} from my followers".` : `Declined @${p.username}'s request.`);
        case 'remove-follower':
          await api.removeFollower(p.userId);
          return done(`@${p.username} no longer follows you.`);
        case 'read-all':
          await api.markAllRead();
          return done('All your notifications are marked read.', { links: [{ to: '/notifications', label: 'Notifications' }] });
        case 'set-tags':
          await api.updateProfile({ tags: p.tags });
          await refreshUser?.();
          return done('Your profile tags are updated.', { links: [{ to: '/profile', label: 'See your profile' }] });
        case 'set-profile':
          await api.updateProfile({ [p.field]: p.value });
          await refreshUser?.();
          return done('Done. You can change it back any time in Settings, or ask me.');
        default:
          return undefined;
      }
    } catch (err) {
      return fail(err);
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-4 pb-6">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)]">
          <img src="/aura-halo.webp" alt="" className="w-8 h-8 object-contain" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Angel</h1>
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1"><ShieldCheck size={12} aria-hidden="true" /> Runs on your device. What you tell her stays here; she only asks Aura's servers to do what you say yes to.</p>
        </div>
      </header>

      <section className="card p-3 sm:p-4 flex flex-col gap-3" aria-label="Conversation with Angel" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
              ${m.from === 'you' ? 'bg-aura-500 text-white rounded-br-md' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-bl-md'}`}>
              {m.from === 'angel' && <p className="text-[11px] font-semibold text-[var(--brand-ink-2)] mb-0.5 flex items-center gap-1"><Sparkles size={11} aria-hidden="true" /> Angel</p>}
              {m.from === 'you' ? <p className="whitespace-pre-wrap break-words">{m.reply.text}</p> : <Reply reply={m.reply} onAction={onAction} onAsk={send} onGo={navigate} busy={busy} />}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-[var(--text-muted)]">Angel is thinking…</p>}
        <div ref={endRef} />
      </section>

      {messages.length < 3 && (
        <div className="flex flex-wrap gap-2" aria-label="Things to ask">
          {STARTERS.map(s => (
            <button key={s} type="button" onClick={() => send(s)} disabled={busy}
              className="px-3 py-1.5 rounded-full text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:border-aura-500/50 text-left">{s}</button>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
        {flow?.step === 'message' ? (
          <textarea value={input} onChange={e => setInput(e.target.value)} maxLength={SUPPORT_MAX} aria-label="Your message to Aura support" rows={4}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(input); } }}
            placeholder="What happened? (Ctrl+Enter to send)" className="input flex-1 resize-y" />
        ) : (
          <input value={input} onChange={e => setInput(e.target.value)} maxLength={MAX_MESSAGE} aria-label="Message Angel"
            placeholder={flow ? 'Your answer, or "cancel"' : 'Ask Angel, or tell her what to do'} className="input flex-1" autoComplete="off"
            inputMode={flow?.step === 'email' ? 'email' : 'text'} />
        )}
        <button type="submit" disabled={busy || !input.trim()} className="btn-primary px-4" aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}
