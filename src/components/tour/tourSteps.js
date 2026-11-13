// The guided tour: the main points of the app, page by page. Each step points
// at an element tagged data-tour="<target>" (the first visible one, so phone
// and desktop layouts can each tag their own). Keep it short (about 10 steps)
// and keep the wording in line with CLAUDE.md (economy, feed, posting, follows)
// when those rules change.
//
//   route          page the step belongs on; the tour goes there first
//                  ('profile' means the viewer's own profile)
//   target         data-tour value to point at; none = a note in the middle
//   skipIfMissing  quietly skip when the element isn't there (e.g. no posts yet)
//   goTo           a nav step: tapping the highlighted button (or the main
//                  button) moves on once that page opens
//   handsOn        the person does the thing: the page isn't dimmed, the note
//                  shrinks while they type, and the step waits for `waitFor`
//   waitFor        a window event that completes the step (the first post)
//   onlyIfPosted   shown only after the person posted during the tour
export const TOUR_STEPS = [
  {
    id: 'welcome', route: '/',
    title: 'Welcome to Aura',
    body: 'Here’s a quick look at the main things you can do. It takes about a minute, and you can skip any time.',
    next: 'Show me around',
  },
  {
    id: 'aura', route: '/', target: 'post-aura', skipIfMissing: true,
    title: 'Give and take aura',
    body: 'Give sends aura to whoever made a post. Take costs you the same amount and nobody receives it. You get free aura every day.',
  },
  {
    id: 'tune', route: '/', target: 'tune-feed',
    title: 'Steer your feed',
    body: 'Choose topics you want more or less of here, or use ••• on any post. Your feed is ranked on your device, so it stays private.',
  },
  {
    id: 'go-post', route: '/', target: 'nav-post', goTo: '/create',
    title: 'Make your first post',
    body: 'Let’s try it. Tap here to open the post page.',
    next: 'Take me there',
  },
  {
    id: 'write', route: '/create', target: 'post-caption', handsOn: true, waitFor: 'aura:post-created',
    title: 'Say hello',
    body: 'Write something, like who you are or what you’re into, then tap Share Post at the bottom. Topics, photos and the rest are optional.',
    typing: 'Tap Share Post when you’re ready.',
    next: 'I’ll post later',
  },
  {
    id: 'posted', route: '/', onlyIfPosted: true,
    title: 'Your first post is live',
    body: 'Nice! Others can now give it aura and comment. You’ll find it on your profile any time.',
  },
  {
    id: 'groups', route: '/groups', target: 'group-discover',
    title: 'Find your people',
    body: 'Groups are communities built around what you’re into. Join open ones right away, ask to join private ones, or start your own.',
  },
  {
    id: 'search', route: '/groups', target: 'search',
    title: 'Search and follow',
    body: 'Find posts, groups, or someone by their @username. Follow people from their profile to keep up with them.',
  },
  {
    id: 'profile', route: 'profile', target: 'profile-edit', skipIfMissing: true,
    title: 'Make it yours',
    body: 'Add a photo, banner, bio and tags so people know who you are.',
  },
  {
    id: 'more', route: 'profile', target: 'nav-more',
    title: 'Everything else',
    body: 'Your Aura Wallet (with the daily bonus), themes and Settings, Suggestions & Reviews, and this tour all live here.',
  },
  {
    id: 'done', route: '/',
    title: 'You’re all set',
    body: 'Enjoy Aura! You can replay this tour from More (the Me tab on phones) whenever you like.',
    next: 'Start exploring',
  },
];

// The steps this run shows: the "post is live" step only if they posted
export function stepsFor({ posted }) {
  return TOUR_STEPS.filter(step => !step.onlyIfPosted || posted);
}
