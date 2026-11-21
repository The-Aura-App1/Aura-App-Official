# Changelog

Everything that changed between the README update of **2026-10-27** (commit `78c867d`) and **2026-11-17** (commit `dc26a0f`): 117 commits. Grouped by area, newest work last within each area. Every commit is in the [history](https://github.com/The-Aura-App1/Aura-App-Official/commits/master).

- [Security and abuse prevention](#security-and-abuse-prevention)
- [Privacy](#privacy)
- [Following, blocking and moderation](#following-blocking-and-moderation)
- [Posts](#posts)
- [Comments, reactions and likes](#comments-reactions-and-likes)
- [Feed and search](#feed-and-search)
- [Angel](#angel)
- [Groups and power-ups](#groups-and-power-ups)
- [Games](#games)
- [Aura, wallet and Premium](#aura-wallet-and-premium)
- [Themes and look](#themes-and-look)
- [Navigation, tour and pages](#navigation-tour-and-pages)
- [Speed and phones](#speed-and-phones)
- [Hosting and domain](#hosting-and-domain)
- [Testing](#testing)

---

## Security and abuse prevention

**Rate limits on every action (server side).** Each Lambda keeps per-account, fixed-window counters in the `aura-rate-limits` table (TTL cleans them up). Going over returns HTTP 429. The limiter fails open on purpose: if its table can't be reached, requests are allowed and it rests for a minute, so a limiter problem can never take the API down.

| Action | Limit per account |
|---|---|
| Any request to aura-aura (aura, games, power-ups) | 120 a minute |
| Posting | 5 a minute, 30 an hour |
| Comments | 10 a minute, 100 an hour |
| Giving or taking aura | 30 a minute, 300 an hour |
| Likes / reactions | 60 a minute each |
| Media upload URLs | 10 a minute (group perk images: 20 an hour) |
| Profile changes | 10 a minute |
| Group actions / creating groups | 30 a minute / 5 an hour |
| Follows | 30 a minute, 400 a day |
| People search | 40 a minute |
| Notifications | 60 a minute |
| Reports | 10 an hour |
| Suggestions / votes / reviews | 3 a day / 60 an hour / 5 a day |
| Support messages | 3 an hour, 8 a day |
| Custom topics | 5 a day |
| Power-ups | 20 a minute |
| Games against bots | 40 new games an hour; 30 moves a minute, 600 an hour |
| Rewarded ads | one payout every 4 hours |

**API Gateway throttling (2026-11-17).** The whole API allows 50 requests a second (bursts of 100). On top of that, lower per-route limits cover the routes that create things or cost money: sign-up profile and reports 3/s (bursts of 6); posting, post upload URLs and the daily bonus 10/s (20); group creation, other upload URLs, feedback/support and ad rewards 5/s (10); `POST /posts/fix-author` 3/s (6).

**Uploads.** Media goes straight to S3 with a pre-signed URL that's valid for 10 minutes and fixed to one content type and size. Only JPEG, PNG and WEBP images (up to 20 MB) and MP4 and MOV videos (up to 500 MB) are accepted, at most 10 images per post. Group perk images get their own signed URLs under `groups/<groupId>/<kind>/`, and a group only accepts keys of that shape once it has reached the level.

**Input checks (2026-11-10, 2026-11-12).**
- Names, bios, captions, comments, group text and feedback are cleaned by one shared `text.mjs` (identical in four Lambdas; a test fails if they drift): control, invisible and direction-flipping characters are removed and lengths are capped.
- Usernames, display names and group names that pose as Aura staff ("Aura Team", "Supp0rt") are refused.
- Request bodies that aren't JSON objects get a 400, bad path escapes a 404, never a 500 with a stack trace.
- Every id the app puts in a path is URL-encoded, so a crafted link can't reach another route.
- Every post style, font, overlay, reaction, topic, hashtag, tag and place is checked on the server against the same lists the app uses; unknown fields are dropped.

**Data leaks closed (2026-11-10).** Comments return only allowlisted fields, so who reported a comment and report counts no longer reach viewers. Like counts go to the author only. Report fields are stripped from posts. Aura and likes are refused on comments of removed posts.

**Hosting headers (2026-11-12, enforced 2026-11-16).** `customHttp.yml` sets a Content Security Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and Cross-Origin-Opener-Policy. The CSP ran report-only first and was enforced once the live pages showed no violations. The theme boot script moved out of `index.html`, so no inline scripts are allowed.

**Ads can't reach the page (2026-11-15).** Feed ads run in Google Ad Manager's Limited Ads mode (no cookies, no device IDs, non-personalized) and are forced into Google's sandboxed cross-origin SafeFrame, so ad code can't read the page or the sign-in tokens.

**Rewarded ads can't be farmed.** Watching an ad is two steps: the server opens a one-time session, and it pays 25 aura only if that session is 15 seconds to 15 minutes old, at most once every 4 hours per account (a script can earn at most 150 a day).

**Accounts that can't be trusted yet (2026-11-15).**
- Playing for aura and catching Aura Rain need an account at least 7 days old, so new accounts can't move aura into another by losing on purpose. A missing join date counts as new (fails closed).
- Only reports from accounts at least 7 days old count toward hiding a post, so a batch of new accounts can't hide something.
- Banned accounts can't post, comment, react, report, follow, give aura, or create, join, invite to or moderate groups.

**Server time is protected.** Bots think for at most 1.5 s (chess) and 1.2 s (pool), and bot games have their own move limits.

**API routes fixed (2026-11-15).** Authorized proxy routes use GET/POST/PUT/DELETE instead of ANY. ANY also caught the browser's CORS preflight, which carries no token, so the authorizer rejected it.

**Least-privilege IAM.** Each Lambda's role has only the tables and actions it uses (`backend/iam/`, checked against the live roles on 2026-11-16), updated whenever a feature needs a new table or action.

**Security checklist (2026-11-16).** [`docs/security-checklist.md`](docs/security-checklist.md) records what was checked, what's fine and what's still open.

## Privacy

- **Learning stays on the device (2026-11-06).** The feed learns from your gives, takes and likes in your browser only (30-day half-life, never sent to the server). Settings > Privacy turns it off or resets it. Clicks, views, watch time and skipped posts are never used.
- **Private accounts (2026-11-12).** Their posts, comments, likes, reactions and aura history are visible only to approved followers. One shared `privacy.mjs` (identical in three Lambdas) makes the check.
- **Public profiles use an allowlist** of fields; anything new stays private unless it's added.
- **Stay out of search (2026-11-15):** "Show me in search" in Settings > Privacy.
- **Angel runs on the device.** Conversations are never saved or sent; only reports, support messages and actions you confirm reach the server.
- **Theme Studio pictures and videos** stay on your device (IndexedDB). **Places** on posts are a name you type, never GPS.

## Following, blocking and moderation

- **Following (2026-11-12):** follow requests, private accounts that approve each follower, follower and following lists, removing followers, follow notifications. Up to 5,000 follows plus open requests.
- **Followers-only comments,** set per post with an account default. Unknown values fail closed.
- **Blocking (2026-11-15)** works both ways: posts, comments, aura, follows, tags and game challenges between the two accounts stop, and each disappears from the other's view at once.
- **Reports** on posts, comments and accounts, with reasons. Five reports from established accounts hide a post or comment for review. A moderator's "keep" clears the count but remembers who reported, so the same people can't hide it again.
- **Moderators' reports queue** in `/moderation`: keep, remove or ban. Banning hides the account's profile, posts and comments, and can be undone.

## Posts

- **Videos, Instagram style (2026-11-13):** they autoplay muted while on screen, pause when scrolled away, have no browser controls, and pause or resume on a tap. A speaker button sets sound for every video. Feed videos fill a 4:5 to 1.91:1 box; the post page shows the exact shape with a seek bar.
- **Post page (2026-11-10):** the post with threaded comments, give and take, likes, delete and report.
- **Post styling (2026-11-14, 2026-11-16):** 276 self-hosted open-licence fonts (150 added on 2026-11-16, one font picker everywhere), text colors, sizes and alignment, backgrounds (solid colors, a gradient builder with linear, radial, conic and mesh gradients, a library of 27 tinted patterns), 28 preset frames and a frame builder. Contrast is checked so text stays readable.
- **Step-by-step posting (2026-11-16):** create, edit and share, with a live preview drawn exactly as the feed draws it. Up to 10 photos, reorderable.
- **Things on posts:** text, links, @mentions, hashtags and emoji dragged anywhere on a photo, a video or a styled text card, in the same spot on every screen.
- **Custom topics (2026-11-16):** add your own topic (with suggestions), alongside Aura's 28. They work in feed tuning, search and Angel.
- **Tag people and add a place (2026-11-16):** up to 10 people, checked to exist and not be blocked, and a typed place name.

## Comments, reactions and likes

- **Replies and tags (2026-11-13):** reply to a reply (one thread, starting "@name"), @mentions that link only to real accounts, suggestions as you type.
- **Comment notifications:** a reply, a tag or a comment on your post, each person notified once by the most specific reason, respecting notification settings and visibility.
- **Reactions (2026-11-16):** any single emoji or country flag on posts and comments, up to 3 per person and 20 different ones per post. Letter-like emoji (so nobody can spell words) and a deny list of rude, sexual, weapon and often-misused emoji are refused. ❤ and ❤️ count as one. A Recent row remembers your last 8.

## Feed and search

- **Search (2026-11-12, 2026-11-15):** posts by words, hashtags, topics and meaning (matched on your device), groups, and people by username or name (exact matches first, then by followers), never banned or blocked accounts.
- **Captions view (2026-11-13):** a Posts / Captions switch shows the feed as a list of captions, with a filter box.

## Angel

An on-device helper, added on 2026-11-15 and expanded through 2026-11-16. There's no generative model, so she can't be steered into writing content or going off topic.

- **Understanding:** rules first, then a trained intent classifier (about 7 KB) over the on-device MiniLM vectors. She answered 36 of 40 fresh phrasings, against 30 for rules alone.
- **Hardened after stress tests:** she refuses writing requests however they're disguised (leetspeak, spaced letters, zero-width characters), people lookups and rankings, rule overrides, and attempts to get around limits. Guide keywords match whole words only.
- **Skills:** tuning the feed (grounded in words today's posts actually use), building themes in conversation ("a different one", "make the accent teal"), switching themes, wallet and limits, what shapes your feed, catch-up on notifications, finding a post you describe in your likes, groups or popular posts, suggesting groups, and starting a bot game.
- **Doing things, with permission:** giving aura, liking, sharing, spotlighting, starting an Aura Rain, commenting in your own words, joining groups, follow requests and more. Each action shows a card with the exact post, person or amount and runs only after a tap or a "yes". She never does anything in bulk and never gives twice to one account in a chat. A master switch in Settings turns actions off.
- **Reports and support:** guided report and support conversations. Support emails go through Amazon SES (3 an hour, 8 a day), with a copy kept.

## Groups and power-ups

- **Levels (2026-11-15):** groups earn XP from posts, comments, gives and games (capped per member per day) up to level 15.
- **Perks:** a group picture (level 2), custom reaction pins (level 7), post backgrounds and a post glow (level 10).
- **Weekly Top Supporters, Spotlight** (pin your post for 24 hours) and **Aura Rain** (drop aura for members to catch). Every aura move happens in one transaction, so aura is never created or lost.
- **Premium boosts (2026-11-16):** up to 5 a month, each adding 25% XP for 30 days.
- **Boards:** Top groups (by level or aura given) and each group's game champions.

## Games

Added on 2026-11-13 and expanded through 2026-11-16. Played in groups for an aura stake or for fun, with no house and no rake.

- **Nine games:** Chess, 8-Ball Pool, Mini Golf, Poker (no-limit Hold'em), Connect 4, Go Fish, Crazy 8, Dice Duel and Flip a Coin, each on its own themed table.
- **Bigger tables:** Poker and Dice Duel take up to 6 players, Go Fish 5, Crazy 8 and Mini Golf 4, with side pots and leaving mid-game handled.
- **Chess:** full rules, clocks with increments, premoves and arrows. The move generator matches the standard perft counts.
- **Pool:** real physics on a 9-foot table to scale (spin, stun, follow, draw, english off the rails). The server runs every shot and the app replays its recording.
- **Mini golf:** random holes that are always beatable, with sand, ice, slopes, windmills and mounds.
- **Fair by design:** the server deals, rolls and flips with crypto-random numbers, checks every move, and only sends each player their own view. Stakes are held on the match and paid out or refunded exactly; a lost race moves no aura.
- **Bots:** Pip, Nova and Atlas (easy, medium, hard) for every skill game, just for fun.
- **The end of a game:** a result card with the aura change, after the last move has played out.

## Aura, wallet and Premium

- **Aura over time (2026-11-15, 2026-11-16):** a real balance-history graph on profiles and in the wallet, from a week to all time.
- **Rewarded ads** are on (see Security), along with a 500-aura bonus, paid once, for your first suggestion.
- **Premium page (2026-11-16):** perks and a Regular vs Premium table. The **first 100 accounts get Premium free**, enforced by a single counter so there are never more than 100.
- **Creator page (2026-11-16):** views, aura, aura per 100 views, your top post and a sortable list of your posts.

## Themes and look

- **13 themes (2026-10-28 to 2026-11-15):** Day, Night, Light, Dark, Snowy Peaks, Duskfall, City Skies, Northern Lights, Firefly Grove, Sky Isles, Abyss, Golden Dunes and Lantern Lake, most with animated, hand-drawn scenery. The public pages rotate through the scenes and can be paused.
- **Each theme has its own gradient** for buttons, borders and accents, and switching themes crossfades.
- **Custom themes, saved themes and Theme Studio (Premium, 2026-11-16):** every color, gradient backdrops, any scene or your own picture or video, fonts, corner roundness, see-through cards and shadows. Save up to 20 named themes.
- **Motion (2026-11-11):** posts rising in, a shimmer while loading, give and take bursts, a wallet that counts up, a bell that rings. Small feedback always plays; big movement becomes a fade where the device asks for reduced motion.
- **Aura's own icon (2026-11-16)** wherever aura the currency appears, and buttons that dip when pressed.

## Navigation, tour and pages

- **Five main tabs (2026-11-12):** Feed, Groups, Post, Notifications and Me. Everything else is under More.
- **App tour (2026-11-13):** about 10 steps, page by page, ending with a real first post. It starts with picking a theme.
- **Notifications (2026-11-16):** mark each read or unread, star to keep, filter All / Unread / Starred.
- **Suggestions & Reviews (2026-11-12):** suggestions with votes, star reviews that a moderator approves before they show on the welcome page.
- **About page (2026-11-16):** rewritten to match what's live today, with the roadmap and FAQ.
- **Sign in with Google (2026-11-16):** built and hidden until Cognito's hosted domain is set up.

## Speed and phones

- **Faster on phones (2026-11-12, 2026-11-16):** the nine non-sky scenes load only when shown, cutting the main bundle from 812 to 689 KB (234 to 205 KB gzipped) and first paint on a throttled phone from 1.83–2.39 s to 1.60–2.17 s. The language model loads only where it's used.
- **Phone audit (2026-11-16):** a script opens every page at 8 sizes from 360 to 1024 px wide and fails on sideways overflow. All 304 checks pass.
- **Clean build:** no lint warnings left in the app.

## Hosting and domain

- **Custom domain (2026-11-17):** https://auraapp.social and www, on Cloudflare DNS with an Amplify-managed certificate.
- **Lambda memory and timeout** raised for aura-aura so hard pool breaks finish in time.

## Testing

- **48 app test files and 14 server test files** (`npm test`, `npm run test:games`), up from 4.
- Thousands of random games checking each rule set, chess perft counts, a solver that holes random golf courses, bot against bot at every level, chess clocks through the real handler with an in-memory DynamoDB, and tests for reactions, overlays, post design, custom topics, tags, Premium claims, support and the first-suggestion bonus.
- Contract tests keep every list the app and the server share equal (topics, hashtags, fonts, styles, reactions, limits, stake caps and more).
- Angel's phrasing sets, including unseen sets written before tuning, and multi-turn conversations.
