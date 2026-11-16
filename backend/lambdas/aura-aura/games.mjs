// Group games: members play each other for an aura pot. No house, no rake.
// Each player's stake is taken when they sit down (challenge or join) and
// held on the match; the winner gets every stake as spendable aura (game
// winnings are never cashable), players who tie for the win share it, and a
// draw or a cancelled table gives each stake back exactly as it was paid.
// aura-aura stays the only writer of balances.
//
// Most games are two players. Dice Duel, Go Fish and Poker can be set up for
// bigger tables (MAX_PLAYERS in gameRules.mjs): the table stays open while
// people join, starts by itself when it fills, or the challenger starts it
// once at least two are in. Players can leave an open table (stake back).
// Once it's going, resigning or running out of time takes just that player
// out (their stake stays in the pot) and the rest play on.
//
// Table aura-games: partition key matchId; GSI `groupId-createdAt-index`
// (partition groupId, sort createdAt) lists a group's games.
//
// Routes (API Gateway: GET and POST /games/{proxy+} → aura-aura, cognito-auth):
//   GET  /games/group/{groupId}        the group's open, live and recent games
//   POST /games/group/{groupId}        challenge: { game, stake, seats?, options?, opponent? }
//   GET  /games/{matchId}              the match, as the viewer may see it
//   POST /games/{matchId}/join         take a seat (starts the game when the table fills)
//   POST /games/{matchId}/start        the challenger starts a bigger table early (2+ seated)
//   POST /games/{matchId}/leave        leave an open table before it starts (stake back)
//   POST /games/{matchId}/move         { move }
//   POST /games/{matchId}/resign
//   POST /games/{matchId}/claim        the player on turn ran out of time
//   POST /games/{matchId}/cancel       the challenger withdraws an open challenge
//   POST /games/{matchId}/decline      the invited player turns it down
import { randomInt } from 'crypto';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GAMES, GameError, MAX_PLAYERS, viewFor } from './gameRules.mjs';
import { eitherBlocked } from './privacy.mjs';
import { addGroupXp } from './groupStats.mjs';

const GAMES_TABLE         = 'aura-games';
const GAMES_INDEX         = 'groupId-createdAt-index';
const USERS_TABLE         = 'aura-users';
const GROUPS_TABLE        = 'aura-groups';
const MEMBERS_TABLE       = 'aura-group-members';
const NOTIFICATIONS_TABLE = 'aura-notifications';

// Stakes: the most one match can be for (per player), and the most a player
// can put into games per UTC day, by account type. 0 is a friendly game.
export const STAKE_CAP = { regular: 500, premium: 2000 };
const DAILY_GAMES_CREATED = 30;
const MIN_STAKE_ACCOUNT_DAYS = 7;                 // as for gifts counting as earned and catching Aura Rain
const TURN_MS             = 2 * 60 * 1000;        // then another player may claim it
const KEEP_FINISHED_DAYS  = 60;                   // finished games expire from the table (TTL)
const LIST_LIMIT          = 60;

const rand = n => randomInt(n);
const seatsOf = match => match.seats ?? 2;

function publicPlayer(user) {
  return {
    userId: user.userId, username: user.username,
    displayName: user.displayName ?? user.username, picKey: user.profilePicKey ?? null,
  };
}

function summary(match) {
  return {
    matchId: match.matchId, groupId: match.groupId, game: match.game, gameName: GAMES[match.game]?.name,
    stake: match.stake, seats: seatsOf(match), status: match.status, options: match.options,
    players: match.players.map(({ paid, joinedAt, ...p }) => p),
    outUserIds: match.players.filter((_, i) => match.state?.out?.[i]).map(p => p.userId),
    invited: match.invited ?? null,
    turnUserId: match.turnUserId ?? null, winnerUserId: match.winnerUserId ?? null,
    winnerUserIds: match.winnerUserIds ?? (match.winnerUserId ? [match.winnerUserId] : []),
    endReason: match.endReason ?? null,
    deadline: match.deadline ?? null, createdAt: match.createdAt, finishedAt: match.finishedAt ?? null,
  };
}

export async function handleGames(ctx, user, method, segments, body) {
  const { dynamo, response, firstLimit } = ctx;

  async function membership(groupId, userId) {
    const [group, member] = await Promise.all([
      dynamo.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { groupId } })),
      dynamo.send(new GetCommand({ TableName: MEMBERS_TABLE, Key: { groupId, userId } })),
    ]);
    return group.Item?.status === 'active' && member.Item?.status === 'active';
  }

  async function getMatch(matchId) {
    return (await dynamo.send(new GetCommand({ TableName: GAMES_TABLE, Key: { matchId } }))).Item ?? null;
  }

  // How a stake would be paid: spendable first, then earned
  function payFor(account, stake) {
    const spendable = Math.max(0, account.auraSpendable ?? 0);
    const earned    = Math.max(0, account.auraEarned ?? 0);
    if (stake > spendable + earned) return null;
    const s = Math.min(stake, spendable);
    return { s, e: stake - s };
  }

  // Collects balance changes per user so one transaction never touches the same user twice
  function ledger() {
    const byUser = new Map();
    const entry = id => {
      if (!byUser.has(id)) byUser.set(id, { adds: {}, conds: [], values: {} });
      return byUser.get(id);
    };
    return {
      add(id, adds) {
        const e = entry(id);
        for (const [k, v] of Object.entries(adds)) if (v) e.adds[k] = (e.adds[k] ?? 0) + v;
      },
      // A stake can only be paid from what the player has right now
      pay(id, paid) {
        const e = entry(id);
        this.add(id, { auraSpendable: -paid.s, auraEarned: -paid.e, auraBalance: -(paid.s + paid.e) });
        if (paid.s) { e.conds.push('auraSpendable >= :paidS'); e.values[':paidS'] = paid.s; }
        if (paid.e) { e.conds.push('auraEarned >= :paidE'); e.values[':paidE'] = paid.e; }
      },
      items() {
        return [...byUser].filter(([, e]) => Object.keys(e.adds).length)
          .map(([id, e]) => ctx.balanceUpdate(id, e.adds, e.conds.join(' AND ') || null, e.values));
      },
    };
  }

  // Gives one player's stake back exactly as they paid it
  function refund(match, player, book, records) {
    book.add(player.userId, { auraSpendable: player.paid.s, auraEarned: player.paid.e, auraBalance: match.stake });
    records.push(ctx.transactionRecord({ type: 'game_refund', userId: player.userId, matchId: match.matchId, amount: match.stake, toSpendable: player.paid.s, toEarned: player.paid.e }));
  }

  // Pays out a finished game: the pot to the winner, shared by players who
  // tied for the win, or every stake back on a draw
  function settle(match, state, book, records) {
    if (!match.stake) return;
    if (!state.split && state.winner === null) {
      for (const p of match.players) refund(match, p, book, records);
      return;
    }
    const pot = match.stake * match.players.length;
    const winners = state.split ?? [state.winner];
    const share = Math.floor(pot / winners.length);
    let odd = pot - share * winners.length;
    for (const seat of winners) {
      const extra = odd > 0 ? 1 : 0;
      odd -= extra;
      const amount = share + extra;
      const winner = match.players[seat].userId;
      book.add(winner, { auraSpendable: amount, auraBalance: amount });
      records.push(ctx.transactionRecord({ type: 'game_win', userId: winner, matchId: match.matchId, amount, toSpendable: amount, toEarned: 0 }));
    }
  }

  // Today's game counters in one update (a transaction may touch the day's
  // record only once), each failing if it would pass its cap
  function dayUpdate(userId, counts) {
    const fields = Object.entries(counts).filter(([, c]) => c.amount);
    if (!fields.length) return [];
    return [{ Update: {
      TableName: 'aura-daily-budgets', Key: { budgetKey: `${userId}#${ctx.today()}` },
      UpdateExpression: `ADD ${fields.map(([f]) => `#${f} :${f}`).join(', ')}`,
      ConditionExpression: fields.map(([f]) => `(attribute_not_exists(#${f}) OR #${f} <= :${f}Max)`).join(' AND '),
      ExpressionAttributeNames: Object.fromEntries(fields.map(([f]) => [`#${f}`, f])),
      ExpressionAttributeValues: Object.fromEntries(fields.flatMap(([f, c]) => [[`:${f}`, c.amount], [`:${f}Max`, c.cap - c.amount]])),
    } }];
  }

  // A stake given back doesn't count against the day it was paid on
  function unspendDay(match, player) {
    if (!match.stake) return [];
    const day = (player.joinedAt ?? match.createdAt).slice(0, 10);
    return [{ Update: {
      TableName: 'aura-daily-budgets', Key: { budgetKey: `${player.userId}#${day}` },
      UpdateExpression: 'ADD gameStakeUsed :minus', ExpressionAttributeValues: { ':minus': -match.stake },
    } }];
  }

  // Stake limits for one player sitting down; returns an error response or { paid, cap }
  function stakeChecks(account, stake) {
    const cap = account.isPremium ? STAKE_CAP.premium : STAKE_CAP.regular;
    if (stake > cap) return { error: response(400, { error: `Games can be for at most ${cap} aura.` }) };
    // Same rule as gifts and Aura Rain: new accounts can't move aura into
    // another account through games (a missing date counts as new)
    const created = Date.parse(account.createdAt);
    if (stake > 0 && !(Number.isFinite(created) && Date.now() - created >= MIN_STAKE_ACCOUNT_DAYS * 86400000)) {
      return { error: response(403, { error: `Accounts can play for aura once they're ${MIN_STAKE_ACCOUNT_DAYS} days old. Friendly games (0 aura) are open to everyone.` }) };
    }
    const paid = payFor(account, stake);
    if (!paid) return { error: response(400, { error: `You need ${stake} aura to play for that. You have ${(account.auraSpendable ?? 0) + (account.auraEarned ?? 0)}.` }) };
    return { paid, cap };
  }

  async function notify(recipientId, type, data) {
    try {
      const recipient = (await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: recipientId } }))).Item;
      if (!recipient || recipient.notificationPrefs?.games === false) return;
      const now = Date.now();
      await dynamo.send(new PutCommand({
        TableName: NOTIFICATIONS_TABLE,
        Item: {
          userId: recipientId, notificationId: `${now}#${Math.random().toString(36).slice(2, 10)}`,
          type, data: { fromUserId: user.userId, fromUsername: user.username, ...data },
          read: false, createdAt: new Date(now).toISOString(),
        },
      }));
    } catch (err) {
      console.warn(`Notification not saved (${err.name}).`);
    }
  }

  // Saves a changed match (only if nobody else changed it first) with any money moves
  async function save(match, changes, moneyItems, messages = []) {
    const next = { ...match, ...changes, version: match.version + 1, updatedAt: new Date().toISOString() };
    const items = [
      { Put: { TableName: GAMES_TABLE, Item: next, ConditionExpression: 'version = :v', ExpressionAttributeValues: { ':v': match.version } } },
      ...moneyItems,
    ];
    const error = await ctx.commit(items, ['Someone else moved first. Refresh and try again.', ...messages]);
    return error ?? next;
  }

  // Fields for a match whose state just changed. The turn timer restarts,
  // except when someone else left a bigger table (keepClock) and the same
  // player is still on turn.
  function progress(match, state, reason = 'game', keepClock = false) {
    if (state.over) return { state, ...finishedFields(match, state, reason) };
    const keep = keepClock && match.state?.turn === state.turn && match.deadline;
    return { state, turnUserId: match.players[state.turn]?.userId ?? null, deadline: keep ? match.deadline : Date.now() + TURN_MS };
  }

  function finishedFields(match, state, reason) {
    const winners = state.split ?? (state.winner === null || state.winner === undefined ? [] : [state.winner]);
    return {
      status: 'finished', endReason: reason, turnUserId: null, deadline: null,
      winnerUserId: winners.length === 1 ? match.players[winners[0]].userId : null,
      winnerUserIds: winners.map(i => match.players[i].userId),
      finishedAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + KEEP_FINISHED_DAYS * 86400,
    };
  }

  function matchResponse(match, status = 200, have = null) {
    const seat = match.players.findIndex(p => p.userId === user.userId);
    let view = match.state ? viewFor(match.game, match.state, seat === -1 ? null : seat) : null;
    // Pool: a poll that already has the latest shot's recording (?have=<shot no>) skips it
    if (view?.shot && have !== null && String(view.shot.no) === have) view = { ...view, shot: { ...view.shot, start: null, frames: null } };
    return response(status, {
      match: summary(match),
      seat: seat === -1 ? null : seat,
      view,
      now: Date.now(),
    });
  }

  // Deals the game for everyone seated and saves it, with any money moves
  // that go with the last player sitting down
  async function begin(match, players, book, records, extraItems = [], messages = []) {
    const seated = { ...match, players };
    const state = GAMES[match.game].init(rand, match.options, players.length);
    if (state.over) settle(seated, state, book, records);
    const saved = await save(match, { players, status: 'active', invited: match.invited, startedAt: new Date().toISOString(), ...progress(seated, state) },
      [...extraItems, ...book.items(), ...records], messages);
    if (saved.statusCode) return saved;
    // Everyone else hears it has started; a game played counts toward the group's level
    await Promise.all(players.filter(p => p.userId !== user.userId).map(p => notify(p.userId, 'game_accepted', {
      matchId: match.matchId, groupId: match.groupId, game: match.game, stake: match.stake, players: players.length,
    })));
    await Promise.all(players.map(p => addGroupXp(dynamo, match.groupId, p.userId, 'game')));
    return matchResponse(saved);
  }

  // ── GET/POST /games/group/{groupId} ──
  if (segments[1] === 'group' && segments.length === 3) {
    const groupId = segments[2];
    if (!(await membership(groupId, user.userId))) return response(403, { error: 'Only members of this group can play its games.' });

    if (method === 'GET') {
      const result = await dynamo.send(new QueryCommand({
        TableName: GAMES_TABLE, IndexName: GAMES_INDEX,
        KeyConditionExpression: 'groupId = :g', ExpressionAttributeValues: { ':g': groupId },
        ScanIndexForward: false, Limit: LIST_LIMIT,
      }));
      return response(200, { games: (result.Items ?? []).map(summary), now: Date.now() });
    }

    if (method === 'POST') {
      const limited = await firstLimit([user.userId, 'game-create', 5, 60]);
      if (limited) return limited;
      const game = typeof body.game === 'string' && Object.hasOwn(GAMES, body.game) ? body.game : null;
      if (!game) return response(400, { error: 'Pick a game.' });
      const stake = body.stake ?? 0;
      if (!Number.isInteger(stake) || stake < 0) return response(400, { error: 'The stake must be a whole number of aura (0 for a friendly game).' });
      const maxSeats = MAX_PLAYERS[game] ?? 2;
      const seats = body.seats ?? 2;
      if (!Number.isInteger(seats) || seats < 2 || seats > maxSeats) {
        return response(400, { error: maxSeats > 2 ? `${GAMES[game].name} is for 2 to ${maxSeats} players.` : `${GAMES[game].name} is for 2 players.` });
      }
      let options;
      try { options = GAMES[game].options(body.options); } catch (err) {
        if (err instanceof GameError) return response(400, { error: err.message });
        throw err;
      }

      let invited = null;
      if (body.opponent !== undefined && body.opponent !== null && body.opponent !== '') {
        if (typeof body.opponent !== 'string') return response(400, { error: 'Invalid opponent.' });
        if (seats > 2) return response(400, { error: 'Invites are for two-player games. A bigger table is open to everyone in the group.' });
        const name = body.opponent.trim().replace(/^@/, '').toLowerCase();
        const reservation = /^[a-z0-9_]{3,30}$/.test(name)
          ? (await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: `USERNAME#${name}` } }))).Item : null;
        const opponentId = reservation?.ownerId;
        if (!opponentId || !(await membership(groupId, opponentId))) return response(404, { error: `@${name} isn't a member of this group.` });
        if (opponentId === user.userId) return response(400, { error: 'You can\'t challenge yourself.' });
        if (await eitherBlocked(dynamo, user.userId, opponentId)) return response(403, { error: `You can't challenge @${name}.` });
        invited = { userId: opponentId, username: name };
      }

      const checks = stakeChecks(user, stake);
      if (checks.error) return checks.error;
      const now = new Date().toISOString();
      const match = {
        matchId: `${Date.now()}-${randomInt(36 ** 6).toString(36)}`,
        groupId, game, stake, seats, options, status: 'open', invited,
        players: [{ ...publicPlayer(user), paid: checks.paid, joinedAt: now }],
        state: null, version: 0, createdAt: now, updatedAt: now,
      };
      const book = ledger();
      if (stake) book.pay(user.userId, checks.paid);
      const items = [
        { Put: { TableName: GAMES_TABLE, Item: match, ConditionExpression: 'attribute_not_exists(matchId)' } },
        ...dayUpdate(user.userId, {
          gamesCreated:  { amount: 1, cap: DAILY_GAMES_CREATED },
          gameStakeUsed: { amount: stake, cap: checks.cap },
        }),
        ...book.items(),
        ...(stake ? [ctx.transactionRecord({ type: 'game_stake', userId: user.userId, matchId: match.matchId, amount: -stake, fromSpendable: checks.paid.s, fromEarned: checks.paid.e })] : []),
      ];
      const error = await ctx.commit(items, [
        'Please try again.',
        `Daily game limit reached: ${DAILY_GAMES_CREATED} new games and ${checks.cap} aura in stakes a day.`,
        'Not enough aura.',
      ]);
      if (error) return error;
      if (invited) await notify(invited.userId, 'game_challenge', { matchId: match.matchId, groupId, game, stake });
      return matchResponse(match, 201);
    }
    return response(404, { error: 'Route not found.' });
  }

  // ── /games/{matchId}[/action] ──
  if (segments.length < 2 || segments.length > 3) return response(404, { error: 'Route not found.' });
  const match = await getMatch(segments[1]);
  if (!match) return response(404, { error: 'Game not found.' });
  const seat = match.players.findIndex(p => p.userId === user.userId);
  const action = segments[2];

  if (method === 'GET' && !action) {
    if (seat === -1 && !(await membership(match.groupId, user.userId))) return response(404, { error: 'Game not found.' });
    return matchResponse(match, 200, typeof ctx.query?.have === 'string' ? ctx.query.have : null);
  }
  if (method !== 'POST') return response(404, { error: 'Route not found.' });

  const limited = await firstLimit([user.userId, 'game-move', 60, 60]);
  if (limited) return limited;

  if (action === 'join') {
    if (match.status !== 'open') return response(409, { error: 'This game has already started or been withdrawn.' });
    if (seat === 0) return response(400, { error: 'You can\'t accept your own challenge.' });
    if (seat !== -1) return response(400, { error: 'You\'re already at this table.' });
    if (match.players.length >= seatsOf(match)) return response(409, { error: 'This table is full.' });
    if (match.invited && match.invited.userId !== user.userId) return response(403, { error: `This challenge is for @${match.invited.username}.` });
    if (!(await membership(match.groupId, user.userId))) return response(403, { error: 'Only members of this group can play its games.' });
    for (const p of match.players) {
      if (await eitherBlocked(dynamo, user.userId, p.userId)) return response(403, { error: "You can't join this game." });
    }
    const checks = stakeChecks(user, match.stake);
    if (checks.error) return checks.error;

    const players = [...match.players, { ...publicPlayer(user), paid: checks.paid, joinedAt: new Date().toISOString() }];
    const book = ledger();
    const records = [];
    if (match.stake) {
      book.pay(user.userId, checks.paid);
      records.push(ctx.transactionRecord({ type: 'game_stake', userId: user.userId, matchId: match.matchId, amount: -match.stake, fromSpendable: checks.paid.s, fromEarned: checks.paid.e }));
    }
    const day = dayUpdate(user.userId, { gameStakeUsed: { amount: match.stake, cap: checks.cap } });
    const messages = match.stake ? [`That would pass your daily limit of ${checks.cap} aura in game stakes.`, 'Not enough aura.'] : ['Not enough aura.'];
    // The last seat filled: deal
    if (players.length === seatsOf(match)) return begin(match, players, book, records, day, messages);
    // Otherwise take the seat and keep the table open
    const saved = await save(match, { players }, [...day, ...book.items(), ...records], messages);
    if (saved.statusCode) return saved;
    return matchResponse(saved);
  }

  if (action === 'start') {
    if (match.status !== 'open') return response(409, { error: 'This game has already started or been withdrawn.' });
    if (seat !== 0) return response(403, { error: 'Only the player who set up the table can start it.' });
    if (match.players.length < 2) return response(409, { error: 'Wait for at least one more player to join.' });
    return begin(match, match.players, ledger(), []);
  }

  if (action === 'leave') {
    if (match.status !== 'open') return response(409, { error: 'The game has started. Resign instead.' });
    if (seat === 0) return response(403, { error: 'You set up this table. Withdraw it instead.' });
    if (seat === -1) return response(403, { error: 'You aren\'t at this table.' });
    const book = ledger();
    const records = [];
    const player = match.players[seat];
    if (match.stake) { refund(match, player, book, records); records.push(...unspendDay(match, player)); }
    const saved = await save(match, { players: match.players.filter((_, i) => i !== seat) }, [...book.items(), ...records]);
    if (saved.statusCode) return saved;
    return matchResponse(saved);
  }

  if (action === 'cancel' || action === 'decline') {
    if (match.status !== 'open') return response(409, { error: 'This challenge has already started or ended.' });
    if (action === 'cancel' && seat !== 0) return response(403, { error: 'Only the challenger can withdraw it.' });
    if (action === 'decline' && match.invited?.userId !== user.userId) return response(403, { error: 'This challenge isn\'t for you.' });
    // Everyone seated gets their stake back, and it stops counting against their day
    const book = ledger();
    const records = [];
    if (match.stake) {
      for (const p of match.players) { refund(match, p, book, records); records.push(...unspendDay(match, p)); }
    }
    const saved = await save(match, {
      status: action === 'cancel' ? 'cancelled' : 'declined', finishedAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + KEEP_FINISHED_DAYS * 86400,
    }, [...book.items(), ...records]);
    if (saved.statusCode) return saved;
    return matchResponse(saved);
  }

  if (seat === -1) return response(403, { error: 'You aren\'t playing in this game.' });
  if (match.status !== 'active') return response(409, { error: 'This game is over.' });
  if (match.state?.out?.[seat]) return response(409, { error: 'You\'re out of this game.' });

  if (action === 'move') {
    if (match.state.turn !== seat) return response(409, { error: 'It\'s not your turn.' });
    let state;
    try { state = GAMES[match.game].apply(match.state, seat, body.move, rand); } catch (err) {
      if (err instanceof GameError) return response(400, { error: err.message });
      throw err;
    }
    const book = ledger();
    const records = [];
    if (state.over) settle(match, state, book, records);
    const saved = await save(match, progress(match, state), [...book.items(), ...records]);
    if (saved.statusCode) return saved;
    return matchResponse(saved);
  }

  if (action === 'resign' || action === 'claim') {
    if (action === 'claim') {
      if (match.state.turn === seat) return response(409, { error: 'It\'s your turn.' });
      if (!match.deadline || Date.now() < match.deadline) return response(409, { error: 'Their turn timer hasn\'t run out yet.' });
    }
    const reason = action === 'resign' ? 'resign' : 'timeout';
    let state;
    let keepClock = false;
    if (match.players.length === 2) {
      // Two players: the other one wins
      const winner = action === 'resign' ? 1 - seat : seat;
      state = { ...match.state, over: true, turn: null, winner, draw: false };
    } else {
      // A bigger table: just that player is out, and the rest play on
      const leaving = action === 'resign' ? seat : match.state.turn;
      state = GAMES[match.game].remove(match.state, leaving, rand);
      keepClock = leaving !== match.state.turn;
    }
    const book = ledger();
    const records = [];
    if (state.over) settle(match, state, book, records);
    const saved = await save(match, progress(match, state, reason, keepClock), [...book.items(), ...records]);
    if (saved.statusCode) return saved;
    return matchResponse(saved);
  }

  return response(404, { error: 'Route not found.' });
}
