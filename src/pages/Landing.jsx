import React from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import AuthBackdrop, { Wordmark } from '../components/auth/AuthBackdrop';

const HIGHLIGHTS = [
  { icon: SlidersHorizontal, text: 'Your feed, your rules' },
  { icon: ShieldCheck,       text: 'Preferences stay on your device' },
  { icon: Sparkles,          text: 'Get rewarded for what you share' },
];

export default function Landing() {
  return (
    <AuthBackdrop>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5">
        <img src="/aura-logo.png" alt="Aura App" className="w-9 h-9 rounded-xl" />
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          <Link to="/about" className="px-3 py-2 rounded-xl text-aura-800 hover:text-aura-500 font-medium transition-colors">About</Link>
          <Link to="/signin" className="px-3 py-2 rounded-xl text-aura-800 hover:text-aura-500 font-medium transition-colors">Sign in</Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-5 pb-16">
        <div className="aura-rise relative w-40 sm:w-56 -mb-4 sm:-mb-8" aria-hidden="true">
          <img src="/aura-halo.png" alt="" className="aura-float aura-halo-glow relative w-full" />
        </div>

        <h1 className="aura-rise" style={{ animationDelay: '0.1s' }}>
          <Wordmark />
        </h1>

        <p className="aura-rise mt-6 sm:mt-8 max-w-3xl font-hand text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-aura-950"
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
        <p className="aura-rise mt-4 max-w-lg text-sm sm:text-base text-aura-800/80 leading-relaxed"
          style={{ animationDelay: '0.35s' }}>
          Your feed follows the choices you make, not what you click on.
          Give aura to the posts you love and earn it on the ones you make.
        </p>

        <div className="aura-rise mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-xs sm:max-w-none sm:w-auto"
          style={{ animationDelay: '0.45s' }}>
          <Link to="/signup" className="aura-cta">
            Create account <ArrowRight size={18} />
          </Link>
          <Link to="/signin" className="aura-glass-btn">
            Sign in
          </Link>
        </div>

        <ul className="aura-rise mt-10 flex flex-wrap justify-center gap-2 sm:gap-3" style={{ animationDelay: '0.55s' }}>
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text}
              className="aura-pill">
              <Icon size={15} className="text-aura-500" />
              {text}
            </li>
          ))}
        </ul>

        <Link to="/about"
          className="aura-rise mt-8 inline-flex items-center gap-1.5 font-hand text-2xl font-bold text-aura-700 hover:text-aura-500 transition-colors"
          style={{ animationDelay: '0.65s' }}>
          What is Aura? <ArrowRight size={18} />
        </Link>
      </main>

      <footer className="px-5 py-6 text-center text-xs text-aura-800/60">
        © {new Date().getFullYear()} Aura App
      </footer>
    </AuthBackdrop>
  );
}
