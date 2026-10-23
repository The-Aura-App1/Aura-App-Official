import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const s3     = new S3Client({ region: 'us-east-1' });

const POSTS_TABLE  = 'aura-posts';
const USERS_TABLE  = 'aura-users';
const BUCKET_NAME  = 'aura-app-media-570934198135';

const MAX_IMAGES_PER_POST = 10;

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

async function getFeed(limit = 20) {
  const result = await dynamo.send(new ScanCommand({
    TableName:        POSTS_TABLE,
    FilterExpression: '#status = :active',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':active': 'active' },
    Limit: 100,
  }));

  const posts = (result.Items ?? [])
    .sort((a, b) => {
      const auraWeight = (b.auraScore - a.auraScore) * 0.7;
      const timeWeight = (new Date(b.createdAt) - new Date(a.createdAt)) * 0.3;
      return auraWeight + timeWeight;
    })
    .slice(0, limit)
    .map(post => { delete post.viewCount; return post; });

  return response(200, { posts });
}

async function getUserPosts(authorId, limit = 20) {
  const result = await dynamo.send(new ScanCommand({
    TableName:        POSTS_TABLE,
    FilterExpression: 'authorId = :aid AND #status = :active',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: { ':aid': authorId, ':active': 'active' },
    Limit: 100,
  }));

  const posts = (result.Items ?? [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map(post => { delete post.viewCount; return post; });

  return response(200, { posts });
}

async function getPost(postId, isOwner = false) {
  const result = await dynamo.send(new GetCommand({
    TableName: POSTS_TABLE,
    Key: { postId },
  }));

  if (!result.Item) return response(404, { error: 'Post not found.' });
  if (result.Item.status !== 'active') return response(404, { error: 'Post not found.' });

  const post = result.Item;
  if (!isOwner) delete post.viewCount;

  await dynamo.send(new UpdateCommand({
    TableName:                 POSTS_TABLE,
    Key:                       { postId },
    UpdateExpression:          'ADD viewCount :one',
    ExpressionAttributeValues: { ':one': 1 },
  }));

  return response(200, post);
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

    if (method === 'GET' && segments[0] === 'users' && segments[2] === 'posts') {
      const authorId = segments[1];
      const limit    = parseInt(event.queryStringParameters?.limit ?? '20');
      return await getUserPosts(authorId, limit);
    }

    if (method === 'GET' && path === '/posts') {
      const limit = parseInt(event.queryStringParameters?.limit ?? '20');
      return await getFeed(limit);
    }

    if (method === 'GET' && path.startsWith('/posts/')) {
      const postId  = path.split('/posts/')[1];
      const isOwner = userId === (await dynamo.send(new GetCommand({
        TableName: POSTS_TABLE,
        Key: { postId },
      }))).Item?.authorId;
      return await getPost(postId, isOwner);
    }

    if (method === 'DELETE' && path.startsWith('/posts/')) {
      if (!userId) return response(401, { error: 'Unauthorized' });
      const postId = path.split('/posts/')[1];
      return await deletePost(postId, userId);
    }

    return response(404, { error: 'Route not found.' });

  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error.' });
  }
};