import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, ShieldCheck, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import AuthBackdrop, { SiteHeader, Wordmark } from '../components/auth/AuthBackdrop';

const HIGHLIGHTS = [
  {
    icon: SlidersHorizontal,
    title: 'Your feed, your rules',
    body: 'Pick topics and keywords, or tap "Show more/less like this". Your feed is ranked only on what you tell it, never on what you click, view or like.',
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

// A pill that opens into a short explanation on hover, or on tap/keyboard
// for devices without hover.
function Highlight({ icon: Icon, title, body, open, onToggle }) {
  return (
    <li className={`aura-highlight ${open ? 'is-open' : ''}`}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aura-800 dark:text-aura-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-500 rounded-2xl">
        <Icon size={16} className="text-aura-500 shrink-0" />
        {title}
        <ChevronDown size={15} className="aura-highlight-chevron text-aura-400 shrink-0" />
      </button>
      <div className="aura-highlight-body">
        <p className="overflow-hidden px-5 text-sm leading-relaxed text-aura-800/80 dark:text-aura-100/80">
          <span className="block pb-4">{body}</span>
        </p>
      </div>
    </li>
  );
}

export default function Landing() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <AuthBackdrop className="aura-glow-on-halo">
      <SiteHeader />

      <main className="flex-1 flex flex-col items-center text-center px-5 pt-6 pb-28 sm:pb-36">
        <div className="aura-rise relative w-36 sm:w-48 mb-2" aria-hidden="true">
          <img src="/aura-halo.png" alt="" className="aura-float aura-halo-glow relative w-full" />
        </div>

        <h1 className="aura-rise" style={{ animationDelay: '0.1s' }}>
          <Wordmark />
        </h1>

        <p className="aura-rise mt-10 sm:mt-12 max-w-3xl font-hand text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-aura-950 dark:text-white"
          style={{ animationDelay: '0.25s' }}>
          A{' '}
          <span className="relative inline-block">
            consumer-centered
            {/* Hand-drawn underline */}
            <svg className="absolute left-0 -bottom-2 w-full h-4 text-fuchsia-500" viewBox="0 0 300 16"
              preserveAspectRatio="none" fill="none" aria-hidden="true">
              <path className="aura-scribble" d="M3 11c38-6 84-9 135-8 52 1 104 3 159 0M18 14c56-4 128-6 210-3"
                stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>{' '}
          approach to social media.
        </p>
        <p className="aura-rise mt-7 max-w-lg text-base sm:text-lg text-aura-800/80 dark:text-aura-100/80 leading-relaxed"
          style={{ animationDelay: '0.35s' }}>
          Your feed follows the choices you make, not what you click on.
          Give aura to the posts you love and earn it on the ones you make.
        </p>

        <div className="aura-rise mt-12 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full max-w-xs sm:max-w-none sm:w-auto"
          style={{ animationDelay: '0.45s' }}>
          <Link to="/signup" className="aura-cta">
            Create account <ArrowRight size={18} />
          </Link>
          <Link to="/signin" className="aura-glass-btn">
            Sign in
          </Link>
        </div>

        {/* The min-height leaves room for one open highlight, so opening one
            never changes the page height or shifts anything around it. */}
        <div className="mt-16 w-full max-w-sm md:max-w-5xl min-h-[19rem] md:min-h-[11rem]">
          <ul className="aura-rise grid grid-cols-1 md:grid-cols-3 items-start gap-4"
            style={{ animationDelay: '0.55s' }}>
            {HIGHLIGHTS.map((h, i) => (
              <Highlight key={h.title} {...h} open={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)} />
            ))}
          </ul>
        </div>

        <Link to="/about"
          className="aura-rise mt-6 inline-flex items-center gap-1.5 font-hand text-2xl font-bold text-aura-700 dark:text-aura-300 hover:text-aura-500 transition-colors"
          style={{ animationDelay: '0.65s' }}>
          What is Aura? <ArrowRight size={18} />
        </Link>
      </main>

      <footer className="relative px-5 py-8 text-center text-xs text-aura-800/60 dark:text-aura-200/60">
        © {new Date().getFullYear()} Aura App
      </footer>
    </AuthBackdrop>
  );
}
