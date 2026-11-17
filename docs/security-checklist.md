# Aura security checklist (before submitting)

Checked by Claude Code on 2026-11-16 by reading the code and the live AWS
settings (read-only). **✅ checked and fine · ⚠️ worth fixing · 🔲 needs you.**
Work down the 🔲 and ⚠️ items; each says what to do.

## Accounts and sign-in
- 🔲 **Cognito password policy and MFA.** In the Cognito console (user pool > Sign-in experience), confirm passwords need 8+ characters with mixed types, and turn on optional MFA (authenticator app). Claude Code can't read the pool's settings.
- 🔲 **Account recovery** is by verified email only (Cognito > Sign-in experience > Account recovery).
- ✅ Every API route except two needs a signed-in token (cognito-auth). The public ones are `GET /feedback/reviews` (approved reviews for the welcome page) and `GET /users/{username}` (public profile fields only; private accounts hide their posts).
- ✅ Ages under 13 can't sign up (checked in the app; ⚠️ add the same check in a Cognito pre-sign-up trigger if you want it enforced server-side).
- ✅ Banned accounts are refused wherever content is created or aura moves (aura-users, aura-posts, aura-comments, aura-groups, aura-aura); aura-notifications only lets people manage their own notifications.
- ⚠️ **Admin list in three places.** The admin user ID is written into aura-users, aura-posts and aura-comments. If you add a moderator, change all three (or move it to one environment variable).

## The API
- ✅ Throttling on the whole API: 50 requests a second, bursts of 100, plus per-person rate limits inside each Lambda (posting, reacting, giving aura, suggestions, support, custom topics).
- ✅ **Per-route limits (2026-11-17)** on the routes that create things or cost money, on top of the whole-API limit: sign-up profile `POST /users` and reports 3/s (bursts of 6); posting, post upload URLs and the daily bonus 10/s (20); group creation, other upload URLs, feedback/support and ad rewards 5/s (10); `POST /posts/fix-author` 3/s (6). These are shared by everyone, so raise them when real traffic grows (API Gateway > Stages > $default > Throttling, or `aws apigatewayv2 update-stage --route-settings`).
- ℹ️ **Firewall (AWS WAF):** it can't attach to Aura's API directly, because WAF supports API Gateway REST APIs, not HTTP APIs. Options when the budget allows: WAF on the Cognito user pool (bot sign-ups, password guessing; about $6-8 a month), WAF on the website through Amplify ($15 a month per app plus WAF fees; doesn't cover the API), or CloudFront with WAF in front of the API. Corey chose the free steps for now (2026-11-17).
- ⚠️ **CORS allows any website** (`AllowOrigins: *`) on the API. It's safe today because the app sends a bearer token, not cookies, so another site can't act as a signed-in person. Tightening it to your real domain(s) is still good hygiene: API Gateway > CORS > Access-Control-Allow-Origin.
- ✅ Every limit is enforced on the server, not only in the app (aura, reactions, suggestions, Theme Studio Premium, custom topics, tags, locations, fonts).
- ✅ Bodies must be JSON objects; ids in paths are URL-encoded and checked; unknown fields are dropped.
- ✅ Errors return a short message; stack traces go to CloudWatch only.

## Data and privacy
- ✅ Private accounts: their posts, comments, reactions and aura history are checked against followers on the server.
- ✅ Blocks are enforced both ways (posts, comments, reactions, tags, aura, follows).
- ✅ Angel runs on the device; only reports, support messages and actions the person says yes to reach the server.
- ✅ Theme Studio pictures and videos never leave the device; locations are a typed place name, never GPS.
- ⚠️ **Media bucket is publicly readable by address.** `aura-app-media-…` lets anyone fetch any file whose address they know (listing is off, and keys are random, so they can't be guessed). That includes photos on private accounts' posts if someone shares the link. Fix later with CloudFront signed URLs; fine for a contest build.
- ⚠️ **Media uploads accept any origin** (bucket CORS `*` with PUT/POST/DELETE). Uploads still need a signed URL from the API (10 minutes, fixed type and size), so this is low risk; set AllowedOrigins to your domain(s) in S3 > Permissions > CORS.
- 🔲 **Turn on DynamoDB point-in-time recovery** for the main tables (aura-users, aura-posts, aura-comments, aura-likes, aura-follows, aura-groups, aura-transactions), so a bad write can be rolled back: DynamoDB > table > Backups > Point-in-time recovery.
- 🔲 **TTL on aura-games** (`expiresAt`), still open from the TODO.

## Money (aura)
- ✅ aura-aura is the only writer of balances; every change is one conditional transaction logged in aura-transactions.
- ✅ Spendable vs earned is enforced on the server; nothing earned is cashable yet (cashing out isn't built).
- ✅ One-time bonuses (first suggestion) can't pay twice, tested with double taps and failures.

## The app (browser)
- ✅ No raw HTML from users is ever rendered (no `dangerouslySetInnerHTML`); captions, comments and overlays are text.
- ✅ Links in posts open in a new tab with `noopener noreferrer nofollow`, and only http(s) addresses are accepted.
- ✅ No secrets in the repository (scanned for AWS keys, private keys and tokens).
- ✅ The phone audit's sample data is left out of real builds (checked in the built files).
- ⚠️ **Dependencies** (`npm audit`): most findings are build tools inside react-scripts and never reach users. One that does: **react-router** has an open-redirect issue in links built from a backslash path; Aura's links are built from encoded ids and usernames, so it isn't reachable today, but the fix is upgrading to react-router 7 (a bigger change; after the contest).
- ✅ **Security headers** are set in `customHttp.yml` (Amplify Hosting): an enforced Content-Security-Policy (since 2026-11-16, commit 8aa4651), Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and Cross-Origin-Opener-Policy. Re-check the CSP whenever a new outside script or domain is added.

## Account-level (free, needs you: Claude Code's AWS user has no access)
- 🔲 **Billing alert:** Billing > Budgets > Create budget > "Monthly cost budget" (zero-spend or e.g. $10), email alerts at 80% and 100%. Catches abuse or a runaway bill early.
- 🔲 **IAM Access Analyzer:** IAM > Access analyzer > Create analyzer (zone of trust: this account). Free; flags anything shared outside the account (like the public media bucket).
- 🔲 **Domain:** Route 53 won't register domains on this free-plan account, so buy it at a registrar (Cloudflare, Porkbun, Namecheap), then add it in Amplify > Domain management; Amplify shows the DNS records to add at the registrar.

## IAM
- ✅ Each Lambda has its own role with only the tables and actions it uses (`backend/iam/`, checked against the live roles on 2026-11-16).
- ✅ The CLI user Claude Code uses can't change IAM policies.
- 🔲 **Root account**: MFA on, no access keys (IAM > Security recommendations).

## Before you submit
1. 🔲 Deploy aura-posts (fonts, custom topics, tags and places) — TODO step 19.
2. 🔲 Try the main flows signed in on a phone: post with a tag and a place, react on a comment, a suggestion's 500 aura, Theme Studio, a game.
3. 🔲 The items marked 🔲 above.
