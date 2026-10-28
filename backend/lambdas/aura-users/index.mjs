import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new DynamoDBClient({ region: 'us-east-1' });
const db     = DynamoDBDocumentClient.from(client);
const s3     = new S3Client({ region: 'us-east-1' });

const USERS_TABLE         = 'aura-users';
const DAILY_BUDGETS_TABLE = 'aura-daily-budgets';
const BUCKET_NAME         = 'aura-app-media-570934198135';
const POSTS_TABLE         = 'aura-posts';
const COMMENTS_TABLE      = 'aura-comments';

// Site moderators (the aura_app account). Keep in sync across aura-users,
// aura-posts and aura-comments. IDs come from the verified Cognito token, so
// nobody else can act as a moderator.
const ADMIN_IDS = new Set(['74081408-8031-706d-70d9-e1fa81428cb1']);

// Keep RULES, AURA_VERSION and AD_COOLDOWN_MS in sync with aura-aura, which enforces them
const RULES = {
  regular: { loginBonus: 200, freeGive: 50,  giveCap: 500,  takeCap: 250  },
  premium: { loginBonus: 800, freeGive: 200, giveCap: 2000, takeCap: 1000 },
};
const AURA_VERSION   = 2;
const AD_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_DISPLAY_NAME = 50;
const MAX_TAG_LENGTH   = 30;
// Profile pictures and banners (see src/pages/Profile.jsx)
const UPLOAD_TYPES = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png':  10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/gif':  10 * 1024 * 1024,
};
const AURA_FIELDS = [
  'auraBalance', 'auraEarned', 'auraSpendable', 'lifetimeEarned', 'lifetimeReceived',
  'lifetimeGiven', 'lifetimeTaken', 'lifetimeLost',
];

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
// App themes an account can save. Keep in sync with THEME_IDS in src/themes/index.js.
const THEME_IDS = ['day', 'night', 'light', 'dark', 'snowy-peaks', 'duskfall', 'custom'];

// Fields only the owner may see
const PRIVATE_FIELDS = [
  'email', 'followerCount', 'followingCount', 'totalPostViews',
  'notificationPrefs', 'commentVisibilityDefault', 'theme',
  'usernameChangeCount', 'usernameChangedAt', 'usernameReserved',
  'usernamePlaceholder', 'usernameConflict',
  'auraEarned', 'auraSpendable', 'lifetimeEarned', 'lifetimeReceived',
  'lifetimeGiven', 'lifetimeTaken', 'lifetimeLost', 'lastAdAt', 'auraVersion',
];

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
    await db.send(new UpdateCommand({
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

function stripPrivate(user) {
  // Balances from before the earned/spendable split are reset on first use, so show them as 0 until then
  if (user.auraVersion !== AURA_VERSION) user.auraBalance = 0;
  for (const field of PRIVATE_FIELDS) delete user[field];
  return user;
}

// Same reset as aura-aura's getAuraAccount
async function migrateAura(user) {
  if (user.auraVersion === AURA_VERSION) return user;
  try {
    await db.send(new UpdateCommand({
      TableName:        USERS_TABLE,
      Key:              { userId: user.userId },
      UpdateExpression: `SET ${AURA_FIELDS.map(f => `${f} = :zero`).join(', ')}, auraVersion = :v`,
      ConditionExpression:       'attribute_not_exists(auraVersion)',
      ExpressionAttributeValues: { ':zero': 0, ':v': AURA_VERSION },
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
  }
  return getUser(user.userId, true);
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
    ...Object.fromEntries(AURA_FIELDS.map(f => [f, 0])),
    auraVersion:    AURA_VERSION,
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

// ─── Moderation ───────────────────────────────────────────────
// Every item in `table` written by `authorId` whose status matches.
async function scanByAuthor(table, authorId, filter, values) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new ScanCommand({
      TableName:                 table,
      FilterExpression:          `authorId = :a AND ${filter}`,
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':a': authorId, ...values },
      ExclusiveStartKey,
    }));
    items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// Banning hides the account's profile, posts and comments; unbanning brings
// back only what the ban hid (not posts the user or a moderator removed).
async function setBanned(moderatorId, body) {
  const { username, banned, reason } = body;
  if (typeof username !== 'string' || !username.trim()) return response(400, { error: 'username is required.' });
  if (typeof banned !== 'boolean') return response(400, { error: 'banned must be true or false.' });
  if (reason !== undefined && (typeof reason !== 'string' || reason.length > 300)) {
    return response(400, { error: 'Reason must be under 300 characters.' });
  }

  const target = await findUserByUsername(username.trim().toLowerCase().replace(/^@/, ''));
  if (!target) return response(404, { error: 'User not found.' });
  if (ADMIN_IDS.has(target.userId)) return response(400, { error: 'Moderator accounts cannot be banned.' });

  const now = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key:       { userId: target.userId },
    UpdateExpression: banned
      ? 'SET isBanned = :t, bannedAt = :now, bannedBy = :mod, banReason = :reason'
      : 'SET isBanned = :f REMOVE bannedAt, bannedBy, banReason',
    ExpressionAttributeValues: banned
      ? { ':t': true, ':now': now, ':mod': moderatorId, ':reason': reason ?? '' }
      : { ':f': false },
  }));

  const tables = [[POSTS_TABLE, 'postId'], [COMMENTS_TABLE, 'commentId']];
  let changed = 0;
  for (const [table, key] of tables) {
    const items = banned
      ? await scanByAuthor(table, target.userId, '#status = :active', { ':active': 'active' })
      : await scanByAuthor(table, target.userId, '#status = :removed AND removedBy = :ban', { ':removed': 'removed', ':ban': 'ban' });
    for (const item of items) {
      await db.send(new UpdateCommand({
        TableName:                 table,
        Key:                       { [key]: item[key] },
        UpdateExpression:          banned ? 'SET #status = :removed, removedBy = :ban, removedAt = :now'
                                          : 'SET #status = :active REMOVE removedBy, removedAt',
        ExpressionAttributeNames:  { '#status': 'status' },
        ExpressionAttributeValues: banned ? { ':removed': 'removed', ':ban': 'ban', ':now': now } : { ':active': 'active' },
      }));
      changed++;
    }
  }

  console.log(`Moderation: ${moderatorId} set banned=${banned} on ${target.userId} (@${target.username}), ${changed} items`);
  return response(200, {
    message: banned
      ? `Banned @${target.username} and hid ${changed} posts and comments.`
      : `Unbanned @${target.username} and restored ${changed} posts and comments.`,
    username: target.username,
    isBanned: banned,
  });
}

// Today's allowances for the wallet. Read-only: aura-aura writes the daily record.
async function getToday(user) {
  const result = await db.send(new GetCommand({
    TableName: DAILY_BUDGETS_TABLE,
    Key: { budgetKey: `${user.userId}#${today()}` },
  }));
  const day   = result.Item ?? {};
  const rules = user.isPremium ? RULES.premium : RULES.regular;
  const nextAdAt = user.lastAdAt ? new Date(Date.parse(user.lastAdAt) + AD_COOLDOWN_MS) : null;

  return {
    date:       today(),
    bonus:      { amount: rules.loginBonus, claimed: !!day.bonusClaimed },
    freeGive:   { used: day.freeGiveUsed   ?? 0, limit: rules.freeGive },
    walletGive: { used: day.walletGiveUsed ?? 0, limit: rules.giveCap },
    take:       { used: day.takeUsed       ?? 0, limit: rules.takeCap },
    nextAdAt:   nextAdAt && nextAdAt > new Date() ? nextAdAt.toISOString() : null,
  };
}

async function updateProfile(userId, body) {
  const {
    displayName, bio, username, tags, profilePicKey, bannerKey,
    isPrivate, hideAuraRank, commentVisibilityDefault, notificationPrefs, theme,
  } = body;

  const newUsername = typeof username === 'string' ? username.trim().toLowerCase() : username;
  if (newUsername !== undefined && !USERNAME_RE.test(newUsername ?? '')) {
    return response(400, { error: 'Username must be 3-30 characters, letters, numbers, and underscores only.' });
  }

  if (displayName !== undefined && (typeof displayName !== 'string' || !displayName.trim()
      || displayName.trim().length > MAX_DISPLAY_NAME)) {
    return response(400, { error: `Display name must be 1-${MAX_DISPLAY_NAME} characters.` });
  }

  if (bio !== undefined && (typeof bio !== 'string' || bio.length > 160)) {
    return response(400, { error: 'Bio must be under 160 characters.' });
  }

  if (tags !== undefined && (!Array.isArray(tags) || tags.length > 10
      || !tags.every(t => typeof t === 'string' && t.length <= MAX_TAG_LENGTH))) {
    return response(400, { error: `Up to 10 tags, ${MAX_TAG_LENGTH} characters each.` });
  }


  for (const [name, value] of Object.entries({ isPrivate, hideAuraRank })) {
    if (value !== undefined && typeof value !== 'boolean') {
      return response(400, { error: `${name} must be true or false.` });
    }
  }

  if (commentVisibilityDefault !== undefined && !COMMENT_VISIBILITY.includes(commentVisibilityDefault)) {
    return response(400, { error: `commentVisibilityDefault must be one of: ${COMMENT_VISIBILITY.join(', ')}.` });
  }

  if (theme !== undefined && !THEME_IDS.includes(theme)) {
    return response(400, { error: `theme must be one of: ${THEME_IDS.join(', ')}.` });
  }

  if (notificationPrefs !== undefined && (typeof notificationPrefs !== 'object' || notificationPrefs === null)) {
    return response(400, { error: 'notificationPrefs must be an object.' });
  }

  const current = await getUser(userId, true);
  if (!current) return response(404, { error: 'User not found.' });

  // New pictures must be ones this user uploaded through /users/me/upload-urls.
  // Keeping the current picture is always allowed.
  for (const [name, value, folder] of [['profilePicKey', profilePicKey, 'avatars'], ['bannerKey', bannerKey, 'banners']]) {
    if (value === undefined || value === '' || value === current[name]) continue;
    if (typeof value !== 'string' || !value.startsWith(`${folder}/${userId}/`) || value.includes('..')) {
      return response(400, { error: `Invalid ${name}.` });
    }
  }

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
  if (theme          !== undefined) updates.theme          = theme;
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

// Keeps letters, digits, dot, dash and underscore, with no runs of dots, so
// keys stay predictable and pass the `..` check when the post is created
function safeFileName(name) {
  const cleaned = String(name ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '.').slice(-60);
  return cleaned || 'file';
}

// The size is signed into the URL, so S3 refuses an upload of any other size
async function signedUpload(key, contentType, size) {
  const command = new PutObjectCommand({
    Bucket:        BUCKET_NAME,
    Key:           key,
    ContentType:   contentType,
    ContentLength: size,
  });
  return getSignedUrl(s3, command, { expiresIn: 600 });
}

async function getProfileUploadUrls(userId, body) {
  const { files } = body;
  if (!Array.isArray(files) || !files.length) return response(400, { error: 'No files specified.' });
  if (files.length > 2) return response(400, { error: 'Too many files.' });
  for (const file of files) {
    const maxSize = UPLOAD_TYPES[file?.contentType];
    if (!maxSize) return response(400, { error: 'Only JPEG, PNG, WEBP or GIF images can be uploaded.' });
    if (!Number.isInteger(file.size) || file.size < 1 || file.size > maxSize) {
      return response(400, { error: `Images must be under ${maxSize / 1024 / 1024}MB.` });
    }
  }

  const urls = [];
  for (const file of files) {
    const folder = file.type === 'banner' ? 'banners' : 'avatars';
    const key    = `${folder}/${userId}/${Date.now()}-${safeFileName(file.name)}`;
    urls.push({ key, url: await signedUpload(key, file.contentType, file.size), type: file.type });
  }

  return response(200, { urls });
}

export const handler = async (event) => {
  const method   = event.requestContext?.http?.method ?? event.httpMethod;
  const path     = event.requestContext?.http?.path   ?? event.path;
  const segments = path.split('/').filter(Boolean);
  const userId   = event.requestContext?.authorizer?.jwt?.claims?.sub;
  // Logged-out requests are limited per IP address
  const who      = userId ?? `ip:${event.requestContext?.http?.sourceIp ?? 'unknown'}`;

  try {
    const limited = await firstLimit([who, 'api', userId ? 120 : 60, 60]);
    if (limited) return limited;

    // Profile edits and uploads
    if (userId && (method === 'PUT' || method === 'POST')) {
      const actionLimited = await firstLimit([userId, 'profile', 10, 60]);
      if (actionLimited) return actionLimited;
    }

    // POST /users — create user
    if (method === 'POST' && path === '/users') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const body = JSON.parse(event.body ?? '{}');
      // The account is always the logged-in user's; a userId in the body is ignored
      const email = event.requestContext?.authorizer?.jwt?.claims?.email ?? body.email;
      const { username } = body;
      if (!email || !username) {
        return response(400, { error: 'email and username are required.' });
      }
      const { user, error } = await createUser(userId, email, username);
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
        user = await migrateAura(user);
      }

      const todayStatus = await getToday(user);
      return response(200, {
        ...user, today: todayStatus, usernameStatus: usernameStatus(user),
        ...(ADMIN_IDS.has(userId) && { isAdmin: true }),
      });
    }

    // GET /users/{username} — get public profile
    if (method === 'GET' && segments[0] === 'users' && segments.length === 2) {
      const asTyped  = decodeURIComponent(segments[1] ?? '');
      const username = asTyped.toLowerCase();
      if (!username || username === 'me') {
        return response(400, { error: 'Invalid username.' });
      }

      const user = await findUserByUsername(username, asTyped);
      // Banned profiles are hidden from everyone except moderators
      if (!user || (user.isBanned && !ADMIN_IDS.has(userId))) {
        return response(404, { error: 'User not found.' });
      }

      return response(200, stripPrivate(user));
    }

    // POST /admin/ban — ban or unban an account (site moderators only)
    if (method === 'POST' && path === '/admin/ban') {
      if (!userId || !ADMIN_IDS.has(userId)) return response(403, { error: 'Moderators only.' });
      return await setBanned(userId, JSON.parse(event.body ?? '{}'));
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