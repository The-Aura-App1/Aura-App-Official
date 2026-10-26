import React from 'react';
import { Link } from 'react-router-dom';
import {
  Hourglass, Bot, EyeOff, Gift, Heart, ThumbsDown, TrendingUp,
  SlidersHorizontal, Smartphone, Ban, Megaphone, Scale, Wallet, ArrowRight, ChevronDown,
} from 'lucide-react';
import AuthBackdrop, { SiteHeader } from '../components/auth/AuthBackdrop';

const PROBLEMS = [
  {
    icon: Hourglass,
    title: 'Your attention is the product',
    body: 'Most feeds rank posts by how long they hold you, and give you little say in what you actually want to see. Say you stop on a post made to cause an uproar (rage bait). You stare in disbelief, maybe leave a comment saying why it\'s wrong. The algorithm reads that as interest, and pushes more posts exactly like it to the top of your feed.',
  },
  {
    icon: Bot,
    title: 'Low-effort AI content everywhere',
    body: 'Feeds are filling up with mass-produced AI content, even though few people actually like it. Many of us, especially in Gen Z, would much rather see authentic work made by real people. As AI spreads through content creation, it gets harder and harder to avoid.',
  },
  {
    icon: EyeOff,
    title: 'Your data pays the bill',
    body: 'Platforms profile you so they can serve ads based on everything your algorithm learns about you. Nobody really knows how far that data goes, and data profiling is becoming more and more of a threat to our civil liberties.',
  },
];

const STEPS = [
  {
    icon: Gift,
    title: 'Get free aura every day',
    body: 'Every account gets a fresh batch of aura daily. It\'s free, and you\'ll never be asked to pay for it.',
  },
  {
    icon: Heart,
    title: 'Give it to what you love',
    body: 'Your friend posted something great? Give them some aura. It\'s like investing in someone\'s content: it tells them, and everyone else, that it\'s worth seeing.',
  },
  {
    icon: ThumbsDown,
    title: 'Skip or take from what you don\'t',
    body: 'Low-effort rage bait? Just scroll past and it gets nothing from you. If you really don\'t like it, you can take aura away from the poster as a disincentive. Taking is capped, so nobody can be piled on.',
  },
  {
    icon: TrendingUp,
    title: 'Great posts rise',
    body: 'Posts climb based on the aura people choose to give them, not on how long anyone stared at them. A post people only react to in disbelief earns nothing.',
  },
];

const PROMISES = [
  {
    icon: SlidersHorizontal,
    title: 'Your feed, your choice',
    points: [
      'You tune your feed with topics, keywords and "Show more/less like this". That\'s it.',
      'We never use your clicks, views, watch time or likes to rank your feed.',
    ],
  },
  {
    icon: Smartphone,
    title: 'Your preferences stay with you',
    points: [
      'Your feed settings are saved on your device and never sent to our servers.',
      'Even keyword matching runs right on your device.',
    ],
  },
  {
    icon: Megaphone,
    title: 'Ads that respect you',
    points: [
      'Ads are never personalized or targeted using your activity.',
      'At most 1 ad per 10 posts, clearly labeled "Sponsored", and nothing autoplays.',
      'Premium members get an ad-free feed.',
    ],
  },
  {
    icon: Scale,
    title: 'Fair by design',
    points: [
      'Daily limits on giving and taking aura are enforced on our servers, not just in the app.',
      'Gifts from brand-new accounts can\'t be cashed out, and there\'s a daily cap on how much earned aura one account can send you.',
      'Cash-outs will need a verified creator account (18+) and support from many different people.',
    ],
  },
];

const FAQS = [
  {
    q: 'Is Aura free?',
    a: 'Yes. Signing up, posting, and giving and receiving aura are all free. Aura Premium is optional.',
  },
  {
    q: 'Can I buy aura?',
    a: 'No, never. Aura can only be earned, so the only way to get ahead is to make things people genuinely value. Real money only buys Premium and cosmetics, never aura.',
  },
  {
    q: 'When can creators cash out?',
    a: 'Cash-outs are coming later. When they launch, top creators with a verified creator account (18+) will be able to cash out the aura they\'ve earned from other people for real money. Your daily free aura and anything you take from others can\'t be cashed out.',
  },
  {
    q: 'How does Aura make money?',
    a: 'From Aura Premium ($4.99/month: ad-free, customizable posts and higher daily limits), optional cosmetics, and non-personalized ads. Not from your data.',
  },
  {
    q: 'Who can join?',
    a: 'Anyone 13 or older.',
  },
  {
    q: 'Is there a phone app?',
    a: 'Aura works in your browser today, and iOS and Android apps are on the way.',
  },
];

function SectionHeading({ kicker, title, children }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <p className="font-hand text-2xl sm:text-3xl font-bold text-fuchsia-600">{kicker}</p>
      <h2 className="aura-heading mt-1 text-4xl sm:text-6xl">{title}</h2>
      {children && <p className="mt-5 text-base sm:text-lg text-aura-800/80 leading-relaxed">{children}</p>}
    </div>
  );
}

function IconBadge({ icon: Icon }) {
  return (
    <div className="w-11 h-11 rounded-2xl bg-aura-100 border border-white flex items-center justify-center shrink-0">
      <Icon size={20} className="text-aura-600" />
    </div>
  );
}

export default function About() {
  return (
    <AuthBackdrop>
      <SiteHeader />

      <main className="flex-1 px-5 pb-28 sm:pb-40">
        {/* Hero */}
        <section className="aura-rise max-w-3xl mx-auto text-center pt-10 sm:pt-16">
          <p className="font-hand text-3xl sm:text-4xl font-bold text-fuchsia-600">Why we built Aura</p>
          <h1 className="aura-heading mt-3 text-5xl sm:text-7xl leading-[1.05]">
            Social media that works for you, not the other way around.
          </h1>
          <p className="mt-7 text-base sm:text-lg text-aura-800/80 leading-relaxed max-w-2xl mx-auto">
            Most platforms are built to keep you scrolling, because your time and your data are what
            they sell. Aura is built on a different idea: you decide what's worth seeing, and you
            reward the people who make it.
          </p>
        </section>

        {/* The problem */}
        <section className="mt-28 sm:mt-36 max-w-6xl mx-auto">
          <SectionHeading kicker="the problem" title="What's broken with social media" />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PROBLEMS.map(p => (
              <article key={p.title} className="aura-glass-card !p-7 text-left">
                <IconBadge icon={p.icon} />
                <h3 className="mt-5 text-xl font-bold text-aura-950">{p.title}</h3>
                <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-aura-800/80">{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* The fix */}
        <section className="mt-28 sm:mt-36 max-w-5xl mx-auto">
          <SectionHeading kicker="our answer" title="Meet aura">
            Instead of treating your time as the currency, Aura uses one you control: aura points, or
            just "aura". Think of it as a free market for content, where everyone's vote actually counts.
          </SectionHeading>
          <ol className="mt-12 grid gap-5 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="aura-glass-card !p-7 flex gap-5 text-left">
                <div className="flex flex-col items-center gap-2">
                  <IconBadge icon={s.icon} />
                  <span className="font-hand text-2xl font-bold text-aura-400">{i + 1}</span>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-aura-950">{s.title}</h3>
                  <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-aura-800/80">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-3xl p-7 sm:p-9 text-center text-white"
            style={{ background: 'linear-gradient(120deg, #5b21b6, #7c3aed 55%, #a21caf)', boxShadow: '0 24px 60px -24px rgba(91, 33, 182, 0.6)' }}>
            <div className="flex justify-center gap-3">
              <Ban size={22} className="text-aura-200" />
              <Wallet size={22} className="text-aura-200" />
            </div>
            <p className="mt-4 font-hand text-3xl sm:text-4xl font-bold">Aura can never be bought. Only earned.</p>
            <p className="mt-3 max-w-2xl mx-auto text-aura-100 leading-relaxed">
              There's no way to pay to win. The only way to get ahead is to make things people
              genuinely value, and later on, top creators will be able to cash out the aura they
              earn for real money.
            </p>
          </div>
        </section>

        {/* Promises */}
        <section className="mt-28 sm:mt-36 max-w-5xl mx-auto">
          <SectionHeading kicker="our promises" title="Built around you">
            We're in the business of building a social media platform, not harvesting your data.
          </SectionHeading>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {PROMISES.map(p => (
              <article key={p.title} className="aura-glass-card !p-7 text-left">
                <div className="flex items-center gap-4">
                  <IconBadge icon={p.icon} />
                  <h3 className="text-lg sm:text-xl font-bold text-aura-950">{p.title}</h3>
                </div>
                <ul className="mt-5 space-y-3">
                  {p.points.map(point => (
                    <li key={point} className="flex gap-3 text-sm sm:text-[15px] leading-relaxed text-aura-800/80">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-fuchsia-500 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-28 sm:mt-36 max-w-3xl mx-auto">
          <SectionHeading kicker="good questions" title="FAQ" />
          <div className="mt-12 space-y-3">
            {FAQS.map(f => (
              <details key={f.q} className="aura-faq group rounded-2xl bg-white/60 border border-white backdrop-blur-md">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-6 py-4 font-semibold text-aura-950">
                  {f.q}
                  <ChevronDown size={18} className="text-aura-400 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-6 pb-5 -mt-1 text-sm sm:text-[15px] leading-relaxed text-aura-800/80">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Founder note */}
        <section className="mt-28 sm:mt-36 max-w-2xl mx-auto">
          <figure className="aura-glass-card !p-8 sm:!p-10 text-center">
            <p className="font-hand text-2xl sm:text-3xl font-bold text-fuchsia-600">a note from the founder</p>
            <blockquote className="mt-4 font-hand text-2xl sm:text-3xl leading-snug text-aura-950">
              "Social media should be about the people on it. I want a feed where your time isn't the
              product, real creators get rewarded, and nobody is harvesting your data to keep you
              hooked. That's what Aura is for."
            </blockquote>
            <figcaption className="mt-5 text-sm text-aura-800/70">Founder of Aura</figcaption>
          </figure>
        </section>

        {/* Call to action */}
        <section className="mt-28 sm:mt-36 text-center">
          <h2 className="aura-heading text-4xl sm:text-6xl">Ready for a feed that answers to you?</h2>
          <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 max-w-xs sm:max-w-none mx-auto">
            <Link to="/signup" className="aura-cta">
              Create account <ArrowRight size={18} />
            </Link>
            <Link to="/signin" className="aura-glass-btn">
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative px-5 py-8 text-center text-xs text-aura-800/60">
        © {new Date().getFullYear()} Aura App
      </footer>
    </AuthBackdrop>
  );
}
