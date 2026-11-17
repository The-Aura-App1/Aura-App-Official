import React, { useEffect, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import useMyGroups from '../groups/useMyGroups';
import { PERKS } from '../../utils/powerUps';
import { REACTION_EMOJIS, EMOJI_GROUPS, MAX_PER_USER, isPin, pinReaction, isReactionEmoji, normalizeReaction } from '../../utils/reactions';

const MEDIA_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com/';

function PinImage({ pin, size = 20 }) {
  const [broken, setBroken] = useState(false);
  if (!pin || broken) return <span aria-hidden="true">📌</span>;
  return <img src={MEDIA_URL + pin.key} alt="" width={size} height={size} className="object-contain inline-block" style={{ width: size, height: size }} onError={() => setBroken(true)} />;
}

// Emoji this person used lately, first in the picker (this device only)
const RECENT_KEY = 'aura.recentReactions';
function loadRecent() {
  try { return (JSON.parse(localStorage.getItem(RECENT_KEY)) ?? []).filter(isReactionEmoji).slice(0, 8); } catch { return []; }
}
function rememberRecent(emoji) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...loadRecent().filter(e => e !== emoji)].slice(0, 8))); } catch { /* storage blocked */ }
}

// The reactions on a post or a comment, and the picker to add yours: up to
// MAX_PER_USER each, from any emoji or (posts only) a group's reaction pins
// (members use their group's pins on its posts; Premium members anywhere).
export default function Reactions({ post, comment = null }) {
  const target = comment ?? post;
  const noun = comment ? 'comment' : 'post';
  const { user, dbProfile } = useAuth();
  const [counts, setCounts] = useState(target.reactions ?? {});
  const [mine, setMine] = useState(target.myReactions ?? []);
  const [pins, setPins] = useState(comment ? {} : post.reactionPins ?? {});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const [group, setGroup] = useState(null);     // an emoji group open in the picker, or null for the quick picks
  const box = useRef(null);
  const premium = !!dbProfile?.isPremium;
  // Group pins only matter once the picker opens
  const myGroups = useMyGroups(open && !!user && !comment);
  const [recent, setRecent] = useState(loadRecent);

  useEffect(() => {
    if (!open) return undefined;
    const close = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  useEffect(() => { if (!error) return undefined; const t = setTimeout(() => setError(''), 3500); return () => clearTimeout(t); }, [error]);

  // The pin sets this person may use here
  const pinSets = comment ? [] : (myGroups ?? [])
    .filter(g => (g.level ?? 1) >= PERKS.pins && g.pins?.length && (g.groupId === post.groupId || premium))
    .sort((a, b) => (a.groupId === post.groupId ? -1 : b.groupId === post.groupId ? 1 : a.name.localeCompare(b.name)));
  const lockedOutside = !comment && !premium && (myGroups ?? []).some(g => (g.level ?? 1) >= PERKS.pins && g.pins?.length && g.groupId !== post.groupId);

  async function toggle(picked, pinInfo) {
    if (busy || !user) return;
    const reaction = isPin(picked) ? picked : normalizeReaction(picked);
    const on = !mine.includes(reaction);
    if (on && mine.length >= MAX_PER_USER) { setError(`You can add up to ${MAX_PER_USER} reactions. Take one back first.`); return; }
    const before = { counts, mine, pins };
    // Shows at once; the server's answer replaces it
    setCounts(c => ({ ...c, [reaction]: Math.max(0, (c[reaction] ?? 0) + (on ? 1 : -1)) }));
    setMine(m => (on ? [...m, reaction] : m.filter(r => r !== reaction)));
    if (on && pinInfo) setPins(p => ({ ...p, [reaction]: pinInfo }));
    setOpen(false);
    setBusy(true);
    try {
      if (on && !isPin(reaction)) { rememberRecent(reaction); setRecent(loadRecent()); }
      const result = comment
        ? await api.reactToComment(comment.commentId, reaction, on)
        : await api.reactToPost(post.postId, reaction, on);
      setCounts(result.reactions ?? {});
      setMine(result.myReactions ?? []);
      setPins(p => ({ ...p, ...(result.reactionPins ?? {}) }));
    } catch (err) {
      setCounts(before.counts); setMine(before.mine); setPins(before.pins);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const shown = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (!user && !shown.length) return null;

  return (
    <div className={`${comment ? 'pt-1' : 'px-4 pb-2'} flex flex-wrap items-center gap-1.5`} ref={box}>
      {shown.map(([reaction, n]) => {
        const me = mine.includes(reaction);
        const label = isPin(reaction) ? pins[reaction]?.name ?? 'a group pin' : reaction;
        return (
          <button key={reaction} type="button" onClick={() => toggle(reaction)} disabled={!user}
            aria-pressed={me} aria-label={`${label}: ${n}. ${me ? 'Tap to take yours back' : 'Tap to add yours'}`}
            className={`flex items-center gap-1 ${comment ? 'h-6 px-1.5 text-[11px]' : 'h-7 px-2 text-xs'} rounded-full font-semibold border transition-colors tabular-nums
              ${me ? 'border-aura-500/60 bg-aura-500/15 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-aura-500/40'}`}>
            <span className="text-sm leading-none flex items-center">{isPin(reaction) ? <PinImage pin={pins[reaction]} size={18} /> : reaction}</span>
            {n}
          </button>
        );
      })}
      {user && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`Add a reaction to this ${noun}`}
          className={`flex items-center ${comment ? 'h-6 px-1.5' : 'h-7 px-2'} rounded-full border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-aura-500/40`}>
          <SmilePlus size={comment ? 13 : 15} />
        </button>
      )}
      {error && <span className="text-[11px] text-red-400" role="alert">{error}</span>}

      {open && (
        <div role="dialog" aria-label="Pick a reaction"
          className="basis-full w-full max-w-sm max-h-72 overflow-y-auto rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg p-2 reaction-picker">
          {/* Any emoji: type or paste it (the phone's emoji keyboard, or Win + . / Ctrl + Cmd + Space) */}
          <form className="flex gap-1.5 mb-2" onSubmit={e => {
            e.preventDefault();
            const pick = typed.trim();
            if (!isReactionEmoji(pick)) { setError('Pick one emoji (letters, numbers and a few others can\'t be used).'); return; }
            setTyped('');
            toggle(pick);
          }}>
            <input value={typed} onChange={e => setTyped(e.target.value)} maxLength={16} placeholder="Any emoji: type or paste one"
              aria-label="Any emoji" className="input !py-1.5 text-sm flex-1 min-w-0" />
            <button type="submit" disabled={!typed.trim()} className="btn-primary px-3 py-1.5 text-xs flex-shrink-0">React</button>
          </form>
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] mb-1.5" role="tablist" aria-label="Emoji groups">
            {[[null, 'Quick'], ...EMOJI_GROUPS.map(([name]) => [name, name])].map(([key, label]) => (
              <button key={label} type="button" role="tab" aria-selected={group === key} onClick={() => setGroup(key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border flex-shrink-0
                  ${group === key ? 'border-aura-500/60 bg-aura-500/10 text-aura-400' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                {label}
              </button>
            ))}
          </div>
          {!group && recent.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] px-1 mb-0.5">Recent</p>
              <div className="grid grid-cols-8 gap-0.5 mb-1.5">
                {recent.map(e => (
                  <button key={e} type="button" onClick={() => toggle(e)} aria-label={`React ${e}`} aria-pressed={mine.includes(e)}
                    className={`h-10 rounded-lg text-xl leading-none hover:bg-[var(--accent-subtle)] ${mine.includes(e) ? 'bg-aura-500/15' : ''}`}>{e}</button>
                ))}
              </div>
            </>
          )}
          <div className="grid grid-cols-8 gap-0.5">
            {(group ? EMOJI_GROUPS.find(([name]) => name === group)[1] : REACTION_EMOJIS).map(e => (
              <button key={e} type="button" onClick={() => toggle(e)} aria-label={`React ${e}`} aria-pressed={mine.includes(e)}
                className={`h-10 rounded-lg text-xl leading-none hover:bg-[var(--accent-subtle)] ${mine.includes(e) ? 'bg-aura-500/15' : ''}`}>{e}</button>
            ))}
          </div>
          {pinSets.map(g => (
            <div key={g.groupId} className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] px-1 mb-1 truncate">{g.name} pins</p>
              <div className="grid grid-cols-6 gap-1">
                {g.pins.map(p => {
                  const r = pinReaction(g.groupId, p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggle(r, { key: p.key, name: p.name })} title={p.name} aria-label={`React with ${p.name}`}
                      aria-pressed={mine.includes(r)}
                      className={`h-10 rounded-lg flex items-center justify-center hover:bg-[var(--accent-subtle)] ${mine.includes(r) ? 'bg-aura-500/15' : ''}`}>
                      <PinImage pin={p} size={28} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {lockedOutside && (
            <p className="text-[11px] text-[var(--text-muted)] px-1 mt-2">With Premium you can use your groups' pins on any post.</p>
          )}
          <p className="text-[10px] text-[var(--text-muted)] px-1 mt-2">Up to {MAX_PER_USER} reactions per {noun}.</p>
        </div>
      )}
    </div>
  );
}
