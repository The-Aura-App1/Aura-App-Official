import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const POSTS_TABLE          = 'aura-posts';
const USERS_TABLE          = 'aura-users';
const TRANSACTIONS_TABLE   = 'aura-transactions';
const DAILY_BUDGETS_TABLE  = 'aura-daily-budgets';

const LIMITS = {
  regular: { give: 5,  take: 3  },
  premium: { give: 15, take: 8  },
};

const DAILY_BUDGET = {
  regular: 100,
  premium: 400,
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Get or create daily budget ───────────────────────────────
async function getDailyBudget(userId, isPremium) {
  const key = `${userId}#${today()}`;

  const result = await dynamo.send(new GetCommand({
    TableName: DAILY_BUDGETS_TABLE,
    Key: { budgetKey: key },
  }));

  if (result.Item) return result.Item;

  const budget = {
    budgetKey:   key,
    userId,
    date:        today(),
    budgetTotal: isPremium ? DAILY_BUDGET.premium : DAILY_BUDGET.regular,
    budgetUsed:  0,
    adWatchedAt: null,
  };

  await dynamo.send(new PutCommand({
    TableName: DAILY_BUDGETS_TABLE,
    Item: budget,
  }));

  return budget;
}

// ─── Give or take aura ────────────────────────────────────────
async function transactAura(fromUserId, postId, amount, type) {
  // 1. Get the giver
  const giverResult = await dynamo.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId: fromUserId },
  }));
  if (!giverResult.Item) return response(404, { error: 'User not found.' });

  const giver = giverResult.Item;
  if (giver.isBanned) return response(403, { error: 'Account banned.' });

  // 2. Get the post
  const postResult = await dynamo.send(new GetCommand({
    TableName: POSTS_TABLE,
    Key: { postId },
  }));
  if (!postResult.Item) return response(404, { error: 'Post not found.' });
  if (postResult.Item.status !== 'active') return response(404, { error: 'Post not found.' });

  const post = postResult.Item;

  // 3. Prevent self-aura
  if (post.authorId === fromUserId) {
    return response(403, { error: 'You cannot give or take aura on your own post.' });
  }

  // 4. Check limits
  const isPremium = giver.isPremium;
  const limits    = isPremium ? LIMITS.premium : LIMITS.regular;
  const absAmount = Math.abs(amount);

  if (type === 'give' && absAmount > limits.give) {
    return response(400, { error: `Maximum ${limits.give} aura per give action.` });
  }
  if (type === 'take' && absAmount > limits.take) {
    return response(400, { error: `Maximum ${limits.take} aura per take action.` });
  }

  // 5. Check daily budget
  const budget = await getDailyBudget(fromUserId, isPremium);
  const budgetRemaining = budget.budgetTotal - budget.budgetUsed;

  if (budgetRemaining < absAmount) {
    return response(400, {
      error: `Not enough daily aura budget. You have ${budgetRemaining} remaining.`,
      budgetRemaining,
    });
  }

  // 6. Calculate aura changes
  const scoreDelta  = type === 'give' ? absAmount : -absAmount;
  const authorDelta = type === 'give' ? absAmount : -absAmount;

  // 7. Atomic transaction — all or nothing
  const transactionId = generateId();
  const now           = new Date().toISOString();
  const budgetKey     = `${fromUserId}#${today()}`;

  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      // Deduct from giver's daily budget
      {
        Update: {
          TableName:                 DAILY_BUDGETS_TABLE,
          Key:                       { budgetKey },
          UpdateExpression:          'ADD budgetUsed :amount',
          ConditionExpression:       'budgetUsed + :amount <= budgetTotal',
          ExpressionAttributeValues: { ':amount': absAmount },
        },
      },
      // Update post aura score
      {
        Update: {
          TableName:        POSTS_TABLE,
          Key:              { postId },
          UpdateExpression: type === 'give'
            ? 'ADD auraScore :delta, auraReceived :abs'
            : 'ADD auraScore :delta, auraTaken :abs',
          ExpressionAttributeValues: {
            ':delta': scoreDelta,
            ':abs':   absAmount,
          },
        },
      },
      // Update author's aura balance
      {
        Update: {
          TableName:                 USERS_TABLE,
          Key:                       { userId: post.authorId },
          UpdateExpression:          'ADD auraBalance :delta',
          ConditionExpression:       type === 'take'
            ? 'auraBalance >= :abs'
            : 'attribute_exists(userId)',
          ExpressionAttributeValues: {
            ':delta': authorDelta,
            ':abs':   absAmount,
          },
        },
      },
      // Write transaction record
      {
        Put: {
          TableName: TRANSACTIONS_TABLE,
          Item: {
            transactionId,
            fromUserId,
            toUserId:  post.authorId,
            postId,
            amount:    scoreDelta,
            type,
            createdAt: now,
            status:    'settled',
          },
        },
      },
    ],
  }));

  return response(200, {
    message:    `${type === 'give' ? 'Gave' : 'Took'} ${absAmount} aura.`,
    scoreDelta,
    transactionId,
    budgetRemaining: budgetRemaining - absAmount,
  });
}

// ─── Watch ad for aura ────────────────────────────────────────
async function watchAd(userId) {
  const userResult = await dynamo.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));
  if (!userResult.Item) return response(404, { error: 'User not found.' });

  const isPremium = userResult.Item.isPremium;
  const budgetKey = `${userId}#${today()}`;
  const budget    = await getDailyBudget(userId, isPremium);

  // Check hourly cooldown
  if (budget.adWatchedAt) {
    const lastWatch = new Date(budget.adWatchedAt);
    const hourAgo   = new Date(Date.now() - 60 * 60 * 1000);
    if (lastWatch > hourAgo) {
      const minutesLeft = Math.ceil((lastWatch - hourAgo) / 60000);
      return response(429, {
        error: `Ad cooldown active. Try again in ${minutesLeft} minutes.`,
        minutesLeft,
      });
    }
  }

  const adReward = 5;
  const now      = new Date().toISOString();

  // Award aura + update cooldown
  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName:                 USERS_TABLE,
          Key:                       { userId },
          UpdateExpression:          'ADD auraBalance :reward',
          ExpressionAttributeValues: { ':reward': adReward },
        },
      },
      {
        Update: {
          TableName:                 DAILY_BUDGETS_TABLE,
          Key:                       { budgetKey },
          UpdateExpression:          'SET adWatchedAt = :now',
          ExpressionAttributeValues: { ':now': now },
        },
      },
    ],
  }));

  return response(200, {
    message:   `You earned ${adReward} aura for watching an ad.`,
    auraEarned: adReward,
  });
}

// ─── Main handler ─────────────────────────────────────────────
export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  const path   = event.requestContext?.http?.path   ?? event.path;
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;

  if (!userId) return response(401, { error: 'Unauthorized' });

  try {
    const body     = JSON.parse(event.body ?? '{}');
    const segments = path.split('/').filter(Boolean);

    // POST /posts/{id}/aura/give
    if (method === 'POST' && segments[0] === 'posts' && segments[2] === 'aura' && segments[3] === 'give') {
      const postId = segments[1];
      const amount = Math.min(Math.abs(body.amount ?? 1), 15);
      return await transactAura(userId, postId, amount, 'give');
    }

    // POST /posts/{id}/aura/take
    if (method === 'POST' && segments[0] === 'posts' && segments[2] === 'aura' && segments[3] === 'take') {
      const postId = segments[1];
      const amount = Math.min(Math.abs(body.amount ?? 1), 8);
      return await transactAura(userId, postId, amount, 'take');
    }

    // POST /ads/watch
    if (method === 'POST' && path === '/ads/watch') {
      return await watchAd(userId);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    if (err.name === 'TransactionCanceledException') {
      return response(400, { error: 'Transaction failed — budget exceeded or balance too low.' });
    }
    return response(500, { error: 'Internal server error.' });
  }
};