import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronLeft, ChevronRight, Sparkles, TrendingUp, TrendingDown, SlidersHorizontal,
  PenSquare, Users, Search, UserPlus, Heart, Palette, Wallet, MessageSquareHeart, Compass,
} from 'lucide-react';

// The steps of the tour. Keep the facts in line with CLAUDE.md (economy, feed,
// likes, follows) when those rules change.
export const STEPS = [
  {
    icon: Compass,
    kicker: 'Welcome',
    title: 'Welcome to Aura',
    body: 'A social app where appreciation is the currency. Here’s a quick look around. It takes about a minute, and you can skip it any time.',
  },
  {
    icon: Sparkles,
    kicker: 'Aura',
    title: 'Give aura to what you love',
    points: [
      { icon: TrendingUp, text: 'Tap Give on a post or comment to send aura to the person who made it.' },
      { icon: TrendingDown, text: 'Tap Take when something doesn’t deserve it. Taking costs you the same amount, and nobody receives it.' },
      { icon: Wallet, text: 'You get free aura every day. Your balance and history live in the Aura Wallet. Aura has no cash value.' },
    ],
  },
  {
    icon: SlidersHorizontal,
    kicker: 'Your feed',
    title: 'A feed you steer',
    points: [
      { icon: SlidersHorizontal, text: 'Open “Tune your feed” at the top of the feed to pick the topics and keywords you want more or less of.' },
      { icon: Sparkles, text: 'Use the ••• menu on a post for “Show more like this” or “Show less like this”.' },
      { icon: Heart, text: 'The feed learns from what you give, take and like, on your device only. Turn it off in Settings › Privacy.' },
    ],
  },
  {
    icon: PenSquare,
    kicker: 'Posting',
    title: 'Share something',
    points: [
      { icon: PenSquare, text: 'Post text, up to 10 photos, or a video. Add up to 3 topics and 10 hashtags so the right people find it.' },
      { icon: TrendingDown, text: 'Choose whether others can take aura from your post. It’s locked once you post.' },
      { icon: Users, text: 'Choose who can comment: anyone, or just your followers.' },
    ],
  },
  {
    icon: Users,
    kicker: 'Groups',
    title: 'Find your people',
    points: [
      { icon: Users, text: 'Join open groups right away, or ask to join private ones. Groups have their own posts and conversations.' },
      { icon: Sparkles, text: 'Give and take aura inside groups too. Group owners set the rules for their group.' },
    ],
  },
  {
    icon: Search,
    kicker: 'Search & follow',
    title: 'Discover and follow',
    points: [
      { icon: Search, text: 'Search posts by words or meaning, find groups, or type an exact @username to find someone.' },
      { icon: UserPlus, text: 'Follow people from their profile. Private accounts approve their followers first.' },
      { icon: Heart, text: 'Likes are private bookmarks. Only you see what you liked, in the Liked tab on your profile.' },
    ],
  },
  {
    icon: Palette,
    kicker: 'Make it yours',
    title: 'Set the scene',
    points: [
      { icon: Palette, text: 'Pick a theme, from Day and Night to Snowy Peaks, Duskfall and City Skies, in Settings › Appearance.' },
      { icon: MessageSquareHeart, text: 'Have an idea? Share it in Suggestions & Reviews and vote on others.' },
    ],
  },
  {
    icon: Sparkles,
    kicker: 'All set',
    title: 'You’re ready',
    body: 'Start wherever you like. You can replay this tour any time from More (the Me tab on phones).',
    actions: [
      { to: '/create',   label: 'Make a post' },
      { to: '/groups',   label: 'Explore groups' },
      { to: '/profile',  label: 'Set up my profile' },
    ],
  },
];

export default function AppTour({ onClose, initialStep = 0 }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(initialStep);
  const dialogRef = useRef(null);
  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  // Keyboard: arrows move, Escape skips. Focus starts inside the dialog.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft')  setStep(s => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function go(to) {
    onClose();
    navigate(to);
  }

  const Icon = current.icon;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-title"
        className="relative w-full sm:max-w-md bg-[var(--bg-secondary)] rounded-t-3xl sm:rounded-2xl
                   border border-[var(--border)] animate-slide-up z-10 outline-none
                   px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">

        <div className="flex items-center justify-between mb-5">
          <p className="text-xs text-[var(--text-muted)]">{step + 1} of {STEPS.length}</p>
          {!isLast && (
            <button type="button" onClick={onClose}
              className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Skip tour <X size={14} />
            </button>
          )}
        </div>

        {/* key restarts the arrive animation on every step */}
        <div key={step} className="aura-arrive min-h-[17rem]">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-white"
            style={{ backgroundImage: 'linear-gradient(135deg, var(--brand-1), var(--brand-3))' }}>
            <Icon size={26} />
          </div>
          <p className="aura-kicker text-[10px] font-bold uppercase tracking-[0.18em] mb-1">{current.kicker}</p>
          <h2 id="tour-title" className="font-heading text-2xl font-semibold text-[var(--text-primary)] mb-3">
            {current.title}
          </h2>

          {current.body && <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{current.body}</p>}

          {current.points && (
            <ul className="flex flex-col gap-3">
              {current.points.map(({ icon: PointIcon, text }) => (
                <li key={text} className="flex gap-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                  <span className="mt-0.5 w-7 h-7 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                    <PointIcon size={15} />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          )}

          {current.actions && (
            <div className="flex flex-col gap-2 mt-5">
              {current.actions.map(({ to, label }) => (
                <button key={to} type="button" onClick={() => go(to)} className="btn-secondary text-sm py-2.5">
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress dots double as shortcuts */}
        <div className="flex justify-center gap-1.5 my-5" role="tablist" aria-label="Tour steps">
          {STEPS.map((s, i) => (
            <button key={s.title} type="button" role="tab" aria-selected={i === step} aria-label={`Step ${i + 1}: ${s.title}`}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-[var(--accent)]' : 'w-1.5 bg-[var(--border)]'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} className="btn-secondary flex items-center justify-center gap-1 px-4 py-2.5 text-sm">
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <button type="button" onClick={isLast ? onClose : () => setStep(s => s + 1)}
            className="btn-primary flex-1 flex items-center justify-center gap-1 py-2.5 text-sm">
            {isLast ? 'Start exploring' : step === 0 ? 'Show me around' : 'Next'}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
