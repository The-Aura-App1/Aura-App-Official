// Group games: two members play each other for an aura pot. No house, no
// rake. Each player's stake is taken when they sit down (challenge or accept)
// and held on the match; the winner gets both stakes as spendable aura (game
// winnings are never cashable), a draw or a cancelled challenge gives each
// stake back exactly as it was paid. aura-aura stays the only writer of
// balances.
//
// Table aura-games: partition key matchId; GSI `groupId-createdAt-index`
// (partition groupId, sort createdAt) lists a group's games.
//
// Routes (API Gateway: ANY /games/{proxy+} → aura-aura, cognito-auth):
//   GET  /games/group/{groupId}        the group's open, live and recent games
//   POST /games/group/{groupId}        challenge: { game, stake, options?, opponent? }
//   GET  /games/{matchId}              the match, as the viewer may see it
//   POST /games/{matchId}/join         accept a challenge
//   POST /games/{matchId}/move         { move }
//   POST /games/{matchId}/resign
//   POST /games/{matchId}/claim        win when the other player's turn timer ran out
//   POST /games/{matchId}/cancel       the challenger withdraws an open challenge
//   POST /games/{matchId}/decline      the invited player turns it down
import { randomInt } from 'crypto';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GAMES, GameError, viewFor } from './gameRules.mjs';

const GAMES_TABLE         = 'aura-games';
const GAMES_INDEX         = 'groupId-createdAt-index';
const USERS_TABLE         = 'aura-users';
const GROUPS_TABLE        = 'aura-groups';
const MEMBERS_TABLE       = 'aura-group-members';
const NOTIFICATIONS_TABLE = 'aura-notifications';

// Stakes: the most one match can be for, and the most a player can put into
// games per UTC day, by account type. 0 is a friendly game.
export const STAKE_CAP = { regular: 500, premium: 2000 };
const DAILY_GAMES_CREATED = 30;
const TURN_MS             = 2 * 60 * 1000;        // then the other player may claim the win
const KEEP_FINISHED_DAYS  = 60;                   // finished games expire from the table (TTL)
const LIST_LIMIT          = 60;

const rand = n => randomInt(n);

function publicPlayer(user) {
  return {
    userId: user.userId, username: user.username,
    displayName: user.displayName ?? user.username, picKey: user.profilePicKey ?? null,
  };
}

function summary(match) {
  return {
    matchId: match.matchId, groupId: match.groupId, game: match.game, gameName: GAMES[match.game]?.name,
    stake: match.stake, status: match.status, options: match.options,
    players: match.players.map(({ paid, ...p }) => p),
    invited: match.invited ?? null,
    turnUserId: match.turnUserId ?? null, winnerUserId: match.winnerUserId ?? null,
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

  // Pays out a finished game: the pot to the winner, or each stake back on a draw
  function settle(match, winnerSeat, book, records) {
    if (!match.stake) return;
    if (winnerSeat === null) {
      for (const p of match.players) {
        book.add(p.userId, { auraSpendable: p.paid.s, auraEarned: p.paid.e, auraBalance: match.stake });
        records.push(ctx.transactionRecord({ type: 'game_refund', userId: p.userId, matchId: match.matchId, amount: match.stake, toSpendable: p.paid.s, toEarned: p.paid.e }));
      }
    } else {
      const pot = match.stake * match.players.length;
      const winner = match.players[winnerSeat].userId;
      book.add(winner, { auraSpendable: pot, auraBalance: pot });
      records.push(ctx.transactionRecord({ type: 'game_win', userId: winner, matchId: match.matchId, amount: pot, toSpendable: pot, toEarned: 0 }));
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

  // Stake limits for one player sitting down; returns an error response or { paid, cap }
  function stakeChecks(account, stake) {
    const cap = account.isPremium ? STAKE_CAP.premium : STAKE_CAP.regular;
    if (stake > cap) return { error: response(400, { error: `Games can be for at most ${cap} aura.` }) };
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

  // Fields for a match whose state just changed
  function progress(match, state) {
    const fields = { state, turnUserId: state.over ? null : match.players[state.turn]?.userId ?? null, deadline: state.over ? null : Date.now() + TURN_MS };
    if (state.over) Object.assign(fields, finishedFields(match, state.winner, 'game'));
    return fields;
  }

  function finishedFields(match, winnerSeat, reason) {
    return {
      status: 'finished', endReason: reason, turnUserId: null, deadline: null,
      winnerUserId: winnerSeat === null ? null : match.players[winnerSeat].userId,
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
      let options;
      try { options = GAMES[game].options(body.options); } catch (err) {
        if (err instanceof GameError) return response(400, { error: err.message });
        throw err;
      }

      let invited = null;
      if (body.opponent !== undefined && body.opponent !== null && body.opponent !== '') {
        if (typeof body.opponent !== 'string') return response(400, { error: 'Invalid opponent.' });
        const name = body.opponent.trim().replace(/^@/, '').toLowerCase();
        const reservation = /^[a-z0-9_]{3,30}$/.test(name)
          ? (await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId: `USERNAME#${name}` } }))).Item : null;
        const opponentId = reservation?.ownerId;
        if (!opponentId || !(await membership(groupId, opponentId))) return response(404, { error: `@${name} isn't a member of this group.` });
        if (opponentId === user.userId) return response(400, { error: 'You can\'t challenge yourself.' });
        invited = { userId: opponentId, username: name };
      }

      const checks = stakeChecks(user, stake);
      if (checks.error) return checks.error;
      const now = new Date().toISOString();
      const match = {
        matchId: `${Date.now()}-${randomInt(36 ** 6).toString(36)}`,
        groupId, game, stake, options, status: 'open', invited,
        players: [{ ...publicPlayer(user), paid: checks.paid }],
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
    if (match.status !== 'open') return response(409, { error: 'This challenge has already been taken or withdrawn.' });
    if (seat !== -1) return response(400, { error: 'You can\'t accept your own challenge.' });
    if (match.invited && match.invited.userId !== user.userId) return response(403, { error: `This challenge is for @${match.invited.username}.` });
    if (!(await membership(match.groupId, user.userId))) return response(403, { error: 'Only members of this group can play its games.' });
    const checks = stakeChecks(user, match.stake);
    if (checks.error) return checks.error;

    const players = [...match.players, { ...publicPlayer(user), paid: checks.paid }];
    const seated = { ...match, players };
    const state = GAMES[match.game].init(rand, match.options);
    const book = ledger();
    const records = [];
    if (match.stake) {
      book.pay(user.userId, checks.paid);
      records.push(ctx.transactionRecord({ type: 'game_stake', userId: user.userId, matchId: match.matchId, amount: -match.stake, fromSpendable: checks.paid.s, fromEarned: checks.paid.e }));
    }
    if (state.over) settle(seated, state.winner, book, records);
    const saved = await save(match, { players, status: 'active', invited: match.invited, startedAt: new Date().toISOString(), ...progress(seated, state) },
      [...dayUpdate(user.userId, { gameStakeUsed: { amount: match.stake, cap: checks.cap } }), ...book.items(), ...records],
      match.stake ? [`That would pass your daily limit of ${checks.cap} aura in game stakes.`, 'Not enough aura.'] : ['Not enough aura.']);
    if (saved.statusCode) return saved;
    await notify(match.players[0].userId, 'game_accepted', { matchId: match.matchId, groupId: match.groupId, game: match.game, stake: match.stake });
    return matchResponse(saved);
  }

  if (action === 'cancel' || action === 'decline') {
    if (match.status !== 'open') return response(409, { error: 'This challenge has already started or ended.' });
    if (action === 'cancel' && seat !== 0) return response(403, { error: 'Only the challenger can withdraw it.' });
    if (action === 'decline' && match.invited?.userId !== user.userId) return response(403, { error: 'This challenge isn\'t for you.' });
    const book = ledger();
    const records = [];
    const challenger = match.players[0];
    if (match.stake) {
      book.add(challenger.userId, { auraSpendable: challenger.paid.s, auraEarned: challenger.paid.e, auraBalance: match.stake });
      records.push(ctx.transactionRecord({ type: 'game_refund', userId: challenger.userId, matchId: match.matchId, amount: match.stake, toSpendable: challenger.paid.s, toEarned: challenger.paid.e }));
      // A withdrawn challenge doesn't count against today's game limit
      records.push({ Update: {
        TableName: 'aura-daily-budgets', Key: { budgetKey: `${challenger.userId}#${match.createdAt.slice(0, 10)}` },
        UpdateExpression: 'ADD gameStakeUsed :minus', ExpressionAttributeValues: { ':minus': -match.stake },
      } });
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

  if (action === 'move') {
    if (match.state.turn !== seat) return response(409, { error: 'It\'s not your turn.' });
    let state;
    try { state = GAMES[match.game].apply(match.state, seat, body.move, rand); } catch (err) {
      if (err instanceof GameError) return response(400, { error: err.message });
      throw err;
    }
    const book = ledger();
    const records = [];
    if (state.over) settle(match, state.winner, book, records);
    const saved = await save(match, progress(match, state), [...book.items(), ...records]);
    if (saved.statusCode) return saved;
    return matchResponse(saved);
  }

  if (action === 'resign' || action === 'claim') {
    if (action === 'claim') {
      if (match.state.turn === seat) return response(409, { error: 'It\'s your turn.' });
      if (!match.deadline || Date.now() < match.deadline) return response(409, { error: 'Their turn timer hasn\'t run out yet.' });
    }
    const winner = action === 'resign' ? 1 - seat : seat;
    const state = { ...match.state, over: true, turn: null, winner, draw: false };
    const book = ledger();
    const records = [];
    settle(match, winner, book, records);
    const saved = await save(match, { state, ...finishedFields(match, winner, action === 'resign' ? 'resign' : 'timeout') }, [...book.items(), ...records]);
    if (saved.statusCode) return saved;
    return matchResponse(saved);
  }

  return response(404, { error: 'Route not found.' });
}
