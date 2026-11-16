import React, { useRef, useState } from 'react';
import { ImagePlus, Lock, Trash2, Sparkles, Trophy } from 'lucide-react';
import { api } from '../../api';
import shrinkImage from '../../utils/shrinkImage';
import { PERKS, MAX_PINS, MAX_BACKGROUNDS } from '../../utils/powerUps';
import { groupBgCss } from '../../utils/postStyle';
import { GroupAvatar } from './GroupBits';
import { refreshMyGroups } from './useMyGroups';

const MEDIA_URL = 'https://aura-app-media-570934198135.s3.amazonaws.com/';

// Shrinks and uploads one image for a group perk; resolves to { id, key }
async function uploadImage(groupId, kind, file) {
  const maxEdge = { picture: 512, pin: 256, background: 1600 }[kind];
  const small = file.type === 'image/gif' ? file : await shrinkImage(file, { maxEdge, minBytes: 0 });
  const { id, key, url } = await api.getGroupUploadUrl(groupId, kind, small.type, small.size);
  const res = await fetch(url, { method: 'PUT', body: small, headers: { 'Content-Type': small.type } });
  if (!res.ok) throw new Error('The image didn\'t upload. Please try again.');
  return { id, key };
}

function Locked({ level }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Lock size={12} /> Unlocks at group level {level}.</p>
  );
}

function FilePick({ label, accept, disabled, onPick }) {
  const input = useRef(null);
  return (
    <>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(f); }} />
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="btn-secondary px-3 py-1.5 text-xs text-[var(--text-primary)]">
        <ImagePlus size={14} /> {label}
      </button>
    </>
  );
}

// Level perks for owners and moderators: the group picture (level 2),
// reaction pins (level 7), post backgrounds and the glow (level 10), plus
// the owner's switch for the Top groups board
export default function GroupPerks({ group, onChanged }) {
  const level = group.level ?? 1;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({});
  const [draftPin, setDraftPin] = useState(null);     // { file, preview, name }
  const [draftBg, setDraftBg] = useState(null);       // { file, preview, name, ink }
  const pins = group.pins ?? [];
  const backgrounds = group.backgrounds ?? [];

  async function act(work, done) {
    setBusy(true);
    setMessage({});
    try {
      await work();
      setMessage({ success: done });
      refreshMyGroups();
      await onChanged();
    } catch (err) {
      setMessage({ error: err.message });
    } finally {
      setBusy(false);
    }
  }
  const save = changes => api.updateGroup(group.groupId, changes);
  const preview = file => ({ file, preview: URL.createObjectURL(file) });

  return (
    <section className="card flex flex-col gap-5" aria-label="Level perks">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><Sparkles size={16} className="text-aura-400" /> Level perks</h3>
        <span className="aura-badge">Level {level}</span>
      </div>
      {(message.error || message.success) && (
        <p className={`text-sm ${message.error ? 'text-red-400' : 'text-aura-400'}`} role="status">{message.error || message.success}</p>
      )}

      {/* Level 2: the group's picture */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Group picture</h4>
        {level < PERKS.picture ? <Locked level={PERKS.picture} /> : (
          <div className="flex items-center gap-3 flex-wrap">
            <GroupAvatar name={group.name} picKey={group.picKey} size="lg" />
            <FilePick label={group.picKey ? 'Change picture' : 'Upload picture'} accept="image/jpeg,image/png,image/webp" disabled={busy}
              onPick={file => act(async () => { const { key } = await uploadImage(group.groupId, 'picture', file); await save({ picKey: key }); }, 'Picture updated.')} />
            {group.picKey && (
              <button type="button" disabled={busy} onClick={() => act(() => save({ picKey: '' }), 'Picture removed.')} className="btn-ghost text-xs">Remove</button>
            )}
          </div>
        )}
      </div>

      {/* Level 7: reaction pins */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Reaction pins <span className="font-normal text-[var(--text-muted)]">({pins.length}/{MAX_PINS})</span></h4>
        {level < PERKS.pins ? <Locked level={PERKS.pins} /> : (
          <>
            <p className="text-xs text-[var(--text-muted)]">Your own reactions for posts in this group. Premium members can use them on any post. Small square PNG, WebP or GIF works best (under 512 KB).</p>
            {pins.length > 0 && (
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pins.map(p => (
                  <li key={p.id} className="flex flex-col items-center gap-1 p-2 rounded-xl border border-[var(--border)] relative">
                    <img src={MEDIA_URL + p.key} alt="" className="w-10 h-10 object-contain" />
                    <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-full">{p.name}</span>
                    <button type="button" disabled={busy} aria-label={`Delete the ${p.name} pin`}
                      onClick={() => act(() => save({ pins: pins.filter(x => x.id !== p.id) }), 'Pin deleted.')}
                      className="absolute top-1 right-1 p-1 rounded-md text-[var(--text-muted)] hover:text-red-400"><Trash2 size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
            {draftPin ? (
              <div className="flex items-center gap-2 flex-wrap">
                <img src={draftPin.preview} alt="" className="w-10 h-10 object-contain rounded-lg border border-[var(--border)]" />
                <input value={draftPin.name} onChange={e => setDraftPin(d => ({ ...d, name: e.target.value }))} maxLength={24} placeholder="Name it"
                  aria-label="Pin name" className="input py-1.5 flex-1 min-w-[8rem]" />
                <button type="button" disabled={busy || !draftPin.name.trim()} className="btn-primary px-3 py-1.5 text-xs"
                  onClick={() => act(async () => {
                    const { id, key } = await uploadImage(group.groupId, 'pin', draftPin.file);
                    await save({ pins: [...pins, { id, key, name: draftPin.name.trim() }] });
                    setDraftPin(null);
                  }, 'Pin added.')}>Add pin</button>
                <button type="button" onClick={() => setDraftPin(null)} className="btn-ghost text-xs">Cancel</button>
              </div>
            ) : pins.length < MAX_PINS && (
              <div><FilePick label="New pin" accept="image/png,image/webp,image/gif" disabled={busy} onPick={file => setDraftPin({ ...preview(file), name: '' })} /></div>
            )}
          </>
        )}
      </div>

      {/* Level 10: custom post backgrounds and the glow */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Post backgrounds <span className="font-normal text-[var(--text-muted)]">({backgrounds.length}/{MAX_BACKGROUNDS})</span></h4>
        {level < PERKS.backgrounds ? <Locked level={PERKS.backgrounds} /> : (
          <>
            <p className="text-xs text-[var(--text-muted)]">Members can pick these for text posts in this group.</p>
            {backgrounds.length > 0 && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {backgrounds.map(b => (
                  <li key={b.id} className="relative rounded-xl overflow-hidden border border-[var(--border)]">
                    <div className="h-20 flex items-center justify-center text-lg font-bold" style={{ background: groupBgCss(b), color: b.ink }}>Aa</div>
                    <div className="flex items-center justify-between gap-1 px-2 py-1">
                      <span className="text-[11px] text-[var(--text-secondary)] truncate">{b.name}</span>
                      <button type="button" disabled={busy} aria-label={`Delete the ${b.name} background`}
                        onClick={() => act(() => save({ backgrounds: backgrounds.filter(x => x.id !== b.id) }), 'Background deleted.')}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {draftBg ? (
              <div className="flex flex-col gap-2 p-3 rounded-xl border border-[var(--border)]">
                <div className="h-24 rounded-lg flex items-center justify-center text-xl font-bold"
                  style={{ background: `linear-gradient(rgba(0,0,0,.16), rgba(0,0,0,.16)), url("${draftBg.preview}") center / cover`, color: draftBg.ink }}>Aa</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={draftBg.name} onChange={e => setDraftBg(d => ({ ...d, name: e.target.value }))} maxLength={30} placeholder="Name it"
                    aria-label="Background name" className="input py-1.5 flex-1 min-w-[8rem]" />
                  <span className="text-xs text-[var(--text-muted)]">Text</span>
                  {['#ffffff', '#111827'].map(ink => (
                    <button key={ink} type="button" aria-pressed={draftBg.ink === ink} aria-label={ink === '#ffffff' ? 'White text' : 'Dark text'}
                      onClick={() => setDraftBg(d => ({ ...d, ink }))}
                      className={`w-7 h-7 rounded-full border-2 ${draftBg.ink === ink ? 'border-aura-500' : 'border-[var(--border)]'}`} style={{ background: ink }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !draftBg.name.trim()} className="btn-primary px-3 py-1.5 text-xs"
                    onClick={() => act(async () => {
                      const { id, key } = await uploadImage(group.groupId, 'background', draftBg.file);
                      await save({ backgrounds: [...backgrounds, { id, key, name: draftBg.name.trim(), ink: draftBg.ink }] });
                      setDraftBg(null);
                    }, 'Background added.')}>Add background</button>
                  <button type="button" onClick={() => setDraftBg(null)} className="btn-ghost text-xs">Cancel</button>
                </div>
              </div>
            ) : backgrounds.length < MAX_BACKGROUNDS && (
              <div><FilePick label="New background" accept="image/jpeg,image/png,image/webp" disabled={busy} onPick={file => setDraftBg({ ...preview(file), name: '', ink: '#ffffff' })} /></div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Group glow</h4>
          {level < PERKS.glow ? <Locked level={PERKS.glow} /> : (
            <p className="text-xs text-[var(--text-muted)]">{group.glow !== false ? 'Posts in this group glow.' : 'The glow is off.'}</p>
          )}
        </div>
        {level >= PERKS.glow && (
          <button type="button" disabled={busy} onClick={() => act(() => save({ glow: group.glow === false }), group.glow === false ? 'The glow is on.' : 'The glow is off.')}
            className="btn-secondary px-4 py-2 text-[var(--text-primary)] flex-shrink-0">{group.glow !== false ? 'Turn off' : 'Turn on'}</button>
        )}
      </div>

      {group.isOwner && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5"><Trophy size={14} className="text-amber-400" /> Top groups board</h4>
            <p className="text-xs text-[var(--text-muted)]">
              {group.joinType === 'invite' ? 'Invite-only groups never show on the board.'
                : group.showOnLeaderboard !== false ? 'This group can show on the board for level and aura.' : 'This group is hidden from the board.'}
            </p>
          </div>
          {group.joinType !== 'invite' && (
            <button type="button" disabled={busy} onClick={() => act(() => save({ showOnLeaderboard: group.showOnLeaderboard === false }), 'Saved.')}
              className="btn-secondary px-4 py-2 text-[var(--text-primary)] flex-shrink-0">{group.showOnLeaderboard !== false ? 'Hide' : 'Show'}</button>
          )}
        </div>
      )}
    </section>
  );
}
