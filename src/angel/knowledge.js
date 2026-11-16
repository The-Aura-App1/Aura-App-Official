// What Angel knows about the app: short, accurate answers she can give
// word for word. Each has keywords (any match counts) and an example
// question (matched by meaning, on the device, when no keyword fits).
// Keep these true when features change; CLAUDE.md is the source.

export const KNOWLEDGE = [
  {
    id: 'what-is-aura', q: 'What is aura?',
    keys: ['what is aura', 'is aura', 'what even is aura', 'what\'s aura', 'aura mean', 'how does aura work', 'aura points'],
    a: 'Aura is how people show appreciation on Aura. You give aura to posts and comments you like, and you earn it when others give to yours. It has no cash value right now; cashing out is on the roadmap for verified creators.',
  },
  {
    id: 'earned-spendable', q: 'What is the difference between earned and spendable aura?',
    keys: ['earned', 'spendable', 'cashable', 'two kinds', 'balance split'],
    a: 'Earned aura comes only from other people giving to your posts or Moments. Spendable aura comes from your daily bonus, game winnings, Aura Rain and similar. Your balance is the two together. When you give, your free daily quota goes first, then spendable, then earned.',
  },
  {
    id: 'give-take', q: 'How does giving and taking aura work?',
    keys: ['give aura', 'giving', 'take aura', 'taking', 'take away', 'takes from me', 'take from me', 'takes aura'],
    a: 'Giving moves aura from you to the author. Taking costs you the same amount you take, nobody receives it, and it only works on posts whose author allowed takes (groups can turn taking off). Daily limits apply to both, and the server enforces them.',
  },
  {
    id: 'limits', q: 'What are the daily limits?',
    keys: ['daily limit', 'limits', 'how much can i give', 'cap', 'quota', 'daily bonus'],
    a: 'Each day you get a login bonus and some free aura to give (more with Premium). There are caps on how much you can give and take a day, and on how much one person can send you. Your wallet shows today\'s numbers.',
  },
  {
    id: 'feed', q: 'How does my feed decide what to show?',
    keys: ['algorithm', 'how does the feed', 'why am i seeing', 'feed work', 'recommendations', 'recommended', 'ranking'],
    a: 'Your feed is ranked on your device. It starts from popular recent posts, then leans toward the topics and keywords you pick in Tune your feed and what you give, take and like. Your choices always outweigh what it learns, and every fifth post is something a little different so you can branch out. It never tracks what you only look at.',
  },
  {
    id: 'privacy', q: 'What does Aura do with my data?',
    keys: ['privacy', 'my data', 'tracking', 'track me', 'personal data', 'sold', 'sell my'],
    a: 'Your feed preferences and what it learns stay in your browser and are never sent to our servers. Search runs on your device too, and so do I: your messages to me never leave it. Ads are never personalized.',
  },
  {
    id: 'private-account', q: 'How do private accounts work?',
    keys: ['private account', 'go private', 'followers only', 'follow request', 'profile private', 'account private', 'make my profile private', 'private posts', 'see my posts', 'who can see'],
    a: 'Turn on Private account in Settings > Privacy. Then only followers you approve see your posts, likes and aura outside groups. Your name, bio and counts stay public. Turning it off lets everyone waiting in.',
  },
  {
    id: 'block', q: 'How do I block someone?',
    keys: ['block', 'blocking', 'unblock', 'stop someone', 'stop them', 'bothering me', 'harassing me', 'bullying me', 'leave me alone'],
    a: 'Open the ⋯ menu on their profile, a post or a comment and choose Block. Neither of you will see the other\'s posts or comments, and they can\'t follow you, comment, give or take aura on your posts, or challenge you to games. They aren\'t told. Settings > Privacy lists who you\'ve blocked.',
  },
  {
    id: 'report', q: 'How do I report something?',
    keys: ['report', 'reporting', 'harass', 'abuse', 'spam'],
    a: 'Use the ⋯ menu on the post, comment or profile and choose Report, then pick a reason. Moderators review reports, and anything reported by enough people is hidden until they do. Your report is anonymous.',
  },
  {
    id: 'groups', q: 'What are groups?',
    keys: ['group', 'groups', 'community'],
    a: 'Groups are communities with their own posts, games and Hearth. They can be open, request-to-join or invite-only, and owners and moderators run them. Group posts stay in the group and never appear in the main feed.',
  },
  {
    id: 'games', q: 'How do group games work?',
    keys: ['game', 'games', 'poker', 'connect 4', 'pool', 'go fish', 'dice', 'coin', 'stake', 'wager', 'more players', 'multiplayer', 'chess', 'crazy 8', 'crazy eights', 'mini golf', 'golf'],
    a: 'In a group\'s Games tab you can challenge a member to Connect 4, 8-Ball Pool, Chess, Mini Golf, Poker, Go Fish, Crazy 8, Dice Duel or a coin flip, for fun or for an aura stake. Mini Golf builds a new random course every game (3, 5 or 9 holes), and every hole can be beaten. Poker and Dice Duel seat up to 6 players, Go Fish up to 5, and Mini Golf and Crazy 8 up to 4: the table is open to the whole group and starts when it fills, or when you start it. Every stake is held until the end and the winner takes them all as spendable aura; players who tie share it, and a draw gives them back. When you set up a game you pick the time: 30 seconds to 15 minutes a move, or for chess a real chess clock (Bullet 1 min, Blitz 3 or 5 min, Rapid 10 or 15 min, some with seconds added after each move). In chess you can also drag pieces, premove while they think, and draw arrows to plan (right-click and drag, or turn on Arrows on a phone).',
  },
  {
    id: 'power-ups', q: 'What are power-ups and the Hearth?',
    keys: ['power-up', 'power up', 'powerup', 'hearth', 'spotlight', 'aura rain', 'level', 'supporters'],
    a: 'Each group levels up from its members\' posts, comments, gives and games. In the Hearth tab you\'ll see the level, this week\'s Top Supporters, and two power-ups: Spotlight pins your post to the top of the group for 24 hours, and Aura Rain drops some of your aura for members to catch for 10 minutes (whatever isn\'t caught comes back).',
  },
  {
    id: 'themes', q: 'How do themes work?',
    keys: ['theme', 'themes', 'dark mode', 'light mode', 'scenery'],
    a: 'Pick a theme in Settings > Appearance; each has its own colors and moving scenery, and you can turn the scenery off there. I can also make you a custom theme: tell me the colors, mood or font you want.',
  },
  {
    id: 'premium', q: 'What does Premium include?',
    keys: ['premium', 'subscription', 'upgrade', 'subscribe', 'ad free', 'ad-free'],
    a: 'Premium is $4.99 a month: an ad-free feed, more daily aura and higher limits, and a username change once a day. Aura itself is never sold for money.',
  },
  {
    id: 'ads', q: 'Why do I see ads?',
    keys: ['ads', 'ad', 'advert', 'adverts', 'sponsored', 'watch an ad'],
    a: 'At most one ad per 10 posts, labeled Sponsored. Ads come from Google in its cookie-free Limited Ads mode and only know the topic of the post above them, never anything about you. Premium is ad-free. You can also watch an ad in your wallet for 25 spendable aura once an hour.',
  },
  {
    id: 'cashout', q: 'Can I cash out my aura?',
    keys: ['cash out', 'cashout', 'cash', 'into money', 'money', 'paid', 'withdraw', 'real money'],
    a: 'Not yet. Aura has no cash value today. Cashing out is on the roadmap for verified creators (18+), and only for earned aura.',
  },
  {
    id: 'username', q: 'How do I change my username?',
    keys: ['username', 'change my name', 'rename', 'handle'],
    a: 'Edit your profile to change it. Everyone gets one free change; Premium can change it once a day.',
  },
  {
    id: 'make-post', q: 'How do I make a post?',
    keys: ['make a post', 'create a post', 'how do i post', 'new post', 'upload a photo', 'upload a video'],
    a: 'Tap Post (the + in the bottom bar, or Post in the sidebar). Add a photo, video or text, a caption, up to 3 topics and up to 10 hashtags, then choose whether others may take aura from it. You can post into a group from the group page.',
  },
  {
    id: 'post-styling', q: 'How do I style a post?',
    keys: ['font', 'style my post', 'background', 'frame', 'customize the look', 'post style'],
    a: 'When you create a post, open Customize the look. Text posts can pick a font, color, background, size and alignment; photos and videos can style their caption; any post can have a frame.',
  },
  {
    id: 'moments', q: 'What are Moments?',
    keys: ['moment', 'moments'],
    a: 'Moments are coming to groups: dual-camera photos or videos that disappear after 24 hours unless saved. Group owners can already switch them on or off.',
  },
  {
    id: 'delete-account', q: 'How do I delete my account?',
    keys: ['delete my account', 'delete account', 'close my account'],
    a: 'Go to Settings > Danger zone.',
  },
  {
    id: 'earn', q: 'How do I earn aura?',
    keys: ['earn aura', 'give me aura', 'get more aura', 'earn the points', 'earn points', 'get aura', 'more aura', 'earn more', 'free aura', 'daily bonus'],
    a: 'You earn aura when people give it to your posts, comments and Moments; that\'s the only way to get earned aura. You also get spendable aura from the daily login bonus, winning group games, catching Aura Rain and watching an ad in your wallet.',
  },
  {
    id: 'moderation', q: 'How does moderation work?',
    keys: ['moderation', 'moderator', 'moderators', 'mods', 'admins', 'community rules', 'rules', 'guidelines', 'what is allowed', 'not allowed', 'banned', 'ban', 'safety', 'safe'],
    a: 'Two layers. Across Aura, moderators review reports: you can report any post, comment or account from its ⋯ menu (spam, harassment, hate, violence, nudity, self-harm, misinformation or other). Something reported by several established accounts is hidden until a moderator keeps or removes it, and accounts that break the rules can be banned. Inside groups, the owner and the moderators they pick can remove posts, approve or remove members, and turn features like taking aura, Moments and power-ups on or off. You can also block anyone yourself.',
  },
  {
    id: 'pins', q: 'Can I pin a post?',
    keys: ['pin', 'pinned', 'pin a post', 'pin my post', 'pins'],
    a: 'Pinning posts to your profile isn\'t here yet; it\'s planned (up to 3). In a group, the Spotlight power-up pins one of your posts to the top for 24 hours.',
  },
  {
    id: 'settings', q: 'Where are my settings?',
    keys: ['settings', 'setting', 'preferences page', 'find my settings', 'account settings'],
    a: 'Settings is in the More menu: the sidebar on a computer, or the Me sheet on a phone. It has Account, Appearance (themes and scenery), Privacy (private account, blocks, your rank), Notifications and the Danger zone.',
  },
  {
    id: 'verify', q: 'How do I get verified?',
    keys: ['verify', 'verified', 'verification', 'blue check', 'checkmark', 'creator account'],
    a: 'There\'s no verification yet. Verified creator accounts are on the roadmap: they\'ll be 18+ and are what cashing out earned aura will need. Watch the About page and Roadmap for when they open.',
  },
  {
    id: 'support', q: 'How do I contact the Aura team?',
    keys: ['contact support', 'support', 'contact the team', 'contact aura', 'talk to someone', 'customer service', 'help desk', 'email aura'],
    a: 'There\'s no live support chat yet. To reach the team, use Suggestions & Reviews in the More menu (you can describe a problem there). To flag a post, comment or account, use Report in its ⋯ menu; moderators review those.',
  },
  {
    id: 'delete-post', q: 'How do I delete a post?',
    keys: ['delete a post', 'delete my post', 'remove my post', 'delete post', 'take down my post', 'edit a post', 'edit my post', 'edit post', 'change my post', 'edit a caption', 'edit my caption'],
    a: 'Open the ⋯ menu on your post and choose Delete post, then tap again to confirm. Posts can\'t be edited after posting, so delete and repost if you need to change something.',
  },
  {
    id: 'group-manage', q: 'How do I create or leave a group?',
    keys: ['create a group', 'make a group', 'start a group', 'leave a group', 'leave group', 'join a group', 'group owner', 'group moderator'],
    a: 'On the Groups tab, tap Create group and choose a name, description and whether it\'s open, request-to-join or invite-only. To join, open a group and tap Join (or Request). To leave, open the group and use Leave group. Owners can make members moderators from the member list.',
  },
  {
    id: 'wallet', q: 'How does the Aura Wallet work?',
    keys: ['wallet', 'balance', 'my aura went', 'lost aura', 'aura went down', 'where did my aura go', 'history'],
    a: 'Your Aura Wallet (in the More menu) shows your balance split into earned and spendable, plus today\'s limits (a full list of changes is coming). Your balance goes down when you give or take aura, stake a game or use a power-up, and when someone takes from your post. The Aura tab on your profile graphs it over time.',
  },
  {
    id: 'caption-tips', q: 'How do I write a good caption?',
    keys: ['good caption', 'better caption', 'caption tips', 'tips for my post', 'better posts', 'posts get more aura', 'more engagement', 'posts do better', 'post tips', 'posts better', 'post better'],
    a: 'A few things that tend to help: put the most interesting part in the first line, give a little context (what, where or why), end with a question to invite comments, and keep hashtags in the hashtag field. Pick topics that really fit so the right people see it. Paste a draft after a colon and I\'ll give you feedback on yours; the words stay yours.',
  },
  {
    id: 'search', q: 'How do I search?',
    keys: ['search', 'find posts', 'look up posts', 'find a group', 'find people', 'find someone', 'find a user', 'find users', 'find my friends', 'hide me from search', 'show me in search'],
    a: 'Tap the search icon at the top (on a phone) or use the search box in the sidebar. It finds people by name or username, groups, and posts. Posts are matched on your device, by words first and then by meaning. Your searches are never saved. To stay out of people search, turn off Settings > Privacy > Show me in search; your profile still opens from a link or a tag.',
  },
  {
    id: 'follow', q: 'How does following work?',
    keys: ['follow', 'following', 'followers', 'unfollow', 'remove a follower'],
    a: 'Tap Follow on someone\'s profile. If their account is private, it becomes a request they approve. You can unfollow any time, and you can remove your own followers from your profile\'s follower list.',
  },
  {
    id: 'comments', q: 'How do comments work?',
    keys: ['comment', 'comments', 'reply', 'replies', 'mention', 'tag someone'],
    a: 'Open a post to comment. Replies stay one level deep, and replying to a reply starts it with @name. Typing @ suggests people in the conversation, and tagged people are notified. When you post, you choose whether anyone or only your followers can comment.',
  },
  {
    id: 'likes', q: 'Can people see what I like?',
    keys: ['like a post', 'likes', 'liked', 'see what i like', 'who liked'],
    a: 'No. Likes are private bookmarks: they don\'t move any aura and nobody else sees them. Your Liked tab is only for you, and authors see only their own like totals.',
  },
  {
    id: 'notifications', q: 'How do I change my notifications?',
    keys: ['notification', 'notifications', 'notify', 'alerts'],
    a: 'Go to Settings > Notifications to choose which ones you get (comments, replies, tags, follows, games and more). The bell tab shows them all.',
  },
  {
    id: 'removed', q: 'Why did my post disappear?',
    keys: ['disappear', 'disappeared', 'removed', 'got hidden', 'taken down', 'missing post', 'deleted my post', 'post is gone', 'posts are gone', 'vanished'],
    a: 'A post can be hidden when enough people report it, until a moderator reviews it, or removed if it breaks the rules. Group posts only show inside their group, and posts by private accounts only show to approved followers.',
  },
  {
    id: 'feedback-page', q: 'How do I send feedback about the app?',
    keys: ['feedback about the app', 'suggestion', 'suggestions', 'review the app', 'leave a review', 'feature request', 'report a bug', 'bug', 'glitch', 'glitched', 'broken', 'not working', 'crashed', 'crashing'],
    a: 'Open Suggestions & Reviews in the More menu. You can post up to 3 suggestions a day and vote on others, or leave one review with 1 to 5 stars.',
  },
  {
    id: 'caption-view', q: 'What is the caption view?',
    keys: ['caption view', 'captions view', 'posts or captions', 'text only view'],
    a: 'The Posts / Captions switch above your feed. Captions shows each post as its caption first, Reddit style, with a box to filter by words. Your choice is remembered on this device.',
  },
  {
    id: 'tour', q: 'Can I see the app tour again?',
    keys: ['tour', 'walkthrough', 'tutorial', 'getting started'],
    a: 'Yes: choose App tour in the More menu (the Me sheet on phones). It\'s short and you can skip it any time.',
  },
  {
    id: 'sign-out', q: 'How do I sign out?',
    keys: ['log out', 'logout', 'sign out', 'signout', 'log off'],
    a: 'Sign out is at the bottom of the sidebar on a computer, and in the Me sheet on a phone.',
  },
  {
    id: 'profile-edit', q: 'How do I change my profile picture or bio?',
    keys: ['profile picture', 'profile pic', 'avatar', 'edit my profile', 'edit profile', 'change my bio', 'display name'],
    a: 'Open your profile and tap Edit Profile to change your picture, display name, bio and username.',
  },
  {
    id: 'rank', q: 'What is my aura rank?',
    keys: ['rank', 'ranking', 'leaderboard', 'aura graph', 'aura timeline'],
    a: 'Your profile shows your global aura rank and, in its Aura tab, a graph of your balance over time. You can hide your rank in Settings > Privacy.',
  },
  {
    id: 'hashtags', q: 'How do hashtags and topics work?',
    keys: ['add hashtags', 'hashtag', 'hashtags', 'topics', 'add a topic'],
    a: 'When you post, pick up to 3 topics and add up to 10 hashtags in their own field. Topics decide which feeds a post reaches; hashtags help people find it and show up in trends.',
  },
  {
    id: 'angel', q: 'Who are you and what can you do?',
    keys: ['who are you', 'what can you do', 'what are you', 'angel', 'who made you', 'who built you', 'are you an ai', 'are you a bot', 'are you real', 'are you human',
      'do you remember', 'do you save', 'do you store', 'what do you store', 'what do you know about me', 'are you chatgpt'],
    a: 'I\'m Angel, Aura\'s helper. I\'m not a chatbot that makes things up: I run entirely on your device, follow fixed rules, and answer from Aura\'s own data and guide. What you tell me is kept only until you leave this page and never leaves your device. I can help you tune your feed, look up what\'s trending, answer questions about the app, make you a custom theme, and give feedback on a post you\'re writing.',
  },
];

// Where an answer's "take me there" button goes
export const KNOWLEDGE_LINKS = {
  settings: { to: '/settings', label: 'Open Settings' },
  notifications: { to: '/settings#notifications', label: 'Notification settings' },
  privacy: { to: '/settings#privacy', label: 'Privacy settings' },
  'private-account': { to: '/settings#privacy', label: 'Privacy settings' },
  block: { to: '/settings#privacy', label: 'Blocked accounts' },
  rank: { to: '/profile', label: 'Open my profile' },
  themes: { to: '/settings#appearance', label: 'Appearance settings' },
  'what-is-aura': { to: '/wallet', label: 'Open Aura Wallet' },
  'earned-spendable': { to: '/wallet', label: 'Open Aura Wallet' },
  earn: { to: '/wallet', label: 'Open Aura Wallet' },
  limits: { to: '/wallet', label: 'Open Aura Wallet' },
  wallet: { to: '/wallet', label: 'Open Aura Wallet' },
  ads: { to: '/wallet', label: 'Watch an ad in my wallet' },
  premium: { to: '/wallet', label: 'Open Aura Wallet' },
  'feedback-page': { to: '/feedback', label: 'Open Suggestions & Reviews' },
  support: { to: '/feedback', label: 'Open Suggestions & Reviews' },
  tour: { to: '/?tour=1', label: 'Start the tour' },
  groups: { to: '/groups', label: 'Open Groups' },
  'group-manage': { to: '/groups', label: 'Open Groups' },
  games: { to: '/groups', label: 'Open Groups' },
  'power-ups': { to: '/groups', label: 'Open Groups' },
  'make-post': { to: '/create', label: 'Make a post' },
  'post-styling': { to: '/create', label: 'Make a post' },
  hashtags: { to: '/create', label: 'Make a post' },
  search: { to: '/search', label: 'Open Search' },
  'profile-edit': { to: '/profile', label: 'Open my profile' },
  'delete-account': { to: '/settings', label: 'Open Settings' },
};
