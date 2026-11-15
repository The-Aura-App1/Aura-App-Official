// Why something is reported. The ids match REPORT_REASONS in aura-posts,
// aura-comments and aura-users (follows.mjs); src/backendContract.test.js
// fails if they drift.
export const REPORT_REASONS = [
  ['spam', 'Spam or scam'],
  ['harassment', 'Harassment or bullying'],
  ['hate', 'Hate speech or symbols'],
  ['violence', 'Violence or threats'],
  ['nudity', 'Nudity or sexual content'],
  ['self_harm', 'Self-harm or suicide'],
  ['misinformation', 'False information'],
  ['other', 'Something else'],
];

export const REPORT_REASON_IDS = REPORT_REASONS.map(([id]) => id);
export const reasonLabel = id => REPORT_REASONS.find(([r]) => r === id)?.[1] ?? id;

// Lets every post and comment on screen hide an account the moment it's blocked
export const BLOCKED_EVENT = 'aura:blocked';
export function announceBlocked(userId) {
  window.dispatchEvent(new CustomEvent(BLOCKED_EVENT, { detail: { userId } }));
}
