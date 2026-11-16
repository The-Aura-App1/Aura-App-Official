import { TOPICS } from '../utils/topics';
import { decodeVector, similarity } from '../utils/embeddings';
import { textMatch, fold } from '../utils/searchRanking';
import { hashtagKey } from '../utils/hashtags';
import { KNOWLEDGE, KNOWLEDGE_LINKS } from './knowledge';
import { describeTheme, describesNothing, MOOD_NAMES } from './themeMaker';
import {
  builtInThemeIn, builtInThemeReply, specFromBuiltIn, themeListReply, currentThemeReply, sceneryReply, balanceReply, feedSummaryReply,
  ASKS_THEME_LIST, ASKS_CURRENT_THEME, ASKS_SCENERY, ASKS_BALANCE, ASKS_FEED_SUMMARY,
} from './skills';
import { THEMES } from '../themes';
import INTENT_MODEL from './intentModel.json';
import { continueFlow, startReport, startSupport, WANTS_REPORT, WANTS_SUPPORT, SUPPORT_MAX } from './flows';
import { commandReply } from './commands';
import {
  vocabularyOf, relatedTags, ASKS_CATCH_UP, catchUpReply, asksToFindPosts, findPostsReply, wantsBot, playBotReply, ASKS_GROUPS, groupsReply,
} from './assist';
import { asksToDescribe, describeReply, isFindFollowUp, findFollowUp } from './describe';

// Angel: Aura's helper. Everything here runs on the person's device; nothing
// they type is sent anywhere, except a report or a support message, and only
// after they confirm it (flows.js). She can also change settings and do
// things in the app when asked (commands.js). She doesn't generate free text: she works out
// which of her five jobs a message is about, then answers from real data
// (the feed's public posts, the person's own feed settings) or from a fixed,
// checked guide (knowledge.js). That keeps her on topic by construction, so
// she can't be talked into other things, and she never writes content.
//
// Her jobs: tune the feed, look up trends, answer app questions, make a
// custom theme, and give feedback on a post someone is writing.
// Anything else gets a polite "Sorry, I can't help you with that."

export const MAX_MESSAGE = 600;

const REFUSALS = [
  "Sorry, I can't help you with that.",
  "Sorry, that's not something I can help with.",
  "I can't help with that one, sorry.",
];
let refusalTurn = 0;
export function refusal(extra = '') {
  const text = REFUSALS[refusalTurn++ % REFUSALS.length];
  return { kind: 'refuse', text: extra ? `${text} ${extra}` : text };
}
const WHAT_I_DO = 'I can catch you up on what you missed, find a post you describe (in your likes, your groups or popular posts), start a game against a bot, suggest groups, tune your feed, look up trends, answer questions about Aura, make you a custom theme, give feedback on a post, change your settings, report someone, or pass a message to Aura\'s support team.';

// ── Reading a message ─────────────────────────────────────────────────

// a support message keeps its line breaks and may run longer
// eslint-disable-next-line no-control-regex -- strips invisible and control characters on purpose
const cleanLong = text => String(text ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, ' ').slice(0, SUPPORT_MAX).trim();
// eslint-disable-next-line no-control-regex -- strips invisible and control characters on purpose
export const clean = text => String(text ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g, ' ').slice(0, MAX_MESSAGE).trim();
const lower = text => fold(text).replace(/[’]/g, "'");
const has = (text, re) => re.test(text);

// Words for topics people commonly use instead of the topic's own name
const TOPIC_WORDS = {
  sports: ['sport', 'sports', 'nfl', 'nba', 'mlb', 'nhl', 'football', 'soccer', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'f1', 'ufc', 'boxing', 'athletes', 'team', 'teams'],
  photography: ['photo', 'photos', 'photography', 'camera', 'photographers'],
  art: ['art', 'painting', 'drawing', 'illustration', 'sketch', 'artists'],
  music: ['music', 'songs', 'song', 'band', 'bands', 'concert', 'albums', 'rap', 'hiphop', 'jazz', 'rock'],
  film: ['film', 'films', 'movie', 'movies', 'cinema', 'tv', 'shows', 'series'],
  design: ['design', 'ui', 'ux', 'graphic'],
  writing: ['writing', 'poetry', 'poems', 'stories'],
  gaming: ['gaming', 'games', 'videogames', 'esports', 'gamer'],
  comedy: ['comedy', 'memes', 'meme', 'funny', 'jokes', 'humor'],
  fitness: ['fitness', 'gym', 'workout', 'workouts', 'running', 'lifting', 'yoga', 'exercise', 'training', 'cardio'],
  cooking: ['cooking', 'cook', 'cooks', 'recipes', 'recipe', 'baking', 'bake', 'chef', 'chefs', 'kitchen', 'mealprep', 'homemade'],
  food: ['food', 'foodie', 'foods', 'restaurants', 'restaurant', 'eating', 'eats', 'dessert', 'desserts', 'snacks', 'brunch', 'coffee'],
  travel: ['travel', 'traveling', 'travelling', 'trips', 'trip', 'vacation', 'vacations', 'abroad', 'wanderlust'],
  fashion: ['fashion', 'outfits', 'clothes', 'style'],
  beauty: ['beauty', 'makeup', 'skincare'],
  tech: ['tech', 'technology', 'gadgets', 'ai', 'phones'],
  science: ['science', 'space', 'physics', 'biology', 'astronomy'],
  finance: ['finance', 'money', 'investing', 'stocks', 'crypto'],
  coding: ['coding', 'programming', 'code', 'developers', 'javascript', 'python'],
  books: ['books', 'book', 'reading', 'novels'],
  education: ['education', 'learning', 'school', 'study'],
  business: ['business', 'startups', 'entrepreneurs', 'marketing'],
  pets: ['pets', 'pet', 'dogs', 'dog', 'cats', 'cat', 'puppies', 'animals'],
  motivation: ['motivation', 'inspiration', 'mindset', 'selfcare'],
  sustainability: ['sustainability', 'climate', 'environment', 'eco'],
  outdoors: ['outdoors', 'outdoor', 'hiking', 'hike', 'camping', 'nature', 'climbing', 'mountains', 'trails'],
  cars: ['cars', 'car', 'automotive', 'racing'],
  diy: ['diy', 'crafts', 'woodworking', 'building'],
};
for (const t of TOPICS) (TOPIC_WORDS[t.id] ??= []).push(...fold(t.label).split(/\s+/));

const STOP = new Set(('a an the and or but of to for in on at by with about from into my me i im i\'m you your it its this that these those is are was be '
  + 'am do does did can could would should will want wanna like love more less fewer see seeing show shows showing posts post content stuff things thing '
  + 'some any lot lots please pls feed get getting got not dont don\'t no none less fewer stop too much many really very just also what which who how '
  + 'why when where there their them they he she we us our more of tired hate hide avoid need needs missing interested into enjoy lately anymore '
  + 'kind type types sort sorts generating most least top trending trend trends popular unpopular attention aura engagement right now today week '
  + 'tune tuning recommend recommended timeline give gives giving find out space creator creators team teams player players '
  + 'getting gets doing does well best worst hottest hot '
  + 'start starting started become becoming became help helping populate fill filling cool nice awesome great good fun neat interesting '
  + 'recently currently started starting lately nowadays maybe kinda sorta something everything anything stuff like such similar related '
  + 'can could you please thanks thank make making add adding put putting bring want wanting wanted would love loving hoping hope try trying '
  + 'little bit lot ton tons new old other others way ways things own feel feeling think thinking know mean').split(/\s+/));

// The topic ids a message names, and the other meaningful words in it
// vocab: words that really appear in today's posts (assist.js vocabularyOf).
// With it, a word only becomes a keyword if posts actually use it (or it's
// quoted or a #hashtag), so filler like "populate" or "cool" never does.
export function subjectsOf(text, vocab = null) {
  // a quoted phrase is one keyword, so its words aren't counted again
  const unquoted = String(text).replace(/["“']([^"”']{2,40})["”']/g, ' ');
  const words = lower(unquoted).split(/[^\p{L}\p{N}#']+/u).filter(Boolean);
  const topics = new Set();
  const keywords = [];
  for (const raw of words) {
    const w = raw.replace(/^#/, '');
    const topic = Object.keys(TOPIC_WORDS).find(id => TOPIC_WORDS[id].includes(w));
    if (topic) topics.add(topic);
    // a specific word (nfl, baking) is also worth keeping as a keyword, but
    // not one that just names the topic (that's what the topic is for)
    if (vocab && topic && (w === topic || w === `${topic}s` || `${w}s` === topic)) continue;
    // with the pool's words known, keep only words posts really use, or
    // words from the curated topic lists (filler like "populate" is neither)
    const grounded = !vocab || raw.startsWith('#') || vocab.has(w) || !!topic;
    if (grounded && !STOP.has(w) && w.length >= 2 && !TOPICS.some(t => fold(t.label) === w)) keywords.push(w);
  }
  const quoted = [...String(text).matchAll(/["“']([^"”']{2,40})["”']/g)].map(m => m[1].trim());
  // feed keywords are at most 40 characters (feedPrefs drops longer ones)
  return { topics: [...topics], keywords: [...new Set([...quoted.map(q => q.toLowerCase()), ...keywords])].filter(k => k.length <= 40).slice(0, 5) };
}

// ── Deciding what a message is about ──────────────────────────────────

const INTENT_RULES = {
  theme: /\b(theme|palette|make it look like|make (it|everything) (look|feel)|(make|turn) (the |my )?app (more |less |all )?\w+|app to (look|feel) like|colou?r scheme|colou?rs? for (the )?app|app('s)? (look|colou?rs?|font)|make (the |my )?app (look|feel|be)|(change|switch|set) (the |my )?(app'?s? )?colou?rs?|colou?rs? to|the app be|custom theme|dark mode|light mode)\b/,
  trends: /\b(nobody|no one|noone) (is )?(posting|posts|talking)\b|\b(trend|trends|trending|popular|unpopular|most (aura|attention|engagement|liked|popular)|least (aura|attention|engagement|popular)|what('?s| is) (hot|big|popping|blowing up)|hottest|top (posts?|hashtags?|topics?|teams?)|performing|generating (the )?most|getting (the )?most|blowing up|which .{1,40} (most|least)|underrated|overlooked|ignored|niche|(people|everyone) (are )?(posting|talking) about|most (posted|talked)|doing well|doing badly|getting more (aura|attention|love)|(more|less) (aura|attention) than|which (one |is |are |team |topic )?(gets|getting|has|have) (more|less|the most|the least)|(tags?|hashtags?|topics?) (are |is )?(hot|big|popular|doing well|blowing up)|(is|are) (anyone|anybody|people) (posting|talking) about|how (popular|big) is|(most|least) active|(are|is) (hot|popping|buzzing|big)|b(vs|versus)b.{0,40}b(bigger|more|most|better|ahead|winning|popular)|which (one )?is (bigger|more popular|ahead)|(hot|popping|buzzing) (right now|today|lately|this week)|(topics?|hashtags?|tags?|teams?|niches?) (are|is) (dead|dying|cold|quiet|flopping))\b/,
  feed: /\b(my feed|feed|timeline|see more|see less|show me (more|less|fewer)|show (more|less|fewer)|more (posts|content|stuff|videos|photos) (about|on|from|of)|less (posts|content|stuff)|fewer|stop showing|not getting|not seeing|keep seeing|tune|recommended (posts|content)|(stop|quit) recommending|reset my|i only want to see|i (just )?want to see|i miss seeing|enough (with|of) (the )?|no more \w+)\b/,
  post: /\b(my (post|caption|draft)|this (post|caption|draft)|a post (i'?m|about)|caption|draft|feedback on|improve my|review my|check my|help (me )?with (a|my|this) post|what topics? (should|for)|which topics?|hashtags? (should|for)|before i post|(suggest|give me|recommend) (some |good )?(hashtags|topics)|best time to post|when should i post|what time (should|to) post)\b/,
};

// ── Her limits ────────────────────────────────────────────────────────
// Checked before anything else, on the message and on a de-disguised copy
// ("wr1te me a c a p t i o n"), so a request can't slip past by spelling.

// Things she might be asked to write. Angel only gives feedback on posts.
const PIECE = '(captions?|tweets?|poems?|stor(?:y|ies)|bios?|comments?|messages?|repl(?:y|ies)|essays?|songs?|lyrics|jokes?|slogans?|taglines?|hooks?|titles?|quotes?|'
  + 'usernames?|user ?names?|group names?|names?|paragraphs?|sentences?|copy|threads?|raps?|limericks?|haikus?|captions? ideas?)';
const ADJ = '(?:(?:good|great|nice|cool|funny|cute|catchy|clever|creative|better|short|long|quick|witty|viral|perfect|sweet|edgy|aesthetic|new|different|random|unique|fun|deep|sad|happy|romantic|professional|instagram|tiktok|aura)\\s+){0,3}';
// Writing verbs: anything after them that's writable (or a post) is a request to write
const STRONG = '(write|wr1te|writ|compose|ghostwrite|generate|pen|type (?:out|up)|draft|spin up|whip up|cook up|dream up|make up|come up with|brainstorm|invent|craft (?:me )?(?:a|an|some|my))';
// Softer verbs count only with an article ("suggest a caption", "give me 5 bios")
const SOFT = '(suggest|give me|gimme|send me|show me|provide|create|make|need|produce|print|output|craft|get me|find me|type|drop|hand me)';
const WRITE_REQUESTS = [
  new RegExp(`\\b${STRONG}\\s+(?:(?:me|us|for me|a|an|the|some|my|this|that|another|\\d+|few|couple|of|ideas? for|examples? of)\\s+){0,4}${ADJ}(${PIECE.slice(1, -1)}|posts?|content|one|version|text|status(?:es)?|description|something)\\b`),
  new RegExp(`\\b${SOFT}\\s+(?:me\\s+)?(?:a|an|some|\\d+|a few|a couple(?: of)?|any)\\s+${ADJ}${PIECE}\\b`),
  new RegExp(`\\bthink of (?:a|an|some|\\d+)\\s+${ADJ}${PIECE}\\b`),
  /\b(caption|post|bio|username|name|content|tweet|comment|reply|title|hook) (ideas?|suggestions?|examples?|samples?|inspo|inspiration|options|prompts?|templates?)\b/,
  /\b(ideas?|examples?|samples?|inspiration|inspo|templates?) (for|of) (a |an |my |some |good |the )*(caption|post|bio|username|name|comment|reply|tweet|group name)s?\b/,
  /\b(sample|example|template) (caption|post|bio|comment|reply)s?\b/,
  /\b(good|best|funny|cute|catchy|cool|clever) (caption|bio|username|name|comment|reply)s? (for|about|on|to)\b/,
  /\bwhat (should|would|could|can|do) (i|you) (caption|call|name|title|write|say|put)\b/,
  /\bwhat (should|would|could) my (bio|caption|post|comment|reply|username|name) (say|be)\b/,
  /\bhow (would|should|could) you (word|phrase|write|caption|say|put)\b/,
  /\bsay something .{0,30}\b(post|caption|comment|share)\b/,
  /\b(post|comment|reply|respond|answer)( something| this| it| that)? (for me|on my behalf)\b/,
  /\b(?!show|find|get|recommend|pick|choose|surface|save|hide)\w+ (a |an |my |the |some )?(post|caption|bio|comment|reply|tweet)s? (for me|on my behalf)\b/,
  /\b(make|create) me (a |an |some )?(post|caption|bio|comment|reply)s?\b/,
  /\b(finish|continue|complete|shorten|lengthen|translate|proofread|polish|punch up|spice up|jazz up|summari[sz]e|paraphrase|reword|rephrase|rewrite|redo)\s+(it|this|that|this one|mine)\b/,
  /\b(finish|continue|complete|extend|shorten|lengthen|translate|proofread|polish|punch up|spice up|jazz up|paraphrase|reword|rephrase|rewrite|rewriting|redo)\s+(my|the|this|a|an|our)?\s*(\w+\s+)?(caption|post|bio|sentence|draft|comment|reply|text|paragraph|line|wording)s?\b/,
  /\b(fix|correct|improve|tweak|check) (the |my )?(grammar|spelling|wording|punctuation)\b/,
  /\b(fix|edit|correct|change) (my|this|the) (post|caption|bio|draft|comment)s? (for me|so it|to make|to sound)\b/,
  /\bmake (my |this |the |that )?(caption|post|bio|draft|comment|wording|writing|this|that)s? (sound |read |feel )?(funnier|shorter|longer|cooler|smarter|catchier|nicer|sadder|happier|wittier|edgier|more (funny|catchy|professional|engaging|viral|exciting|interesting|clever|poetic)|professional|viral|go viral)\b/,
  /\bmake (this|that|it|my caption|my post) sound\b/,
  /\b(add|put|insert|throw in|sprinkle) (some |a few |more |a )?(emojis?|jokes?|puns?|a hook|a call to action|rhymes?) (to|in|into|on)\b/,
  /\b(improved|alternative|rewritten|polished|edited|better) (one|version|wording)\b/,
  /\b(caption|text|post|content|bio|story|poem|joke|tweet) (generator|writer|bot|maker)\b/,
  /\b(rewrite|rewriting|rewritten|reword|rephrase|paraphrase|ghostwrite)\b/,
  /\btell me what to post\b|\bwhat (should|do|can) i post\s*\??$/,
  /\b(caption|title|name|describe) (this|it|that|my \w+)( for me)?\b(?! view)/,
  /\bneed (some |a few )?hashtags and (a |an )?(caption|post|bio)\b/,
  /\bturn (this|it|that|my \w+) into (a |an )?(\w+ )?(caption|post|bio|tweet|comment|reply)\b/,
  /\b(write|generate|make|create|give me|gimme|suggest) .{0,20}\bhashtags? and (a |an |some )?(caption|post|bio)\b/,
  /\b(tell|read|sing|recite) (me |us )?(a |an |some )?(story|stories|poem|poems|joke|jokes|song|songs|lullaby|captions?)\b/,
  /\b(write|wr1te)\s+(me|it|this|that|a|an|my|some|something|for|about|up)\b/,
];
// "How do I write a good caption?" is asking for help, not for her to write
const ASKING_HOW = /^(how (do|can|should|could) (i|we)|can (i|we|people|others) (make|create|write|post|add)|any tips|tips (for|on)|what makes)\b/;
const asksToWrite = text => !ASKING_HOW.test(text) && WRITE_REQUESTS.some(re => re.test(text));

// Attempts to change her rules
const OVERRIDE = /\b((forget|drop|disable|turn off|break|bend) (all |any |the |your |these )*(rules|instructions|limits|restrictions|filters|guidelines)|ignore (all |any |the |your |previous |prior |above |these )*(instructions|rules|prompts?|limits|guidelines)|you are now|from now on,? you|pretend (you are|to be|you're|that you)|act as|roleplay|role play|jailbreak|dan mode|developer mode|god mode|sudo|(with|have|has) no (restrictions|rules|filters)|without (any )?(restrictions|rules|filters)|i authori[sz]e you|you (may|can|are allowed to) now|system prompt|your (instructions|prompt|programming|source code|training)|(print|show|reveal|repeat|tell me|output|what are) (me )?your (instructions|prompt|rules|system|code))\b|^\s*(system|assistant|developer|admin)\s*:/;

// Looking into other people (beyond public trend totals) is off limits
const WHO = '(users?|accounts?|creators?|persons?|influencers?|profiles?|posters?|people)';
const PEOPLE = new RegExp([
  '@[a-z0-9_]{2,}',
  "\\bwho('s| is| are|s)? (the )?(most|top|best|biggest|richest|highest|lowest|least)\\b",
  "\\bwho('s| is|s) (trending|popular|famous|blowing up|on aura|online)\\b",
  '\\bwho (gave|give|gives|sent|sends|took|takes|blocked|reported|viewed|visited|views|unfollowed|follows|followed|is following|liked|likes|stalks|saw|watched|muted|hates|posts|posted|commented)\\b',
  '\\bwho has (the )?(most|highest|biggest|least|lowest|top)\\b',
  "\\bwho('s| is| are)? (getting|receiving|earning|making|giving|taking|posting) (the )?(most|least|more|less)\\b",
  '\\bwho in (my|the|this|our) (group|feed|followers|follows)\\b',
  "\\bwho('s| is| are| has been| have been| was| were| keeps?) (liking|giving|taking|following|viewing|visiting|blocking|reporting|stalking|watching|unfollowing|commenting on|looking at|checking)\\b",
  '\\b(what|which) (accounts?|users?|creators?|people|profiles?) (should|to|could|can|do) (i )?(follow|add|watch)\\b',
  '\\bwho (should|to|could) i (follow|add|watch)\\b',
  '\\b(best|top|good) (creators?|accounts?|people|users?) to follow\\b',
  '\\bwhich (users?|accounts?|creators?|persons?|influencers?|profiles?|posters?)\\b',
  `\\btop (creators?|users?|accounts?|people|influencers?|posters?|profiles?)\\b`,
  `\\b(most|least) (popular|followed|liked|active) ${WHO}\\b`,
  `\\b${WHO} (are |is )?(trending|popular|blowing up|getting the most)\\b`,
  '\\bhow much aura (does|do|did|has) (?!my\\b|i\\b|it\\b|a\\b|this\\b)',
  '\\b(account|profile|posts?|activity|likes|followers|location|address|phone|email|password|ip( address)?) (of|from|for) (the |a )?(user|account|person|admin|moderator|someone|somebody|him|her|them)\\b',
  '\\bfind (the )?(account|profile) of\\b',
  '\\bis (my )?(ex|boss|friend|crush|girlfriend|boyfriend|mom|dad|teacher|coworker|sister|brother)\\b.{0,20}\\b(on|using) (aura|here|this)\\b',
  '\\b(my )?followers (are )?into\\b',
  '\\btell me about (the |a )?(user|account|person|member|creator)\\b',
  '\\bshow me everything\\b',
  '\\blist (all |every )?(the )?(private|users|accounts|members|people)\\b',
  "\\b((?!(what|that|it|let|there|here|who|where|how)'s)\\w+'s|his|her|their|the admin'?s?) (email|phone|number|address|password|real name|ip|location|age)\\b",
  '\\b(email|phone number|home address|password|real name|ip address) (of|for) (?!my\\b)',
  '\\bwhere (does|do|did) (?!i\\b|you\\b|we\\b)\\w+ (live|work|go to school|stay)\\b',
  '\\b(dox|doxx|stalk|track down)\\w*\\b',
  "\\b(see|view|check|look at|look up|find|show me|access|read) (someone|somebody|other people|others)('s|s'|')?\\b",
  '\\bprivate (account|posts?|profile) of\\b',
  '\\bwhat does (?!aura\\b|the\\b|my\\b|this\\b|it\\b|spendable\\b|earned\\b)\\S+ like\\b',
].join('|'));

// Getting around Aura's rules, or into what isn't yours
const ABUSE = new RegExp([
  '\\b(hack|hacks|hacking|hacked|exploit|exploits|exploiting|cheat|cheats|cheating|botting|auto ?clicker|farm(ing)? aura|aura farm(ing)?|dupe|duplicate aura|circumvent|evade|ban evasion|ddos|scrape|scraping|phish|phishing|steal|stealing|crack)\\b',
  '\\b(use|using|make|run|running|build|write|code|with|my|our) (a |an |some )?(bots?|macros?|auto ?clickers?)\\b',
  // a script to farm aura, not a script font
  '\\b(use|using|run|running|build|write|code|with|via) (a |an |some )?scripts?\\b(?! fonts?)',
  '\\b(win every|always win|never lose|guaranteed (win|to win)|rig|rigged|predict the (cards|dice|coin|deck))\\b',
  '\\b(get|getting|go|work) (around|past) (a |the |my |their |his |her )?(block|ban|limit|limits|cap|caps|cooldown|rules?|filter|private)\\b',
  '\\bbypass\\w*\\b',
  '\\b(second|alt|fake|extra|burner) accounts?\\b|\\balts\\b|\\bmultiple accounts\\b|\\bsock ?puppets?\\b',
  '\\bgive myself\\b',
  "\\bsee (their|his|her|someone'?s|other people'?s|others'?|all|people'?s|everyone'?s) private\\b",
  '\\b(how|can) (can )?i (see|view|read|access|look at|get into) (\\w+ )?private (posts|accounts?|profiles?|groups?)\\b',
  '\\b(get into|log ?in ?to|access) (someone|somebody|another|their|his|her|other)\\b',
  '\\bunban me\\b',
  '\\b(more|past|over|beyond|above) (than )?(the |my )?(daily )?(limit|limits|cap|caps|cooldown)\\b',
  '\\b(infinite|unlimited) aura\\b',
].join('|'));

// Undoes common disguises: digits for letters, spaced-out letters, extra symbols
function undisguise(text) {
  const leet = text.replace(/[013457@$!|]/g, c => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '|': 'l' }[c]));
  // "w r i t e  a  c a p t i o n" → "write a caption" (double spaces separate words)
  const joined = leet.replace(/(?:\b\p{L}\b ?){3,}/gu, run => run.split(/ {2,}/).map(w => w.replace(/ /g, '')).join(' ') + ' ');
  return joined.replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

// Words that show a message is about Aura at all: the meaning-match
// fallback only answers when one is present, so off-topic questions that
// happen to sound similar to a known one are still refused
const DOMAIN = /\b(moderation|moderators?|mods|rules|guidelines|safety|banned|ban|support|delete|edit|wallet|aura|feed|timeline|posts?|posting|captions?|hashtags?|topics?|themes?|colou?rs?|fonts?|dark|light|app|profile|account|groups?|games?|poker|pool|connect 4|go fish|dice|coin flip|follow\w*|block\w*|report\w*|premium|ads?|wallet|angel|trend\w*|popular|notifications?|comments?|likes?|liked|shares?|settings|username|privacy|private|data|moments?|hearth|spotlight|rain|points|balance|rank|search|stake|bio|draft)\b/;

const INTENT_EXAMPLES = {
  feed: ['I want to see more cooking posts', 'stop showing me so much politics', 'my feed is boring', 'I am not seeing posts about soccer', 'how do I get more photography in my feed'],
  trends: ['what is trending right now', 'which team is getting the most aura', 'what hashtags are popular', 'which topics are getting the least attention', 'what kind of posts do well'],
  theme: ['make me a dark purple theme', 'I want the app to look like a sunset', 'can you make a theme with a serif font', 'give the app ocean colors'],
  post: ['can you give me feedback on my caption', 'what topic should my post be in', 'is my post too long', 'how can I make my post better'],
};

// The message's vector, worked out once per message
let lastVector = { text: null, vec: null };
async function vectorOf(text, embed) {
  if (!embed) return null;
  if (lastVector.text === text) return lastVector.vec;
  try {
    const [mine] = (await embed([text])) ?? [];
    lastVector = { text, vec: decodeVector(mine) };
  } catch {
    lastVector = { text, vec: null };
  }
  return lastVector.vec;
}

// A small classifier trained on hundreds of example messages
// (scripts/angel-intents), on top of the same on-device vectors. It only
// picks which of her existing answers to give; it never writes anything.
let intentWeights = null;
function weightsOf() {
  if (!intentWeights) {
    intentWeights = INTENT_MODEL.weights.map(({ scale, w }) => {
      const bin = atob(w);
      const out = new Float32Array(INTENT_MODEL.dim);
      for (let d = 0; d < out.length; d++) { const c = bin.charCodeAt(d); out[d] = (c > 127 ? c - 256 : c) * scale; }
      return out;
    });
  }
  return intentWeights;
}
export async function classifyIntent(text, embed) {
  const vec = await vectorOf(text, embed);
  if (!vec) return null;
  const z = weightsOf().map((w, k) => similarity(w, vec) + INTENT_MODEL.bias[k]);
  const top = Math.max(...z);
  const ex = z.map(v => Math.exp(v - top));
  const sum = ex.reduce((a, c) => a + c, 0);
  const k = ex.indexOf(1);
  return { label: INTENT_MODEL.labels[k], p: ex[k] / sum };
}

let exampleVecs = null;
async function nearestIntent(text, embed) {
  if (!embed) return null;
  try {
    if (!exampleVecs) {
      const entries = [
        ...Object.entries(INTENT_EXAMPLES).flatMap(([intent, list]) => list.map(q => ({ intent, q }))),
        ...KNOWLEDGE.map(k => ({ intent: 'app', q: k.q, k })),
      ];
      const vecs = await embed(entries.map(e => e.q));
      if (!vecs) return null;
      exampleVecs = entries.map((e, i) => ({ ...e, vec: decodeVector(vecs[i]) }));
    }
    const vec = await vectorOf(text, embed);
    if (!vec) return null;
    let best = null;
    for (const e of exampleVecs) {
      const sim = similarity(vec, e.vec);
      if (!best || sim > best.sim) best = { ...e, sim };
    }
    return best && best.sim >= 0.55 ? best : null;
  } catch {
    return null;
  }
}

// Whole words only ("cap" isn't in "capital", "coin" isn't in "bitcoin");
// a plural still counts
const keyPattern = new Map();
const keyMatches = (text, key) => {
  let re = keyPattern.get(key);
  if (!re) {
    re = new RegExp(`(^|[^\\p{L}\\p{N}])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es|ing|ed)?($|[^\\p{L}\\p{N}])`, 'u');
    keyPattern.set(key, re);
  }
  return re.test(text);
};
function knowledgeByKeys(text) {
  let best = null;
  for (const k of KNOWLEDGE) {
    const hits = k.keys.filter(key => keyMatches(text, key)).reduce((n, key) => n + key.length, 0);
    if (hits && (!best || hits > best.hits)) best = { k, hits };
  }
  return best?.k ?? null;
}

// Pages she can take people to by name
const PAGES = [
  [/^(profile|account page|page)$/, { to: '/profile', label: 'Open my profile' }],
  [/^(wallet|aura wallet|aura|balance)$/, { to: '/wallet', label: 'Open Aura Wallet' }],
  [/^(settings|setting)$/, { to: '/settings', label: 'Open Settings' }],
  [/^(notifications|notification|bell|inbox)$/, { to: '/notifications', label: 'Open Notifications' }],
  [/^(groups|group)$/, { to: '/groups', label: 'Open Groups' }],
  [/^(feed|home|home page|timeline)$/, { to: '/', label: 'Open my feed' }],
  [/^(search)$/, { to: '/search', label: 'Open Search' }],
  [/^(post|new post|create|create post)$/, { to: '/create', label: 'Make a post' }],
  [/^(feedback|suggestions|reviews|suggestions & reviews)$/, { to: '/feedback', label: 'Open Suggestions & Reviews' }],
  [/^(about|about page|roadmap)$/, { to: '/about', label: 'Open About Aura' }],
  [/^(appearance|themes|theme settings)$/, { to: '/settings#appearance', label: 'Appearance settings' }],
  [/^(privacy|privacy settings)$/, { to: '/settings#privacy', label: 'Privacy settings' }],
  [/^(premium|premium page|subscriptions?|upgrade|creator account)$/, { to: '/premium', label: 'See Premium' }],
  [/^(my themes|saved themes|your themes)$/, { to: '/settings#appearance', label: 'Your themes' }],
];

// "How do I…", "what is…", "can people…": questions about the app itself
const QUESTION = /^(how|why|where|when|what('?s| is| are| does| do| happens| happened)|whats|can (i|people|someone|others|anyone|you)|do (i|you|people|others)|does|is (it|there|my)|are (my|you|people)|should i|will|could i|who (made|built|created|are)|explain)\b/;

// Feed requests that don't say "feed": "more NFL less politics", "I like anime"
function looksLikeFeed(text) {
  if (INTENT_RULES.feed.test(text)) return true;
  if (/^(more|less|fewer|no more|hide|mute|show me|give me more|i want more|i need more)\b/.test(text)) return true;
  if (/\b(more|less|fewer) of\b|\b(give|show|get) me (more|less)\b|\bmore (\w+ )?(please|pls)\b/.test(text)) return true;
  // "I want less sports and more music": more or less of a real topic
  if (/\b(more|less|fewer)\b/.test(text) && subjectsOf(text).topics.length && !/\b(theme|colou?rs?|aura|darker|lighter)\b/.test(text)) return true;
  if (/\b(i (really )?(like|love|enjoy|adore|am into|'m into|am a fan of|'m a fan of|hate|can'?t stand)|(i'?m|im|i am) (\w+ )?(into|obsessed with|a fan of|interested in|hooked on)|i'?m (so )?(tired|sick) of|hide (posts|content|stuff|anything)|mute)\b/.test(text)) {
    const { topics, keywords } = subjectsOf(text);
    return topics.length + keywords.length > 0;
  }
  return false;
}

// ── The five jobs ─────────────────────────────────────────────────────

const label = id => TOPICS.find(t => t.id === id)?.label ?? id;
// short keywords are usually acronyms (NFL, NBA, UFC)
const shown = k => (k.length <= 4 && /^[a-z0-9]+$/.test(k) ? k.toUpperCase() : k);

async function feedReply(text, ctx) {
  if (has(text, /\b(reset|start over|clear)\b/) && has(text, /\b(feed|preferences|settings|choices)\b/)) {
    return {
      kind: 'feed', text: 'I can clear your topic and keyword choices so your feed starts fresh. What it has learned from your gives and likes stays (Settings > Privacy can reset that).',
      actions: [{ id: 'reset-feed', label: 'Clear my feed choices' }],
    };
  }
  if (has(text, /\b(what|which|show)\b.{0,20}\b(my )?(preferences|choices|settings|topics i)\b/)) {
    const p = ctx.prefs ?? { more: [], less: [], words: [] };
    const list = arr => (arr.length ? arr.map(label).join(', ') : 'none');
    return {
      kind: 'feed',
      text: `More of: ${list(p.more)}. Less of: ${list(p.less)}. Keywords: ${p.words.length ? p.words.map(w => `${w.text} (${w.choice})`).join(', ') : 'none'}.`,
    };
  }
  const less = has(text, /\b(less|fewer|stop|don'?t want|no more|tired of|hate|hide|avoid|too much|too many|sick of|keep seeing)\b/);
  let pool = [];
  try { pool = (await ctx.getPool?.()) ?? []; } catch { pool = []; }
  let { topics, keywords } = subjectsOf(text, pool.length ? vocabularyOf(pool) : new Set());
  // "more of that": what we were just talking about
  if (!topics.length && !keywords.length && /\b(that|this|it|those|them|these)\b/.test(text) && ctx.lastSubjects) {
    ({ topics, keywords } = ctx.lastSubjects);
  }
  if (!topics.length && !keywords.length) {
    return {
      kind: 'feed',
      text: 'Tell me what you\'d like more or less of, like "more cooking and NFL" or "less politics". I\'ll set it up for you to confirm. Your choices stay on this device.',
    };
  }
  const choice = less ? 'less' : 'more';
  const parts = [...topics.map(t => `the ${label(t)} topic`), ...keywords.map(k => `#${k}`)];
  // what that looks like right now, and hashtags people use with it
  const inPool = pool.filter(p => (p.tags ?? []).some(t => topics.includes(t)) || keywords.some(k => (p.hashtags ?? []).map(lower).includes(k))).length;
  const related = choice === 'more' && topics.length ? relatedTags(pool, topics, new Set(keywords)) : [];
  const now = topics.length || keywords.length
    ? (inPool ? ` ${inPool} of today's popular post${inPool === 1 ? '' : 's'} already fit.` : ' Nothing popular fits it today, so you\'ll see it as posts come in.')
    : '';
  return {
    kind: 'feed',
    text: `${choice === 'more' ? 'Got it.' : 'Okay.'} I'd show ${choice} of ${parts.join(' and ')}.${now} Say yes and I'll apply it.`,
    actions: [{ id: 'apply-feed', label: 'Apply', payload: { topics, keywords, choice } }],
    followUps: related.length ? [`Also more #${related.slice(0, 3).join(', #')}`] : [],
    subjects: { topics, keywords },
  };
}

async function trendsReply(text, ctx) {
  let posts = [];
  try { posts = (await ctx.getPool?.()) ?? []; } catch { posts = []; }
  posts = posts.filter(p => p && p.status !== 'removed');
  if (!posts.length) return { kind: 'trends', text: 'I couldn\'t load the public posts just now, so I can\'t look at trends. Try again in a moment.' };
  const { topics, keywords } = subjectsOf(text);
  const leastFirst = has(text, /\b(least|lowest|unpopular|worst|dying|dead|cold|quiet|flopping|ignored|underrated|not doing well|losing)\b/);
  const words = keywords.map(w => fold(w));
  // Within the topic, prefer posts that also mention the specific words (NFL
  // inside Sports); without a topic, the words alone decide
  let pool = topics.length ? posts.filter(p => (p.tags ?? []).some(t => topics.includes(t))) : posts;
  if (words.length) {
    const matching = pool.filter(p => textMatch(p, words) >= 0.7);
    if (matching.length || !topics.length) pool = matching;
  }
  if (!pool.length) {
    return { kind: 'trends', text: `None of the public posts I can see right now match ${[...topics.map(label), ...keywords].join(', ')}. Try a broader topic.` };
  }
  // "NBA or NFL?", "chiefs vs eagles": compare exactly the things named
  if (words.length >= 2 && has(text, /\b(or|vs|versus|compared?( to)?|than|against)\b/)) {
    const scope = topics.length ? posts.filter(p => (p.tags ?? []).some(t => topics.includes(t))) : posts;
    const rows = words.map((w, i) => {
      const hits = scope.filter(p => textMatch(p, [w]) >= 0.7);
      return { key: shown(keywords[i]), aura: hits.reduce((n, p) => n + Math.max(0, p.auraScore ?? 0), 0), posts: hits.length };
    }).sort((a, b) => b.aura - a.aura);
    if (rows.some(r => r.posts)) {
      return {
        kind: 'trends',
        text: rows[0].aura > (rows[1]?.aura ?? 0) ? `${rows[0].key} is getting more aura right now.` : 'They\'re about even right now.',
        items: [{ title: 'Side by side', rows: rows.map(r => `${r.key}: ${r.aura.toLocaleString()} aura across ${r.posts} post${r.posts === 1 ? '' : 's'}`) }],
        note: 'This counts aura given to public posts in the feed\'s current pool (the most active posts right now), not every post, and never anyone\'s private activity.',
      };
    }
  }
  // Group by hashtag (the clearest signal of a team, show or theme), else by topic
  const groups = new Map();
  for (const p of pool) {
    const keys = (p.hashtags ?? []).map(hashtagKey).filter(h => !words.includes(h));
    for (const key of keys.length ? keys.map(h => `#${h}`) : (p.tags ?? []).map(label)) {
      const g = groups.get(key) ?? { key, aura: 0, posts: 0 };
      g.aura += Math.max(0, p.auraScore ?? 0);
      g.posts += 1;
      groups.set(key, g);
    }
  }
  const ranked = [...groups.values()].sort((a, b) => b.aura - a.aura || b.posts - a.posts);
  const top = ranked.slice(0, 5);
  const bottom = ranked.filter(g => !top.includes(g)).slice(-3).reverse();
  const scope = topics.length || keywords.length ? ` about ${[...topics.map(label), ...keywords.map(shown)].join(', ')}` : '';
  const line = g => `${g.key}: ${g.aura.toLocaleString()} aura across ${g.posts} post${g.posts === 1 ? '' : 's'}`;
  const items = leastFirst
    ? [{ title: 'Getting the least attention', rows: [...ranked].reverse().slice(0, 5).map(line) }, { title: 'For comparison, the most', rows: top.slice(0, 3).map(line) }]
    : [{ title: 'Getting the most aura', rows: top.map(line) }, ...(bottom.length ? [{ title: 'Getting the least', rows: bottom.map(line) }] : [])];
  return {
    kind: 'trends',
    text: `From the ${pool.length} public post${pool.length === 1 ? '' : 's'}${scope} in today's trending pool:`,
    items,
    note: 'This counts aura given to public posts in the feed\'s current pool (the most active posts right now), not every post, and never anyone\'s private activity.',
  };
}

function appReply(k) {
  const link = KNOWLEDGE_LINKS[k.id];
  return { kind: 'app', text: k.a, ...(link && { links: [link] }) };
}

// For descriptions she has no word for ("pumpkin spice", "a rainy café"):
// the closest mood by meaning, on the device
let moodVecs = null;
async function nearestMood(text, embed) {
  if (!embed) return null;
  try {
    if (!moodVecs) {
      const vecs = await embed(MOOD_NAMES.map(m => `${m} colors`));
      if (!vecs) return null;
      moodVecs = MOOD_NAMES.map((m, i) => ({ m, vec: decodeVector(vecs[i]) }));
    }
    const [mine] = (await embed([text])) ?? [];
    const vec = decodeVector(mine);
    if (!vec) return null;
    let best = null;
    for (const { m, vec: v } of moodVecs) {
      const sim = similarity(vec, v);
      if (!best || sim > best.sim) best = { m, sim };
    }
    return best && best.sim >= 0.35 ? best.m : null;
  } catch {
    return null;
  }
}

async function themeReply(text, ctx) {
  const opts = { remix: !!ctx.remix };
  let result = describeTheme(text, ctx.lastTheme, opts);
  if (!result) {
    const mood = describesNothing(text) ? null : await nearestMood(text, ctx.embed);
    if (mood) result = describeTheme(`${mood} ${text}`, ctx.lastTheme, opts);
  }
  if (!result) {
    return {
      kind: 'theme',
      text: ctx.lastTheme
        ? 'Tell me what to change: the colors ("make the accent teal", "a navy background"), light or dark ("pure black", "lighter"), the font ("a serif font"), or ask for "a different one".'
        : 'Describe the look you want: colors ("purple and gold"), a mood or season ("cozy fall", "cyberpunk", "rainy day"), light or dark, and a font if you like ("serif", "mono").',
    };
  }
  return {
    kind: 'theme', text: result.summary, theme: result.spec, note: result.note,
    actions: [{ id: 'apply-theme', label: 'Try it on', payload: result.spec }],
  };
}

// The draft in a message: quoted, or after a colon or line break
const draftOf = raw => (raw.match(/["“]([\s\S]{8,})["”]/)?.[1] ?? raw.split(/:\s|\n/).slice(1).join(' ')).trim();
const hasDraft = raw => draftOf(raw).length >= 8;

async function postReply(text, raw, ctx) {
  const draft = draftOf(raw);
  if (has(text, /\b(best time|when should i post|what time)\b/)) {
    return { kind: 'post', text: 'I can\'t tell you the best time to post: Aura doesn\'t track when people look at the app, by design. Posts stay in the trending pool by how much aura they get, so a strong post does well whenever you share it.' };
  }
  if (draft.length < 8) {
    return {
      kind: 'post',
      text: 'Paste your draft after a colon, like "feedback on my caption: …", and I\'ll point out what could be stronger and suggest topics and hashtags. I won\'t write it for you; it\'s your voice.',
    };
  }
  const notes = [];
  const good = [];
  const sentences = draft.split(/[.!?]+\s/).filter(Boolean);
  const words = draft.split(/\s+/).filter(Boolean);
  const letters = draft.replace(/[^\p{L}]/gu, '');
  const caps = letters.replace(/[^\p{Lu}]/gu, '').length / Math.max(1, letters.length);
  const emoji = (draft.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const tags = (draft.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const mentions = (draft.match(/@[\w]+/g) ?? []).length;
  if (words.length < 4) notes.push('It\'s very short. A line of context (what, where or why) gives people something to respond to.');
  if (draft.length > 600) notes.push('It\'s long. The first line shows first, so put the most important part up front.');
  if (sentences[0] && sentences[0].length > 140) notes.push('The opening sentence is long; a shorter first line draws people in.');
  if (words.length / Math.max(1, sentences.length) > 28) notes.push('Some sentences run long. Breaking them up makes it easier to read on a phone.');
  if (caps > 0.5 && letters.length > 12) notes.push('Most of it is in capitals, which reads as shouting.');
  if (/([!?])\1{2,}/.test(draft)) notes.push('Lots of repeated !!! or ??? can feel noisy; one usually lands better.');
  if (emoji > 8) notes.push(`There are ${emoji} emoji; a few go further than many.`);
  if (tags > 0) notes.push('Hashtags work best in the post\'s hashtag field (up to 10), where people can tap them, rather than in the caption.');
  if (mentions > 3) notes.push('Tagging many people notifies each of them; tag only people who are part of the post.');
  if (/\?/.test(draft)) good.push('Ending on a question invites comments.');
  else notes.push('Consider asking people something; questions get more replies.');
  if (words.length >= 8 && words.length <= 80 && caps < 0.3) good.push('The length is comfortable to read.');

  // Topic and hashtag suggestions from real data: on-device meaning, and
  // hashtags already used on similar public posts
  const { topics } = subjectsOf(draft);
  let topicIds = topics;
  if (!topicIds.length && ctx.embed) {
    try {
      const vecs = await ctx.embed([draft, ...TOPICS.map(t => t.label)]);
      const [d, ...rest] = (vecs ?? []).map(decodeVector);
      if (d) topicIds = rest.map((v, i) => [TOPICS[i].id, similarity(d, v)]).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(([, s]) => s > 0.2).map(([id]) => id);
    } catch { /* suggestions are a bonus */ }
  }
  let hashtags = [];
  try {
    const posts = (await ctx.getPool?.()) ?? [];
    const draftWords = subjectsOf(draft).keywords.map(fold);
    const counts = new Map();
    for (const p of posts) {
      if (!draftWords.length || textMatch(p, draftWords) < 0.5) continue;
      for (const h of p.hashtags ?? []) counts.set(hashtagKey(h), (counts.get(hashtagKey(h)) ?? 0) + 1);
    }
    hashtags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h]) => `#${h}`);
  } catch { /* optional */ }

  const items = [];
  if (notes.length) items.push({ title: 'Could be stronger', rows: notes });
  if (good.length) items.push({ title: 'Working well', rows: good });
  if (topicIds.length) items.push({ title: 'Topics that fit', rows: [topicIds.map(label).join(', ')] });
  if (hashtags.length) items.push({ title: 'Hashtags on similar public posts', rows: [hashtags.join('  ')] });
  return { kind: 'post', text: 'Here\'s my feedback. I won\'t rewrite it; it should sound like you.', items };
}

// ── Answering ─────────────────────────────────────────────────────────

// Her answer for an intent the classifier picked
async function byIntent(label, text, raw, ctx) {
  switch (label) {
    case 'switch': {
      const named = builtInThemeIn(text);
      if (named) return builtInThemeReply(named.theme, ctx);
      if (/\b(default|normal|original|regular|standard|usual|old|back)\b/.test(text)) return builtInThemeReply(THEMES.find(t => t.id === 'day'), ctx);
      return themeListReply(text, ctx);
    }
    case 'theme-list': return themeListReply(text, ctx);
    case 'current-theme': return currentThemeReply(ctx);
    case 'theme': return themeReply(text, ctx);
    case 'account': return balanceReply(ctx, text);
    case 'scenery': return sceneryReply(text, ctx);
    case 'feed': return feedReply(text, ctx);
    case 'feed-summary': {
      let pool = [];
      try { pool = (await ctx.getPool?.()) ?? []; } catch { pool = []; }
      return feedSummaryReply(text, ctx, pool);
    }
    case 'trends': return trendsReply(text, ctx);
    case 'post': return postReply(text, raw, ctx);
    case 'app': {
      const near = await nearestIntent(raw, ctx.embed);
      if (near?.k && near.sim >= 0.45) return appReply(near.k);
      const close = await closestKnowledge(raw, text, ctx.embed);
      return { kind: 'unknown', text: 'I don\'t have an answer for that one yet. These are the closest things I can help with:', followUps: close.map(k => k.q) };
    }
    default: return refusal();
  }
}
// When the words point one way but the classifier is sure of another job
const SURE = 0.85;
const OWN_JOBS = new Set(['switch', 'theme-list', 'current-theme', 'theme', 'account', 'scenery', 'feed', 'feed-summary', 'trends', 'post']);

/**
 * @param {string} message  what the person typed
 * @param {object} ctx      { prefs, getPool(): Promise<post[]>, embed(texts): Promise<string[]|null>, lastTheme }
 */
export async function respond(message, ctx = {}) {
  const reply = await reply_(message, ctx);
  // a question about reaching support or reporting: the answer, and a way to start
  if (reply.kind === 'app' && !ctx.flow) {
    const text = lower(clean(message));
    const start = WANTS_SUPPORT.test(text) || /\b(contact|support|customer service)\b/.test(text) ? 'Contact Aura support'
      : WANTS_REPORT.test(text) || /\breport\b/.test(text) ? 'I want to report someone' : null;
    if (start) return { ...reply, followUps: [...(reply.followUps ?? []), start] };
  }
  return reply;
}

async function reply_(message, ctx) {
  const writing = ctx.flow?.type === 'support' && ctx.flow.step === 'message';
  const raw = writing ? cleanLong(message) : clean(message);
  if (!raw) return { kind: 'hint', text: WHAT_I_DO, flow: ctx.flow ?? null };
  const text = lower(raw);

  // A report or support message under way: this message is the next answer
  if (ctx.flow) return continueFlow(ctx.flow, raw, text, ctx);

  // "yes" / "do it" right after she offered something does it; "no" lets it go
  if (ctx.pendingActions?.length) {
    if (/^(yes|yeah|yep|yup|ya|sure|ok(ay)?|k|do it|go ahead|apply( it| that)?|sounds good|please( do)?|let'?s (do it|go)|perfect|great|confirm|that works)\b[\s!.]*$/.test(text)) {
      return { kind: 'confirm', text: 'On it.', autoAction: ctx.pendingActions[0] };
    }
    if (/^(no|nope|nah|never ?mind|nvm|cancel|don'?t|not now|maybe later)\b[\s!.]*$/.test(text)) {
      return { kind: 'confirm', text: 'Okay, I won\'t change anything.' };
    }
  }
  // Follow-ups on posts she just found: "the second one", "show more",
  // "only my groups", "newer ones", "not that, one with a dog"
  if (ctx.lastFind && isFindFollowUp(text, ctx.lastFind)) return findFollowUp(text, ctx);
  // "also more #pasta, #baking" (her own suggestion, tapped)
  const alsoTags = /^also more (#[\p{L}\p{N}_]+(?:, #[\p{L}\p{N}_]+)*)$/u.exec(text);
  if (alsoTags) {
    const keywords = alsoTags[1].split(', ').map(t => t.slice(1));
    return { kind: 'feed', text: `Adding ${alsoTags[1]} too. Say yes and I'll apply it.`, actions: [{ id: 'apply-feed', label: 'Apply', payload: { topics: [], keywords, choice: 'more' } }], subjects: { topics: [], keywords } };
  }

  if (/^(hi|hey|hello|yo|hiya|good (morning|afternoon|evening))\b[\s!.]*$/.test(text)) {
    return { kind: 'hello', text: `Hi! I'm Angel. ${WHAT_I_DO}` };
  }
  if (/^(thanks|thank you|thx|ty|cheers|appreciate it)\b/.test(text)) return { kind: 'hello', text: 'Happy to help!' };

  if (/^(help|help me|help please|what now|options|menu|\?+)$/.test(text)) return { kind: 'hint', text: WHAT_I_DO };

  // Her limits come first, whatever else the message asks for. Each is
  // checked on the message as typed and with disguises undone.
  const plain = undisguise(text);
  const either = re => re.test(text) || re.test(plain);
  if (either(OVERRIDE)) return refusal(`My rules don't change. ${WHAT_I_DO}`);
  // Reaching Aura's team, reporting someone, and doing things in the app
  // ("how do I contact support?" gets the answer, with a button to start)
  const asking = /^(how|where|what|can i|could i|is there|do you)\b/.test(text);
  if (WANTS_SUPPORT.test(text) && !asking) return startSupport(text, ctx);
  if (WANTS_REPORT.test(text) && !asking) return startReport(raw, text, ctx);
  // Her newer skills, from the person's own data
  if (ASKS_CATCH_UP.test(text)) return catchUpReply(ctx);
  if (asksToDescribe(text) || asksToFindPosts(text)) return describeReply(text, ctx);
  if (wantsBot(text)) return playBotReply(text, ctx);
  if (ASKS_GROUPS.test(text) && !/\bhow (do|can)\b/.test(text)) return groupsReply(text, ctx);
  const command = await commandReply(raw, text, ctx);
  if (command) return command;
  if (asksToWrite(text) || asksToWrite(plain)) {
    return refusal('I don\'t write or rewrite things for people; your posts should sound like you. Paste your draft after a colon and I\'ll give you feedback on it.');
  }
  if (either(PEOPLE)) return refusal('I don\'t look into other people\'s accounts or activity, or rank people. I can show which hashtags and topics are getting attention.');
  if (either(ABUSE)) return refusal('I can\'t help with getting around Aura\'s rules or into anything that isn\'t yours.');
  // Small talk about her, and other apps, aren't her jobs
  if (/\byour (favou?rite|opinion|feelings?|age|birthday|hobby|hobbies|thoughts on)\b|\bhow old are you\b|\bdo you (like|love|feel|enjoy|dream|sleep|eat)\b|\bare you (happy|sad|alive|single|ok|okay)\b/.test(text)) return refusal();
  if (/\b(tiktok|instagram|insta|twitter|facebook|snapchat|reddit|youtube|threads app|bluesky|discord|whatsapp|bereal|pinterest|tumblr)\b/.test(text)) return refusal('I only know about Aura.');

  // Their own app: the scenery switch, their wallet, the built-in themes, their feed
  if (ASKS_THEME_LIST.test(text) && !/\bhow (do|does)\b/.test(text)) return themeListReply(text, ctx);
  if (ASKS_SCENERY.test(text) && !/\b(theme|themes|colou?rs?)\b/.test(text)) return sceneryReply(text, ctx);
  if (ASKS_BALANCE.test(text)) return balanceReply(ctx, text);
  if (ASKS_CURRENT_THEME.test(text)) return currentThemeReply(ctx);
  if (ASKS_THEME_LIST.test(text)) return themeListReply(text, ctx);
  // right after the list: "the dark ones", "just the light ones", "ones that move"
  if (ctx.lastKind === 'builtin-theme' && /\b(dark|light|moving|animated)\b.{0,12}\b(ones?|themes?)\b|\bones that (move|are (dark|light))\b/.test(text)) return themeListReply(text, ctx);
  // "take me to settings", "open my wallet": straight there
  const nav = /^(please |can you |could you )?(take me to|open|go to|bring me to|navigate to|show me) (the |my )?([a-z &]+?)( page| tab)?( please)?$/.exec(text);
  if (nav) {
    const page = PAGES.find(([re]) => re.test(nav[4]));
    const k = page ? null : knowledgeByKeys(text);
    const link = page ? page[1] : k && KNOWLEDGE_LINKS[k.id];
    // "show me every theme you have" names a guide topic but asks for a list
    const c = !page && link ? await classifyIntent(raw, ctx.embed) : null;
    if (c && c.p >= SURE && OWN_JOBS.has(c.label)) return byIntent(c.label, text, raw, ctx);
    if (link) return { kind: 'app', text: 'Here you go.', links: [link] };
  }
  const builtIn = builtInThemeIn(text);
  if (builtIn) {
    // "like Abyss but pink": a custom theme starting from that one's colors
    const rest = text.replace(builtIn.phrase, ' ');
    const base = specFromBuiltIn(builtIn.theme);
    const remix = /\b(but|except|with|only|version|remix|more|less|instead)\b/.test(text) && describeTheme(rest, base, { remix: true })?.changed.length;
    if (remix) return themeReply(rest, { ...ctx, lastTheme: base, remix: true });
    return builtInThemeReply(builtIn.theme, ctx);
  }
  if (ASKS_FEED_SUMMARY.test(text)) {
    let pool = [];
    try { pool = (await ctx.getPool?.()) ?? []; } catch { pool = []; }
    return feedSummaryReply(text, ctx, pool);
  }

  // Follow-ups to a theme she just made: "darker", "use a serif font", and
  // right after one, anything that reads as a change ("that's more grey than
  // black", "can I have a different one", "fall leaf colors")
  if (ctx.lastTheme || ctx.lastKind === 'theme') {
    const themeWords = !!ctx.lastTheme && /\b(darker|lighter|brighter|muted|vivid|softer|bolder|warmer|cooler|font|serif|mono|sans|accent|background)\b/.test(text);
    const aboutApp = QUESTION.test(text) && knowledgeByKeys(text);
    const otherJob = aboutApp || INTENT_RULES.trends.test(text) || looksLikeFeed(text) || INTENT_RULES.post.test(text);
    // right after she asked what look they want, a description is the answer
    const answering = ctx.lastKind === 'theme' && !otherJob && !describesNothing(text)
      && (describeTheme(text, ctx.lastTheme) || (!ctx.lastTheme && ctx.embed));
    if (themeWords || answering) return themeReply(text, ctx);
  }

  // A draft to look at is the clearest sign of all
  if (INTENT_RULES.post.test(text) && (hasDraft(raw) || /\b(feedback|review|check|look at|rate)\b/.test(text))) return postReply(text, raw, ctx);
  // "How do I…" questions and problems ("my post is gone") go to the guide first
  const problem = /\b(gone|disappeared|vanished|missing|removed|hidden|glitch\w*|bug|broken|not working|crash\w*|won'?t load)\b/.test(text);
  if ((QUESTION.test(text) || problem) && !INTENT_RULES.theme.test(text) && !INTENT_RULES.trends.test(text)) {
    const known = knowledgeByKeys(text);
    if (known) {
      // a guide word alone ("show me every theme you have") can be the wrong job
      const c = problem ? null : await classifyIntent(raw, ctx.embed);
      if (c && c.p >= SURE && OWN_JOBS.has(c.label)) return byIntent(c.label, text, raw, ctx);
      if (c?.label === 'write' && c.p >= 0.6 && !ASKING_HOW.test(text)) return refusal();
      return appReply(known);
    }
  }

  // Predictions and outside events aren't Aura data
  if (/\bwho (will|is going to|gonna) win\b|\b(tonight'?s|tomorrow'?s) game\b|\b(score|odds|spread) (of|for|in) the\b/.test(text)) return refusal();

  if (INTENT_RULES.theme.test(text)) return themeReply(text, ctx);
  // Colors or a font for the app, without saying "theme" ("spring colors with a serif font")
  if (/\b(colou?rs|colou?r|fonts?|serif|sans|mono)\b/.test(text) && !/\b(post|posts|caption|captions|text post)\b/.test(text) && describeTheme(text)) return themeReply(text, ctx);
  // "make the background white", "set the accent to gold" (not a post's background)
  const aboutPost = /\b(post|posts|caption|captions|text post)\b/.test(text);
  if (/\b(make|change|set|turn|switch|use) (the |my )?(app'?s? )?(background|accent|bg)\b/.test(text) && !aboutPost) return themeReply(text, ctx);
  if (INTENT_RULES.trends.test(text)) return trendsReply(text, ctx);
  if (looksLikeFeed(text)) return feedReply(text, ctx);
  if (INTENT_RULES.post.test(text)) return postReply(text, raw, ctx);
  const known = knowledgeByKeys(text);
  if (known) {
    const c = await classifyIntent(raw, ctx.embed);
    if (c && c.p >= SURE && OWN_JOBS.has(c.label)) return byIntent(c.label, text, raw, ctx);
    if (c?.label === 'write' && c.p >= 0.6 && !ASKING_HOW.test(text)) return refusal();
    return appReply(known);
  }
  // Just a look ("something minimal and grey", "matrix style"): a theme
  const look = !aboutPost && describeTheme(text);
  if (look && look.changed.some(c => c === 'mood' || c === 'accent' || c === 'background')) return themeReply(text, ctx);

  // No clear words: match by meaning, on the device, but only for messages
  // that are about Aura at all (so "capital of France" can't land on a
  // similar-sounding app answer)
  // The classifier, trained on many phrasings: without an Aura word it has to
  // be sure, so off-topic questions are still refused
  const c = await classifyIntent(raw, ctx.embed);
  if (c && (c.label === 'offtopic' || c.label === 'write') && c.p >= 0.5) return refusal();
  if (c && c.label !== 'offtopic' && c.label !== 'write' && c.p >= (DOMAIN.test(text) ? 0.45 : c.label === 'app' ? 0.9 : 0.65)) return byIntent(c.label, text, raw, ctx);
  if (!DOMAIN.test(text)) return refusal();
  const near = await nearestIntent(raw, ctx.embed);
  if (near?.intent === 'app') return appReply(near.k);
  if (near?.intent === 'feed') return feedReply(text, ctx);
  if (near?.intent === 'trends') return trendsReply(text, ctx);
  if (near?.intent === 'theme') return themeReply(text, ctx);
  if (near?.intent === 'post') return postReply(text, raw, ctx);
  // About Aura, but nothing she knows: say so, and offer the closest things she does
  const close = await closestKnowledge(raw, text, ctx.embed);
  return {
    kind: 'unknown',
    text: 'I don\'t have an answer for that one yet. These are the closest things I can help with:',
    followUps: close.map(k => k.q),
  };
}

// The guide entries nearest a question: by meaning when the model is
// loaded, else by shared words
async function closestKnowledge(raw, text, embed) {
  if (embed && exampleVecs) {
    try {
      const [mine] = (await embed([raw])) ?? [];
      const vec = decodeVector(mine);
      if (vec) {
        return exampleVecs.filter(e => e.k).map(e => ({ k: e.k, sim: similarity(vec, e.vec) }))
          .sort((a, b) => b.sim - a.sim).slice(0, 3).map(e => e.k);
      }
    } catch { /* fall back to words */ }
  }
  const words = new Set(text.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3 && !STOP.has(w)));
  const scored = KNOWLEDGE.map(k => ({ k, n: lower(`${k.q} ${k.keys.join(' ')}`).split(/[^\p{L}\p{N}]+/u).filter(w => words.has(w)).length }));
  const hits = scored.filter(s => s.n).sort((a, b) => b.n - a.n).slice(0, 3).map(s => s.k);
  return hits.length ? hits : KNOWLEDGE.filter(k => ['angel', 'feed', 'what-is-aura'].includes(k.id));
}
