// The guided tour, page by page. Each step points at an element tagged
// data-tour="<target>" (the first visible one, so phone and desktop layouts
// can each tag their own). Keep the wording in line with CLAUDE.md
// (economy, feed, posting, follows) when those rules change.
//
//   route          page the step belongs on; the tour goes there first
//                  ('profile' means the viewer's own profile)
//   target         data-tour value to point at; none = a note in the middle
//   skipIfMissing  quietly skip when the element isn't there (e.g. no posts yet)
//   goTo           a nav step: tapping the highlighted button (or the main
//                  button) moves on once that page opens
//   waitFor        a window event that completes the step (the first post)
//   onlyIfPosted   shown only after the person posted during the tour
export const TOUR_STEPS = [
  {
    id: 'welcome', route: '/',
    title: 'Welcome to Aura',
    body: 'Let’s take a quick walk around. We’ll point things out as we go, and you can skip whenever you like.',
    next: 'Show me around',
  },
  {
    id: 'tune', route: '/', target: 'tune-feed',
    title: 'Tune your feed',
    body: 'Pick topics and keywords you want more or less of. Your feed is ranked on your device, so what you pick stays private.',
  },
  {
    id: 'aura', route: '/', target: 'post-aura', skipIfMissing: true,
    title: 'Give and take aura',
    body: 'Give sends aura to whoever made the post. Take costs you the same amount and nobody receives it. You get free aura every day.',
  },
  {
    id: 'post-menu', route: '/', target: 'post-menu', skipIfMissing: true,
    title: 'More like this, less like that',
    body: 'This menu has “Show more like this” and “Show less like this”, so your feed learns what you’re into.',
  },
  {
    id: 'search', route: '/', target: 'search',
    title: 'Search',
    body: 'Find posts by words or meaning, look up groups, or type an exact @username to find someone.',
  },
  {
    id: 'go-post', route: '/', target: 'nav-post', goTo: '/create',
    title: 'Make your first post',
    body: 'Everyone starts somewhere. Tap here to open the post page.',
    next: 'Take me there',
  },
  {
    id: 'post-type', route: '/create', target: 'post-type',
    title: 'Words, photos or video',
    body: 'Choose what you’re sharing: text, up to 10 photos, or one video.',
  },
  {
    id: 'post-caption', route: '/create', target: 'post-caption',
    title: 'Say hello',
    body: 'Introduce yourself, or share something you love. It doesn’t have to be perfect.',
  },
  {
    id: 'post-topics', route: '/create', target: 'post-topics',
    title: 'Help people find it',
    body: 'Add up to 3 topics and some hashtags. They’re optional, but they help the right people see your post.',
  },
  {
    id: 'post-takes', route: '/create', target: 'post-takes',
    title: 'Your post, your rules',
    body: 'Decide whether others can take aura (locked once you post) and, just below, who can comment.',
  },
  {
    id: 'post-share', route: '/create', target: 'post-share', waitFor: 'aura:post-created',
    title: 'Share it',
    body: 'Tap Share Post when you’re ready. We’ll carry on as soon as it’s up.',
    next: 'I’ll post later',
  },
  {
    id: 'posted', route: '/', onlyIfPosted: true,
    title: 'Your first post is live',
    body: 'Nice! Others can now give it aura and comment. You’ll find it on your profile any time.',
  },
  {
    id: 'go-groups', route: '/', target: 'nav-groups', goTo: '/groups',
    title: 'Groups',
    body: 'Communities built around what you’re into. Let’s look.',
    next: 'Take me there',
  },
  {
    id: 'group-discover', route: '/groups', target: 'group-discover',
    title: 'Find your people',
    body: 'Join open groups right away, or ask to join private ones. Groups have their own posts and conversations.',
  },
  {
    id: 'group-create', route: '/groups', target: 'group-create',
    title: 'Or start your own',
    body: 'Create a group, choose who can join, and set its rules.',
  },
  {
    id: 'notifications', route: '/groups', target: 'nav-notifications',
    title: 'Notifications',
    body: 'Aura on your posts, comments, replies, new followers and follow requests all land here.',
  },
  {
    id: 'profile', route: 'profile', target: 'profile-edit',
    title: 'Make it yours',
    body: 'Add a photo, banner, bio and tags so people know who you are. Your posts and what you liked live below.',
  },
  {
    id: 'wallet', route: '/wallet', target: 'wallet-today', skipIfMissing: true,
    title: 'Your daily aura',
    body: 'Claim your daily bonus and see how much you can still give today. Aura has no cash value.',
  },
  {
    id: 'theme', route: '/settings', target: 'settings-appearance',
    title: 'Set the scene',
    body: 'Pick a theme, from Day and Night to Snowy Peaks, Duskfall and City Skies. Privacy and notifications are further down.',
  },
  {
    id: 'more', route: '/settings', target: 'nav-more',
    title: 'Everything else',
    body: 'Your wallet, settings, Suggestions & Reviews, and this tour live here.',
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
