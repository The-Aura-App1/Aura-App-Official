# About page: audit and new wording (draft for Corey)

Checked on 2026-11-16 against the code. **Applied 2026-11-16** (with the three goals as the Promises section), same layout and styling.
Say "approved" (or edit any line) and Claude Code puts it into `src/pages/About.jsx`,
keeping the layout, styling, voice and the founder's quote.

## 1. What the page says today, and whether it's true

| Section | Claim | True? | Checked in |
|---|---|---|---|
| Problems | The three problem cards (attention, AI content, data) | Opinion, fine | — |
| Steps | Free aura every day, never asked to pay for it | ✅ | aura-aura daily bonus |
| Steps | Giving aura tells people a post is worth seeing | ✅ | feed ranks by aura |
| Steps | Taking costs the taker the same; authors and groups can turn taking off | ✅ | aura-aura `takeAura`, `allowTakes` |
| Steps | Posts climb by aura given, not by time stared at | ✅ | `hotScore` in aura-posts uses only aura and age |
| Promises | Tune with topics, keywords, "Show more/less"; learns from aura and likes | ✅ | Tune your feed, `tasteProfile.js` |
| Promises | Never uses clicks, views or watch time to rank | ✅ | views are counted for creators' own stats only, never used in ranking |
| Promises | Feed settings stay on your device; keyword matching on the device | ✅ | `feedPrefs.js` (localStorage), on-device model |
| Promises | Ads: never personalized, at most 1 per 10, labeled, no autoplay, Limited Ads, Premium ad-free | ✅ | `src/ads`, CLAUDE.md ads section |
| Promises | Daily limits enforced on the server | ✅ | aura-aura rules |
| Roadmap · Next up | Blocking | ❌ shipped | follows.mjs, SafetyActions |
| Roadmap · Next up | Following, private accounts, follow requests | ❌ shipped | follows.mjs |
| Roadmap · Next up | Reporting and moderation tools | ❌ shipped | Report menus, `/moderation` |
| Roadmap · Soon | iOS and Android apps | ✅ not built | — |
| Roadmap · Soon | Moments | ✅ not built (only an on/off switch for groups exists) | GroupPage |
| Roadmap · Soon | Group games for aura | ❌ shipped (nine games, plus bots) | `/games`, aura-aura games |
| Roadmap · Soon | Aura Premium | ⚠️ the page and perks exist and the first 100 accounts get it free; buying it isn't open yet | Premium.jsx |
| Roadmap · Later | Creator payouts | ✅ not built | — |
| Roadmap · Later | Badges, leaderboards, a hideable global rank | ⚠️ group leaderboards exist; badges are never awarded and no global rank is calculated | GroupLeaderboard, aura-users |
| Roadmap · Later | Direct messages | ✅ not built | — |
| FAQ | Is Aura free? | ✅ | — |
| FAQ | Can I buy aura? "Real money only buys Premium and cosmetics" | ⚠️ nothing can be bought yet | Premium.jsx ("coming soon") |
| FAQ | Can I turn aura into money? No cash value | ✅ | — |
| FAQ | How does Aura make money? "Premium ($4.99/month), optional cosmetics, ads" | ⚠️ ads are live; Premium and cosmetics aren't on sale yet | — |
| FAQ | Who can join? 13 or older | ✅ | sign-up check |
| FAQ | Phone app? Browser today, iOS and Android on the way | ✅ | — |

## 2. New Roadmap (only what isn't built)

**Next up**
- Buying Aura Premium (ad-free, more aura each day, Theme Studio and more; the first 100 accounts already have it free)
- Moments: group-only photos that disappear after 24 hours

**Soon**
- iOS and Android apps
- Badges, and a global aura rank you can hide

**Later**
- Creator payouts, once the payment and money-transmission rules are sorted out
- Direct messages

## 3. New section: "What's in Aura today" (8 cards, Promises card style)

1. **Groups that grow** — Start or join a group, post and chat with members, and watch it level up as people give aura. Higher levels unlock the group's own picture, reaction pins and backgrounds.
2. **Games for aura** — Challenge members to chess, pool, mini golf, poker and more, for fun or for a small aura stake. Aura is never money, and stakes are held fairly until the game ends.
3. **Angel, your helper** — Ask Angel to find a post you half remember, tune your feed, make you a theme or answer questions. She runs on your device, and does things for you only after you say yes.
4. **Search** — Find people, groups and posts by words, hashtags or even meaning. Posts are matched right on your device.
5. **Follow, privately if you like** — Follow people you want to keep up with. Make your account private and only approved followers see your posts.
6. **Block and report** — Block anyone and you stop seeing each other. Report posts, comments or accounts, and moderators review them.
7. **Themes that move** — Pick from dreamy animated scenes like Northern Lights or Abyss, or build your own look with Premium's Theme Studio.
8. **Posts your way** — Hundreds of fonts, colors, patterns, gradients and frames, any emoji as a reaction, and text, links and people placed right on your photos.

(Cards 3, 7 and 8 mention things that are built but **not yet deployed**: Angel's actions and post-finding are app-only and live; Theme Studio, the new fonts, patterns, gradients, frames, custom topics and tagging need the aura-posts / aura-users deploys first. Publish this section after those deploys.)

## 4. FAQ changes

- **Can I buy aura?** No, never. Aura can only be earned, so the only way to get ahead is to make things people genuinely value. When Premium goes on sale, money will buy Premium and cosmetics, never aura.
- **How does Aura make money?** Today, from non-personalized ads. Next, from Aura Premium ($4.99 a month: ad-free, more daily aura, Theme Studio and more) and optional cosmetics. Never from your data.
- **New: What is Angel?** Aura's built-in helper. She runs entirely on your device: what you tell her stays there, and she only asks Aura's servers to do things you've said yes to.
- **New: Who can see my posts if my account is private?** Only the followers you approve. Everyone else sees your name and picture, not your posts.

Everything else in the FAQ stays as it is, including the age line.
