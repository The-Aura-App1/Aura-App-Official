# Aura app

## AWS rules

- Always run the AWS CLI with `--profile aura`. The profile points at account 570934198135, region us-east-1.
- Only touch Lambda functions whose names start with `aura-`.
- Never touch `postits-ai-proxy` or any other AWS resource. That includes other Lambdas, IAM, API Gateway, DynamoDB, S3, and so on.
- Ask before running anything that changes live AWS state, including `deploy.ps1`.
- TEMPORARY, one-time exception for custom domain setup only (approved 2026-10-24). Delete this rule once the domain is live. Claude may also read and change: Amplify Hosting (the aura app only), Route 53 (the aura domain's hosted zone only), ACM certificates for that domain, the Cognito app client 1b2uhsh7qdlmgbjj5vh09p64ds (callback/sign-out URLs only), and CORS on API 7uob369et4. Still never touch `postits-ai-proxy` or anything unrelated, and ask before each change. Buying the domain is done by the user.

## Lambda code

- Source lives in `backend/lambdas/<name>/index.mjs` for these functions:
  `aura-users`, `aura-posts`, `aura-aura`, `aura-groups`, `aura-comments`, `aura-notifications`.
- Deploy one function with `.\deploy.ps1 -Name <name>`. The script only accepts the six names above. It builds the zip in a temp folder, deploys it, and prints the function's `LastModified` so you can confirm the deploy.
- `*.zip` files are gitignored. Never commit deployment packages.
- Each Lambda role's least-privilege IAM policy is in `backend/iam/<name>.json` (see its README). When a Lambda starts using a new table, index, action or S3 folder, update that file and tell the user to update the policy in IAM before deploying. Claude has no IAM access.

## Rollback

- Deploys overwrite the live function. AWS keeps no undo, so commit before every deploy and deploy only committed code.
- To roll back one function: find the last good commit with `git log --oneline -- backend/lambdas/<name>/index.mjs`, restore the file with `git checkout <commit> -- backend/lambdas/<name>/index.mjs`, run `.\deploy.ps1 -Name <name>`, confirm LastModified changed and the app works, then commit.
- git revert or git reset alone does not change the live function. Always redeploy afterward.

## Stack

- Web: React 18 (Create React App) + Tailwind 3 + AWS Amplify auth. Mobile (React Native + Expo) comes before launch.
- Backend: AWS Lambda (Node ESM, index.mjs) + API Gateway HTTP API + DynamoDB + S3 + Cognito. Region us-east-1.
- Cognito user pool: us-east-1_fiuEOr0XM. App client: 1b2uhsh7qdlmgbjj5vh09p64ds.
- API: https://7uob369et4.execute-api.us-east-1.amazonaws.com
- Media bucket: aura-app-media-570934198135
- Tables: aura-users, aura-posts, aura-transactions, aura-daily-budgets, aura-groups, aura-group-members, aura-comments, aura-likes, aura-notifications, aura-shares, aura-feedback, aura-follows, aura-games
- User is on Windows PowerShell. Use PowerShell syntax, not bash.

## Code conventions

- Each Lambda has a response() helper, a handler that parses method/path/segments, and one function per route. Define every function once, above the handler.
- New API routes need a route in API Gateway with the cognito-auth authorizer where required. That is done manually in the console, not by deploy.ps1.
- Usernames are unique, enforced by reservation items in aura-users keyed `userId = USERNAME#<name>` (attributes: ownerId, createdAt; no `username` attribute). Any code that scans aura-users must skip keys starting with `USERNAME#`.
- Usernames are stored lowercase. Posts denormalize authorUsername, authorDisplay and authorPicKey. Changing a profile calls POST /posts/fix-author to backfill them.
- Text people write goes through `text.mjs` (identical copies in aura-users, aura-posts, aura-comments, aura-groups; a test fails if they drift): `cleanLine` for names, `cleanText` for bios, captions, comments, descriptions and feedback. `impersonatesStaff` blocks usernames, display names and group names that pose as Aura staff ("Aura Team", "Supp0rt"); ADMIN_IDS are exempt.
- Public profiles use an allowlist (`PUBLIC_FIELDS` in aura-users). A new user field stays private unless it's added there.
- Request bodies that aren't JSON objects get a 400, and path segments are URL-decoded safely (bad escapes give 404), in every Lambda.
- aura-groups refuses every non-GET request from a site-banned account.
- Ad rewards are off (`ADS_ENABLED` in aura-aura and src/pages/AuraWallet.jsx, kept equal by a test) until a real ad network verifies views.
- Security headers live in `customHttp.yml` (Amplify). The CSP is report-only for now; no inline scripts (the theme boot script is `public/theme-boot.js`).
- Several handlers use ScanCommand. Replace them with GSIs before launch.
- Never enforce limits only on the frontend. Lambdas must enforce all aura limits.
- Site moderation: `ADMIN_IDS` (only the owner's `aura_app` account) is defined in aura-users, aura-posts and aura-comments. Change all three together. Moderators can remove any post or comment (existing DELETE routes) and ban/unban via POST /admin/ban (aura-users), which hides or restores the user's posts and comments (`removedBy: 'ban'`) and hides their profile. The /moderation page shows only when GET /users/me returns `isAdmin`.
- Balances: `auraEarned` (cashable) and `auraSpendable` on the user record; `auraBalance` is kept equal to their sum for display. Lifetime counters: `lifetimeEarned`, `lifetimeReceived`, `lifetimeGiven`, `lifetimeTaken`, `lifetimeLost`. Records without `auraVersion: 2` predate the split and are reset to 0 on first use.
- aura-aura is the only writer of balances. It logs every change to aura-transactions with its earned/spendable split. Daily usage lives in aura-daily-budgets under `<userId>#<UTC date>`; per-source and per-post counters use other keys in the same table.
- The daily limits (`RULES`) are defined in both aura-aura (enforces) and aura-users (reports `today` on GET /users/me). Change both together.
- Post topics (`TOPICS`, max 3 per post) are defined in both `src/utils/topics.js` and aura-posts (validates). Change both together.
- Post hashtags (free-form, `MAX_HASHTAGS` 10, `HASHTAG_PATTERN`) are defined in both `src/utils/hashtags.js` and aura-posts. Change both together. `src/backendContract.test.js` fails CI if any of these shared constants drift.

## Feed

- Recommendations use explicit choices (Tune your feed panel, "Show more/less like this") plus what the feed learns on the device (`src/utils/tasteProfile.js`, decided 2026-10-28): gives (+), takes (−), likes, and later comments and shares. Each teaches the post's topics, hashtags, creator (gently, capped) and embedding, fading with a 30-day half-life. Explicit choices always outweigh it (TASTE_WEIGHT < MORE_BOOST/LESS_PENALTY), and every 5th post is exploration. On by default; Settings > Privacy turns it off or resets it. Never track clicks, views, dwell time or skipped posts.
- Preferences and the learned taste are stored only in the browser's localStorage (`src/utils/feedPrefs.js`, `src/utils/tasteProfile.js`) and must never be sent to the server. Comments and shares should call `recordEngagement` once their UI exists.
- Keywords: users can add free-text "more/less" keywords. The model (Xenova/all-MiniLM-L6-v2 via @huggingface/transformers, pinned) runs only in the browser, in a web worker (`src/workers/embed.worker.js`); keyword vectors are cached with the prefs, so feed loads never need the model. Everything is self-hosted: model files are committed in `public/models/` (sha256 of model_quantized.onnx: afdb6f1a…), and `scripts/copy-ort.js` copies the ONNX runtime into `public/ort/` (gitignored) before every start/build. Nothing loads from third parties. The Amplify SPA rewrite rule must exclude `onnx`, `wasm` and `mjs`, or those files get served as index.html.
- Post embeddings are computed on the author's device at post time and sent as `embedding` (base64 of 384 int8 values). aura-posts only checks the format and length (`isValidEmbedding`) because the model is too big for Lambda (358 MB vs the 250 MB limit). Authors could send a misleading vector, the same way they could mis-tag a topic. Posting still works without one. Keep EMBED_MODEL and EMBED_DIM in sync between `src/utils/embeddings.js` and aura-posts.
- Search (`/search`, 2026-11-12; `src/pages/Search.jsx`, `src/utils/searchRanking.js`): a search icon in the phone top bar and a search field in the sidebar (not a tab). Posts are matched on the device against the feed's pool (GET /posts): words first (caption, hashtags, topics, author), the on-device model's meaning when words differ, then hotScore, then a light taste nudge. No exploration slots. Queries are never saved or sent for post matching; groups use GET /groups?q= and an exact @username uses GET /users/{name}. Searching all posts (beyond the pool) needs a server index before launch.
- Caption view (2026-11-13, `src/components/feed/CaptionList.jsx`): a Posts / Captions switch above the feed. Captions shows each post Reddit-style as its caption first (author, type, aura, comments, hashtags) and tapping it opens the post page. A "Filter by caption" box narrows it on the device (every typed word must start a word of the caption or a hashtag). The choice is remembered per device in localStorage (`aura.feedView`).
- GET /posts returns the same posts to every viewer: the overall top 100 by hot score plus the top 20 per topic, each with `hotScore`. The client re-ranks them (`src/utils/feedRanking.js`). It still scans the table; move the per-topic lists to a GSI before launch.

## Economy (final)

- Daily free aura: regular 250, premium 1,000 (login bonus plus free give quota).
- 10,000 aura starts at $1. Only the dollar value of 10,000 aura floats with the treasury. The rate shifts gradually.
- Treasury is seeded with $100. After that, 50% of net profit goes into the treasury and 50% to the owner.
- Cashout is on the public Roadmap, not in the MVP (payments and money-transmission law come first). The app and About page say aura has no cash value. Planned terms: $20 minimum, verified creator account only ($20/year), 18+ only. Creator receives 75%, platform keeps 25%.
- Earned aura (cashable) comes only from others giving to your posts or Moments. Earned can also be given once spendable runs out (giving uses free quota, then spendable, then earned); spendable is never cashable. Login bonus, free quota, game winnings and power-up aura are spendable and never cashable.
- Taking (2026-10-27): costs the taker the same amount (spendable, then earned) and nobody receives it; the author's spendable drops by the amount. Authors set `allowTakes` per post at creation (locked; comments follow their post). Group owners can set `allowTakes` on a group. aura-aura enforces all of it. Blocking users is next on the roadmap.
- Anti-exploit: max 500 earned aura/day from any one account. Gifts from accounts under 7 days old count as spendable. 30-day account age and 50 unique aura sources are required before the first cashout. Flag same-device or same-IP giving.
- Carried over from earlier, not re-confirmed: give cap 500/day regular and 2,000/day premium, take cap 250/day regular and 1,000/day premium, max 50 taken per post.
- Aura is never sold for money. Real money buys only subscriptions (premium $4.99/month) and cosmetics.

## Product decisions

- Settings: Account, Privacy (including private accounts with follow requests), Notifications, Analytics (mostly behind creator paywall), Danger zone. Creator and payouts live in the Aura Wallet page. A separate Subscriptions page is on hold.
- Username changes: regular users get 1 lifetime change, then the username is locked unless they buy premium. Premium gets 1 change per 24 hours. Moving off a placeholder, invalid or duplicate username is free. aura-users enforces this and returns `usernameStatus` on GET /users/me.
- Premium: ad-free (users can turn ads back on), customizable posts (about 120 fonts, colors, backgrounds), higher limits.
- Ads: non-personalized, 1 per 10 posts in feed, labeled "Sponsored", native card style, no autoplay.
- Themes (`src/themes/index.js`): Day, Night, Light (pure white), Dark (pure black), Snowy Peaks, Duskfall, City Skies (night city from a rooftop, AURA sign on a hill); a custom builder is planned (colors/fonts free, image/GIF/video backgrounds Premium, visible only to its owner). The theme is saved on the account (`theme`, owner-only; `THEME_IDS` in aura-users must match the app's). The welcome/sign-in pages rotate through Day, City Skies, Snowy Peaks, Night and Duskfall, and visitors can pause on one. Scenery animates even when the device asks for reduced motion (user's decision, 2026-10-28); it plays at 0.6× speed there, and Settings > Animated scenery turns it off.
- Theme look (2026-11-06, after testers called it childish): never handwriting fonts. Each theme has its own signature gradient as `--brand-*` (fills) and `--brand-ink-*` (text) in index.css; CTAs, card borders and `.aura-kicker` labels use it. A new theme must define both sets plus `--wordmark-ink`.
- Logo and headings (2026-11-07, after "the name is plain"): the Fraunces serif (`@fontsource-variable/fraunces`, full axes). The logotype (`src/components/brand/Wordmark.jsx`) is Fraunces italic with SOFT 100 / WONK 1 in solid `--wordmark-ink`, with the logo's own halo (`/aura-halo.webp`, same as the app icon) over the "A"; on the landing page the big floating halo sits above the name instead. Text is never gradient-filled; `.aura-em` is solid `--brand-ink-2`.
- Scenes (2026-11-07): the user rejected a redesign of Day/Night into a hillside farm (with film grain, no rays/sparkles/constellation) and had it reverted. Keep Day and Night as they are (sun and rays, cloud bank, sparkles, nebulae, constellation). Kept from that pass: the Day hot-air balloon and the Snowy Peaks changes (taller ranges, lit cabin with chimney smoke, randomly scattered snow). Ask before restyling a scene's overall look.
- Group games (no house, no rake, player vs player): Connect 4, 8-Ball Pool ("Crazy 8s" in the notes meant pool, not the card game), Poker, Go Fish, Dice Duel, Flip a Coin. Skill games first. Stake cap applies. Built 2026-11-13, see "Games" below.
- Moments: group-only dual-camera photos/video, 24-hour expiry unless saved, aura on them counts as earned.
- Profile: 3 pins max, 10 tags max, badges, global aura rank (hideable).
- Navigation (2026-11-12): five main tabs only (Feed, Groups, Post, Notifications, Profile/Me). Everything else goes in `moreItems` (`src/components/layout/navItems.js`): the sidebar's "More" section on desktop and the "Me" sheet on phones. Add new pages there, not as new tabs.
- Motion (2026-11-12): app animations live in `src/motion.css` and `src/components/motion/`. Small feedback moments (give, take, like, bell, wallet orbs, count-ups) always play, even with reduced motion (user's decision); only big movement (posts rising, the publish send-off) turns into fades there. Theme switches crossfade (ThemeContext).
- Videos in posts (2026-11-13, `src/components/post/FeedVideo.jsx`): Instagram style, as the user asked. They play muted and looping while at least 60% on screen, pause when scrolled away, and start loading about 400px before they scroll in. No browser player controls (no volume bar or speed menu). Tapping the video pauses or resumes it; the small speaker button toggles sound, and that choice carries over to every video. If a phone blocks autoplay, a play button shows and a tap starts it. Tapping anywhere else on a post (not a button, link, menu or video) opens the post page. Feed videos fill their box Instagram style (shape between 4:5 and 1.91:1, cropped). There, the video takes its exact shape (up to 55vh tall, no black bars), picks up where it was, stays pinned at the top while the comments scroll, and has a draggable seek bar (arrow keys skip 5 s).
- Comments (2026-11-13): replies stay one level deep (aura-comments rejects deeper nesting), so replying to a reply posts in the same thread, starting with "@name ", like Instagram. @mentions in comments link to profiles (`src/utils/mentions.js`), but only for real accounts (people in the conversation, or confirmed once with GET /users/{name}); other tags stay plain text. Typing @ suggests people already in the conversation, matching usernames and display names.
- Comment notifications (2026-11-13): aura-comments writes them to aura-notifications after a comment saves (best effort). Each person hears once, by the most specific reason: `reply` (their comment was replied to), then `mention` (tagged), then `comment` (on their post). Never the commenter, banned accounts, someone whose `notificationPrefs` turns that type off, or a tagged person who can't see the post (private account or group). At most 10 tags per comment notify. The `MENTION` pattern is shared with `src/utils/mentions.js` (a test keeps them equal); usernames resolve through `USERNAME#` reservation items. `mention` is in NOTIFICATION_TYPES (aura-users) and Settings ("Tags in comments").
- App tour (2026-11-13): a guided, skippable walkthrough of the main points (about 10 steps; the user wants it kept short), page by page (feed, post page, groups, profile, More), spotlighting real elements with a note beside them. Steps live in `src/components/tour/tourSteps.js`; elements are tagged `data-tour="…"` (the first visible match wins, so the sidebar and the phone tab bar tag the same names). The page stays usable underneath, and it has people make a first post (a hands-on step: no dimming, and the note shrinks to a bar at the top once they type or scroll): CreatePost fires `aura:post-created`, which moves the tour to "Your first post is live". AppShell opens it once per account per device (`src/utils/tour.js`) and whenever the URL has `?tour=1` ("App tour" in moreItems). When you rename or remove a tagged element, keep its `data-tour` or update the steps.
- Suggestions & Reviews (2026-11-12): one page, `/feedback`, with two tabs. aura-users serves `/feedback/*` (`backend/lambdas/aura-users/feedback.mjs`, table `aura-feedback`, key `feedbackID` with a capital ID, as the table was created). Suggestions are signed-in only: 3 a day, one vote each. Reviews are one per person, 1–5 stars; a moderator approves them in /moderation before they show publicly, and editing sends them back for approval. The welcome page shows approved reviews via the public `GET /feedback/reviews`.

## Follows

- Following (2026-11-12): `backend/lambdas/aura-users/follows.mjs` serves `/follows/*` (API route `ANY /follows/{proxy+}`, cognito-auth). Table `aura-follows`: partition key `userId`, sort key `edge`. Each follow is two items written in one transaction, `OUT#<followee>` on the follower and `IN#<follower>` on the followee, with `status` `active` or `pending`. `followerCount` / `followingCount` on user records count active follows only (public, via PUBLIC_FIELDS).
- Private accounts: following them is a request the owner approves or declines (Notifications page). Turning private off approves everyone waiting. Owners can remove followers. Max 5,000 follows plus open requests per account; banned accounts can't follow and are hidden.
- Outside groups, a private account's posts, comments, likes and aura are for the owner, approved followers and site moderators only. `privacy.mjs` (identical copies in aura-posts, aura-comments, aura-aura; a test fails if they drift) does the check; aura-posts' `visibleToViewer` is the one place posts are filtered. Group posts follow the group's rules instead. The profile itself (name, bio, counts) stays public.
- Comment visibility: new posts store `commentVisibility` (`anyone` | `followers`, from CreatePost, defaulting to the account's `commentVisibilityDefault`; group posts are always `anyone`). aura-comments lets only the author and active followers comment on followers-only posts, and any unknown value fails closed. `COMMENT_VISIBILITY` is in aura-users and aura-posts (kept equal by a test).
- Follow notifications (`follow`, `follow_request`, `follow_accepted`) are written by aura-users to aura-notifications, best effort, respecting `notificationPrefs.followRequest` / `followAccepted`.

## Games

- Built 2026-11-13. Group-only, two players, for an aura stake or friendly (0). Served by aura-aura (`backend/lambdas/aura-aura/games.mjs`, API route `ANY /games/{proxy+}`, cognito-auth) because aura-aura is the only writer of balances. Rules are pure functions in `gameRules.mjs` (Connect 4, heads-up no-limit Hold'em freezeout with 1,000 chips each and blinds doubling every 6 hands, 8-Ball Pool, Go Fish, Dice Duel best of 3, Flip a Coin).
- The server deals, rolls and flips (crypto.randomInt), checks every move, and only sends `viewFor(state, seat)`: never the deck or the other player's cards. Members of the group can watch (seat null, no hands shown); only active members can challenge or accept.
- Money: each stake is paid when the player sits down (challenge or accept), spendable first then earned, and held on the match. The winner gets both stakes as spendable (game winnings are never cashable); a draw, withdrawn or declined challenge refunds each stake exactly as paid. Logged in aura-transactions as `game_stake`, `game_win`, `game_refund`. Every write is one transaction with the match's `version` check, so a lost race moves no aura.
- Limits (`STAKE_CAP` in games.mjs and `src/components/games/gameInfo.js`, kept equal by a test): at most 500 aura a game and 500 a day in stakes (premium 2,000), 30 new games a day. Turn timer 2 minutes; after that the waiting player can claim the win. Either player can resign.
- Table `aura-games`: partition key `matchId`; GSI `groupId-createdAt-index` (groupId, createdAt) lists a group's games; TTL on `expiresAt` (finished games kept 60 days). Notifications `game_challenge` / `game_accepted` respect `notificationPrefs.games`.
- 8-Ball Pool (2026-11-14, replaced Crazy Eights): physics and rules in `pool.mjs`. A move is `{angle, power 0..1, cue?: [x, y]}`; the server runs the whole shot (portrait 1000×2000 table, ball radius 22, six pockets) and stores the result plus a 20 fps recording (`shot.frames`) that `src/components/games/PoolTable.jsx` plays back. Casual 8-ball rules: open table until someone pots cleanly, fouls (no hit, wrong group first, scratch) give ball in hand anywhere, the 8 early or with a foul loses, the 8 on the break re-racks, 300 shots is a draw. A poll sends `?have=<shot no>` so the recording isn't resent. Table sizes are shared with the app (a test keeps them equal).
- App: a Games tab on group pages (`src/components/games/GroupGames.jsx`) and `/games/:matchId` (`src/pages/GameMatch.jsx`, boards in `Boards.jsx`). The page polls (2 s waiting on them, 8 s on your turn) since there are no websockets yet. `npm run test:games` plays thousands of random games and checks the rules' invariants.

## Likes and shares

- Likes: a free, private bookmark/reaction with no aura effect. They only shape the liker's own on-device feed learning, never anyone else's ranking. Posts, comments and Moments can be liked. The author always sees their own like count; nobody else does (strip likeCount for non-authors). The Liked tab is owner-only and re-checks visibility on every read. Likes don't notify. Only followers can like a private account's posts. Banned users can't like.
- Shares: launch target is groups only (no copy link yet; DM sharing after chat). The sharer must be an active member of the target group, and can share a given post to a given group once. Private-account posts, Moments and posts from private groups can't be shared.
- A share card always shows the original post with "Originally posted by @author" rendered from the original, which the sharer can't remove.
- Aura on a share has two targets: the original author (earned, counted on the original post) and the sharer. For now the sharer always receives spendable aura; a way to reward reposts that add commentary is to be designed later.
- The share count is visible only to the author, and only on creator accounts.

## Build order

1. Settings page (next), Aura Wallet page, follow system
2. Post customization, groups UI, games, power-ups, Moments, search, leaderboard
3. Aura split (earned/spendable), caps, treasury and rate, Stripe, cashout flow, badges and rank
4. Security pass: WAF, rate limits, cooldowns, input sanitization, signed S3 URLs, CORS, pen testing
5. React Native app and store submission
6. Chat (post-launch). Remind the user later about aura-reactive post glow.
