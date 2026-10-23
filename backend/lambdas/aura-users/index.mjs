import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new DynamoDBClient({ region: 'us-east-1' });
const db     = DynamoDBDocumentClient.from(client);
const s3     = new S3Client({ region: 'us-east-1' });

const USERS_TABLE         = 'aura-users';
const DAILY_BUDGETS_TABLE = 'aura-daily-budgets';
const BUCKET_NAME         = 'aura-app-media-570934198135';

const DAILY_BUDGET_REGULAR = 500;
const DAILY_BUDGET_PREMIUM = 2000;

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

async function getUser(userId, isOwner = false) {
  const result = await db.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));

  if (!result.Item) return null;

  const user = result.Item;
  if (!isOwner) {
    delete user.email;
    delete user.followerCount;
    delete user.followingCount;
    delete user.totalPostViews;
  }

  return user;
}

async function createUser(userId, email, username) {
  const now = new Date().toISOString();
  const user = {
    userId,
    email,
    username,
    displayName:    username,
    bio:            '',
    tags:           [],
    accountType:    'regular',
    isPremium:      false,
    isCreator:      false,
    auraBalance:    0,
    auraEarned:     0,
    auraSpendable:  0,
    followerCount:  0,
    followingCount: 0,
    totalPostViews: 0,
    profilePicKey:  '',
    bannerKey:      '',
    badges:         [],
    pins:           [],
    hideAuraRank:   false,
    createdAt:      now,
    isBanned:       false,
  };

  await db.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: user,
    ConditionExpression: 'attribute_not_exists(userId)',
  }));

  return user;
}

async function getDailyBudget(userId, isPremium) {
  const key = `${userId}#${today()}`;

  const result = await db.send(new GetCommand({
    TableName: DAILY_BUDGETS_TABLE,
    Key: { budgetKey: key },
  }));

  if (result.Item) return result.Item;

  const budget = {
    budgetKey:   key,
    userId,
    date:        today(),
    budgetTotal: isPremium ? DAILY_BUDGET_PREMIUM : DAILY_BUDGET_REGULAR,
    budgetUsed:  0,
    adWatchedAt: null,
  };

  await db.send(new PutCommand({
    TableName: DAILY_BUDGETS_TABLE,
    Item: budget,
  }));

  return budget;
}

async function updateProfile(userId, body) {
  const { displayName, bio, username, tags, profilePicKey, bannerKey } = body;

  if (username !== undefined) {
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return response(400, { error: 'Username must be 3-30 characters, letters, numbers, and underscores only.' });
    }
  }

  if (bio && bio.length > 160) {
    return response(400, { error: 'Bio must be under 160 characters.' });
  }

  if (tags && tags.length > 10) {
    return response(400, { error: 'Maximum 10 tags.' });
  }

  const updates = {};
  if (displayName    !== undefined) updates.displayName    = displayName.trim();
  if (bio            !== undefined) updates.bio            = bio.trim();
  if (username       !== undefined) updates.username       = username.trim().toLowerCase();
  if (tags           !== undefined) updates.tags           = tags.slice(0, 10);
  if (profilePicKey  !== undefined) updates.profilePicKey  = profilePicKey;
  if (bannerKey      !== undefined) updates.bannerKey      = bannerKey;
  updates.updatedAt = new Date().toISOString();

  const setExpressions   = Object.keys(updates).map(k => `#${k} = :${k}`);
  const expressionNames  = Object.fromEntries(Object.keys(updates).map(k => [`#${k}`, k]));
  const expressionValues = Object.fromEntries(Object.keys(updates).map(k => [`:${k}`, updates[k]]));

  await db.send(new UpdateCommand({
    TableName:                 USERS_TABLE,
    Key:                       { userId },
    UpdateExpression:          `SET ${setExpressions.join(', ')}`,
    ExpressionAttributeNames:  expressionNames,
    ExpressionAttributeValues: expressionValues,
  }));

  const result = await db.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));

  return response(200, result.Item);
}

async function getProfileUploadUrls(userId, body) {
  const { files } = body;
  if (!files?.length) return response(400, { error: 'No files specified.' });

  const urls = [];
  for (const file of files) {
    const folder  = file.type === 'banner' ? 'banners' : 'avatars';
    const key     = `${folder}/${userId}/${Date.now()}-${file.name}`;
    const command = new PutObjectCommand({
      Bucket:      BUCKET_NAME,
      Key:         key,
      ContentType: file.contentType,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    urls.push({ key, url, type: file.type });
  }

  return response(200, { urls });
}

export const handler = async (event) => {
  const method   = event.requestContext?.http?.method ?? event.httpMethod;
  const path     = event.requestContext?.http?.path   ?? event.path;
  const segments = path.split('/').filter(Boolean);
  const userId   = event.requestContext?.authorizer?.jwt?.claims?.sub;

  try {
    // POST /users — create user
    if (method === 'POST' && path === '/users') {
      const body = JSON.parse(event.body ?? '{}');
      const { userId: uid, email, username } = body;
      if (!uid || !email || !username) {
        return response(400, { error: 'userId, email, and username are required.' });
      }
      const user = await createUser(uid, email, username);
      return response(201, user);
    }

    // PUT /users/me — update profile
    if (method === 'PUT' && path === '/users/me') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const body = JSON.parse(event.body ?? '{}');
      return await updateProfile(userId, body);
    }

    // POST /users/me/upload-urls — get S3 presigned URLs
    if (method === 'POST' && path === '/users/me/upload-urls') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const body = JSON.parse(event.body ?? '{}');
      return await getProfileUploadUrls(userId, body);
    }

    // GET /users/me — get own profile
    if (method === 'GET' && path === '/users/me') {
      if (!userId) return response(401, { error: 'Unauthorized' });

      let user = await getUser(userId, true);
      if (!user) {
        const email    = event.requestContext?.authorizer?.jwt?.claims?.email ?? '';
        const username = event.requestContext?.authorizer?.jwt?.claims?.['cognito:username'] ?? userId;
        user = await createUser(userId, email, username);
      }

      const budget = await getDailyBudget(userId, user.isPremium);
      return response(200, { ...user, budget });
    }

    // GET /users/{username} — get public profile
    if (method === 'GET' && segments[0] === 'users' && segments.length === 2) {
      const username = segments[1];
      if (!username || username === 'me') {
        return response(400, { error: 'Invalid username.' });
      }

      const result = await db.send(new ScanCommand({
        TableName:        USERS_TABLE,
        FilterExpression: 'username = :u',
        ExpressionAttributeValues: { ':u': username },
        Limit: 1,
      }));

      if (!result.Items?.length) {
        return response(404, { error: 'User not found.' });
      }

      const user = result.Items[0];
      delete user.email;
      delete user.followerCount;
      delete user.followingCount;
      delete user.totalPostViews;

      return response(200, user);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    if (err.name === 'ConditionalCheckFailedException') {
      return response(409, { error: 'User already exists.' });
    }
    return response(500, { error: 'Internal server error.' });
  }
};