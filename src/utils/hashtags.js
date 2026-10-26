// Free-form hashtags authors add to posts. Keep MAX_HASHTAGS and HASHTAG_PATTERN
// in sync with aura-posts, which enforces them.
export const MAX_HASHTAGS    = 10;
export const HASHTAG_PATTERN = /^[\p{L}\p{N}_]{1,30}$/u;

// Lowercase, letters and numbers only: "#Live_Music" and "live music" both give "livemusic"
export function hashtagKey(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// Splits typed input like "#jazz, LiveMusic #sax" into tags, adding any that are
// new and valid. Returns the new list and an error for anything skipped.
export function addHashtags(list, input) {
  const next = [...list];
  let error = '';
  for (const raw of input.split(/[\s,#]+/).filter(Boolean)) {
    if (!HASHTAG_PATTERN.test(raw)) { error = 'Hashtags can use letters, numbers and _ (up to 30 characters).'; continue; }
    if (next.some(t => t.toLowerCase() === raw.toLowerCase())) continue;
    if (next.length >= MAX_HASHTAGS) { error = `You can add up to ${MAX_HASHTAGS} hashtags.`; break; }
    next.push(raw);
  }
  return { list: next, error };
}

// "StreetPhoto" and "street_photo" become "Street Photo" and "street photo", so the model reads words
export function hashtagWords(tag) {
  return tag.replace(/_/g, ' ').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').trim();
}
