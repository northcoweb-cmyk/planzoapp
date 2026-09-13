// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/intent.js — edit the source, then run scripts-port.mjs */
/**
 * Turn "7 of us want something cheap Saturday" into structured intent.
 *
 * Deterministic parser FIRST. It handles the overwhelming majority of real
 * inputs — group size, day, budget signal, activity type — at zero cost.
 * The model is consulted only when the parser's confidence is low, and even
 * then it may only fill fields the parser left empty. It can never override
 * something the parser read directly out of the user's own words.
 */
import ai from './ai.js';
import cache from './cache.js';
import { hash } from './ids.js';
import store from './store.js';

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// "drinks" alone means a bar, not a sit-down meal — it used to also match
// FOOD_WORDS, which made "let's go get drinks" ask a "what do you want to
// eat, Pizza/Burgers/..." question that had nothing to do with the request.
const FOOD_WORDS   = /\b(dinner|lunch|brunch|breakfast|eat|food|restaurant|pizza|burgers?|sushi|tacos?|wings|bbq|ice ?cream|gelato|froyo|frozen yogurt|donuts?|bagels?|dessert|cupcakes?|boba|bubble tea|ramen|pho|dim ?sum|thai|indian|chinese|korean food|mediterranean|greek food|seafood|steak|pasta|noodles?|sandwiches?|salads?|smoothies?)\b/i;
// The group's food question only offers a fixed list (Pizza, Burgers, ...)
// that plainly doesn't include everything someone might type — "ice cream"
// used to just vanish, and with no one able to vote for it the search
// fell through to a generic "things to do" query that ignored what was
// actually asked for. This captures the specific term straight out of the
// person's own words so it can be searched directly, with the group's vote
// only overriding it if they explicitly pick something else.
const SPECIFIC_FOOD_TERMS = [
  'ice cream', 'icecream', 'gelato', 'froyo', 'frozen yogurt', 'donuts', 'donut', 'bagels', 'bagel',
  'dessert', 'cupcakes', 'cupcake', 'boba', 'bubble tea', 'ramen', 'pho', 'dim sum', 'thai food', 'thai',
  'indian food', 'chinese food', 'korean food', 'mediterranean', 'greek food', 'seafood', 'steak',
  'pasta', 'noodles', 'sandwiches', 'salads', 'smoothies', 'pizza', 'burgers', 'burger', 'sushi',
  'tacos', 'wings', 'bbq', 'brunch', 'breakfast', 'coffee',
];
function specificFoodTerm(lower) {
  for (const term of SPECIFIC_FOOD_TERMS) {
    if (new RegExp(`\\b${term.replace(/ /g, '\\s?')}\\b`, 'i').test(lower)) return term.replace('icecream', 'ice cream');
  }
  return null;
}
const NIGHT_WORDS  = /\b(bar|bars|club|clubbing|nightlife|party|night out|drinks?)\b/i;
const RIGHT_NOW_WORDS = /\b(right now|rn|asap|immediately)\b/i;
const OUTDOOR_WORDS= /\b(beach|hike|hiking|park|outdoors?|trail|lake|camping|picnic|sunset)\b/i;
const EVENT_WORDS  = /\b(concert|show|game|festival|comedy|tickets?|match)\b/i;
const TRIP_WORDS   = /\b(trip|weekend away|vacation|flight|hotel|airbnb|road ?trip)\b/i;
const FREE_WORDS   = /\b(free|no money|broke|\$0|cheap as possible)\b/i;
const CHEAP_WORDS  = /\b(cheap|budget|affordable|inexpensive)\b/i;

function parse(text) {
  const t = String(text || '').trim();
  const lower = t.toLowerCase();
  const intent = {
    raw: t,
    title: null, groupSize: null, dayHint: null, timeOfDay: null,
    needsFood: false, multiStop: false, categories: [],
    budgetSignal: null, confidence: 0, source: 'parser', rightNow: false, foodTerm: null,
  };
  if (!t) return intent;

  let signals = 0;

  // "pizza rn" means the plan should only suggest places open at this exact
  // moment — a place that opens at 11am is worthless to someone asking for
  // it at 1:59am, however good a match it is on cuisine.
  if (RIGHT_NOW_WORDS.test(lower)) { intent.rightNow = true; intent.dayHint = intent.dayHint || 'today'; signals++; }

  // Group size: "7 of us", "me and 4 friends", "6 people"
  const m1 = lower.match(/(\d{1,2})\s*(?:of us|people|friends|guys|girls)/);
  const m2 = lower.match(/me and (\d{1,2})/);
  const m3 = lower.match(/\b(?:group of|party of)\s*(\d{1,2})/);
  // "me and 4 friends" is 5, and must be tested BEFORE the bare "N friends"
  // pattern, which would otherwise read the same phrase as 4.
  if (m2) { intent.groupSize = +m2[1] + 1; signals++; }
  else if (m1) { intent.groupSize = +m1[1]; signals++; }
  else if (m3) { intent.groupSize = +m3[1]; signals++; }
  else if (/\bmy (girlfriend|boyfriend|partner|wife|husband)\b/.test(lower)) { intent.groupSize = 2; signals++; }

  for (const d of DAYS) if (lower.includes(d)) { intent.dayHint = d; signals++; break; }
  if (/\btonight\b/.test(lower))        { intent.dayHint = 'today';    intent.timeOfDay = 'Evening'; signals++; }
  else if (/\btomorrow\b/.test(lower))  { intent.dayHint = 'tomorrow'; signals++; }
  else if (/\bthis weekend\b/.test(lower)) { intent.dayHint = 'weekend'; signals++; }
  if (/\bmorning\b/.test(lower))   intent.timeOfDay = 'Morning';
  if (/\bafternoon\b/.test(lower)) intent.timeOfDay = 'Afternoon';
  if (/\blate night\b/.test(lower)) intent.timeOfDay = 'Late night';

  if (FOOD_WORDS.test(lower))    {
    intent.needsFood = true; intent.categories.push('food'); signals++;
    intent.foodTerm = specificFoodTerm(lower);
  }
  // A named meal is a time signal, not just a food signal — "dinner Saturday"
  // should never be scheduled for 10am because the group happened to vote
  // "Morning" on a question it should not have been asked.
  if (/\bdinner\b/.test(lower))         intent.timeOfDay = intent.timeOfDay || 'Evening';
  else if (/\blunch\b/.test(lower))     intent.timeOfDay = intent.timeOfDay || 'Afternoon';
  else if (/\b(breakfast|brunch)\b/.test(lower)) intent.timeOfDay = intent.timeOfDay || 'Morning';
  if (NIGHT_WORDS.test(lower))   { intent.categories.push('nightlife'); signals++; }
  if (OUTDOOR_WORDS.test(lower)) { intent.categories.push('outdoors'); signals++; }
  if (EVENT_WORDS.test(lower))   { intent.categories.push('event'); signals++; }
  if (TRIP_WORDS.test(lower))    { intent.categories.push('trip'); intent.multiStop = true; signals++; }

  if (FREE_WORDS.test(lower))       { intent.budgetSignal = 'free'; signals++; }
  else if (CHEAP_WORDS.test(lower)) { intent.budgetSignal = 'cheap'; signals++; }
  const money = lower.match(/\$(\d{1,4})/);
  if (money) { intent.budgetSignal = `under_${money[1]}`; signals++; }

  intent.multiStop = intent.multiStop || intent.categories.length >= 2;
  intent.title = titleFor(t, intent);
  intent.confidence = Math.min(1, signals / 4);
  return intent;
}

/**
 * A short headline for the plan. The full idea is shown separately, so this
 * should read like a label ("Saturday dinner"), not repeat the sentence.
 */
function titleFor(text, intent) {
  const day = intent.dayHint && intent.dayHint !== 'today' && intent.dayHint !== 'tomorrow'
    ? intent.dayHint.charAt(0).toUpperCase() + intent.dayHint.slice(1)
    : intent.dayHint === 'today' ? 'Tonight'
    : intent.dayHint === 'tomorrow' ? 'Tomorrow' : null;

  // "ice cream" naming itself as "Dinner" is confusing — a specific named
  // food (ice cream, sushi, tacos, ...) is a better label than the generic
  // meal-kind fallback whenever it's exactly what the person asked for.
  const KIND = { food: intent.foodTerm || 'dinner', nightlife: 'night out', outdoors: 'day out', event: 'event', trip: 'trip' };
  const kind = intent.categories.map(c => KIND[c]).find(Boolean);

  if (day && kind) return `${day} ${kind}`;
  if (kind) return kind.charAt(0).toUpperCase() + kind.slice(1);
  if (day) return `${day} plans`;

  const clean = text.replace(/\s+/g, ' ').trim();
  const short = clean.length <= 32 ? clean : clean.slice(0, 30).replace(/\s\S*$/, '') + '…';
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/**
 * Parse, then optionally enrich with the model — but only if the parser is
 * unsure, AI is enabled and under budget. Enrichment is cached for 14 days
 * keyed on the text, so the same phrasing is never paid for twice.
 */
async function extract(text, { planId } = {}) {
  const base = parse(text);
  if (base.confidence >= 0.5 || !ai.enabled()) return base;

  const key = `cache:ai:intent:${hash(text).slice(0, 24)}`;
  const hit = await store.get(key);
  if (hit?.v) return { ...base, ...hit.v, source: 'parser+ai(cached)' };

  const r = await ai.askJson({
    planId, tier: 'cheap', maxTokens: 300,
    system: 'You extract structured planning intent. You never invent venues, addresses, prices or dates. '
      + 'Only fill fields you can infer from the text itself. Use null when unsure.',
    prompt: `Extract intent from this group planning request.\n\nText: ${JSON.stringify(text)}\n\n`
      + `Return keys: groupSize (int|null), dayHint (string|null), timeOfDay `
      + `("Morning"|"Afternoon"|"Evening"|"Late night"|null), needsFood (bool), `
      + `categories (array from: food, nightlife, outdoors, event, trip, activity), `
      + `budgetSignal ("free"|"cheap"|"under_N"|null), title (short, max 6 words).`,
  });
  if (!r.ok) return base;

  const d = r.data || {};
  const merged = { ...base, source: 'parser+ai' };
  // The parser wins every field it actually read. AI only fills blanks.
  if (base.groupSize == null && Number.isInteger(d.groupSize)) merged.groupSize = d.groupSize;
  if (!base.dayHint && typeof d.dayHint === 'string') merged.dayHint = d.dayHint;
  if (!base.timeOfDay && typeof d.timeOfDay === 'string') merged.timeOfDay = d.timeOfDay;
  if (!base.needsFood && d.needsFood === true) merged.needsFood = true;
  if (!base.categories.length && Array.isArray(d.categories)) merged.categories = d.categories.slice(0, 4);
  if (!base.budgetSignal && typeof d.budgetSignal === 'string') merged.budgetSignal = d.budgetSignal;
  if (typeof d.title === 'string' && d.title.length <= 60) merged.title = d.title;
  merged.confidence = Math.max(base.confidence, 0.6);

  await store.set(key, { v: { ...merged, raw: undefined } }, cache.TTL.ai_intent);
  return merged;
}

export { parse, extract };
export default { parse, extract };