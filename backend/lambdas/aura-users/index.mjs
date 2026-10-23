import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
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

// Usernames are reserved with items keyed `USERNAME#<name>` in the users table.
// They carry ownerId but no `username` attribute, so username scans never match them.
const USERNAME_RE          = /^[a-z0-9_]{3,30}$/;
const RESERVATION_PREFIX   = 'USERNAME#';
const PREMIUM_USERNAME_GAP = 24 * 60 * 60 * 1000;

const NOTIFICATION_TYPES = [
  'auraGiven', 'auraTaken', 'comment', 'reply', 'followRequest', 'followAccepted',
  'groupInvite', 'groupRequestApproved', 'cashoutProcessed', 'dailyBonus',
];
const COMMENT_VISIBILITY = ['anyone', 'followers'];

// Fields only the owner may see
const PRIVATE_FIELDS = [
  'email', 'followerCount', 'followingCount', 'totalPostViews',
  'notificationPrefs', 'commentVisibilityDefault',
  'usernameChangeCount', 'usernameChangedAt', 'usernameReserved',
  'usernamePlaceholder', 'usernameConflict',
];

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

function stripPrivate(user) {
  for (const field of PRIVATE_FIELDS) delete user[field];
  return user;
}

function reservationKey(username) {
  return `${RESERVATION_PREFIX}${username}`;
}

function cancellationCodes(err) {
  return (err.CancellationReasons ?? []).map(r => r?.Code);
}

async function getUser(userId, isOwner = false) {
  if (userId.startsWith(RESERVATION_PREFIX)) return null;

  const result = await db.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));

  if (!result.Item) return null;
  return isOwner ? result.Item : stripPrivate(result.Item);
}

// Placeholder, invalid or duplicated usernames can be changed once without using up the limit
function isFreeUsernameChange(user) {
  return !USERNAME_RE.test(user.username ?? '') || !!user.usernamePlaceholder || !!user.usernameConflict;
}

// Regular users get one change, then the name is locked. Premium users get one change per day.
function usernameStatus(user) {
  if (isFreeUsernameChange(user)) return { canChange: true, free: true };

  if (user.isPremium) {
    const nextAt = user.usernameChangedAt
      ? new Date(Date.parse(user.usernameChangedAt) + PREMIUM_USERNAME_GAP)
      : null;
    if (nextAt && nextAt > new Date()) return { canChange: false, nextChangeAt: nextAt.toISOString() };
    return { canChange: true };
  }

  if ((user.usernameChangeCount ?? 0) >= 1) return { canChange: false, locked: true };
  return { canChange: true, changesLeft: 1 };
}

// Scans cover users created before reservations existed. Paginates, because
// Limit applies before FilterExpression.
async function scanForUsername(...usernames) {
  const names  = [...new Set(usernames)];
  const values = Object.fromEntries(names.map((name, i) => [`:u${i}`, name]));
  const matches = [];
  let ExclusiveStartKey;
  do {
    const result = await db.send(new ScanCommand({
      TableName:        USERS_TABLE,
      FilterExpression: `username IN (${Object.keys(values).join(', ')})`,
      ExpressionAttributeValues: values,
      ExclusiveStartKey,
    }));
    matches.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return matches;
}

// asTyped also matches legacy usernames that were stored before lowercasing was enforced
async function findUserByUsername(username, asTyped = username) {
  const reservation = await db.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId: reservationKey(username) },
  }));
  if (reservation.Item) return getUser(reservation.Item.ownerId, true);

  const legacy = await scanForUsername(username, asTyped);
  return legacy.find(u => u.username === username) ?? legacy[0] ?? null;
}

async function isUsernameTaken(username, selfId) {
  const reservation = await db.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId: reservationKey(username) },
  }));
  if (reservation.Item) return reservation.Item.ownerId !== selfId;

  const legacy = await scanForUsername(username);
  return legacy.some(u => u.userId !== selfId);
}

// Reserve the username of a user created before reservations existed
async function ensureReservation(user) {
  if (user.usernameReserved || user.usernameConflict || !USERNAME_RE.test(user.username ?? '')) return user;

  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: USERS_TABLE,
            Item: { userId: reservationKey(user.username), ownerId: user.userId, createdAt: new Date().toISOString() },
            ConditionExpression: 'attribute_not_exists(userId)',
          },
        },
        {
          Update: {
            TableName:                 USERS_TABLE,
            Key:                       { userId: user.userId },
            UpdateExpression:          'SET usernameReserved = :t',
            ConditionExpression:       'username = :u',
            ExpressionAttributeValues: { ':t': true, ':u': user.username },
          },
        },
      ],
    }));
    return { ...user, usernameReserved: true };
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    if (cancellationCodes(err)[0] !== 'ConditionalCheckFailed') return user;

    // Someone else already holds this name, so this user gets a free change
    console.warn(`Duplicate username ${user.username} for ${user.userId}`);
    await db.send(new UpdateCommand({
      TableName:                 USERS_TABLE,
      Key:                       { userId: user.userId },
      UpdateExpression:          'SET usernameConflict = :t',
      ExpressionAttributeValues: { ':t': true },
    }));
    return { ...user, usernameConflict: true };
  }
}

async function changeUsername(user, newUsername) {
  const status = usernameStatus(user);
  if (!status.canChange) {
    return response(403, {
      error: status.locked
        ? 'Your username is locked. Premium members can change it once a day.'
        : `You can change your username again after ${status.nextChangeAt}.`,
    });
  }

  if (await isUsernameTaken(newUsername, user.userId)) {
    return response(409, { error: 'That username is taken.' });
  }

  const now  = new Date().toISOString();
  const free = isFreeUsernameChange(user);

  const transactItems = [
    {
      Put: {
        TableName: USERS_TABLE,
        Item: { userId: reservationKey(newUsername), ownerId: user.userId, createdAt: now },
        ConditionExpression: 'attribute_not_exists(userId)',
      },
    },
    {
      Update: free
        ? {
            TableName:                 USERS_TABLE,
            Key:                       { userId: user.userId },
            UpdateExpression:          'SET username = :new, usernameReserved = :t REMOVE usernamePlaceholder, usernameConflict',
            ConditionExpression:       'username = :old',
            ExpressionAttributeValues: { ':new': newUsername, ':t': true, ':old': user.username },
          }
        : {
            TableName:                 USERS_TABLE,
            Key:                       { userId: user.userId },
            UpdateExpression:          'SET username = :new, usernameReserved = :t, usernameChangedAt = :now ADD usernameChangeCount :one',
            ConditionExpression:       'username = :old',
            ExpressionAttributeValues: { ':new': newUsername, ':t': true, ':now': now, ':one': 1, ':old': user.username },
          },
    },
  ];

  // Release the old name so others can take it
  if (user.usernameReserved) {
    transactItems.push({
      Delete: {
        TableName:                 USERS_TABLE,
        Key:                       { userId: reservationKey(user.username) },
        ConditionExpression:       'ownerId = :me',
        ExpressionAttributeValues: { ':me': user.userId },
      },
    });
  }

  try {
    await db.send(new TransactWriteCommand({ TransactItems: transactItems }));
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    const [nameCheck] = cancellationCodes(err);
    if (nameCheck === 'ConditionalCheckFailed') return response(409, { error: 'That username is taken.' });
    return response(409, { error: 'Your profile changed while saving. Please try again.' });
  }

  return null;
}

// fallbackOnConflict: use a generated placeholder instead of failing when the name is invalid or taken
async function createUser(userId, email, requestedUsername, fallbackOnConflict = false) {
  let username = (requestedUsername ?? '').trim().toLowerCase();
  let placeholder = false;

  if (!USERNAME_RE.test(username) || await isUsernameTaken(username, userId)) {
    if (!fallbackOnConflict) {
      return USERNAME_RE.test(username)
        ? { error: response(409, { error: 'That username is taken.' }) }
        : { error: response(400, { error: 'Username must be 3-30 characters, letters, numbers, and underscores only.' }) };
    }
    username    = `user_${userId.replace(/-/g, '').slice(0, 12).toLowerCase()}`;
    placeholder = true;
  }

  const now = new Date().toISOString();
  const user = {
    userId,
    email,
    username,
    usernameReserved: true,
    ...(placeholder && { usernamePlaceholder: true }),
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

  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: USERS_TABLE,
            Item: user,
            ConditionExpression: 'attribute_not_exists(userId)',
          },
        },
        {
          Put: {
            TableName: USERS_TABLE,
            Item: { userId: reservationKey(username), ownerId: userId, createdAt: now },
            ConditionExpression: 'attribute_not_exists(userId)',
          },
        },
      ],
    }));
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    const [userCheck] = cancellationCodes(err);
    if (userCheck === 'ConditionalCheckFailed') return { error: response(409, { error: 'User already exists.' }) };
    return { error: response(409, { error: 'That username is taken.' }) };
  }

  return { user };
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
  const {
    displayName, bio, username, tags, profilePicKey, bannerKey,
    isPrivate, hideAuraRank, commentVisibilityDefault, notificationPrefs,
  } = body;

  const newUsername = typeof username === 'string' ? username.trim().toLowerCase() : username;
  if (newUsername !== undefined && !USERNAME_RE.test(newUsername ?? '')) {
    return response(400, { error: 'Username must be 3-30 characters, letters, numbers, and underscores only.' });
  }

  if (bio && bio.length > 160) {
    return response(400, { error: 'Bio must be under 160 characters.' });
  }

  if (tags && tags.length > 10) {
    return response(400, { error: 'Maximum 10 tags.' });
  }

  for (const [name, value] of Object.entries({ isPrivate, hideAuraRank })) {
    if (value !== undefined && typeof value !== 'boolean') {
      return response(400, { error: `${name} must be true or false.` });
    }
  }

  if (commentVisibilityDefault !== undefined && !COMMENT_VISIBILITY.includes(commentVisibilityDefault)) {
    return response(400, { error: `commentVisibilityDefault must be one of: ${COMMENT_VISIBILITY.join(', ')}.` });
  }

  if (notificationPrefs !== undefined && (typeof notificationPrefs !== 'object' || notificationPrefs === null)) {
    return response(400, { error: 'notificationPrefs must be an object.' });
  }

  const current = await getUser(userId, true);
  if (!current) return response(404, { error: 'User not found.' });

  if (newUsername !== undefined && newUsername !== current.username) {
    const error = await changeUsername(current, newUsername);
    if (error) return error;
  }

  const updates = {};
  if (displayName    !== undefined) updates.displayName    = displayName.trim();
  if (bio            !== undefined) updates.bio            = bio.trim();
  if (tags           !== undefined) updates.tags           = tags.slice(0, 10);
  if (profilePicKey  !== undefined) updates.profilePicKey  = profilePicKey;
  if (bannerKey      !== undefined) updates.bannerKey      = bannerKey;
  if (isPrivate      !== undefined) updates.isPrivate      = isPrivate;
  if (hideAuraRank   !== undefined) updates.hideAuraRank   = hideAuraRank;
  if (commentVisibilityDefault !== undefined) updates.commentVisibilityDefault = commentVisibilityDefault;
  // Unknown keys are dropped; every known type defaults to on
  if (notificationPrefs !== undefined) {
    updates.notificationPrefs = Object.fromEntries(
      NOTIFICATION_TYPES.map(type => [type, notificationPrefs[type] !== false])
    );
  }
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

  return response(200, { ...result.Item, usernameStatus: usernameStatus(result.Item) });
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
      const { user, error } = await createUser(uid, email, username);
      if (error) return error;
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
        // preferred_username is the name picked at sign-up; cognito:username is the email
        const claims  = event.requestContext?.authorizer?.jwt?.claims ?? {};
        const created = await createUser(userId, claims.email ?? '', claims.preferred_username, true);
        if (created.error) return created.error;
        user = created.user;
      } else {
        user = await ensureReservation(user);
      }

      const budget = await getDailyBudget(userId, user.isPremium);
      return response(200, { ...user, budget, usernameStatus: usernameStatus(user) });
    }

    // GET /users/{username} — get public profile
    if (method === 'GET' && segments[0] === 'users' && segments.length === 2) {
      const asTyped  = decodeURIComponent(segments[1] ?? '');
      const username = asTyped.toLowerCase();
      if (!username || username === 'me') {
        return response(400, { error: 'Invalid username.' });
      }

      const user = await findUserByUsername(username, asTyped);
      if (!user) {
        return response(404, { error: 'User not found.' });
      }

      return response(200, stripPrivate(user));
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