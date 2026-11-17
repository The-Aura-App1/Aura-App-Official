import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand,
  BatchGetCommand, TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { cleanText } from './text.mjs';
import { canSeeAccount, hiddenAuthors, blockedBetween, eitherBlocked } from './privacy.mjs';
import { addGroupXp, GROUP_STATS_TABLE, groupLevel, PERKS } from './groupStats.mjs';
import { parseReaction, reactionKey, commentReactionKey, normalizeReaction, visibleCounts, MAX_PER_USER, MAX_KINDS } from './reactions.mjs';
import { checkOverlays } from './overlays.mjs';
import { checkStyle } from './postStyle.mjs';

// Request bodies must be JSON objects; anything else is a 400, not a crash
function parseBody(raw) {
  if (raw === undefined || raw === null || raw === '') return {};
  try {
    const body = JSON.parse(raw);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function decodeSegment(value) {
  try { return decodeURIComponent(value ?? ''); } catch { return null; }
}

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const s3     = new S3Client({ region: 'us-east-1' });

const POSTS_TABLE    = 'aura-posts';
const USERS_TABLE    = 'aura-users';
const LIKES_TABLE    = 'aura-likes';
const COMMENTS_TABLE = 'aura-comments';
const GROUPS_TABLE   = 'aura-groups';
const MEMBERS_TABLE  = 'aura-group-members';
const GROUP_PAGE_SIZE = 20;
const BUCKET_NAME    = 'aura-app-media-570934198135';

// Site moderators (the aura_app account). Keep in sync across aura-users,
// aura-posts and aura-comments. IDs come from the verified Cognito token, so
// nobody else can act as a moderator.
const ADMIN_IDS = new Set(['74081408-8031-706d-70d9-e1fa81428cb1']);

const MAX_IMAGES_PER_POST = 10;
const LIKED_PAGE_SIZE     = 20;
const CAPTION_LIMIT_GLOBAL = 2200;    // same limits as comments
const CAPTION_LIMIT_GROUP  = 10000;

// Media types and sizes the app accepts (see src/pages/CreatePost.jsx)
const UPLOAD_TYPES = {
  'image/jpeg':      20 * 1024 * 1024,
  'image/png':       20 * 1024 * 1024,
  'image/webp':      20 * 1024 * 1024,
  'video/mp4':       500 * 1024 * 1024,
  'video/quicktime': 500 * 1024 * 1024,
};

// aura-likes is keyed by userId + postId; postId holds `<type>#<id>` so one
// table covers likes on posts, comments and (later) Moments
const LIKE_TARGETS = {
  posts:    { type: 'post',    table: POSTS_TABLE,    key: 'postId'    },
  comments: { type: 'comment', table: COMMENTS_TABLE, key: 'commentId' },
};

// Feed ranking (Reddit-style "hot"): every 10x more aura counts as
// HOT_HALF_DAY seconds newer, so aura lifts a post without freezing the feed
const HOT_EPOCH    = Date.parse('2026-01-01T00:00:00Z') / 1000;
const HOT_HALF_DAY = 45000;

// Keep in sync with src/utils/topics.js
const TOPICS = new Set([
  'photography', 'art', 'music', 'film', 'design', 'writing', 'gaming', 'comedy',
  'sports', 'fitness', 'cooking', 'food', 'travel', 'fashion', 'beauty', 'tech',
  'science', 'finance', 'coding', 'books', 'education', 'business', 'pets',
  'motivation', 'sustainability', 'outdoors', 'cars', 'diy',
]);
const MAX_POST_TOPICS = 3;
// Who may comment on a post; keep in sync with aura-users
const COMMENT_VISIBILITY = ['anyone', 'followers'];

// Free-form hashtags (see src/utils/hashtags.js)
const MAX_HASHTAGS    = 10;
const HASHTAG_PATTERN = /^[\p{L}\p{N}_]{1,30}$/u;

// Caption embeddings are computed on the author's device (see
// src/utils/embeddings.js): base64 of EMBED_DIM signed bytes, value * 127
const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EMBED_DIM   = 384;
const FEED_ALL_SIZE   = 100;
const FEED_TOPIC_SIZE = 20;

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

// A normalized vector stays close to length 1 after rounding to bytes
function isValidEmbedding(value) {
  if (typeof value !== 'string' || value.length > 600 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== EMBED_DIM) return false;
  let sumSquares = 0;
  for (let i = 0; i < EMBED_DIM; i++) sumSquares += (bytes.readInt8(i) / 127) ** 2;
  return sumSquares > 0.9 && sumSquares < 1.1;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

async function getUploadUrls(userId, files) {
  const urls = [];
  for (const file of files) {
    const key = `posts/${userId}/${generateId()}-${safeFileName(file.name)}`;
    urls.push({ key, url: await signedUpload(key, file.contentType, file.size) });
  }
  return urls;
}

// ─── Group access ─────────────────────────────────────────────
// Open groups are readable by anyone logged in (except banned users); request
// and invite groups only by members. Only members post and interact.
async function groupAccess(groupId, viewerId) {
  const groupResult = await dynamo.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { groupId } }));
  const group = groupResult.Item?.status === 'active' ? groupResult.Item : null;
  if (!group) return { group: null, canSee: false, isMember: false, canModerate: false };

  const member = viewerId
    ? (await dynamo.send(new GetCommand({ TableName: MEMBERS_TABLE, Key: { groupId, userId: viewerId } }))).Item
    : null;
  const isMember    = member?.status === 'active';
  const canModerate = isMember && (group.ownerId === viewerId || member.role === 'moderator');
  const canSee      = isMember || (group.joinType === 'open' && member?.status !== 'banned');
  return { group, isMember, canModerate, canSee };
}

// Drops posts the viewer can't see: group posts follow the group's rules
// (checking each group once), other posts follow the author's privacy
async function visibleToViewer(posts, viewerId) {
  const access = new Map();
  const blocked = ADMIN_IDS.has(viewerId) ? new Set() : await blockedBetween(dynamo, viewerId, posts.map(p => p.authorId));
  const hidden = await hiddenAuthors(dynamo, viewerId,
    posts.filter(p => !p.groupId).map(p => p.authorId), ADMIN_IDS.has(viewerId));
  const visible = [];
  for (const post of posts) {
    if (blocked.has(post.authorId)) continue;
    if (post.groupId) {
      if (!access.has(post.groupId)) access.set(post.groupId, await groupAccess(post.groupId, viewerId));
      if (!access.get(post.groupId).canSee) continue;
    } else if (hidden.has(post.authorId)) {
      continue;
    }
    visible.push(post);
  }
  return visible;
}

async function createPost(userId, body) {
  const { type, mediaKeys, tags, hashtags, groupId, embedding, allowTakes, commentVisibility } = body;
  // Invisible and direction-flipping characters are removed before any check
  const caption = typeof body.caption === 'string' ? cleanText(body.caption) : body.caption;

  let group = null;
  if (groupId !== undefined) {
    if (typeof groupId !== 'string' || !groupId) return response(400, { error: 'Invalid groupId.' });
    const access = await groupAccess(groupId, userId);
    if (!access.group) return response(404, { error: 'Group not found.' });
    if (!access.isMember) return response(403, { error: 'Only members can post in this group.' });
    group = access.group;
  }

  if (!type) return response(400, { error: 'Post type is required.' });
  if (!['text', 'image', 'video'].includes(type)) {
    return response(400, { error: 'Invalid post type.' });
  }
  if (type === 'image' && mediaKeys?.length > MAX_IMAGES_PER_POST) {
    return response(400, { error: `Maximum ${MAX_IMAGES_PER_POST} images per post.` });
  }
  if (type === 'video' && mediaKeys?.length > 1) {
    return response(400, { error: 'Only one video per post.' });
  }
  if (tags !== undefined && (!Array.isArray(tags) || tags.length > MAX_POST_TOPICS
      || new Set(tags).size !== tags.length || !tags.every(t => TOPICS.has(t)))) {
    return response(400, { error: `Pick up to ${MAX_POST_TOPICS} topics from the list.` });
  }
  if (hashtags !== undefined && (!Array.isArray(hashtags) || hashtags.length > MAX_HASHTAGS
      || !hashtags.every(t => typeof t === 'string' && HASHTAG_PATTERN.test(t))
      || new Set(hashtags.map(t => t.toLowerCase())).size !== hashtags.length)) {
    return response(400, { error: `Up to ${MAX_HASHTAGS} different hashtags, using letters, numbers and _ (30 characters max).` });
  }
  // Set once here; there is no route that changes it after posting
  if (allowTakes !== undefined && typeof allowTakes !== 'boolean') {
    return response(400, { error: 'allowTakes must be true or false.' });
  }
  // Who may comment; group posts are always open to the group's members
  if (commentVisibility !== undefined && !COMMENT_VISIBILITY.includes(commentVisibility)) {
    return response(400, { error: `commentVisibility must be one of: ${COMMENT_VISIBILITY.join(', ')}.` });
  }
  if (embedding !== undefined && !isValidEmbedding(embedding)) {
    return response(400, { error: 'Invalid embedding.' });
  }

  const captionLimit = group ? CAPTION_LIMIT_GROUP : CAPTION_LIMIT_GLOBAL;
  if (caption !== undefined && (typeof caption !== 'string' || caption.length > captionLimit)) {
    return response(400, { error: `Caption must be under ${captionLimit} characters.` });
  }
  // Media must be files this user uploaded through /posts/upload-urls
  if (mediaKeys !== undefined && (!Array.isArray(mediaKeys)
      || !mediaKeys.every(k => typeof k === 'string' && k.startsWith(`posts/${userId}/`) && !k.includes('..')))) {
    return response(400, { error: 'Invalid media.' });
  }
  if (type === 'text' && mediaKeys?.length) {
    return response(400, { error: 'Text posts cannot have media.' });
  }

  const userResult = await dynamo.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));

  if (!userResult.Item) return response(404, { error: 'User not found.' });
  if (userResult.Item.isBanned) return response(403, { error: 'Account banned.' });

  const author = userResult.Item;
  // A level-10 group's own backgrounds can be used on text posts in it
  let groupBgs = [];
  if (group && typeof body.style?.bg === 'string' && body.style.bg.startsWith('grp:')) {
    const level = (await groupLevel(dynamo, group.groupId))?.level ?? 1;
    if (level >= PERKS.backgrounds) groupBgs = (group.backgrounds ?? []).map(b => `grp:${b.id}`);
  }
  // Fonts, colors, backgrounds and frames (set once, at posting)
  const styled = checkStyle(body.style, type, author, groupBgs);
  if (styled.error) return response(styled.status ?? 400, { error: styled.error });
  // The background's image and text color are copied onto the post, so it keeps its look
  const groupBg = styled.style?.bg?.startsWith('grp:')
    ? (group.backgrounds ?? []).find(b => `grp:${b.id}` === styled.style.bg) : null;
  // Text, links, mentions, hashtags and emoji placed on the photos, the video,
  // or a text post's card (only one with a background has a card to place them on)
  if (body.overlays !== undefined && type === 'text' && !styled.style?.bg) {
    return response(400, { error: 'Pick a background for your text post to put things on it.' });
  }
  const placed = checkOverlays(body.overlays, type === 'image' ? (mediaKeys?.length ?? 0) : 1, cleanText);
  if (placed.error) return response(400, { error: placed.error });

  const postId = generateId();
  const now    = new Date().toISOString();

  const post = {
    postId,
    authorId:       userId,
    authorUsername: author.username,
    authorDisplay:  author.displayName,
    authorPicKey: author.profilePicKey ?? '',
    type,
    caption:        caption ?? '',
    mediaKeys:      mediaKeys ?? [],
    tags:           tags ?? [],
    hashtags:       hashtags ?? [],
    auraScore:      0,
    auraReceived:   0,
    auraTaken:      0,
    viewCount:      0,
    likeCount:      0,
    allowTakes:     allowTakes ?? true,
    commentVisibility: group ? 'anyone' : (commentVisibility ?? author.commentVisibilityDefault ?? 'anyone'),
    status:         'active',
    reportCount:    0,
    createdAt:      now,
    updatedAt:      now,
    ...(styled.style && { style: styled.style }),
    ...(groupBg && { groupBg: { key: groupBg.key, ink: groupBg.ink, name: groupBg.name } }),
    ...(placed.overlays.length && { overlays: placed.overlays }),
    reactions:      {},
    ...(group && { groupId: group.groupId, groupName: group.name }),
    ...(!group && embedding && { embedding, embeddingModel: EMBED_MODEL }),
  };

  await dynamo.send(new PutCommand({
    TableName: POSTS_TABLE,
    Item: post,
  }));

  if (post.groupId) await addGroupXp(dynamo, post.groupId, userId, 'post');
  return response(201, post);
}

// Reads every page. A single Scan page stops at 1 MB (or Limit) before the
// filter runs, so stopping early silently drops matching posts.
// TODO: replace with Query on GSIs (status+createdAt, authorId+createdAt) before launch
async function scanAll(params) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new ScanCommand({ ...params, ExclusiveStartKey }));
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function hotScore(post) {
  const aura    = post.auraScore ?? 0;
  const order   = Math.log10(Math.max(Math.abs(aura), 1));
  const seconds = (Date.parse(post.createdAt) || 0) / 1000 - HOT_EPOCH;
  return Math.sign(aura) * order + seconds / HOT_HALF_DAY;
}

function likeKey(type, id) {
  return `${type}#${id}`;
}

// Fetches items by key in chunks of 100, retrying anything DynamoDB defers
async function batchGet(table, keys) {
  const items = [];
  for (let i = 0; i < keys.length; i += 100) {
    let request = { [table]: { Keys: keys.slice(i, i + 100) } };
    while (request && Object.keys(request).length) {
      const result = await dynamo.send(new BatchGetCommand({ RequestItems: request }));
      items.push(...(result.Responses?.[table] ?? []));
      request = result.UnprocessedKeys;
    }
  }
  return items;
}

// Adds likedByMe for the viewer and hides author-only counts from everyone else
async function forViewer(posts, viewerId) {
  // Posts by people the viewer blocked, or who blocked the viewer, never show
  if (viewerId && !ADMIN_IDS.has(viewerId) && posts.length) {
    const blocked = await blockedBetween(dynamo, viewerId, posts.map(p => p.authorId));
    if (blocked.size) posts = posts.filter(p => !blocked.has(p.authorId));
  }
  const liked = new Set();
  const mine = new Map();
  if (viewerId && posts.length) {
    const rows = await batchGet(LIKES_TABLE, posts.flatMap(p => [
      { userId: viewerId, postId: likeKey('post', p.postId) },
      { userId: viewerId, postId: reactionKey(p.postId) },
    ]));
    for (const row of rows) {
      if (row.postId.startsWith('react#')) mine.set(row.postId.slice(6), [...(row.reactions ?? [])]);
      else liked.add(row.targetId);
    }
  }
  const pins = await pinInfo(posts);
  return posts.map(post => {
    const reactions = visibleCounts(post.reactions);
    post.reactions = reactions;
    const used = Object.keys(reactions).filter(k => pins.has(k));
    if (used.length) post.reactionPins = Object.fromEntries(used.map(k => [k, pins.get(k)]));
    // Report details are for moderation only, never for viewers
    delete post.reportCount;
    delete post.reportedBy;
    delete post.trustedReports;
    delete post.reportReasons;
    delete post.lastReportedAt;
    delete post.reviewedAt;
    delete post.reviewedBy;
    if (post.authorId !== viewerId) {
      delete post.viewCount;
      delete post.likeCount;
    } else {
      // Posts from before likes existed have no counter yet
      post.likeCount = post.likeCount ?? 0;
    }
    return { ...post, likedByMe: liked.has(post.postId), myReactions: mine.get(post.postId) ?? [] };
  });
}

// The image and name of every group pin used on these posts (one read per group)
async function pinInfo(posts) {
  const wanted = new Map();
  for (const post of posts) {
    for (const k of Object.keys(post.reactions ?? {})) {
      const r = parseReaction(k);
      if (r?.kind === 'pin') wanted.set(r.groupId, true);
    }
  }
  const out = new Map();
  await Promise.all([...wanted.keys()].map(async groupId => {
    try {
      const group = (await dynamo.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { groupId } }))).Item;
      for (const pin of group?.status === 'active' ? group.pins ?? [] : []) out.set(`pin:${groupId}:${pin.id}`, { key: pin.key, name: pin.name });
    } catch (err) {
      console.warn(`Pins not read (${err.name}).`);
    }
  }));
  return out;
}

// ─── Reactions ────────────────────────────────────────────────
// POST /posts/{id}/reactions { reaction, on }: add or take back one reaction.
// Doing what's already done is a no-op, so double taps can't double count.
async function setReaction(userId, postId, body) {
  const reaction = normalizeReaction(body?.reaction);
  const on = body?.on !== false;
  const parsed = parseReaction(reaction);
  if (!parsed) return response(400, { error: 'That reaction isn\'t available.' });

  const [postResult, userResult] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId } })),
    dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } })),
  ]);
  const post = postResult.Item;
  const user = userResult.Item;
  if (!user) return response(404, { error: 'User not found.' });
  if (user.isBanned) return response(403, { error: 'Account banned.' });
  if (!post || post.status !== 'active' || !(await visibleToViewer([post], userId)).length) return response(404, { error: 'Post not found.' });
  // Only a group's members react to its posts
  if (post.groupId && on && !(await groupAccess(post.groupId, userId)).isMember) return response(403, { error: 'Join the group to react to its posts.' });

  // A group pin: the group has to be level 7 with that pin, and the reactor a
  // member; outside the group, only Premium members may use it
  if (parsed.kind === 'pin' && on) {
    const access = await groupAccess(parsed.groupId, userId);
    if (!access.group || !access.isMember) return response(403, { error: 'Only members can use this group\'s pins.' });
    if (((await groupLevel(dynamo, parsed.groupId))?.level ?? 1) < PERKS.pins) return response(403, { error: `Group pins unlock at level ${PERKS.pins}.` });
    if (!(access.group.pins ?? []).some(p => p.id === parsed.pinId)) return response(404, { error: 'That pin is gone.' });
    if (post.groupId !== parsed.groupId && !user.isPremium) return response(403, { error: 'Using group pins outside the group is a Premium feature.' });
  }

  const done = await applyReaction(REACT_TARGETS.post, postId, reactionKey(postId), userId, reaction, on, post.reactions);
  if (done.error) return done.error;
  const pins = await pinInfo([{ reactions: done.reactions }]);
  return response(200, {
    reactions: done.reactions, myReactions: done.mine,
    reactionPins: Object.fromEntries([...pins].filter(([k]) => done.reactions[k])),
  });
}

// Posts and comments keep reactions the same way: each person's choices in
// aura-likes, the counts in a `reactions` map on the item, both changed in
// one transaction so they can't drift.
const REACT_TARGETS = {
  post:    { table: POSTS_TABLE,    keyName: 'postId',    noun: 'post' },
  comment: { table: COMMENTS_TABLE, keyName: 'commentId', noun: 'comment' },
};

// → { reactions, mine } or { error: response }
async function applyReaction(target, id, likesKey, userId, reaction, on, existing) {
  const itemKey = { [target.keyName]: id };
  // The counts map has to exist before one count in it can change
  if (!existing) {
    await dynamo.send(new UpdateCommand({
      TableName: target.table, Key: itemKey,
      UpdateExpression: 'SET #rx = if_not_exists(#rx, :empty)',
      ConditionExpression: 'attribute_exists(#id)',
      ExpressionAttributeNames: { '#rx': 'reactions', '#id': target.keyName },
      ExpressionAttributeValues: { ':empty': {} },
    }));
  }

  const key = { userId, postId: likesKey };
  const now = new Date().toISOString();
  const items = on
    ? [
        { Update: {
          TableName: LIKES_TABLE, Key: key,
          UpdateExpression: 'ADD #r :set SET targetType = :type, targetId = :tid, updatedAt = :now',
          ConditionExpression: 'attribute_not_exists(#r) OR (NOT contains(#r, :one) AND size(#r) < :max)',
          ExpressionAttributeNames: { '#r': 'reactions' },
          ExpressionAttributeValues: { ':set': new Set([reaction]), ':one': reaction, ':max': MAX_PER_USER, ':type': target.noun === 'post' ? 'reaction' : 'comment-reaction', ':tid': id, ':now': now },
        } },
        { Update: {
          TableName: target.table, Key: itemKey,
          UpdateExpression: 'SET #rx.#k = if_not_exists(#rx.#k, :zero) + :one',
          ConditionExpression: '#status = :active AND (attribute_exists(#rx.#k) OR size(#rx) < :kinds)',
          ExpressionAttributeNames: { '#rx': 'reactions', '#k': reaction, '#status': 'status' },
          ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':kinds': MAX_KINDS, ':active': 'active' },
        } },
      ]
    : [
        { Update: {
          TableName: LIKES_TABLE, Key: key,
          UpdateExpression: 'DELETE #r :set SET updatedAt = :now',
          ConditionExpression: 'contains(#r, :one)',
          ExpressionAttributeNames: { '#r': 'reactions' },
          ExpressionAttributeValues: { ':set': new Set([reaction]), ':one': reaction, ':now': now },
        } },
        { Update: {
          TableName: target.table, Key: itemKey,
          UpdateExpression: 'SET #rx.#k = #rx.#k - :one',
          ConditionExpression: 'attribute_exists(#rx.#k) AND #rx.#k > :zero',
          ExpressionAttributeNames: { '#rx': 'reactions', '#k': reaction },
          ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
        } },
      ];

  try {
    await dynamo.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (err.name === 'AccessDeniedException') return { error: response(503, { error: 'Reactions aren\'t switched on yet. Try again later.' }) };
    if (err.name !== 'TransactionCanceledException') throw err;
    const [mineCheck, itemCheck] = (err.CancellationReasons ?? []).map(r => r?.Code);
    if (mineCheck === 'ConditionalCheckFailed') {
      // Already done, or (adding) they're at their limit
      const row = (await dynamo.send(new GetCommand({ TableName: LIKES_TABLE, Key: key }))).Item;
      const have = [...(row?.reactions ?? [])];
      if (on && !have.includes(reaction) && have.length >= MAX_PER_USER) {
        return { error: response(409, { error: `You can add up to ${MAX_PER_USER} reactions to a ${target.noun}. Take one back to add another.` }) };
      }
    } else if (itemCheck === 'ConditionalCheckFailed') {
      if (on) return { error: response(409, { error: `This ${target.noun} already has ${MAX_KINDS} different reactions. Pick one that's already on it.` }) };
    } else {
      throw err;
    }
  }

  const [after, row] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: target.table, Key: itemKey, ProjectionExpression: '#rx', ExpressionAttributeNames: { '#rx': 'reactions' } })),
    dynamo.send(new GetCommand({ TableName: LIKES_TABLE, Key: key })),
  ]);
  return { reactions: visibleCounts(after.Item?.reactions), mine: [...(row.Item?.reactions ?? [])] };
}

// Reactions on a comment: the same emoji rules and limits as posts (no group
// pins). Only someone who can see the comment can react: its post must be
// visible to them (private accounts, followers-only, groups), neither of
// them may have blocked the other, banned accounts can't, and a removed or
// hidden comment takes none.
async function setCommentReaction(userId, commentId, body) {
  const reaction = normalizeReaction(body?.reaction);
  const on = body?.on !== false;
  const parsed = parseReaction(reaction);
  if (!parsed || parsed.kind !== 'emoji') return response(400, { error: 'That reaction isn\'t available on comments.' });

  const [commentResult, userResult] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: COMMENTS_TABLE, Key: { commentId } })),
    dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } })),
  ]);
  const comment = commentResult.Item;
  const user = userResult.Item;
  if (!user) return response(404, { error: 'User not found.' });
  if (user.isBanned) return response(403, { error: 'Account banned.' });
  const notFound = response(404, { error: 'Comment not found.' });
  if (!comment || (on && comment.status !== 'active')) return notFound;
  const post = (await dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId: comment.postId } }))).Item;
  if (!post || post.status !== 'active' || !(await visibleToViewer([post], userId)).length) return notFound;
  if (!ADMIN_IDS.has(userId) && comment.authorId !== userId && await eitherBlocked(dynamo, userId, comment.authorId)) return notFound;
  if (post.groupId && on && !(await groupAccess(post.groupId, userId)).isMember) return response(403, { error: 'Join the group to react to its comments.' });

  const done = await applyReaction(REACT_TARGETS.comment, commentId, commentReactionKey(commentId), userId, reaction, on, comment.reactions);
  if (done.error) return done.error;
  return response(200, { reactions: done.reactions, myReactions: done.mine });
}

// Every viewer gets the same posts: the overall top list plus the top of each
// topic. Ranking by preference happens on the device, so the request reveals
// nothing about what the viewer likes. Group posts never appear here.
async function getFeed(viewerId) {
  const active = await scanAll({
    TableName:        POSTS_TABLE,
    FilterExpression: '#status = :active AND attribute_not_exists(groupId)',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':active': 'active' },
  });

  for (const post of active) post.hotScore = hotScore(post);
  active.sort((a, b) => b.hotScore - a.hotScore);

  const picked   = new Set(active.slice(0, FEED_ALL_SIZE));
  const perTopic = new Map();
  for (const post of active) {
    for (const topic of post.tags ?? []) {
      const count = perTopic.get(topic) ?? 0;
      if (!TOPICS.has(topic) || count >= FEED_TOPIC_SIZE) continue;
      perTopic.set(topic, count + 1);
      picked.add(post);
    }
  }

  // Private accounts' posts reach only their followers
  const posts = await visibleToViewer(active.filter(post => picked.has(post)), viewerId);
  return response(200, { posts: await forViewer(posts, viewerId) });
}

// `mine`: the author asking for their own posts (the Creator page) gets group
// posts too, and up to MINE_LIMIT of them, with their own views and likes.
const MINE_LIMIT = 500;
async function getUserPosts(authorId, viewerId, limit = 20, mine = false) {
  if (!(await canSeeAccount(dynamo, viewerId, authorId, ADMIN_IDS.has(viewerId)))) {
    return response(403, { error: 'This account is private.', private: true });
  }
  if (!ADMIN_IDS.has(viewerId) && await eitherBlocked(dynamo, viewerId, authorId)) {
    return response(200, { posts: [] });
  }
  const authored = await scanAll({
    TableName:        POSTS_TABLE,
    FilterExpression: `authorId = :aid AND #status = :active${mine ? '' : ' AND attribute_not_exists(groupId)'}`,
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':aid': authorId, ':active': 'active' },
  });

  const newest = authored
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);

  return response(200, { posts: await forViewer(newest, viewerId) });
}

async function getPost(postId, viewerId) {
  const result = await dynamo.send(new GetCommand({
    TableName: POSTS_TABLE,
    Key: { postId },
  }));

  if (!result.Item) return response(404, { error: 'Post not found.' });
  if (result.Item.status !== 'active') return response(404, { error: 'Post not found.' });

  const post = result.Item;
  if (!(await visibleToViewer([post], viewerId)).length) return response(404, { error: 'Post not found.' });

  // Authors viewing their own post don't add views
  if (post.authorId !== viewerId) {
    await dynamo.send(new UpdateCommand({
      TableName:                 POSTS_TABLE,
      Key:                       { postId },
      UpdateExpression:          'ADD viewCount :one',
      ExpressionAttributeValues: { ':one': 1 },
    }));
  }

  const [visible] = await forViewer([post], viewerId);
  return response(200, visible);
}

// ─── Likes ────────────────────────────────────────────────────
// A like is a private bookmark with no aura effect. Liking twice or unliking
// something not liked is a no-op, so double taps can't double count.
async function setLike(userId, collection, targetId, liked) {
  const target = LIKE_TARGETS[collection];
  const key    = { userId, postId: likeKey(target.type, targetId) };

  if (liked) {
    const userResult = await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
    if (!userResult.Item) return response(404, { error: 'User not found.' });
    if (userResult.Item.isBanned) return response(403, { error: 'Account banned.' });

    // Only content the user can see can be liked; group posts follow group visibility
    const targetResult = await dynamo.send(new GetCommand({ TableName: target.table, Key: { [target.key]: targetId } }));
    const postId = target.type === 'post' ? targetId : targetResult.Item?.postId;
    const post   = target.type === 'post'
      ? targetResult.Item
      : postId && (await dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId } }))).Item;
    // A comment on a removed post can't be liked either
    if (!targetResult.Item || !post || post.status !== 'active' || !(await visibleToViewer([post], userId)).length) {
      return response(404, { error: `${target.type === 'post' ? 'Post' : 'Comment'} not found.` });
    }
  }

  const items = liked
    ? [
        {
          Put: {
            TableName: LIKES_TABLE,
            Item: { ...key, targetType: target.type, targetId, createdAt: new Date().toISOString() },
            ConditionExpression: 'attribute_not_exists(userId)',
          },
        },
        {
          Update: {
            TableName:                 target.table,
            Key:                       { [target.key]: targetId },
            UpdateExpression:          'ADD likeCount :one',
            ConditionExpression:       '#status = :active',
            ExpressionAttributeNames:  { '#status': 'status' },
            ExpressionAttributeValues: { ':one': 1, ':active': 'active' },
          },
        },
      ]
    : [
        {
          Delete: {
            TableName: LIKES_TABLE,
            Key: key,
            ConditionExpression: 'attribute_exists(userId)',
          },
        },
        {
          // Unliking still works after the target is removed, but never creates it
          Update: {
            TableName:                 target.table,
            Key:                       { [target.key]: targetId },
            UpdateExpression:          'ADD likeCount :minusOne',
            ConditionExpression:       'attribute_exists(#key)',
            ExpressionAttributeNames:  { '#key': target.key },
            ExpressionAttributeValues: { ':minusOne': -1 },
          },
        },
      ];

  try {
    await dynamo.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    const [likeCheck, targetCheck] = (err.CancellationReasons ?? []).map(r => r?.Code);
    if (likeCheck === 'ConditionalCheckFailed') return response(200, { liked });
    if (targetCheck === 'ConditionalCheckFailed') {
      return response(404, { error: `${target.type === 'post' ? 'Post' : 'Comment'} not found.` });
    }
    throw err;
  }

  return response(200, { liked });
}

// The Liked tab: the viewer's liked posts, most recently liked first.
// cursor is an offset into that list.
async function getLikedPosts(userId, cursor) {
  const likes = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName:                 LIKES_TABLE,
      KeyConditionExpression:    'userId = :u AND begins_with(postId, :prefix)',
      ExpressionAttributeValues: { ':u': userId, ':prefix': 'post#' },
      ExclusiveStartKey,
    }));
    likes.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  likes.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const start = Math.max(0, parseInt(cursor ?? '0', 10) || 0);
  const page  = likes.slice(start, start + LIKED_PAGE_SIZE);
  const next  = start + LIKED_PAGE_SIZE < likes.length ? String(start + LIKED_PAGE_SIZE) : null;

  // Re-check every post: removed posts, and group posts the user can no longer see, are skipped
  const fetched = await batchGet(POSTS_TABLE, page.map(like => ({ postId: like.targetId })));
  const byId    = new Map(fetched.map(post => [post.postId, post]));
  const active  = page
    .map(like => byId.get(like.targetId))
    .filter(post => post && post.status === 'active');
  const posts   = await visibleToViewer(active, userId);

  return response(200, { posts: await forViewer(posts, userId), nextCursor: next });
}

// ─── Group feed ───────────────────────────────────────────────
// The group's current Spotlight post, if any (best effort: never breaks the feed)
async function spotlightPost(groupId) {
  try {
    const spot = (await dynamo.send(new GetCommand({ TableName: GROUP_STATS_TABLE, Key: { groupId, sk: 'SPOTLIGHT' } }))).Item;
    if (!spot || !(spot.until > Date.now())) return null;
    const post = (await dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId: spot.postId } }))).Item;
    return post && post.status === 'active' && post.groupId === groupId ? { ...post, spotlightUntil: spot.until } : null;
  } catch (err) {
    console.warn(`Spotlight not read (${err.name}).`);
    return null;
  }
}

// Newest first, from groupId-index. cursor is the encoded LastEvaluatedKey.
async function getGroupPosts(groupId, viewerId, cursor) {
  const access = await groupAccess(groupId, viewerId);
  // Invite-only groups stay hidden from outsiders, same as aura-groups
  if (!access.group || (!access.canSee && access.group.joinType === 'invite')) {
    return response(404, { error: 'Group not found.' });
  }
  if (!access.canSee) return response(403, { error: 'Join this group to see its posts.' });

  let ExclusiveStartKey;
  if (cursor) {
    try { ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); }
    catch { return response(400, { error: 'Invalid cursor.' }); }
    if (ExclusiveStartKey?.groupId !== groupId) return response(400, { error: 'Invalid cursor.' });
  }

  // Removed posts are filtered after the read, so keep reading until a page fills
  const posts = [];
  do {
    const result = await dynamo.send(new QueryCommand({
      TableName:                 POSTS_TABLE,
      IndexName:                 'groupId-index',
      KeyConditionExpression:    'groupId = :g',
      FilterExpression:          '#status = :active',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':g': groupId, ':active': 'active' },
      ScanIndexForward:          false,
      Limit:                     GROUP_PAGE_SIZE - posts.length,
      ExclusiveStartKey,
    }));
    posts.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey && posts.length < GROUP_PAGE_SIZE);

  const nextCursor = ExclusiveStartKey
    ? Buffer.from(JSON.stringify(ExclusiveStartKey), 'utf8').toString('base64url')
    : null;

  // The group's Spotlight (a power-up, see aura-aura/powerups.mjs) leads the first page
  if (!cursor) {
    const pinned = await spotlightPost(groupId);
    if (pinned) {
      const at = posts.findIndex(p => p.postId === pinned.postId);
      if (at !== -1) posts.splice(at, 1);
      posts.unshift({ ...pinned, spotlight: true });
    }
  }

  const visible = await forViewer(posts, viewerId);
  // Level-10 groups glow, unless the owner turned it off
  const glow = access.group.glow !== false && ((await groupLevel(dynamo, groupId))?.level ?? 1) >= PERKS.glow;
  return response(200, {
    posts: visible.map(post => ({ ...post, canRemove: access.canModerate || post.authorId === viewerId, ...(glow && { glow: true }) })),
    nextCursor,
    glow,
  });
}

// ─── Report post ──────────────────────────────────────────────
// One report per person per post. At REPORT_HIDE_AT reports the post is
// hidden ('pending_review') until a moderator keeps or removes it in
// /moderation. Reasons are kept for the review queue (the list matches
// src/utils/reportReasons.js and aura-comments; a test keeps them equal).
const REPORT_REASONS = ['spam', 'harassment', 'hate', 'violence', 'nudity', 'self_harm', 'misinformation', 'other'];
const REPORT_HIDE_AT = 5;
// Every report reaches the moderators, but only reports from accounts at
// least this old count toward hiding a post, so a batch of new accounts
// can't hide something on its own (trustedReports)
const REPORT_TRUSTED_DAYS = 7;

async function reportPost(postId, userId, reason) {
  const [result, reporterResult] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: POSTS_TABLE, Key: { postId } })),
    dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId }, ProjectionExpression: 'isBanned, createdAt' })),
  ]);
  const reporter = reporterResult.Item;
  if (!reporter) return response(404, { error: 'User not found.' });
  if (reporter.isBanned) return response(403, { error: 'Account banned.' });
  const post = result.Item;
  if (!post || post.status !== 'active' || !(await visibleToViewer([post], userId)).length) {
    return response(404, { error: 'Post not found.' });
  }
  if (post.authorId === userId) return response(400, { error: 'You cannot report your own post.' });
  const created = Date.parse(reporter.createdAt);
  const trusted = Number.isFinite(created) && Date.now() - created >= REPORT_TRUSTED_DAYS * 86400000 ? 1 : 0;

  let updated;
  try {
    updated = await dynamo.send(new UpdateCommand({
      TableName:                 POSTS_TABLE,
      Key:                       { postId },
      UpdateExpression:          'ADD reportCount :one, trustedReports :trusted, reportedBy :me, reportReasons :why SET lastReportedAt = :now',
      ConditionExpression:       'attribute_not_exists(reportedBy) OR NOT contains(reportedBy, :uid)',
      ExpressionAttributeValues: {
        ':one': 1, ':trusted': trusted, ':me': new Set([userId]), ':uid': userId, ':now': new Date().toISOString(),
        ':why': new Set([REPORT_REASONS.includes(reason) ? reason : 'other']),
      },
      ReturnValues:              'ALL_NEW',
    }));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    return response(200, { message: 'Post reported.' });   // already reported by this person
  }

  if ((updated.Attributes?.trustedReports ?? 0) >= REPORT_HIDE_AT) {
    await dynamo.send(new UpdateCommand({
      TableName:                 POSTS_TABLE,
      Key:                       { postId },
      UpdateExpression:          'SET #status = :pending',
      ConditionExpression:       '#status = :active',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: { ':pending': 'pending_review', ':active': 'active' },
    })).catch(err => { if (err.name !== 'ConditionalCheckFailedException') throw err; });
  }
  return response(200, { message: 'Post reported.' });
}

async function deletePost(postId, userId) {
  const result = await dynamo.send(new GetCommand({
    TableName: POSTS_TABLE,
    Key: { postId },
  }));

  if (!result.Item) return response(404, { error: 'Post not found.' });
  // Site moderators can remove any post; group owners and moderators any post in their group
  const isSiteMod = ADMIN_IDS.has(userId) && result.Item.authorId !== userId;
  if (result.Item.authorId !== userId && !isSiteMod) {
    const canModerate = result.Item.groupId && (await groupAccess(result.Item.groupId, userId)).canModerate;
    if (!canModerate) return response(403, { error: 'Not your post.' });
  }

  await dynamo.send(new UpdateCommand({
    TableName:                 POSTS_TABLE,
    Key:                       { postId },
    UpdateExpression:          `SET #status = :removed${isSiteMod ? ', removedBy = :mod, removedAt = :now' : ''}`,
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: {
      ':removed': 'removed',
      ...(isSiteMod && { ':mod': 'moderator', ':now': new Date().toISOString() }),
    },
  }));

  return response(200, { message: 'Post deleted.' });
}

async function handleUploadUrls(userId, body) {
  const { files } = body;
  if (!Array.isArray(files) || !files.length) return response(400, { error: 'No files specified.' });
  if (files.length > MAX_IMAGES_PER_POST) return response(400, { error: 'Too many files.' });
  for (const file of files) {
    const maxSize = UPLOAD_TYPES[file?.contentType];
    if (!maxSize) return response(400, { error: 'Only JPEG, PNG and WEBP images or MP4 and MOV videos can be uploaded.' });
    if (!Number.isInteger(file.size) || file.size < 1 || file.size > maxSize) {
      return response(400, { error: `Each file must be under ${maxSize / 1024 / 1024}MB.` });
    }
  }

  const urls = await getUploadUrls(userId, files);
  return response(200, { urls });
}

// Copies the author's current username, display name and picture onto their
// posts. The values come from the user record, never from the request, so
// nobody can make their posts show someone else's name.
async function fixAuthorNames(userId) {
  const userResult = await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
  const author = userResult.Item;
  if (!author) return response(404, { error: 'User not found.' });
  const newUsername      = author.username;
  const newDisplayName   = author.displayName ?? author.username;
  const newProfilePicKey = author.profilePicKey;

  const posts = await scanAll({
    TableName:        POSTS_TABLE,
    FilterExpression: 'authorId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  });

  await Promise.all(posts.map(post =>
    dynamo.send(new UpdateCommand({
      TableName:                 POSTS_TABLE,
      Key:                       { postId: post.postId },
      UpdateExpression:          'SET authorUsername = :u, authorDisplay = :d, authorPicKey = :p',
      ExpressionAttributeValues: {
        ':u': newUsername,
        ':d': newDisplayName,
        ':p': newProfilePicKey ?? '',
      },
    }))
  ));

  return response(200, { message: `Updated ${posts.length} posts.` });
}

export const handler = async (event) => {
  const method   = event.requestContext?.http?.method ?? event.httpMethod;
  const path     = event.requestContext?.http?.path   ?? event.path;
  const userId   = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const segments = path.split('/').filter(Boolean);
  // Logged-out requests are limited per IP address
  const who      = userId ?? `ip:${event.requestContext?.http?.sourceIp ?? 'unknown'}`;

  try {
    const limited = await firstLimit([who, 'api', userId ? 120 : 60, 60]);
    if (limited) return limited;

    const body = parseBody(event.body);
    if (!body && method === 'POST') return response(400, { error: 'The request body must be a JSON object.' });
    // Ids in the path arrive URL-encoded
    for (let i = 1; i < segments.length; i++) {
      const decoded = decodeSegment(segments[i]);
      if (decoded === null) return response(404, { error: 'Route not found.' });
      segments[i] = decoded;
    }

    if (method === 'POST' && path === '/posts/upload-urls') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'upload', 10, 60]);
      if (actionLimited) return actionLimited;
      return await handleUploadUrls(userId, body);
    }

    if (method === 'POST' && path === '/posts/fix-author') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'fixauthor', 10, 3600]);
      if (actionLimited) return actionLimited;
      return await fixAuthorNames(userId);
    }

    if (method === 'POST' && path === '/posts') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'post', 5, 60], [userId, 'post', 30, 3600]);
      if (actionLimited) return actionLimited;
      return await createPost(userId, body);
    }

    // POST|DELETE /posts/{id}/like and /comments/{id}/like
    // (matched before the /posts/{id} routes below)
    if ((method === 'POST' || method === 'DELETE') && LIKE_TARGETS[segments[0]]
        && segments.length === 3 && segments[2] === 'like') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'like', 60, 60]);
      if (actionLimited) return actionLimited;
      return await setLike(userId, segments[0], segments[1], method === 'POST');
    }

    // POST /posts/{id}/reactions { reaction, on }
    // POST /comments/{id}/reactions { reaction, on }
    if (method === 'POST' && segments[0] === 'comments' && segments.length === 3 && segments[2] === 'reactions') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'react', 60, 60]);
      if (actionLimited) return actionLimited;
      return await setCommentReaction(userId, segments[1], body);
    }

    if (method === 'POST' && segments[0] === 'posts' && segments.length === 3 && segments[2] === 'reactions') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'react', 60, 60]);
      if (actionLimited) return actionLimited;
      return await setReaction(userId, segments[1], body);
    }

    // POST /posts/{id}/report
    if (method === 'POST' && segments[0] === 'posts' && segments.length === 3 && segments[2] === 'report') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const actionLimited = await firstLimit([userId, 'report', 10, 3600]);
      if (actionLimited) return actionLimited;
      return await reportPost(segments[1], userId, body?.reason);
    }

    // GET /groups/{id}/posts — a group's feed
    if (method === 'GET' && segments[0] === 'groups' && segments.length === 3 && segments[2] === 'posts') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await getGroupPosts(segments[1], userId, event.queryStringParameters?.cursor);
    }

    // GET /users/me/likes — the Liked tab
    if (method === 'GET' && path === '/users/me/likes') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await getLikedPosts(userId, event.queryStringParameters?.cursor);
    }

    if (method === 'GET' && segments[0] === 'users' && segments.length === 3 && segments[2] === 'posts') {
      const authorId = segments[1];
      const asked    = parseInt(event.queryStringParameters?.limit ?? '20', 10);
      const mine     = event.queryStringParameters?.scope === 'mine' && !!userId && authorId === userId;
      const limit    = Number.isInteger(asked) ? Math.min(Math.max(asked, 1), mine ? MINE_LIMIT : 50) : 20;
      return await getUserPosts(authorId, userId, limit, mine);
    }

    if (method === 'GET' && path === '/posts') {
      return await getFeed(userId);
    }

    if (method === 'GET' && segments[0] === 'posts' && segments.length === 2) {
      return await getPost(segments[1], userId);
    }

    if (method === 'DELETE' && segments[0] === 'posts' && segments.length === 2) {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await deletePost(segments[1], userId);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error.' });
  }
};