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
- Tables: aura-users, aura-posts, aura-transactions, aura-daily-budgets, aura-groups, aura-group-members, aura-comments, aura-likes, aura-notifications, aura-shares
- User is on Windows PowerShell. Use PowerShell syntax, not bash.

## Code conventions

- Each Lambda has a response() helper, a handler that parses method/path/segments, and one function per route. Define every function once, above the handler.
- New API routes need a route in API Gateway with the cognito-auth authorizer where required. That is done manually in the console, not by deploy.ps1.
- Usernames are unique, enforced by reservation items in aura-users keyed `userId = USERNAME#<name>` (attributes: ownerId, createdAt; no `username` attribute). Any code that scans aura-users must skip keys starting with `USERNAME#`.
- Usernames are stored lowercase. Posts denormalize authorUsername, authorDisplay and authorPicKey. Changing a profile calls POST /posts/fix-author to backfill them.
- Several handlers use ScanCommand. Replace them with GSIs before launch.
- Never enforce limits only on the frontend. Lambdas must enforce all aura limits.
- Balances: `auraEarned` (cashable) and `auraSpendable` on the user record; `auraBalance` is kept equal to their sum for display. Lifetime counters: `lifetimeEarned`, `lifetimeReceived`, `lifetimeGiven`, `lifetimeTaken`, `lifetimeLost`. Records without `auraVersion: 2` predate the split and are reset to 0 on first use.
- aura-aura is the only writer of balances. It logs every change to aura-transactions with its earned/spendable split. Daily usage lives in aura-daily-budgets under `<userId>#<UTC date>`; per-source and per-post counters use other keys in the same table.
- The daily limits (`RULES`) are defined in both aura-aura (enforces) and aura-users (reports `today` on GET /users/me). Change both together.
- Post topics (`TOPICS`, max 3 per post) are defined in both `src/utils/topics.js` and aura-posts (validates). Change both together.
- Post hashtags (free-form, `MAX_HASHTAGS` 10, `HASHTAG_PATTERN`) are defined in both `src/utils/hashtags.js` and aura-posts. Change both together. `src/backendContract.test.js` fails CI if any of these shared constants drift.

## Feed

- Recommendations use only explicit choices (Tune your feed panel, "Show more/less like this"). Never track clicks, views, dwell time or likes for ranking.
- Preferences are stored only in the browser's localStorage (`src/utils/feedPrefs.js`) and must never be sent to the server.
- Keywords: users can add free-text "more/less" keywords. The model (Xenova/all-MiniLM-L6-v2 via @huggingface/transformers, pinned) runs only in the browser, in a web worker (`src/workers/embed.worker.js`); keyword vectors are cached with the prefs, so feed loads never need the model. Everything is self-hosted: model files are committed in `public/models/` (sha256 of model_quantized.onnx: afdb6f1a…), and `scripts/copy-ort.js` copies the ONNX runtime into `public/ort/` (gitignored) before every start/build. Nothing loads from third parties. The Amplify SPA rewrite rule must exclude `onnx`, `wasm` and `mjs`, or those files get served as index.html.
- Post embeddings are computed on the author's device at post time and sent as `embedding` (base64 of 384 int8 values). aura-posts only checks the format and length (`isValidEmbedding`) because the model is too big for Lambda (358 MB vs the 250 MB limit). Authors could send a misleading vector, the same way they could mis-tag a topic. Posting still works without one. Keep EMBED_MODEL and EMBED_DIM in sync between `src/utils/embeddings.js` and aura-posts.
- GET /posts returns the same posts to every viewer: the overall top 100 by hot score plus the top 20 per topic, each with `hotScore`. The client re-ranks them (`src/utils/feedRanking.js`). It still scans the table; move the per-topic lists to a GSI before launch.

## Economy (final)

- Daily free aura: regular 250, premium 1,000 (login bonus plus free give quota).
- 10,000 aura starts at $1. Only the dollar value of 10,000 aura floats with the treasury. The rate shifts gradually.
- Treasury is seeded with $100. After that, 50% of net profit goes into the treasury and 50% to the owner.
- Cashout: $20 minimum, verified creator account only ($20/year), 18+ only. Creator receives 75%, platform keeps 25%.
- Earned aura (cashable) comes only from others giving to your posts or Moments. Earned can also be given once spendable runs out (giving uses free quota, then spendable, then earned); spendable is never cashable. Login bonus, free quota, aura taken from others, game winnings and power-up aura are spendable and never cashable.
- Anti-exploit: max 500 earned aura/day from any one account. Gifts from accounts under 7 days old count as spendable. 30-day account age and 50 unique aura sources are required before the first cashout. Flag same-device or same-IP giving.
- Carried over from earlier, not re-confirmed: give cap 500/day regular and 2,000/day premium, take cap 250/day regular and 1,000/day premium, max 50 taken per post.
- Aura is never sold for money. Real money buys only subscriptions (premium $4.99/month) and cosmetics.

## Product decisions

- Settings: Account, Privacy (including private accounts with follow requests), Notifications, Analytics (mostly behind creator paywall), Danger zone. Creator and payouts live in the Aura Wallet page. A separate Subscriptions page is on hold.
- Username changes: regular users get 1 lifetime change, then the username is locked unless they buy premium. Premium gets 1 change per 24 hours. Moving off a placeholder, invalid or duplicate username is free. aura-users enforces this and returns `usernameStatus` on GET /users/me.
- Premium: ad-free (users can turn ads back on), customizable posts (about 120 fonts, colors, backgrounds), higher limits.
- Ads: non-personalized, 1 per 10 posts in feed, labeled "Sponsored", native card style, no autoplay.
- Group games (no house, no rake, player vs player): Connect 4, Poker, Crazy 8s, Go Fish, Dice Duel, Flip a Coin. Skill games first. Stake cap applies.
- Moments: group-only dual-camera photos/video, 24-hour expiry unless saved, aura on them counts as earned.
- Profile: 3 pins max, 10 tags max, badges, global aura rank (hideable).

## Likes and shares

- Likes: a free, private bookmark/reaction with no aura effect and no effect on feed ranking. Posts, comments and Moments can be liked. The author always sees their own like count; nobody else does (strip likeCount for non-authors). The Liked tab is owner-only and re-checks visibility on every read. Likes don't notify. Only followers can like a private account's posts. Banned users can't like.
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
