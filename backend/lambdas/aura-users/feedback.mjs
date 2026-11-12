// Suggestions and reviews (the in-app "Suggestions & Reviews" page and the
// reviews on the welcome page). Lives in aura-users; index.mjs hands every
// /feedback request to handleFeedback.
//
// Table aura-feedback, partition key `feedbackId` (string):
//   SUGGESTION#<id>          { kind: 'suggestion', authorId, text, votes, status, createdAt }
//                              status: open | planned | done | removed
//   VOTE#<suggestionId>#<userId>  one per person per suggestion
//   REVIEW#<userId>          { kind: 'review', authorId, rating, text, status, createdAt, updatedAt }
//                              status: pending | approved | rejected. Only approved reviews are
//                              public, and editing a review sends it back to pending.
//
// Everything a person writes is cleaned and length-checked here; the app's
// checks are only for convenience.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand,
  DeleteCommand, BatchGetCommand, TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomBytes } from 'node:crypto';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const FEEDBACK_TABLE = 'aura-feedback';
const USERS_TABLE    = 'aura-users';

const SUGGESTION_MIN = 10;
const SUGGESTION_MAX = 500;
const REVIEW_MAX     = 600;
const PUBLIC_REVIEWS = 30;
const SUGGESTIONS_SHOWN = 100;
const SUGGESTION_STATUSES = ['open', 'planned', 'done'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Approved reviews are the same for every visitor, so they're kept for a minute
let publicCache = { at: 0, body: null };
const PUBLIC_CACHE_MS = 60_000;

// Same cleaning as aura-comments: no control characters, no invisible
// direction marks (they can disguise text), no walls of blank lines.
function cleanText(raw) {
  return String(raw ?? '').normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '')
    .replace(/[؜‎‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function newId() {
  return `${Date.now()}-${randomBytes(6).toString('base64url')}`;
}

async function scanKind(kind, filter = '', values = {}, names = {}) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await db.send(new ScanCommand({
      TableName: FEEDBACK_TABLE,
      FilterExpression: `kind = :kind${filter ? ` AND ${filter}` : ''}`,
      ExpressionAttributeValues: { ':kind': kind, ...values },
      ...(Object.keys(names).length && { ExpressionAttributeNames: names }),
      ExclusiveStartKey,
    }));
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function batchGet(table, keys, projection) {
  const found = [];
  for (let i = 0; i < keys.length; i += 100) {
    let request = { [table]: { Keys: keys.slice(i, i + 100), ...(projection && { ProjectionExpression: projection }) } };
    while (request && Object.keys(request).length) {
      const result = await db.send(new BatchGetCommand({ RequestItems: request }));
      found.push(...(result.Responses?.[table] ?? []));
      request = result.UnprocessedKeys;
    }
  }
  return found;
}

// Current name and picture for each author (so renamed or banned accounts show correctly)
async function authorsOf(items) {
  const ids = [...new Set(items.map(i => i.authorId).filter(Boolean))];
  const users = await batchGet(USERS_TABLE, ids.map(userId => ({ userId })),
    'userId, username, displayName, profilePicKey, isBanned');
  return new Map(users.map(u => [u.userId, u]));
}

// What anyone may see. Listed fields only, so nothing internal leaks.
function publicAuthor(author) {
  return {
    authorUsername: author?.username ?? '',
    authorDisplay:  author?.displayName || author?.username || 'Aura member',
    authorPicKey:   author?.profilePicKey ?? '',
  };
}

function publicSuggestion(item, author, viewerId, voted) {
  return {
    suggestionId: item.feedbackId.slice('SUGGESTION#'.length),
    text:      item.text,
    votes:     item.votes ?? 0,
    status:    item.status,
    createdAt: item.createdAt,
    votedByMe: voted,
    isMine:    item.authorId === viewerId,
    ...publicAuthor(author),
  };
}

function publicReview(item, author) {
  return {
    rating:    item.rating,
    text:      item.text,
    createdAt: item.createdAt,
    ...publicAuthor(author),
  };
}

async function activeUser(userId) {
  const { Item } = await db.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
  return Item && !Item.isBanned ? Item : null;
}

// ── Suggestions ──────────────────────────────────────────────────────────

async function listSuggestions(viewerId) {
  const items = (await scanKind('suggestion', '#status <> :removed', { ':removed': 'removed' }, { '#status': 'status' }))
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, SUGGESTIONS_SHOWN);
  const [authors, votes] = await Promise.all([
    authorsOf(items),
    batchGet(FEEDBACK_TABLE, items.map(i => ({ feedbackId: `VOTE#${i.feedbackId}#${viewerId}` })), 'feedbackId'),
  ]);
  const voted = new Set(votes.map(v => v.feedbackId));
  const suggestions = items
    .filter(i => !authors.get(i.authorId)?.isBanned)
    .map(i => publicSuggestion(i, authors.get(i.authorId), viewerId, voted.has(`VOTE#${i.feedbackId}#${viewerId}`)));
  return { suggestions };
}

async function createSuggestion(userId, body, { rateLimited, response }) {
  const text = cleanText(body.text);
  if (text.length < SUGGESTION_MIN) return response(400, { error: `Say a little more (at least ${SUGGESTION_MIN} characters).` });
  if (text.length > SUGGESTION_MAX) return response(400, { error: `Keep it under ${SUGGESTION_MAX} characters.` });
  const user = await activeUser(userId);
  if (!user) return response(403, { error: 'Your account cannot send suggestions.' });
  const limited = await rateLimited(userId, 'suggest', 3, 86400);
  if (limited) return response(429, { error: 'You can send 3 suggestions a day. Try again tomorrow.' });

  const item = {
    feedbackId: `SUGGESTION#${newId()}`, kind: 'suggestion', authorId: userId,
    text, votes: 1, status: 'open', createdAt: new Date().toISOString(),
  };
  // Your own suggestion starts with your vote
  await db.send(new TransactWriteCommand({ TransactItems: [
    { Put: { TableName: FEEDBACK_TABLE, Item: item, ConditionExpression: 'attribute_not_exists(feedbackId)' } },
    { Put: { TableName: FEEDBACK_TABLE, Item: { feedbackId: `VOTE#${item.feedbackId}#${userId}`, kind: 'vote', createdAt: item.createdAt } } },
  ] }));
  return response(201, publicSuggestion(item, user, userId, true));
}

async function vote(userId, suggestionId, on, { rateLimited, response }) {
  if (!ID_RE.test(suggestionId)) return response(404, { error: 'Suggestion not found.' });
  if (!(await activeUser(userId))) return response(403, { error: 'Your account cannot vote.' });
  const limited = await rateLimited(userId, 'vote', 60, 3600);
  if (limited) return limited;

  const key = `SUGGESTION#${suggestionId}`;
  const voteKey = { feedbackId: `VOTE#${key}#${userId}` };
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      on
        ? { Put: { TableName: FEEDBACK_TABLE, Item: { ...voteKey, kind: 'vote', createdAt: new Date().toISOString() },
                   ConditionExpression: 'attribute_not_exists(feedbackId)' } }
        : { Delete: { TableName: FEEDBACK_TABLE, Key: voteKey, ConditionExpression: 'attribute_exists(feedbackId)' } },
      { Update: {
        TableName: FEEDBACK_TABLE, Key: { feedbackId: key },
        UpdateExpression: 'ADD votes :d',
        ConditionExpression: 'kind = :kind AND #status <> :removed',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':d': on ? 1 : -1, ':kind': 'suggestion', ':removed': 'removed' },
      } },
    ] }));
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    const [voteFailed, suggestionFailed] = (err.CancellationReasons ?? []).map(r => r?.Code === 'ConditionalCheckFailed');
    if (suggestionFailed) return response(404, { error: 'Suggestion not found.' });
    if (voteFailed) return response(200, { ok: true });   // already voted / already removed
    throw err;
  }
  return response(200, { ok: true });
}

// ── Reviews ──────────────────────────────────────────────────────────────

async function publicReviews(response) {
  if (publicCache.body && Date.now() - publicCache.at < PUBLIC_CACHE_MS) return response(200, publicCache.body);
  const approved = await scanKind('review', '#status = :approved', { ':approved': 'approved' }, { '#status': 'status' });
  const authors = await authorsOf(approved);
  const shown = approved.filter(r => authors.get(r.authorId) && !authors.get(r.authorId).isBanned);
  const average = shown.length ? shown.reduce((sum, r) => sum + r.rating, 0) / shown.length : 0;
  const body = {
    count: shown.length,
    average: Math.round(average * 10) / 10,
    reviews: shown
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, PUBLIC_REVIEWS)
      .map(r => publicReview(r, authors.get(r.authorId))),
  };
  publicCache = { at: Date.now(), body };
  return response(200, body, { 'Cache-Control': 'public, max-age=60' });
}

async function myReview(userId, response) {
  const { Item } = await db.send(new GetCommand({ TableName: FEEDBACK_TABLE, Key: { feedbackId: `REVIEW#${userId}` } }));
  if (!Item) return response(200, { review: null });
  return response(200, { review: { rating: Item.rating, text: Item.text, status: Item.status, updatedAt: Item.updatedAt } });
}

async function saveReview(userId, body, { rateLimited, response }) {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return response(400, { error: 'Pick 1 to 5 stars.' });
  const text = cleanText(body.text);
  if (text.length > REVIEW_MAX) return response(400, { error: `Keep it under ${REVIEW_MAX} characters.` });
  if (!(await activeUser(userId))) return response(403, { error: 'Your account cannot leave a review.' });
  const limited = await rateLimited(userId, 'review', 5, 86400);
  if (limited) return response(429, { error: 'You can update your review 5 times a day. Try again tomorrow.' });

  const now = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: FEEDBACK_TABLE, Key: { feedbackId: `REVIEW#${userId}` },
    UpdateExpression: 'SET kind = :kind, authorId = :me, rating = :rating, #text = :text, #status = :pending, updatedAt = :now, createdAt = if_not_exists(createdAt, :now)',
    ExpressionAttributeNames: { '#text': 'text', '#status': 'status' },
    ExpressionAttributeValues: { ':kind': 'review', ':me': userId, ':rating': rating, ':text': text, ':pending': 'pending', ':now': now },
  }));
  return response(200, { review: { rating, text, status: 'pending', updatedAt: now } });
}

async function deleteReview(userId, response) {
  await db.send(new DeleteCommand({ TableName: FEEDBACK_TABLE, Key: { feedbackId: `REVIEW#${userId}` } }));
  publicCache = { at: 0, body: null };
  return response(200, { ok: true });
}

// ── Moderation ───────────────────────────────────────────────────────────

async function adminList(response) {
  const [reviews, suggestions] = await Promise.all([
    scanKind('review', '#status = :pending', { ':pending': 'pending' }, { '#status': 'status' }),
    scanKind('suggestion', '#status <> :removed', { ':removed': 'removed' }, { '#status': 'status' }),
  ]);
  const authors = await authorsOf([...reviews, ...suggestions]);
  return response(200, {
    reviews: reviews.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).map(r => ({
      reviewId: r.feedbackId.slice('REVIEW#'.length), ...publicReview(r, authors.get(r.authorId)),
    })),
    suggestions: suggestions
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      .map(s => publicSuggestion(s, authors.get(s.authorId), null, false)),
  });
}

const ADMIN_ACTIONS = {
  review:     { approve: 'approved', reject: 'rejected' },
  suggestion: { open: 'open', planned: 'planned', done: 'done', remove: 'removed' },
};

async function adminAct(kind, id, body, response) {
  const status = ADMIN_ACTIONS[kind]?.[body.action];
  if (!status || !ID_RE.test(id)) return response(400, { error: 'Unknown action.' });
  const prefix = kind === 'review' ? 'REVIEW#' : 'SUGGESTION#';
  try {
    await db.send(new UpdateCommand({
      TableName: FEEDBACK_TABLE, Key: { feedbackId: `${prefix}${id}` },
      UpdateExpression: 'SET #status = :status',
      ConditionExpression: 'kind = :kind',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': status, ':kind': kind },
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return response(404, { error: 'Not found.' });
    throw err;
  }
  if (kind === 'review') publicCache = { at: 0, body: null };
  return response(200, { ok: true, status });
}

// Returns a response for /feedback routes, or null for anything else.
//   GET    /feedback/reviews                    public: approved reviews
//   GET    /feedback/reviews/me                 your review
//   PUT    /feedback/reviews/me                 write or edit (goes back to pending)
//   DELETE /feedback/reviews/me
//   GET    /feedback/suggestions
//   POST   /feedback/suggestions
//   POST   /feedback/suggestions/{id}/vote      DELETE to take the vote back
//   GET    /feedback/admin                      moderators
//   POST   /feedback/admin/{review|suggestion}/{id}   { action }
export async function handleFeedback({ method, segments, userId, isAdmin, rawBody, rateLimited, response }) {
  if (segments[0] !== 'feedback') return null;
  const [, area, a, b] = segments;
  const body = () => {
    try { return JSON.parse(rawBody ?? '{}') ?? {}; } catch { return {}; }
  };
  const helpers = { rateLimited, response };

  if (method === 'GET' && area === 'reviews' && segments.length === 2) return publicReviews(response);

  if (!userId) return response(401, { error: 'Sign in first.' });

  if (area === 'reviews' && a === 'me' && segments.length === 3) {
    if (method === 'GET')    return myReview(userId, response);
    if (method === 'PUT')    return saveReview(userId, body(), helpers);
    if (method === 'DELETE') return deleteReview(userId, response);
  }

  if (area === 'suggestions') {
    if (segments.length === 2 && method === 'GET')  return response(200, await listSuggestions(userId));
    if (segments.length === 2 && method === 'POST') return createSuggestion(userId, body(), helpers);
    if (segments.length === 4 && b === 'vote' && (method === 'POST' || method === 'DELETE')) {
      return vote(userId, decodeURIComponent(a), method === 'POST', helpers);
    }
  }

  if (area === 'admin') {
    if (!isAdmin) return response(403, { error: 'Moderators only.' });
    if (method === 'GET' && segments.length === 2) return adminList(response);
    if (method === 'POST' && segments.length === 4) return adminAct(a, decodeURIComponent(b), body(), response);
  }

  return response(404, { error: 'Route not found.' });
}

export const _test = { cleanText, publicSuggestion, publicReview, SUGGESTION_STATUSES };
