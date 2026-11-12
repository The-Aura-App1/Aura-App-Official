import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, ShieldCheck, Sparkles, ArrowRight, ChevronDown, Heart, MessageCircle, Lightbulb, Star } from 'lucide-react';
import { api } from '../api';
import Avatar from '../components/common/Avatar';
import Stars from '../components/common/Stars';
import AuthBackdrop, { SiteHeader, Wordmark } from '../components/auth/AuthBackdrop';

const FEATURES = [
  {
    icon: SlidersHorizontal,
    title: 'Your feed, your rules',
    body: 'Pick topics and keywords, or tap "Show more/less like this". Your feed also learns from the aura you give and the posts you like, right on your device. It never uses what you click on or how long you look.',
  },
  {
    icon: ShieldCheck,
    title: 'Preferences stay on your device',
    body: 'Your feed settings are saved in your browser and never sent to our servers. Even keyword matching runs right on your device.',
  },
  {
    icon: Sparkles,
    title: 'Get rewarded for what you share',
    body: 'When people give aura to your posts, you earn it, and your best work rises to the top for everyone.',
  },
];

// ── Illustrative previews of the app ─────────────────────────────────
// Made-up example content, drawn in CSS, so visitors can see what Aura looks
// like before signing up. Hidden from screen readers: the features below say
// the same thing in words.

function PreviewPost({ className = '', style }) {
  return (
    <div className={`aura-preview w-64 ${className}`} style={style} aria-hidden="true">
      <div className="aura-preview-float aura-glass-card !p-3.5 text-left">
        <div className="flex items-center gap-2.5">
          <span className="aura-avatar w-8 h-8 rounded-full shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight text-aura-950 dark:text-white">Ava Lin</p>
            <p className="text-[11px] text-aura-800/60 dark:text-aura-100/60">@skyline_ava · 2h</p>
          </div>
        </div>
        <p className="mt-2.5 text-[13px] leading-snug text-aura-900 dark:text-aura-50">
          First light over the ridge this morning.
        </p>
        <div className="aura-preview-photo mt-2.5 h-28 rounded-xl overflow-hidden relative">
          <svg className="absolute inset-x-0 bottom-0 w-full h-12" viewBox="0 0 200 40" preserveAspectRatio="none">
            <path d="M0 40 L0 26 L28 12 L46 22 L72 6 L98 24 L124 14 L150 26 L176 10 L200 22 L200 40Z" fill="rgba(46, 24, 84, 0.55)" />
            <path d="M0 40 L0 32 L40 22 L70 32 L110 20 L150 32 L200 26 L200 40Z" fill="rgba(30, 14, 60, 0.7)" />
          </svg>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="aura-chip inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white">
            <Sparkles size={12} /> 1,284 aura
          </span>
          <span className="flex items-center gap-3 text-aura-800/60 dark:text-aura-100/60">
            <Heart size={14} /> <MessageCircle size={14} />
          </span>
        </div>
      </div>
      {/* Aura arriving on the post, now and then */}
      <span className="aura-plus absolute -top-3 right-4 rounded-full px-2.5 py-1 text-[11px] font-bold text-white aura-chip">
        +50 aura
      </span>
    </div>
  );
}

function PreviewTune({ className = '', style }) {
  const chip = 'rounded-full px-2.5 py-1 text-[11px] font-medium';
  return (
    <div className={`aura-preview w-64 ${className}`} style={style} aria-hidden="true">
      <div className="aura-preview-float aura-glass-card !p-4 text-left" style={{ animationDelay: '-3s' }}>
        <p className="aura-kicker text-[10px] font-bold uppercase tracking-[0.18em]">Tune your feed</p>
        <p className="mt-3 text-[11px] font-semibold text-aura-800/70 dark:text-aura-100/70">More like</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {['Photography', 'Space', 'Hiking'].map(t => (
            <span key={t} className={`${chip} bg-aura-500/15 text-aura-700 dark:text-aura-100 border border-aura-500/25`}>{t}</span>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-semibold text-aura-800/70 dark:text-aura-100/70">Less like</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={`${chip} bg-aura-950/5 dark:bg-white/5 text-aura-800/70 dark:text-aura-100/60 border border-aura-800/10 dark:border-white/10 line-through decoration-aura-500/60`}>Drama</span>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/50 dark:bg-white/5 px-3 py-2">
          <span className="text-[11px] font-medium text-aura-900 dark:text-aura-50">Learn on this device</span>
          <span className="aura-toggle" />
        </div>
      </div>
    </div>
  );
}

// Reviews from real members (moderator-approved), plus ways to add your own
// or suggest a feature once signed in.
function Community() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    api.getPublicReviews().then(d => { if (live) setData(d); }).catch(() => { if (live) setData({ reviews: [], count: 0 }); });
    return () => { live = false; };
  }, []);
  const reviews = data?.reviews ?? [];

  return (
    <section id="reviews" className="scroll-mt-6 px-5 sm:px-10 pb-16 sm:pb-24">
      <div className="mx-auto max-w-6xl">
        <p className="aura-kicker text-center text-xs font-bold uppercase tracking-[0.22em]">From the community</p>
        <h2 className="aura-heading mt-3 text-center text-3xl sm:text-5xl leading-tight">
          What people are <span className="aura-em">saying</span>.
        </h2>
        {data?.count > 0 && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-aura-800/80 dark:text-aura-100/80">
            <Stars value={data.average} size={16} /> {data.average} out of 5 from {data.count} review{data.count === 1 ? '' : 's'}
          </p>
        )}

        {reviews.length > 0 ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 6).map(review => (
              <li key={`${review.authorUsername}-${review.createdAt}`} className="aura-glass-card aura-lift text-left">
                <Stars value={review.rating} size={15} />
                {review.text && (
                  <p className="mt-3 text-sm leading-relaxed text-aura-900 dark:text-aura-50 whitespace-pre-wrap break-words line-clamp-6">
                    {review.text}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2.5">
                  <Avatar name={review.authorDisplay} picKey={review.authorPicKey} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-aura-950 dark:text-white truncate">{review.authorDisplay}</p>
                    {review.authorUsername && <p className="text-xs text-aura-800/60 dark:text-aura-100/60 truncate">@{review.authorUsername}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : data && (
          <p className="mt-6 text-center text-sm text-aura-800/70 dark:text-aura-100/70">
            Aura is brand new. Be one of the first to leave a review.
          </p>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-xs sm:max-w-none mx-auto">
          <Link to="/signin" className="aura-glass-btn">
            <Star size={16} /> Write a review
          </Link>
          <Link to="/signin" className="aura-glass-btn">
            <Lightbulb size={16} /> Suggest a feature
          </Link>
        </div>
        <p className="mt-3 text-center text-xs text-aura-800/60 dark:text-aura-100/60">
          Sign in to share yours. Reviews appear here after a quick check by our team.
        </p>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <AuthBackdrop className="aura-glow-on-halo">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero: fills the first screen */}
        <section className="aura-hero flex flex-col items-center text-center px-5">
          <div className="aura-rise relative w-36 sm:w-[min(12rem,22vh)] -mb-2 sm:-mb-6" aria-hidden="true">
            <span className="aura-halo-aura" />
            <img src="/aura-halo.png" alt="" className="aura-float aura-halo-glow relative w-full" />
          </div>

          <h1 className="aura-rise" style={{ animationDelay: '0.1s' }}>
            <Wordmark />
          </h1>

          <p className="aura-rise mt-6 sm:mt-8 max-w-4xl font-heading text-[1.8rem] min-[400px]:text-3xl sm:text-5xl md:text-[min(3.75rem,7.5vh)] font-semibold leading-tight tracking-tight text-aura-950 dark:text-white"
            style={{ animationDelay: '0.25s' }}>
            A{' '}
            <span className="relative inline-block">
              <span className="aura-em">consumer-centered</span>
              {/* Hand-drawn underline */}
              <svg className="absolute left-0 -bottom-2 w-full h-4" style={{ color: 'var(--brand-3)' }} viewBox="0 0 300 16"
                preserveAspectRatio="none" fill="none" aria-hidden="true">
                <path className="aura-scribble" d="M3 11c38-6 84-9 135-8 52 1 104 3 159 0M18 14c56-4 128-6 210-3"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>{' '}
            approach to social media.
          </p>

          {/* On wide screens the previews flank the pitch and buttons */}
          <div className="mt-6 sm:mt-8 w-full max-w-7xl grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] items-start gap-x-14">
            <PreviewPost className="hidden xl:block justify-self-end aura-rise mt-2" style={{ animationDelay: '0.7s', rotate: '-4deg' }} />

            <div className="flex flex-col items-center">
              <p className="aura-rise max-w-lg text-base sm:text-lg text-aura-800/80 dark:text-aura-100/80 leading-relaxed"
                style={{ animationDelay: '0.35s' }}>
                Your feed follows the choices you make, not what you click on.
                Give aura to the posts you love and earn it on the ones you make.
              </p>
              <div className="aura-rise mt-9 sm:mt-11 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full max-w-xs sm:max-w-none sm:w-auto"
                style={{ animationDelay: '0.45s' }}>
                <Link to="/signup" className="aura-cta">
                  Create account <ArrowRight size={18} />
                </Link>
                <Link to="/signin" className="aura-glass-btn">
                  Sign in
                </Link>
              </div>
            </div>

            <PreviewTune className="hidden xl:block justify-self-start aura-rise mt-12" style={{ animationDelay: '0.85s', rotate: '3deg' }} />
          </div>

          <a href="#features" className="aura-rise mt-auto pt-12 pb-6 flex flex-col items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-aura-800/60 dark:text-aura-100/60 hover:text-aura-500 transition-colors"
            style={{ animationDelay: '0.9s' }}>
            Explore
            <ChevronDown size={18} className="aura-cue" />
          </a>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-6 px-5 sm:px-10 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="aura-kicker text-center text-xs font-bold uppercase tracking-[0.22em]">Why Aura</p>
            <h2 className="aura-heading mt-3 text-center text-3xl sm:text-5xl leading-tight">
              Social media that answers <span className="aura-em">to you</span>.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-center text-base sm:text-lg leading-relaxed text-aura-800/80 dark:text-aura-100/80">
              No hidden engagement tricks. You decide what you see, and the people who make great things get rewarded for it.
            </p>

            {/* Below xl the previews live here instead of beside the hero */}
            <div className="xl:hidden mt-12 flex flex-col sm:flex-row items-center sm:items-start justify-center gap-8 sm:gap-6">
              <PreviewPost style={{ rotate: '-2deg' }} />
              <PreviewTune className="sm:mt-10" style={{ rotate: '2deg' }} />
            </div>

            <ul className="mt-14 sm:mt-16 grid gap-5 md:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="aura-glass-card aura-lift text-left">
                  <span className="aura-icon-tile w-11 h-11 rounded-xl flex items-center justify-center text-white">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-aura-950 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-aura-800/80 dark:text-aura-100/80">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Community />

        {/* Closing call to action */}
        <section className="px-5 sm:px-10 pb-16 sm:pb-24">
          <div className="aura-glass-card mx-auto max-w-5xl sm:!p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div>
              <h2 className="aura-heading text-2xl sm:text-4xl leading-tight">Step into a calmer feed.</h2>
              <p className="mt-3 max-w-md text-sm sm:text-base leading-relaxed text-aura-800/80 dark:text-aura-100/80">
                Free to join. Your feed preferences never leave your device.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto shrink-0">
              <Link to="/signup" className="aura-cta">
                Create account <ArrowRight size={18} />
              </Link>
              <Link to="/about" className="aura-glass-btn">
                What is Aura?
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative px-5 sm:px-10 py-8 border-t border-white/50 dark:border-white/10">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/aura-logo.png" alt="" className="w-7 h-7 rounded-lg" />
            <span className="text-xs text-aura-800/70 dark:text-aura-200/70">© {new Date().getFullYear()} Aura App</span>
          </div>
          <nav className="flex items-center gap-5 text-sm font-medium text-aura-800 dark:text-aura-100">
            <Link to="/about" className="hover:text-aura-500 transition-colors">About</Link>
            <a href="#reviews" className="hover:text-aura-500 transition-colors">Reviews</a>
            <Link to="/signin" className="hover:text-aura-500 transition-colors">Sign in</Link>
            <Link to="/signup" className="hover:text-aura-500 transition-colors">Create account</Link>
          </nav>
        </div>
      </footer>
    </AuthBackdrop>
  );
}
