import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useChooseTheme from '../hooks/useChooseTheme';
import { respond, MAX_MESSAGE } from '../angel/angel';
import { embedTexts, warmUpModel } from '../utils/embedClient';
import { loadPrefs, savePrefs, clearPrefs, setTopics, addKeyword, hasKeyword, MAX_KEYWORDS } from '../utils/feedPrefs';
import { saveCustom, customVars } from '../themes/customTheme';
import { getTheme } from '../themes';
import { loadTaste, prepareTaste, isLearningOn } from '../utils/tasteProfile';
import { fontFamily, loadPostFont } from '../utils/postStyle';

// Angel's chat. Everything happens here, on the device: messages are kept in
// memory only (never saved or sent), the trend data is the same public feed
// pool the feed already loads, and her suggestions only change things after
// a tap (feed choices and themes, both stored on this device).

const STARTERS = [
  'What is my feed like right now?',
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
      {reply.actions?.length > 0 && !reply.done && (
        <div className="flex flex-wrap gap-2 pt-1">
          {reply.actions.map(a => (
            <button key={a.id} type="button" disabled={busy} onClick={() => onAction(a)} className="btn-primary px-3 py-1.5 text-xs">{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Angel() {
  const { user, dbProfile } = useAuth();
  const { themeId, refreshCustom, skyDetails, setSkyDetails } = useTheme();
  const navigate = useNavigate();
  const chooseTheme = useChooseTheme();
  const [messages, setMessages] = useState([
    { from: 'angel', reply: { kind: 'hello', text: 'Hi, I\'m Angel. I can help you tune your feed, look up trends, answer questions about Aura, make you a custom theme, or give feedback on a post you\'re writing. I run on your device, and what you tell me never leaves it.' } },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const lastTheme = useRef(null);
  // What her last reply was about, so a follow-up ("a different one") continues it
  const lastKind = useRef(null);
  const pool = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { warmUpModel(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const getPool = useCallback(async () => {
    if (!pool.current) pool.current = api.getFeed().then(d => d.posts ?? []).catch(err => { pool.current = null; throw err; });
    return pool.current;
  }, []);
  const embed = useCallback(texts => embedTexts(texts, 20000).catch(() => null), []);

  const say = (from, reply) => setMessages(m => [...m, { from, reply }]);

  async function send(text) {
    const message = text.trim().slice(0, MAX_MESSAGE);
    if (!message || busy) return;
    setInput('');
    say('you', { text: message });
    setBusy(true);
    try {
      const reply = await respond(message, { prefs: loadPrefs(user?.userId), getPool, embed, lastTheme: lastTheme.current, lastKind: lastKind.current,
        // their own app state, all already on this device
        me: dbProfile, currentThemeId: themeId, skyDetails,
        taste: prepareTaste(loadTaste(user?.userId)), learning: isLearningOn(user?.userId),
      });
      if (reply.theme) lastTheme.current = reply.theme;
      lastKind.current = reply.kind;
      say('angel', reply);
    } catch {
      say('angel', { kind: 'error', text: 'Something went wrong on my side. Try asking again.' });
    } finally {
      setBusy(false);
    }
  }

  // Her suggestions only take effect when tapped
  async function onAction(action) {
    setBusy(true);
    const markDone = () => setMessages(m => m.map(x => (x.reply.actions?.includes(action) ? { ...x, reply: { ...x.reply, done: true } } : x)));
    try {
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
        say('angel', { kind: 'theme', text: 'It\'s on. Keep tweaking it with me, or pick another theme any time in Settings > Appearance, where yours now shows as "' + (action.payload.name || 'My theme') + '".' });
      }
    } finally {
      setBusy(false);
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
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1"><ShieldCheck size={12} aria-hidden="true" /> Runs on your device. What you say never leaves it.</p>
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
        <input value={input} onChange={e => setInput(e.target.value)} maxLength={MAX_MESSAGE} aria-label="Message Angel"
          placeholder="Ask Angel about your feed, trends, themes, posts or the app" className="input flex-1" autoComplete="off" />
        <button type="submit" disabled={busy || !input.trim()} className="btn-primary px-4" aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}
