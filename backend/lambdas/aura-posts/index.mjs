import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand,
  BatchGetCommand, TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const s3     = new S3Client({ region: 'us-east-1' });

const POSTS_TABLE    = 'aura-posts';
const USERS_TABLE    = 'aura-users';
const LIKES_TABLE    = 'aura-likes';
const COMMENTS_TABLE = 'aura-comments';
const BUCKET_NAME    = 'aura-app-media-570934198135';

const MAX_IMAGES_PER_POST = 10;
const LIKED_PAGE_SIZE     = 20;

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

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function getUploadUrls(userId, files) {
  const urls = [];
  for (const file of files) {
    const key     = `posts/${userId}/${generateId()}-${file.name}`;
    const command = new PutObjectCommand({
      Bucket:      BUCKET_NAME,
      Key:         key,
      ContentType: file.contentType,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    urls.push({ key, url });
  }
  return urls;
}

async function createPost(userId, body) {
  const { type, caption, mediaKeys, tags } = body;

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

  const userResult = await dynamo.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));

  if (!userResult.Item) return response(404, { error: 'User not found.' });
  if (userResult.Item.isBanned) return response(403, { error: 'Account banned.' });

  const author = userResult.Item;
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
    auraScore:      0,
    auraReceived:   0,
    auraTaken:      0,
    viewCount:      0,
    likeCount:      0,
    status:         'active',
    reportCount:    0,
    createdAt:      now,
    updatedAt:      now,
  };

  await dynamo.send(new PutCommand({
    TableName: POSTS_TABLE,
    Item: post,
  }));

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
  const liked = new Set();
  if (viewerId && posts.length) {
    const likes = await batchGet(LIKES_TABLE, posts.map(p => ({ userId: viewerId, postId: likeKey('post', p.postId) })));
    for (const like of likes) liked.add(like.targetId);
  }
  return posts.map(post => {
    if (post.authorId !== viewerId) {
      delete post.viewCount;
      delete post.likeCount;
    } else {
      // Posts from before likes existed have no counter yet
      post.likeCount = post.likeCount ?? 0;
    }
    return { ...post, likedByMe: liked.has(post.postId) };
  });
}

async function getFeed(viewerId, limit = 20) {
  const active = await scanAll({
    TableName:        POSTS_TABLE,
    FilterExpression: '#status = :active',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':active': 'active' },
  });

  const top = active
    .sort((a, b) => hotScore(b) - hotScore(a))
    .slice(0, limit);

  return response(200, { posts: await forViewer(top, viewerId) });
}

async function getUserPosts(authorId, viewerId, limit = 20) {
  const authored = await scanAll({
    TableName:        POSTS_TABLE,
    FilterExpression: 'authorId = :aid AND #status = :active',
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

  // Re-check every post: removed or deleted posts are skipped
  const fetched = await batchGet(POSTS_TABLE, page.map(like => ({ postId: like.targetId })));
  const byId    = new Map(fetched.map(post => [post.postId, post]));
  const posts   = page
    .map(like => byId.get(like.targetId))
    .filter(post => post && post.status === 'active');

  return response(200, { posts: await forViewer(posts, userId), nextCursor: next });
}

async function deletePost(postId, userId) {
  const result = await dynamo.send(new GetCommand({
    TableName: POSTS_TABLE,
    Key: { postId },
  }));

  if (!result.Item) return response(404, { error: 'Post not found.' });
  if (result.Item.authorId !== userId) return response(403, { error: 'Not your post.' });

  await dynamo.send(new UpdateCommand({
    TableName:                 POSTS_TABLE,
    Key:                       { postId },
    UpdateExpression:          'SET #status = :removed',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':removed': 'removed' },
  }));

  return response(200, { message: 'Post deleted.' });
}

async function handleUploadUrls(userId, body) {
  const { files } = body;
  if (!files?.length) return response(400, { error: 'No files specified.' });
  if (files.length > MAX_IMAGES_PER_POST) return response(400, { error: 'Too many files.' });

  const urls = await getUploadUrls(userId, files);
  return response(200, { urls });
}

async function fixAuthorNames(userId, body) {
  const { newUsername, newDisplayName, newProfilePicKey } = body;
  if (!newUsername || !newDisplayName) {
    return response(400, { error: 'newUsername and newDisplayName required.' });
  }

  const result = await dynamo.send(new ScanCommand({
    TableName:        POSTS_TABLE,
    FilterExpression: 'authorId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));

  const posts = result.Items ?? [];

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

  try {
    if (method === 'POST' && path === '/posts/upload-urls') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const body = JSON.parse(event.body ?? '{}');
      return await handleUploadUrls(userId, body);
    }

    if (method === 'POST' && path === '/posts/fix-author') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const body = JSON.parse(event.body ?? '{}');
      return await fixAuthorNames(userId, body);
    }

    if (method === 'POST' && path === '/posts') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const body = JSON.parse(event.body ?? '{}');
      return await createPost(userId, body);
    }

    // POST|DELETE /posts/{id}/like and /comments/{id}/like
    // (matched before the /posts/{id} routes below)
    if ((method === 'POST' || method === 'DELETE') && LIKE_TARGETS[segments[0]]
        && segments.length === 3 && segments[2] === 'like') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await setLike(userId, segments[0], segments[1], method === 'POST');
    }

    // GET /users/me/likes — the Liked tab
    if (method === 'GET' && path === '/users/me/likes') {
      if (!userId) return response(401, { error: 'Unauthorized' });
      return await getLikedPosts(userId, event.queryStringParameters?.cursor);
    }

    if (method === 'GET' && segments[0] === 'users' && segments.length === 3 && segments[2] === 'posts') {
      const authorId = segments[1];
      const limit    = parseInt(event.queryStringParameters?.limit ?? '20');
      return await getUserPosts(authorId, userId, limit);
    }

    if (method === 'GET' && path === '/posts') {
      const limit = parseInt(event.queryStringParameters?.limit ?? '20');
      return await getFeed(userId, limit);
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