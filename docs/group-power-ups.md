# Group power-ups and aura gamification (plan, 2026-11-15)

A plan for "Aura power ups within groups" from the handwritten notes. Nothing here is built yet. It's written to fit the economy rules in `CLAUDE.md`, so it can be built in stages without changing them.

## What it's for

- **Make groups feel alive.** Give members reasons to come back daily, and moments the whole group shares, like an aura rain or a surge hour.
- **Reward generosity, not farming.** Most rewards go to people who give aura and take part, not to people who just collect it.
- **Give each group an identity.** A level, a look and a trophy shelf that members build together.
- **Protect the economy.** Power-ups mostly use up aura. Nothing new becomes cashable, and none of it can be bought with real money.

## Rules every feature follows

These come from the current economy and add nothing new to it.

1. **Spendable aura only.** Power-ups are bought with spendable aura, and any bonus they pay out is spendable. Earned (cashable) aura still comes only from people giving to your posts or Moments.
2. **No aura from nowhere.** Every bonus is paid from aura someone put in, such as the group's pool or the buyer, or from the existing daily free allowances. Nothing is created out of thin air.
3. **aura-aura stays the only writer of balances.** Every purchase, contribution and payout runs through it in one transaction and is logged in `aura-transactions`.
4. **Not pay-to-win.** Aura is never sold, and Premium gets cosmetic variants and a little more room, not stronger effects. Games stay pure skill: no power-ups inside a match.
5. **Abuse-resistant.**
   - Accounts under 7 days old, or in the group under 3 days, can't contribute to the pool or claim shared rewards.
   - Daily caps apply per person and per group.
   - Site-banned and group-banned accounts are excluded.
6. **Owners can switch it off.** Group settings gain "Power-ups on/off", next to "Members can take aura".

## The pieces

### 1. Group level ("Resonance")

The group earns XP from real activity by members:

- posting
- commenting
- giving inside the group
- playing games
- posting Moments
- completing weekly goals

Each member's XP counts up to a daily cap, so one person spamming can't level the group. Levels unlock cosmetics and comfort, never power:

| Level | Unlocks |
|---|---|
| 2 | Group accent color (picked from the theme palettes) |
| 3 | A second pinned post |
| 5 | Animated group banner frame (reuses the post frames) |
| 7 | Custom group emoji: 3 reaction slots |
| 10 | Group "glow" on its posts in members' feeds (the aura-reactive glow idea in `CLAUDE.md`) |
| 15 | Season trophy shelf on the group page |

Level is public and shown on the group card. This is the cheapest piece to build, with no money flow at all, and the biggest visible win.

### 2. The group pool ("Hearth")

- **Contributions:** members can put spendable aura into a shared pool, up to a daily cap (say 200 a person).
- **What the pool pays for:** only group power-ups and group events. It can never be withdrawn to a person.
- **Visible:** every contribution and spend is listed in a public "Hearth ledger" tab.
- **A sink:** the pool turns spare spendable aura into shared experiences, which keeps balances from piling up.
- **Who spends it:** owners and mods choose what the pool buys, or members vote if the owner turns voting on.

### 3. Power-ups

These are one-off effects bought with your own spendable aura or the pool. Prices below are starting points to tune.

| Power-up | What it does | Paid by | Starting cost |
|---|---|---|---|
| **Spotlight** | Pins a post to the top of the group feed for 24 h with a soft glow. One active per group. | Anyone (for their own post) or the pool | 150 |
| **Aura Rain** | A pot of aura (100 to 2,000) falls on the group for 10 minutes. Members tap to catch a share, first come, with at most a tenth of the pot each. | Pool, or a generous member | The pot itself |
| **Surge Hour** | For one hour, every give inside the group is topped up 50% from the pool until the set budget runs out. The top-up is spendable for the receiver. | Pool | The budget (say 500) |
| **Shield** | A post can't be taken from for 24 h, in groups that allow takes. | The author | 75 |
| **Echo** | Puts a post in the group's weekly Highlights reel. | Anyone | 50 |
| **Streak Freeze** | Saves your group streak for one missed day. | Yourself | 40 |
| **Flair** | A colored name tag in this group for 30 days. Pure cosmetic, and a steady sink. | Yourself | 100 |

Active effects show as a small banner at the top of the group, such as "Surge Hour: 38 min left".

### 4. Streaks and quests

- **Group streak:** you post, comment, give or play in the group on consecutive days. Milestones at 3, 7 and 30 days give a badge, plus a small spendable reward taken from your existing daily free allowance. No new aura is created.
- **Daily quests (3 a day):**
  - "Give to two members' posts"
  - "Comment on a new member's post"
  - "Play one game"
  - Rewards are small, are paid from the same daily allowance, and add group XP.
- **Weekly group goal:** the whole group works toward one target, such as "200 gives this week" or "30 Moments". Reaching it gives the group a burst of XP and a trophy for the week. It pays nothing into people's balances, which makes it pure teamwork.

### 5. Leaderboards and seasons

- **Weekly boards inside each group:**
  - **Top Supporters**, ranked by aura given. This is the headline board.
  - **Rising Stars:** the newest members who received the most.
  - **Game Champions:** most game wins.
- **"Most aura received" is never the headline.** That keeps the focus on generosity.
- **Seasons:** each lasts four weeks and ends with season badges shown on profiles. This uses the profile badges already planned in `CLAUDE.md`.
- **Opting out:** anyone can opt out of appearing on boards. This follows the existing hideable global rank.

### 6. Bounties

- **Posting one:** a member posts a challenge, such as "Best sunset photo by Friday", and puts up aura as the prize. The prize is held, the same way game stakes are.
- **Paying out:** the poster picks the winner, or members vote. The prize then arrives as a give from the poster, so the existing give rules decide whether it's earned or spendable (the 500 a day per source cap, and the 7-day new-account rule).
- **Cancelling:** an unclaimed bounty refunds itself after its deadline.

### 7. Group tournaments and clashes (later)

- **Tournaments:**
  - An 8 or 16 player bracket for any group game, with an optional equal buy-in that's held and paid to the top two (70/30).
  - It reuses the game engine and stake caps.
- **Aura Clash:**
  - Two groups agree to a weekend contest.
  - Whichever group gives more aura inside itself, counting unique givers so a few rich members can't decide it, wins a trophy for its shelf.
  - No aura changes hands between the groups.

## How it would be built

- **aura-aura** (balances): new routes under `/power-ups/{proxy+}`:
  - contribute to the pool
  - buy a power-up
  - start an Aura Rain and catch from it
  - pay the Surge top-up inside the existing give transaction
  - post a bounty and pay it out
  - New transaction types: `pool_in`, `powerup`, `rain_catch`, `surge_bonus`, `bounty_hold`, `bounty_pay`, `bounty_refund`.
- **New tables:**
  - `aura-group-effects`: active power-ups per group, with TTL so they expire on their own.
  - `aura-group-stats`: XP, level, pool balance and weekly counters per group, with each member's daily XP in the same table.
  - Pool and level could instead live on the group item. A separate table keeps hot counters off the group record.
- **aura-groups:** reads level and effects for the group page, and owns the "Power-ups on/off" setting.
- **aura-posts:** sorts a Spotlighted post first and adds a `glow` flag for level-10 groups.
- **App:**
  - A **Hearth** tab on group pages: level ring, pool, ledger, shop, quests and boards.
  - Effect banners on the group page.
  - Catch animations that reuse the wallet orb burst.
  - Streak flames on the member list.
- **Your console steps:** two tables, IAM updates for aura-aura and aura-groups, and one API route.

## Suggested order

| Stage | What | Why first |
|---|---|---|
| A (contest demo) | Group level and XP, weekly Top Supporters board, Spotlight, Aura Rain | Visible and fun, little economy risk. Aura Rain is a great live demo moment. |
| B | Hearth pool and ledger, Surge Hour, Shield, Flair, streaks and daily quests | Turns on the sink and the daily habit loop |
| C | Bounties, seasons and badges, tournaments | Needs the badge system and more testing |
| D | Aura Clash between groups | Needs real groups with real activity |

## Decisions for you

1. **Who spends the pool:** owner and mods only, or a member vote? I suggest owner and mods, with voting as an option.
2. **Caps:** a 200-a-day contribution cap per person, and Aura Rain capped at 2,000 a day per group?
3. **Rewards from your own allowance:** should quest and streak rewards come out of the existing daily free aura (my suggestion, so no new aura is created), or be a small new source with its own cap?
4. **Leaderboard headline:** Top Supporters (given), as suggested, or Top Received?
5. **Premium extras:** one free Spotlight a week and Flair color variants, or nothing extra at all?
6. **Stage A for the contest:** should I build Stage A now?
