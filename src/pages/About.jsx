import React from 'react';
import { Link } from 'react-router-dom';
import {
  Hourglass, Bot, EyeOff, Gift, Heart, ThumbsDown, TrendingUp,
  SlidersHorizontal, Ban, Wallet, ArrowRight, ChevronDown, Map,
  ShieldCheck, PartyPopper, Users, Gamepad2, Sparkles, Search, UserCheck, Flag, Palette, Brush,
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
    title: 'Skip it, or take if you mean it',
    body: 'Low-effort rage bait? Just scroll past and it gets nothing from you. If you really mean it, you can take aura away, but taking costs you the same amount and nobody profits from it. Authors can turn taking off for any post, and groups can turn it off entirely.',
  },
  {
    icon: TrendingUp,
    title: 'Great posts rise',
    body: 'Posts climb based on the aura people choose to give them, not on how long anyone stared at them. A post people only react to in disbelief earns nothing.',
  },
];

// The three things Aura puts first (the company's goal framework), each with
// the promises that belong to it. Every line here must be true of the live app.
const PROMISES = [
  {
    icon: SlidersHorizontal,
    title: 'Giving users their power back',
    points: [
      'You tune your feed with topics, keywords and "Show more/less like this", and it learns from the aura you give and take and the posts you like.',
      'We never use your clicks, views or watch time to rank your feed. Posts rise on the aura people choose to give them.',
      'Taking aura costs the taker the same amount, so piling on someone never pays off. Authors choose whether each post can be taken from, and groups can be take-free safe spaces.',
      'Daily limits on giving and taking aura are enforced on our servers, not just in the app.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Privacy and security',
    points: [
      'Your feed settings, and everything your feed learns about what you like, stay on your device and are never sent to our servers. You can turn learning off or reset it in Settings.',
      'Angel, our helper, runs on your device too. What you tell her stays there, and she only asks our servers to do things you say yes to.',
      'Make your account private, block anyone, and report posts, comments or accounts for our moderators to review.',
      "Ads are never personalized: at most 1 in 10 posts, clearly labeled \"Sponsored\", nothing autoplays, and they come from Google's cookie-free Limited Ads mode, knowing only the topic of the post above them. Google's ad script does see your IP address, as any website you load does. Premium members see none.",
    ],
  },
  {
    icon: PartyPopper,
    title: 'Bringing fun back to social media',
    points: [
      'Challenge friends in your groups to chess, pool, mini golf, poker and more, for fun or for a small aura stake that is never real money.',
      'Groups level up as members give aura, unlocking their own picture, reaction pins and backgrounds.',
      'Make your corner of Aura yours: moving dreamscape themes, fonts, backgrounds and frames for your posts, and any emoji as a reaction.',
    ],
  },
];

// What's live in Aura today (only finished, deployed features)
const TODAY = [
  { icon: Users, title: 'Groups that grow', body: 'Start or join a group, post and comment with members, and watch it level up as people give aura. Higher levels unlock the group\'s own picture, reaction pins and backgrounds.' },
  { icon: Gamepad2, title: 'Games for aura', body: 'Challenge members to chess, pool, mini golf, poker and more, or play a bot just for fun. Stakes are aura, never money, and they\'re held fairly until the game ends.' },
  { icon: Sparkles, title: 'Angel, your helper', body: 'Ask Angel to find a post you half remember, tune your feed, make you a theme or answer questions. She runs on your device and acts only after you say yes.' },
  { icon: Search, title: 'Search', body: 'Find people, groups and posts by words, hashtags or even meaning. Posts are matched right on your device.' },
  { icon: UserCheck, title: 'Follow, privately if you like', body: 'Follow the people you want to keep up with. Make your account private and only the followers you approve see your posts.' },
  { icon: Flag, title: 'Block and report', body: 'Block anyone and you stop seeing each other. Report posts, comments or accounts, and our moderators review them.' },
  { icon: Palette, title: 'Themes that move', body: 'Pick from animated dreamscapes like Northern Lights, Abyss or City Skies, or design your own with Premium\'s Theme Studio.' },
  { icon: Brush, title: 'Posts your way', body: 'Fonts, colors, backgrounds and frames for your posts, text and links placed right on your photos, and any emoji as a reaction.' },
];

const ROADMAP = [
  {
    when: 'Next up',
    items: [
      'Buying Aura Premium (ad-free, more aura each day, Theme Studio and more). The first 100 accounts already have it free.',
      'Moments: group-only photos that disappear after 24 hours',
    ],
  },
  {
    when: 'Soon',
    items: [
      'iOS and Android apps',
      'Badges, and a global aura rank you can hide',
    ],
  },
  {
    when: 'Later',
    items: [
      'Creator payouts, once the payment and money-transmission rules are sorted out',
      'Direct messages',
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
    a: 'No, never. Aura can only be earned, so the only way to get ahead is to make things people genuinely value. When Premium goes on sale, money will buy Premium and cosmetics, never aura.',
  },
  {
    q: 'Can I turn aura into money?',
    a: 'Not today. Aura has no cash value. Creator payouts are on our roadmap, but paying people real money comes with payment and money-transmission rules we want to get right before we offer it.',
  },
  {
    q: 'How does Aura make money?',
    a: 'Today, from non-personalized ads. Next, from Aura Premium ($4.99 a month: ad-free, more daily aura, Theme Studio and more) and optional cosmetics. Never from your data.',
  },
  {
    q: 'What is Angel?',
    a: 'Aura\'s built-in helper. She runs entirely on your device: what you tell her stays there, and she only asks Aura\'s servers to do things you\'ve said yes to.',
  },
  {
    q: 'Who can see my posts if my account is private?',
    a: 'Only the followers you approve. Everyone else sees your name and picture, not your posts.',
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
      <p className="aura-kicker text-xs sm:text-sm font-semibold uppercase tracking-[0.2em]">{kicker}</p>
      <h2 className="aura-heading mt-3 text-4xl sm:text-6xl">{title}</h2>
      {children && <p className="mt-5 text-base sm:text-lg text-aura-800/80 dark:text-aura-100/80 leading-relaxed">{children}</p>}
    </div>
  );
}

function IconBadge({ icon: Icon }) {
  return (
    <div className="w-11 h-11 rounded-xl bg-aura-100 dark:bg-aura-500/15 border border-white dark:border-white/10 flex items-center justify-center shrink-0">
      <Icon size={20} className="text-aura-600 dark:text-aura-300" />
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
          <p className="aura-kicker text-xs sm:text-sm font-semibold uppercase tracking-[0.2em]">Why we built Aura</p>
          <h1 className="aura-heading mt-3 text-5xl sm:text-7xl leading-[1.05]">
            Social media that works for <em className="aura-em">you</em>, not the other way around.
          </h1>
          <p className="mt-7 text-base sm:text-lg text-aura-800/80 dark:text-aura-100/80 leading-relaxed max-w-2xl mx-auto">
            Most platforms are built to keep you scrolling, because your time and your data are what
            they sell. Aura is built on a different idea: you decide what's worth seeing, and you
            reward the people who make it.
          </p>
        </section>

        {/* The problem */}
        <section className="mt-28 sm:mt-36 max-w-6xl mx-auto">
          <SectionHeading kicker="the problem" title={<>What's <em className="aura-em">broken</em> with social media</>} />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PROBLEMS.map(p => (
              <article key={p.title} className="aura-glass-card !p-7 text-left">
                <IconBadge icon={p.icon} />
                <h3 className="mt-5 text-xl font-bold text-aura-950 dark:text-white">{p.title}</h3>
                <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-aura-800/80 dark:text-aura-100/80">{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* The fix */}
        <section className="mt-28 sm:mt-36 max-w-5xl mx-auto">
          <SectionHeading kicker="our answer" title={<>Meet <em className="aura-em">aura</em></>}>
            Instead of treating your time as the currency, Aura uses one you control: aura points, or
            just "aura". Think of it as a free market for content, where everyone's vote actually counts.
          </SectionHeading>
          <ol className="mt-12 grid gap-5 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="aura-glass-card !p-7 flex gap-5 text-left">
                <div className="flex flex-col items-center gap-2">
                  <IconBadge icon={s.icon} />
                  <span className="font-heading text-2xl font-semibold text-aura-400">{i + 1}</span>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-aura-950 dark:text-white">{s.title}</h3>
                  <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-aura-800/80 dark:text-aura-100/80">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl p-7 sm:p-9 text-center text-white"
            style={{ background: 'linear-gradient(120deg, var(--brand-1), var(--brand-2) 55%, var(--brand-3))', boxShadow: '0 24px 60px -24px rgb(var(--aura-600) / 0.6)' }}>
            <div className="flex justify-center gap-3">
              <Ban size={22} className="text-aura-200" />
              <Wallet size={22} className="text-aura-200" />
            </div>
            <p className="mt-4 font-heading text-3xl sm:text-4xl font-semibold">Aura can never be bought. Only earned.</p>
            <p className="mt-3 max-w-2xl mx-auto text-aura-100 leading-relaxed">
              There's no way to pay to win. The only way to get ahead is to make things people
              genuinely value.
            </p>
          </div>
        </section>

        {/* Promises */}
        <section className="mt-28 sm:mt-36 max-w-5xl mx-auto">
          <SectionHeading kicker="what we stand for" title={<>Three things we put <em className="aura-em">first</em></>}>
            Giving you your power back, keeping you private and secure, and bringing the fun back to social media.
            We're in the business of building a social media platform, not harvesting your data.
          </SectionHeading>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PROMISES.map(p => (
              <article key={p.title} className="aura-glass-card !p-7 text-left">
                <div className="flex items-center gap-4">
                  <IconBadge icon={p.icon} />
                  <h3 className="text-lg sm:text-xl font-bold text-aura-950 dark:text-white">{p.title}</h3>
                </div>
                <ul className="mt-5 space-y-3">
                  {p.points.map(point => (
                    <li key={point} className="flex gap-3 text-sm sm:text-[15px] leading-relaxed text-aura-800/80 dark:text-aura-100/80">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-fuchsia-500 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* What's live today */}
        <section className="mt-28 sm:mt-36 max-w-6xl mx-auto">
          <SectionHeading kicker="already here" title={<>What's in <em className="aura-em">aura</em> today</>} />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TODAY.map(t => (
              <article key={t.title} className="aura-glass-card !p-6 text-left">
                <IconBadge icon={t.icon} />
                <h3 className="mt-4 text-lg font-bold text-aura-950 dark:text-white">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-aura-800/80 dark:text-aura-100/80">{t.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section className="mt-28 sm:mt-36 max-w-5xl mx-auto">
          <SectionHeading kicker="what's next" title="Roadmap">
            Aura is early. Here's what we're building, in roughly the order it's coming.
          </SectionHeading>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {ROADMAP.map(stage => (
              <article key={stage.when} className="aura-glass-card !p-7 text-left">
                <div className="flex items-center gap-3">
                  <IconBadge icon={Map} />
                  <h3 className="text-lg sm:text-xl font-bold text-aura-950 dark:text-white">{stage.when}</h3>
                </div>
                <ul className="mt-5 space-y-3">
                  {stage.items.map(item => (
                    <li key={item} className="flex gap-3 text-sm sm:text-[15px] leading-relaxed text-aura-800/80 dark:text-aura-100/80">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-fuchsia-500 shrink-0" />
                      {item}
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
              <details key={f.q} className="aura-faq group rounded-2xl bg-white/60 dark:bg-white/5 border border-white dark:border-white/10 backdrop-blur-md">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-6 py-4 font-semibold text-aura-950 dark:text-white">
                  {f.q}
                  <ChevronDown size={18} className="text-aura-400 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-6 pb-5 -mt-1 text-sm sm:text-[15px] leading-relaxed text-aura-800/80 dark:text-aura-100/80">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Founder note */}
        <section className="mt-28 sm:mt-36 max-w-2xl mx-auto">
          <figure className="aura-glass-card !p-8 sm:!p-10 text-center">
            <p className="aura-kicker text-xs sm:text-sm font-semibold uppercase tracking-[0.2em]">a note from the founder</p>
            <blockquote className="mt-5 font-heading italic text-2xl sm:text-3xl leading-snug text-aura-950 dark:text-white">
              "We're in the business of making a consumer centered social media platform, not a
              cleverly designed data farm."
            </blockquote>
            <figcaption className="mt-5 text-sm text-aura-800/70 dark:text-aura-200/70">Founder of Aura</figcaption>
          </figure>
        </section>

        {/* Call to action */}
        <section className="mt-28 sm:mt-36 text-center">
          <h2 className="aura-heading text-4xl sm:text-6xl">Ready for a feed that answers to <em className="aura-em">you</em>?</h2>
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

      <footer className="relative px-5 py-8 text-center text-xs text-aura-800/60 dark:text-aura-200/60">
        © {new Date().getFullYear()} Aura App
      </footer>
    </AuthBackdrop>
  );
}
