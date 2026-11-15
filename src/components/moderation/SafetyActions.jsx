import React, { useEffect, useState } from 'react';
import { Flag, Ban } from 'lucide-react';
import { api } from '../../api';
import { REPORT_REASONS, BLOCKED_EVENT, announceBlocked } from '../../utils/reportReasons';

// "Report" and "Block @name" for a ⋯ menu. Reporting asks why; blocking asks
// once more and then hides the account everywhere on screen.
//   kind: 'post' | 'comment' | 'user', targetId: the post or comment id
//   username / userId: whose content it is
//   onNotice(text): shows the outcome where the menu was
//   onDone(): closes the menu
const REPORT = {
  post:    (targetId, reason) => api.reportPost(targetId, reason),
  comment: (targetId, reason) => api.reportComment(targetId, reason),
  user:    (_, reason, username) => api.reportUser(username, reason),
};
const LABEL = { post: 'Report post', comment: 'Report comment', user: 'Report account' };

const item = 'w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm hover:bg-[var(--accent-subtle)] disabled:opacity-50';

export default function SafetyActions({ kind, targetId, username, userId, onNotice, onDone, showBlock = true }) {
  const [step, setStep] = useState(null);   // null | 'report' | 'block'
  const [busy, setBusy] = useState(false);

  async function report(reason) {
    setBusy(true);
    try {
      await REPORT[kind](targetId, reason, username);
      onNotice?.('Thanks for telling us. A moderator will take a look.');
    } catch (err) {
      onNotice?.(err.message || 'Could not send the report.');
    } finally {
      setBusy(false);
      setStep(null);
      onDone?.();
    }
  }

  async function block() {
    setBusy(true);
    try {
      await api.blockUser(username);
      announceBlocked(userId);
      onNotice?.(`You blocked @${username}.`);
    } catch (err) {
      onNotice?.(err.message || 'Could not block this account.');
    } finally {
      setBusy(false);
      setStep(null);
      onDone?.();
    }
  }

  if (step === 'report') {
    return (
      <div className="p-1" role="group" aria-label="Why are you reporting this?">
        <p className="px-2 pb-1 text-xs text-[var(--text-muted)]">What's wrong with it?</p>
        {REPORT_REASONS.map(([value, label]) => (
          <button key={value} type="button" onClick={() => report(value)} disabled={busy}
            className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--accent-subtle)] disabled:opacity-50">
            {label}
          </button>
        ))}
      </div>
    );
  }
  if (step === 'block') {
    return (
      <div className="p-2 max-w-[16rem]">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Block @{username}?</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          You won't see each other's posts or comments, and they can't follow you, comment, give or take aura on your posts, or challenge you to games. They aren't told.
        </p>
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={block} disabled={busy}
            className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 disabled:opacity-50">
            {busy ? 'Blocking…' : 'Block'}
          </button>
          <button type="button" onClick={() => setStep(null)} className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)]">Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setStep('report')} className={`${item} text-[var(--text-primary)]`}>
        <Flag size={14} aria-hidden="true" /> {LABEL[kind]}
      </button>
      {showBlock && username && (
        <button type="button" onClick={() => setStep('block')} className={`${item} text-red-400`}>
          <Ban size={14} aria-hidden="true" /> Block @{username}
        </button>
      )}
    </>
  );
}

// True once the given account is blocked from anywhere on the page
export function useBlockedAuthor(userId) {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const on = e => { if (e.detail?.userId === userId) setBlocked(true); };
    window.addEventListener(BLOCKED_EVENT, on);
    return () => window.removeEventListener(BLOCKED_EVENT, on);
  }, [userId]);
  return blocked;
}
