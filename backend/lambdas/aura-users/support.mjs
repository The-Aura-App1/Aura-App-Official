// Customer support: POST /feedback/support (sent from Angel's chat). The
// message is emailed to Aura's support inbox with Amazon SES, with the
// person's own contact email as the Reply-To so support can answer straight
// from the inbox, and a copy is kept in aura-feedback:
//   SUPPORT#<id>  { kind: 'support', authorId, username, category, text, contactEmail, status, createdAt }
//                 status: sent | unsent (SES refused or isn't set up yet)
//
// Set on the aura-users function (never in code):
//   SUPPORT_TO    the inbox that receives support messages
//   SUPPORT_FROM  a verified SES identity to send from (can be the same address)
// The function's role needs ses:SendEmail on that identity.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { randomBytes } from 'node:crypto';
import { cleanLine, cleanText, hasVisibleText } from './text.mjs';

const db  = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const ses = new SESv2Client({ region: 'us-east-1' });

export const SUPPORT_CATEGORIES = {
  bug:     'Something isn\'t working',
  account: 'My account or sign-in',
  aura:    'Aura, games or purchases',
  safety:  'Safety or another person',
  idea:    'An idea or general feedback',
  other:   'Something else',
};
export const SUPPORT_MIN = 10;
export const SUPPORT_MAX = 2000;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

// A contact address we can safely put in a Reply-To header
export function validEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

// Checks a support message; returns { error } or the cleaned fields
export function checkSupport(body) {
  const category = typeof body?.category === 'string' && Object.hasOwn(SUPPORT_CATEGORIES, body.category) ? body.category : null;
  if (!category) return { error: 'Pick what it\'s about.' };
  const text = cleanText(body?.message ?? '');
  if (!hasVisibleText(text) || text.length < SUPPORT_MIN) return { error: `Tell us a little more (at least ${SUPPORT_MIN} characters).` };
  if (text.length > SUPPORT_MAX) return { error: `Keep it under ${SUPPORT_MAX} characters.` };
  const contactEmail = validEmail(body?.contactEmail);
  if (!contactEmail) return { error: 'Add an email address we can reply to.' };
  return { category, text, contactEmail };
}

export async function sendSupport({ userId, body, rateLimited, response }) {
  const limited = await rateLimited(userId, 'support', 3, 3600) ?? await rateLimited(userId, 'support-day', 8, 86400);
  if (limited) return limited;
  const checked = checkSupport(body);
  if (checked.error) return response(400, { error: checked.error });
  const { category, text, contactEmail } = checked;

  const user = (await db.send(new GetCommand({ TableName: 'aura-users', Key: { userId } }))).Item;
  if (!user) return response(404, { error: 'User not found.' });
  const username = cleanLine(user.username ?? '');
  const ticket = randomBytes(5).toString('hex').toUpperCase();
  const createdAt = new Date().toISOString();

  let status = 'unsent';
  const to = process.env.SUPPORT_TO, from = process.env.SUPPORT_FROM;
  if (to && from) {
    try {
      await ses.send(new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        ReplyToAddresses: [contactEmail],
        Content: { Simple: {
          Subject: { Data: `[Aura support ${ticket}] ${SUPPORT_CATEGORIES[category]} (@${username})`, Charset: 'UTF-8' },
          Body: { Text: { Charset: 'UTF-8', Data: [
            `Ticket: ${ticket}`,
            `From: @${username} (${cleanLine(user.displayName ?? username)})`,
            `User id: ${userId}`,
            `Account created: ${user.createdAt ?? 'unknown'}`,
            `Reply to: ${contactEmail}`,
            `About: ${SUPPORT_CATEGORIES[category]}`,
            `Sent: ${createdAt} (through Angel)`,
            '',
            text,
          ].join('\n') } },
        } },
      }));
      status = 'sent';
    } catch (err) {
      console.warn(`Support email not sent (${err.name}).`);
    }
  }

  // Keep a copy either way, so nothing is lost
  await db.send(new UpdateCommand({
    TableName: 'aura-feedback', Key: { feedbackID: `SUPPORT#${ticket}` },
    UpdateExpression: 'SET kind = :k, authorId = :a, username = :u, category = :c, #t = :t, contactEmail = :e, #s = :s, createdAt = :d',
    ExpressionAttributeNames: { '#t': 'text', '#s': 'status' },
    ExpressionAttributeValues: { ':k': 'support', ':a': userId, ':u': username, ':c': category, ':t': text, ':e': contactEmail, ':s': status, ':d': createdAt },
  }));

  if (status !== 'sent') return response(503, { error: 'Support email isn\'t reachable right now. Your message was saved; please try again later.', ticket });
  return response(201, { ticket });
}
