// Ads (decided 2026-10-30, see CLAUDE.md "Ads"): Google Ad Manager in Limited
// Ads mode. No cookies, no device IDs, no personalization; feed ads are matched
// only to the topic of the post above them. Google's script does see each
// visitor's IP address, which the About page says.
//
// The ad units come from Amplify environment variables (Hosting > Environment
// variables), so no code change is needed when the real ones exist:
//   REACT_APP_GAM_FEED_UNIT      e.g. /1234567/aura_feed      (native/display, 300x250 or fluid)
//   REACT_APP_GAM_REWARDED_UNIT  e.g. /1234567/aura_rewarded  (web rewarded)
// Until they're set, Google's public sample units run instead. Those show
// Google's test creatives and earn nothing; ADS_TEST is then true and the ad
// cards say "Test ad".
const env = process.env;

export const SAMPLE_UNITS = {
  feed:     '/6355419/Travel/Europe',
  rewarded: '/22639388115/rewarded_web_example',
};

export const FEED_UNIT     = env.REACT_APP_GAM_FEED_UNIT || SAMPLE_UNITS.feed;
export const REWARDED_UNIT = env.REACT_APP_GAM_REWARDED_UNIT || SAMPLE_UNITS.rewarded;
export const ADS_TEST      = !env.REACT_APP_GAM_FEED_UNIT || !env.REACT_APP_GAM_REWARDED_UNIT;

// One sponsored card after every AD_EVERY posts (CLAUDE.md: 1 per 10 posts)
export const AD_EVERY = 10;

// Limited Ads only works when GPT loads from this address (from the standard
// address, the limitedAds setting is ignored)
export const GPT_LIMITED_URL = 'https://pagead2.googlesyndication.com/tag/js/gpt.js';
