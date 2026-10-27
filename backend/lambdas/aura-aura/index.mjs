import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const POSTS_TABLE          = 'aura-posts';
const COMMENTS_TABLE       = 'aura-comments';
const USERS_TABLE          = 'aura-users';
const TRANSACTIONS_TABLE   = 'aura-transactions';
const DAILY_BUDGETS_TABLE  = 'aura-daily-budgets';
const GROUPS_TABLE         = 'aura-groups';
const MEMBERS_TABLE        = 'aura-group-members';

// Keep RULES and AURA_VERSION in sync with aura-users, which reports today's limits
const RULES = {
  regular: { loginBonus: 200, freeGive: 50,  giveCap: 500,  takeCap: 250  },
  premium: { loginBonus: 800, freeGive: 200, giveCap: 2000, takeCap: 1000 },
};
const AURA_VERSION = 2;

const MAX_TAKE_PER_TARGET    = 50;
const MAX_EARNED_PER_SOURCE  = 500;   // per giver, per recipient, per day
const NEW_ACCOUNT_DAYS       = 7;     // gifts from younger accounts are spendable
const AD_REWARD              = 25;
const AD_COOLDOWN_MS         = 60 * 60 * 1000;

const TARGETS = {
  posts:    { table: POSTS_TABLE,    key: 'postId',    type: 'post'    },
  comments: { table: COMMENTS_TABLE, key: 'commentId', type: 'comment' },
};

// ─── Rate limits ──────────────────────────────────────────────
// Fixed-window counters in aura-rate-limits (partition key limitKey, TTL on
// expiresAt). Fails open: if the table is missing or unreachable, requests are
// allowed and the limiter rests for a minute, so it can never take the API down.
const RATE_TABLE = 'aura-rate-limits';
let rateLimitsOffUntil = 0;

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// Returns a 429 response once `who` has made `limit` requests in this window
async function rateLimited(who, bucket, limit, windowSeconds) {
  if (Date.now() < rateLimitsOffUntil) return null;
  const now    = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / windowSeconds);
  try {
    await dynamo.send(new UpdateCommand({
      TableName:                 RATE_TABLE,
      Key:                       { limitKey: `${who}#${bucket}#${windowSeconds}#${window}` },
      UpdateExpression:          'SET expiresAt = :exp ADD #count :one',
      ConditionExpression:       'attribute_not_exists(#count) OR #count < :limit',
      ExpressionAttributeNames:  { '#count': 'count' },
      ExpressionAttributeValues: { ':one': 1, ':limit': limit, ':exp': (window + 1) * windowSeconds + 60 },
    }));
    return null;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      const retryAfter = (window + 1) * windowSeconds - now;
      return response(429, { error: 'Too many requests. Please slow down and try again shortly.' },
        { 'Retry-After': String(retryAfter) });
    }
    console.warn(`Rate limiter unavailable (${err.name}); allowing requests for a minute.`);
    rateLimitsOffUntil = Date.now() + 60_000;
    return null;
  }
}

// Runs several limits in order and returns the first 429, if any
async function firstLimit(...checks) {
  for (const [who, bucket, limit, windowSeconds] of checks) {
    const limited = await rateLimited(who, bucket, limit, windowSeconds);
    if (limited) return limited;
  }
  return null;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rulesFor(user) {
  return user.isPremium ? RULES.premium : RULES.regular;
}

// ─── Balances ─────────────────────────────────────────────────
// Accounts from before the earned/spendable split are reset to 0 on first use.
// auraBalance is kept equal to auraEarned + auraSpendable for display.
async function getAuraAccount(userId) {
  try {
    await dynamo.send(new UpdateCommand({
      TableName:        USERS_TABLE,
      Key:              { userId },
      UpdateExpression: `SET auraBalance = :zero, auraEarned = :zero, auraSpendable = :zero,
                             lifetimeEarned = :zero, lifetimeReceived = :zero, lifetimeGiven = :zero,
                             lifetimeTaken = :zero, lifetimeLost = :zero, auraVersion = :v`,
      ConditionExpression:       'attribute_exists(userId) AND attribute_not_exists(auraVersion)',
      ExpressionAttributeValues: { ':zero': 0, ':v': AURA_VERSION },
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
  }

  const result = await dynamo.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));
  return result.Item ?? null;
}

// ─── Daily usage ──────────────────────────────────────────────
// One record per user per UTC day. Missing counters start at 0, which also
// upgrades records written before the split.
async function getDay(userId) {
  const result = await dynamo.send(new UpdateCommand({
    TableName:        DAILY_BUDGETS_TABLE,
    Key:              { budgetKey: `${userId}#${today()}` },
    UpdateExpression: `SET userId = :u, #date = :d,
                           freeGiveUsed   = if_not_exists(freeGiveUsed, :zero),
                           walletGiveUsed = if_not_exists(walletGiveUsed, :zero),
                           takeUsed       = if_not_exists(takeUsed, :zero),
                           bonusClaimed   = if_not_exists(bonusClaimed, :f)`,
    ExpressionAttributeNames:  { '#date': 'date' },
    ExpressionAttributeValues: { ':u': userId, ':d': today(), ':zero': 0, ':f': false },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

async function getCounter(budgetKey, field) {
  const result = await dynamo.send(new GetCommand({
    TableName: DAILY_BUDGETS_TABLE,
    Key: { budgetKey },
  }));
  return result.Item?.[field] ?? 0;
}

// Adds :amount to a counter in the budgets table, failing if it would pass max
function counterUpdate(budgetKey, field, amount, max) {
  return {
    Update: {
      TableName:                 DAILY_BUDGETS_TABLE,
      Key:                       { budgetKey },
      UpdateExpression:          'ADD #f :amount',
      ConditionExpression:       'attribute_not_exists(#f) OR #f <= :limit',
      ExpressionAttributeNames:  { '#f': field },
      ExpressionAttributeValues: { ':amount': amount, ':limit': max - amount },
    },
  };
}

function balanceUpdate(userId, adds, extraCondition = null, extraValues = {}) {
  const fields = Object.entries(adds);
  return {
    Update: {
      TableName:        USERS_TABLE,
      Key:              { userId },
      UpdateExpression: `ADD ${fields.map(([f]) => `${f} :${f}`).join(', ')}`,
      ConditionExpression: ['auraVersion = :v', extraCondition].filter(Boolean).join(' AND '),
      ExpressionAttributeValues: {
        ':v': AURA_VERSION,
        ...Object.fromEntries(fields.map(([f, v]) => [`:${f}`, v])),
        ...extraValues,
      },
    },
  };
}

function transactionRecord(fields) {
  return {
    Put: {
      TableName: TRANSACTIONS_TABLE,
      Item: { transactionId: generateId(), createdAt: new Date().toISOString(), status: 'settled', ...fields },
    },
  };
}

// Runs the writes all-or-nothing. messages[i] explains a failed condition on items[i].
async function commit(items, messages) {
  try {
    await dynamo.send(new TransactWriteCommand({ TransactItems: items }));
    return null;
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    const failed = (err.CancellationReasons ?? []).findIndex(r => r?.Code === 'ConditionalCheckFailed');
    return response(409, { error: messages[failed] ?? 'Something changed while saving. Please try again.' });
  }
}

// ─── Targets ──────────────────────────────────────────────────
async function getTarget(collection, targetId) {
  const target = TARGETS[collection];
  const result = await dynamo.send(new GetCommand({
    TableName: target.table,
    Key: { [target.key]: targetId },
  }));
  if (!result.Item || result.Item.status !== 'active') return null;
  return { ...target, id: targetId, item: result.Item };
}

// Aura on group content is for group members only. Returns null when allowed,
// otherwise the error response (404 when the viewer can't even see it).
async function checkGroupAccess(target, userId) {
  const post = target.type === 'post'
    ? target.item
    : (await dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId: target.item.postId } }))).Item;
  if (!post?.groupId) return null;

  const group  = (await dynamo.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { groupId: post.groupId } }))).Item;
  const member = (await dynamo.send(new GetCommand({ TableName: MEMBERS_TABLE, Key: { groupId: post.groupId, userId } }))).Item;
  if (member?.status === 'active' && group?.status === 'active') return null;

  const canSee = group?.status === 'active' && group.joinType === 'open' && member?.status !== 'banned';
  return canSee
    ? response(403, { error: 'Only group members can give or take aura here.' })
    : response(404, { error: 'Post or comment not found.' });
}

// Authors choose at posting time whether a post (and its comments) can be taken
// from, and group owners can turn taking off for the whole group.
async function takeBlocked(target) {
  const post = target.type === 'post'
    ? target.item
    : (await dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId: target.item.postId } }))).Item;
  if (post?.allowTakes === false) {
    return response(403, { error: 'The author turned off taking aura on this post.' });
  }
  if (post?.groupId) {
    const group = (await dynamo.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { groupId: post.groupId } }))).Item;
    if (group?.allowTakes === false) {
      return response(403, { error: 'Taking aura is turned off in this group.' });
    }
  }
  return null;
}

function targetUpdate(target, scoreDelta, counterField, amount) {
  return {
    Update: {
      TableName:                 target.table,
      Key:                       { [target.key]: target.id },
      UpdateExpression:          `ADD auraScore :delta, ${counterField} :abs`,
      ConditionExpression:       '#status = :active',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':delta': scoreDelta, ':abs': amount, ':active': 'active' },
    },
  };
}

function targetFields(target) {
  return {
    targetType: target.type,
    targetId:   target.id,
    postId:     target.type === 'post' ? target.id : target.item.postId,
  };
}

// ─── Give ─────────────────────────────────────────────────────
// Free gives are used first, then the wallet: spendable aura, falling back to
// earned aura once spendable runs out. The recipient gets earned aura, except
// gifts from new accounts and anything past the per-source daily cap, which
// arrive as spendable.
async function giveAura(giver, target, amount) {
  const rules = rulesFor(giver);
  if (amount > rules.freeGive + rules.giveCap) {
    return response(400, { error: `You can give at most ${rules.freeGive + rules.giveCap} aura a day.` });
  }

  const day        = await getDay(giver.userId);
  const freeLeft   = Math.max(0, rules.freeGive - day.freeGiveUsed);
  const fromFree   = Math.min(amount, freeLeft);
  const fromWallet = amount - fromFree;

  const spendableAvailable = Math.max(0, giver.auraSpendable ?? 0);
  const earnedAvailable    = Math.max(0, giver.auraEarned ?? 0);
  const fromSpendable      = Math.min(fromWallet, spendableAvailable);
  const fromEarned         = fromWallet - fromSpendable;

  if (fromWallet > 0) {
    const walletLeft = Math.max(0, rules.giveCap - day.walletGiveUsed);
    if (fromWallet > walletLeft) {
      return response(400, { error: `You can give ${freeLeft + walletLeft} more aura today.` });
    }
    if (fromEarned > earnedAvailable) {
      const canGive = freeLeft + spendableAvailable + earnedAvailable;
      return response(400, { error: `Not enough aura. You can give up to ${canGive} right now.` });
    }
  }

  const authorId = target.item.authorId;
  const author   = await getAuraAccount(authorId);
  if (!author) return response(404, { error: 'Author not found.' });

  const sourceKey  = `${giver.userId}#to#${authorId}#${today()}`;
  const accountAge = giver.createdAt ? Date.now() - Date.parse(giver.createdAt) : 0;
  let earned = 0;
  if (accountAge >= NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000) {
    const alreadyEarned = await getCounter(sourceKey, 'earnedGiven');
    earned = Math.min(amount, Math.max(0, MAX_EARNED_PER_SOURCE - alreadyEarned));
  }
  const spendable = amount - earned;

  const items = [
    {
      Update: {
        TableName:                 DAILY_BUDGETS_TABLE,
        Key:                       { budgetKey: `${giver.userId}#${today()}` },
        UpdateExpression:          'ADD freeGiveUsed :free, walletGiveUsed :wallet',
        ConditionExpression:       'freeGiveUsed <= :freeLimit AND walletGiveUsed <= :walletLimit',
        ExpressionAttributeValues: {
          ':free': fromFree, ':wallet': fromWallet,
          ':freeLimit': rules.freeGive - fromFree, ':walletLimit': rules.giveCap - fromWallet,
        },
      },
    },
    balanceUpdate(
      giver.userId,
      { auraSpendable: -fromSpendable, auraEarned: -fromEarned, auraBalance: -fromWallet, lifetimeGiven: amount },
      [fromSpendable > 0 && 'auraSpendable >= :fromSpendable', fromEarned > 0 && 'auraEarned >= :fromEarned']
        .filter(Boolean).join(' AND ') || null,
      {
        ...(fromSpendable > 0 && { ':fromSpendable': fromSpendable }),
        ...(fromEarned > 0 && { ':fromEarned': fromEarned }),
      },
    ),
    balanceUpdate(authorId, {
      auraEarned: earned, auraSpendable: spendable, auraBalance: amount,
      lifetimeEarned: earned, lifetimeReceived: amount,
    }),
    targetUpdate(target, amount, 'auraReceived', amount),
  ];
  const messages = [
    'Daily give limit reached.',
    'Not enough aura.',
    'Author not found.',
    'That post or comment is no longer available.',
  ];

  if (earned > 0) {
    items.push(counterUpdate(sourceKey, 'earnedGiven', earned, MAX_EARNED_PER_SOURCE));
    messages.push('Something changed while saving. Please try again.');
  }

  items.push(transactionRecord({
    type: 'give', fromUserId: giver.userId, toUserId: authorId, ...targetFields(target),
    amount, fromFree, fromWallet, fromSpendable, fromEarned, earnedAmount: earned, spendableAmount: spendable,
  }));

  const error = await commit(items, messages);
  if (error) return error;

  return response(200, {
    message:   `Gave ${amount} aura.`,
    scoreDelta: amount,
    fromFree,
    fromSpendable,
    fromEarned,
  });
}

// ─── Take ─────────────────────────────────────────────────────
// Removes aura from the author's spendable balance (which may go negative).
// Taking costs the taker the same amount, paid from spendable and then earned
// aura, and nobody receives it: both sides are destroyed, so taking is never
// profitable and piling on costs the pile as much as the target. Limited per
// day and per post or comment.
async function takeAura(taker, target, amount) {
  const rules = rulesFor(taker);
  if (amount > MAX_TAKE_PER_TARGET) {
    return response(400, { error: `You can take at most ${MAX_TAKE_PER_TARGET} aura from one ${target.type}.` });
  }

  const blocked = await takeBlocked(target);
  if (blocked) return blocked;

  const spendableAvailable = Math.max(0, taker.auraSpendable ?? 0);
  const earnedAvailable    = Math.max(0, taker.auraEarned ?? 0);
  if (amount > spendableAvailable + earnedAvailable) {
    return response(400, {
      error: `Taking costs the same amount of your own aura. You have ${spendableAvailable + earnedAvailable}.`,
    });
  }
  const fromSpendable = Math.min(amount, spendableAvailable);
  const fromEarned    = amount - fromSpendable;

  const day      = await getDay(taker.userId);
  const takeLeft = Math.max(0, rules.takeCap - day.takeUsed);
  if (amount > takeLeft) {
    return response(400, { error: `You can take ${takeLeft} more aura today.` });
  }

  const perTargetKey = `${taker.userId}#take#${target.type}#${target.id}`;
  const takenHere    = await getCounter(perTargetKey, 'taken');
  if (takenHere + amount > MAX_TAKE_PER_TARGET) {
    return response(400, {
      error: `You can take ${Math.max(0, MAX_TAKE_PER_TARGET - takenHere)} more aura from this ${target.type}.`,
    });
  }

  const authorId = target.item.authorId;
  const author   = await getAuraAccount(authorId);
  if (!author) return response(404, { error: 'Author not found.' });

  const items = [
    counterUpdate(`${taker.userId}#${today()}`, 'takeUsed', amount, rules.takeCap),
    counterUpdate(perTargetKey, 'taken', amount, MAX_TAKE_PER_TARGET),
    balanceUpdate(authorId, { auraSpendable: -amount, auraBalance: -amount, lifetimeLost: amount }),
    balanceUpdate(
      taker.userId,
      { auraSpendable: -fromSpendable, auraEarned: -fromEarned, auraBalance: -amount, lifetimeTaken: amount },
      [fromSpendable > 0 && 'auraSpendable >= :fromSpendable', fromEarned > 0 && 'auraEarned >= :fromEarned']
        .filter(Boolean).join(' AND ') || null,
      {
        ...(fromSpendable > 0 && { ':fromSpendable': fromSpendable }),
        ...(fromEarned > 0 && { ':fromEarned': fromEarned }),
      },
    ),
    targetUpdate(target, -amount, 'auraTaken', amount),
    transactionRecord({
      type: 'take', fromUserId: authorId, takenBy: taker.userId,
      ...targetFields(target), amount: -amount, takerCost: amount, fromSpendable, fromEarned,
    }),
  ];
  const messages = [
    'Daily take limit reached.',
    `Take limit for this ${target.type} reached.`,
    'Author not found.',
    'Not enough aura.',
    'That post or comment is no longer available.',
  ];

  const error = await commit(items, messages);
  if (error) return error;

  return response(200, {
    message:   `Took ${amount} aura. It cost you ${amount}.`,
    scoreDelta: -amount,
    cost:       amount,
    fromSpendable,
    fromEarned,
  });
}

// ─── Daily login bonus ────────────────────────────────────────
async function claimDailyBonus(user) {
  const { loginBonus } = rulesFor(user);
  const day = await getDay(user.userId);
  if (day.bonusClaimed) return response(409, { error: 'You already claimed today\'s bonus.' });

  const error = await commit([
    {
      Update: {
        TableName:                 DAILY_BUDGETS_TABLE,
        Key:                       { budgetKey: `${user.userId}#${today()}` },
        UpdateExpression:          'SET bonusClaimed = :t',
        ConditionExpression:       'bonusClaimed = :f',
        ExpressionAttributeValues: { ':t': true, ':f': false },
      },
    },
    balanceUpdate(user.userId, { auraSpendable: loginBonus, auraBalance: loginBonus }),
    transactionRecord({ type: 'bonus', toUserId: user.userId, amount: loginBonus }),
  ], [
    'You already claimed today\'s bonus.',
  ]);
  if (error) return error;

  return response(200, { message: `Claimed ${loginBonus} aura.`, amount: loginBonus });
}

// ─── Watch ad for aura ────────────────────────────────────────
// The cooldown lives on the user record so it doesn't reset at midnight.
async function watchAd(user) {
  const cutoff = new Date(Date.now() - AD_COOLDOWN_MS).toISOString();
  if (user.lastAdAt && user.lastAdAt > cutoff) {
    const minutesLeft = Math.ceil((Date.parse(user.lastAdAt) + AD_COOLDOWN_MS - Date.now()) / 60000);
    return response(429, { error: `Ad cooldown active. Try again in ${minutesLeft} minutes.`, minutesLeft });
  }

  const now = new Date().toISOString();
  const error = await commit([
    {
      Update: {
        TableName:                 USERS_TABLE,
        Key:                       { userId: user.userId },
        UpdateExpression:          'SET lastAdAt = :now ADD auraSpendable :reward, auraBalance :reward',
        ConditionExpression:       'auraVersion = :v AND (attribute_not_exists(lastAdAt) OR lastAdAt <= :cutoff)',
        ExpressionAttributeValues: { ':now': now, ':reward': AD_REWARD, ':v': AURA_VERSION, ':cutoff': cutoff },
      },
    },
    transactionRecord({ type: 'ad', toUserId: user.userId, amount: AD_REWARD }),
  ], [
    'Ad cooldown active. Try again later.',
  ]);
  if (error) return error;

  return response(200, {
    message:    `You earned ${AD_REWARD} aura for watching an ad.`,
    amount:     AD_REWARD,
    nextAdAt:   new Date(Date.parse(now) + AD_COOLDOWN_MS).toISOString(),
  });
}

// ─── Main handler ─────────────────────────────────────────────
export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  const path   = event.requestContext?.http?.path   ?? event.path;
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;

  if (!userId) return response(401, { error: 'Unauthorized' });

  try {
    const limited = await firstLimit([userId, 'api', 120, 60]);
    if (limited) return limited;

    const body     = JSON.parse(event.body ?? '{}');
    const segments = path.split('/').filter(Boolean);

    const user = await getAuraAccount(userId);
    if (!user) return response(404, { error: 'User not found.' });
    if (user.isBanned) return response(403, { error: 'Account banned.' });

    // POST /posts/{id}/aura/{give|take} and POST /comments/{id}/aura/{give|take}
    if (method === 'POST' && TARGETS[segments[0]] && segments[2] === 'aura'
        && (segments[3] === 'give' || segments[3] === 'take') && segments.length === 4) {
      const actionLimited = await firstLimit([userId, 'aura', 30, 60], [userId, 'aura', 300, 3600]);
      if (actionLimited) return actionLimited;

      const amount = body.amount === undefined ? 1 : body.amount;
      if (!Number.isInteger(amount) || amount < 1) {
        return response(400, { error: 'Amount must be a whole number of at least 1.' });
      }

      const target = await getTarget(segments[0], segments[1]);
      if (!target) return response(404, { error: 'Post or comment not found.' });
      if (target.item.authorId === userId) {
        return response(403, { error: 'You cannot give or take aura on your own content.' });
      }
      const denied = await checkGroupAccess(target, userId);
      if (denied) return denied;

      return segments[3] === 'give'
        ? await giveAura(user, target, amount)
        : await takeAura(user, target, amount);
    }

    // POST /aura/daily-bonus
    if (method === 'POST' && path === '/aura/daily-bonus') {
      return await claimDailyBonus(user);
    }

    // POST /ads/watch
    if (method === 'POST' && path === '/ads/watch') {
      return await watchAd(user);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error.' });
  }
};
