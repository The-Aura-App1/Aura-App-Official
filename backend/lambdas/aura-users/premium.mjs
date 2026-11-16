// Premium without payments (2026-11-16, before checkout exists):
//
// - The launch offer: the first LAUNCH_SPOTS people to press "Get Premium"
//   get it free. A counter in aura-feedback (PROMO#premium-launch) and the
//   person's record change in one transaction, so there are never more than
//   LAUNCH_SPOTS, and nobody claims twice.
// - House accounts (the official aura_app account and the contest judge's
//   demo_judge) are always Premium and creator accounts.
import { GetCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

export const LAUNCH_SPOTS = 100;
const PROMO_KEY = { feedbackID: 'PROMO#premium-launch' };
export const HOUSE_IDS = new Set([
  '74081408-8031-706d-70d9-e1fa81428cb1',   // aura_app (official)
  'b438a438-7091-7082-ef04-75e17974d01a',   // demo_judge (contest judge)
]);

// How many free spots are left (best effort: null if it can't be read)
export async function launchSpotsLeft(db) {
  try {
    const item = (await db.send(new GetCommand({ TableName: 'aura-feedback', Key: PROMO_KEY }))).Item;
    return Math.max(0, LAUNCH_SPOTS - (item?.claimed ?? 0));
  } catch (err) {
    console.warn(`Launch offer not read (${err.name}).`);
    return null;
  }
}

// Makes a house account Premium and a creator if it isn't yet; returns the record to show
export async function ensureHouseAccount(db, user) {
  if (!HOUSE_IDS.has(user.userId) || (user.isPremium && user.isCreator)) return user;
  const now = new Date().toISOString();
  try {
    await db.send(new UpdateCommand({
      TableName: 'aura-users', Key: { userId: user.userId },
      UpdateExpression: 'SET isPremium = :t, isCreator = :t, premiumSource = if_not_exists(premiumSource, :house), premiumSince = if_not_exists(premiumSince, :now)',
      ConditionExpression: 'attribute_exists(userId)',
      ExpressionAttributeValues: { ':t': true, ':house': 'house', ':now': now },
    }));
    return { ...user, isPremium: true, isCreator: true, premiumSource: user.premiumSource ?? 'house', premiumSince: user.premiumSince ?? now };
  } catch (err) {
    console.warn(`House account not upgraded (${err.name}).`);
    return user;
  }
}

// PUT /users/me { claimPremium: true }
export async function claimLaunchPremium(db, user, response) {
  if (user.isBanned) return response(403, { error: 'Account banned.' });
  if (user.isPremium) return response(409, { error: 'You already have Premium.' });
  if (user.premiumClaimedAt) return response(409, { error: 'You\'ve already claimed the launch offer.' });
  const now = new Date().toISOString();
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: 'aura-feedback', Key: PROMO_KEY,
        UpdateExpression: 'ADD claimed :one SET updatedAt = :now',
        ConditionExpression: 'attribute_not_exists(claimed) OR claimed < :max',
        ExpressionAttributeValues: { ':one': 1, ':max': LAUNCH_SPOTS, ':now': now },
      } },
      { Update: {
        TableName: 'aura-users', Key: { userId: user.userId },
        UpdateExpression: 'SET isPremium = :t, premiumSource = :launch, premiumSince = :now, premiumClaimedAt = :now',
        ConditionExpression: 'attribute_exists(userId) AND attribute_not_exists(premiumClaimedAt) AND (attribute_not_exists(isPremium) OR isPremium = :f)',
        ExpressionAttributeValues: { ':t': true, ':f': false, ':launch': 'launch', ':now': now },
      } },
    ] }));
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    const [spots, person] = (err.CancellationReasons ?? []).map(r => r?.Code);
    if (spots === 'ConditionalCheckFailed') return response(409, { error: `All ${LAUNCH_SPOTS} free Premium spots have been claimed.`, left: 0 });
    if (person === 'ConditionalCheckFailed') return response(409, { error: 'You already have Premium.' });
    throw err;
  }
  return response(200, { message: 'Premium is yours, free. Welcome!', isPremium: true, left: await launchSpotsLeft(db) });
}
