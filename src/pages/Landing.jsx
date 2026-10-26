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
          <Link to="/about" className="px-3 py-2 rounded-xl text-aura-200 hover:text-white transition-colors">About</Link>
          <Link to="/signin" className="px-3 py-2 rounded-xl text-aura-200 hover:text-white transition-colors">Sign in</Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-5 pb-16">
        <div className="aura-rise relative w-40 sm:w-56 -mb-4 sm:-mb-8" aria-hidden="true">
          <div className="absolute inset-[18%] rounded-full bg-aura-500/40 blur-3xl" />
          <img src="/aura-halo.png" alt="" className="aura-float relative w-full" />
        </div>

        <h1 className="aura-rise" style={{ animationDelay: '0.1s' }}>
          <Wordmark />
        </h1>

        <p className="aura-rise mt-6 sm:mt-8 max-w-2xl font-display text-xl sm:text-3xl font-semibold leading-snug text-white"
          style={{ animationDelay: '0.25s' }}>
          A consumer-centered approach to social media.
        </p>
        <p className="aura-rise mt-4 max-w-lg text-sm sm:text-base text-aura-200/80 leading-relaxed"
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
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm text-aura-100 bg-white/5 border border-white/10 backdrop-blur">
              <Icon size={15} className="text-aura-300" />
              {text}
            </li>
          ))}
        </ul>

        <Link to="/about"
          className="aura-rise mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-aura-300 hover:text-white transition-colors"
          style={{ animationDelay: '0.65s' }}>
          What is Aura? <ArrowRight size={15} />
        </Link>
      </main>

      <footer className="px-5 py-6 text-center text-xs text-aura-200/50">
        © {new Date().getFullYear()} Aura App
      </footer>
    </AuthBackdrop>
  );
}
