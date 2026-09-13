'use strict';
/**
 * SCENARIO AGENT — a self-healing regression harness over real user
 * questions, not synthetic unit inputs.
 *
 * Why this exists: the ice-cream bug ("I said ice cream and it gave me a
 * random place") and the creator-availability bug ("keeps asking if I'm in
 * on my own idea") were both found by hand, one report at a time. This
 * script automates that discovery loop — it runs the SAME deterministic
 * pipeline a real plan uses (intent.parse → consensus.build → the adaptive
 * question sequence → plan.searchTerms) against 50 realistic questions
 * spread across real US locations, and fails loudly the moment an outcome
 * would be wrong in exactly the way a real person would notice.
 *
 * Deliberately zero cost: it never calls Google Places, Ticketmaster, or an
 * AI model. Those services are metered (see lib/cost.js) against a shared
 * daily budget that real users draw from — spending it on a test run would
 * be its own bug. Every assertion here is checkable from the deterministic
 * layer alone: what would be SEARCHED FOR, not what a live API returns.
 * (scripts/e2e.js already covers the live-HTTP contract end to end.)
 *
 * Run: node scripts/scenario-agent.js
 * Exit code is non-zero if anything failed, so it can gate CI later.
 */
const intent = require('../engine/intent');
const consensus = require('../engine/consensus');
const questions = require('../engine/questions');
const plan = require('../engine/plan');
const { CATEGORIES } = require('../engine/catalog');

// ── 20 real US locations, spread coast to coast, north to south ─────────
const CITIES = [
  { label: 'New York, NY', lat: 40.7128, lon: -74.0060 },
  { label: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437 },
  { label: 'Chicago, IL', lat: 41.8781, lon: -87.6298 },
  { label: 'Houston, TX', lat: 29.7604, lon: -95.3698 },
  { label: 'Phoenix, AZ', lat: 33.4484, lon: -112.0740 },
  { label: 'Philadelphia, PA', lat: 39.9526, lon: -75.1652 },
  { label: 'San Antonio, TX', lat: 29.4241, lon: -98.4936 },
  { label: 'San Diego, CA', lat: 32.7157, lon: -117.1611 },
  { label: 'Dallas, TX', lat: 32.7767, lon: -96.7970 },
  { label: 'Austin, TX', lat: 30.2672, lon: -97.7431 },
  { label: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  { label: 'Denver, CO', lat: 39.7392, lon: -104.9903 },
  { label: 'Boston, MA', lat: 42.3601, lon: -71.0589 },
  { label: 'Nashville, TN', lat: 36.1627, lon: -86.7816 },
  { label: 'Portland, OR', lat: 45.5152, lon: -122.6784 },
  { label: 'Atlanta, GA', lat: 33.7490, lon: -84.3880 },
  { label: 'Las Vegas, NV', lat: 36.1699, lon: -115.1398 },
  { label: 'Minneapolis, MN', lat: 44.9778, lon: -93.2650 },
  { label: 'New Orleans, LA', lat: 29.9511, lon: -90.0715 },
  { label: 'Miami, FL', lat: 25.7617, lon: -80.1918 },
];

// Maps a specific food term onto the fixed food-question option a real
// person would honestly pick, when one fits — everything else is an honest
// "Something else" (ice cream, ramen, bagels, etc. simply aren't on the
// fixed list, and a real person would pick that, not silently mis-click
// "Pizza" for a bowl of ramen).
const FOOD_TERM_TO_CATALOG_PICK = {
  pizza: 'Pizza', burgers: 'Burgers', burger: 'Burgers', sushi: 'Sushi', wings: 'Wings', bbq: 'BBQ',
  pasta: 'Italian', tacos: 'Mexican', breakfast: 'Breakfast', brunch: 'Breakfast',
  ramen: 'Asian', pho: 'Asian', 'dim sum': 'Asian', thai: 'Asian', 'thai food': 'Asian',
  'chinese food': 'Asian', 'korean food': 'Asian',
};

// ── 50 scenarios: idea text, kind of expectation, and any specifics ─────
// kind: 'food' | 'outdoor' | 'nightlife' | 'trip' | 'activity'
const SCENARIOS = [
  { idea: 'ice cream', kind: 'food', foodTerm: 'ice cream' },
  { idea: 'sushi tonight', kind: 'food', foodTerm: 'sushi', dayHint: 'today' },
  { idea: '7 of us want pizza this Saturday', kind: 'food', foodTerm: 'pizza', dayHint: 'saturday', groupSize: 7 },
  { idea: 'me and 4 friends want tacos', kind: 'food', foodTerm: 'tacos', groupSize: 5 },
  { idea: 'cheap ramen for lunch', kind: 'food', foodTerm: 'ramen', budgetSignal: 'cheap' },
  { idea: 'bagels tomorrow morning', kind: 'food', foodTerm: 'bagels', dayHint: 'tomorrow' },
  { idea: 'bbq this weekend for group of 10', kind: 'food', foodTerm: 'bbq', dayHint: 'weekend', groupSize: 10 },
  { idea: 'vegan food for dinner', kind: 'food', foodTerm: null, dietary: 'Vegan' },
  { idea: 'gluten free breakfast', kind: 'food', foodTerm: 'breakfast', dietary: 'Gluten-free' },
  { idea: 'halal food for 6 people', kind: 'food', foodTerm: null, dietary: 'Halal', groupSize: 6 },
  { idea: 'seafood dinner under $50', kind: 'food', foodTerm: 'seafood', money: 50 },
  { idea: 'steak night', kind: 'food', foodTerm: 'steak' },
  { idea: 'sandwiches for lunch', kind: 'food', foodTerm: 'sandwiches' },
  { idea: 'korean food tonight', kind: 'food', foodTerm: 'korean food', dayHint: 'today' },
  { idea: 'indian food this friday', kind: 'food', foodTerm: null, dayHint: 'friday' },
  { idea: 'brunch this sunday', kind: 'food', foodTerm: 'brunch', dayHint: 'sunday' },
  { idea: 'coffee and pastries', kind: 'food', foodTerm: 'coffee' },
  { idea: 'dessert after dinner', kind: 'food', foodTerm: 'dessert' },
  { idea: 'boba with friends', kind: 'food', foodTerm: 'boba' },
  { idea: 'gelato right now', kind: 'food', foodTerm: 'gelato', rightNow: true },
  { idea: 'donuts tomorrow', kind: 'food', foodTerm: 'donuts', dayHint: 'tomorrow' },
  { idea: 'frozen yogurt this afternoon', kind: 'food', foodTerm: 'frozen yogurt' },
  { idea: 'cupcakes for a birthday', kind: 'food', foodTerm: 'cupcakes' },
  { idea: 'thai food for the group', kind: 'food', foodTerm: 'thai' },
  { idea: 'pho tonight', kind: 'food', foodTerm: 'pho', dayHint: 'today' },
  { idea: 'wings and a game', kind: 'food', foodTerm: 'wings' },
  { idea: 'italian food this saturday for 8', kind: 'food', foodTerm: null, dayHint: 'saturday', groupSize: 8 },
  { idea: 'burgers asap', kind: 'food', foodTerm: 'burgers', rightNow: true },
  { idea: 'noodles for dinner', kind: 'food', foodTerm: 'noodles' },
  { idea: 'smoothies after the gym', kind: 'food', foodTerm: 'smoothies' },
  { idea: 'free eats, we are broke', kind: 'food', foodTerm: null, budgetSignal: 'free' },
  { idea: 'dinner under $25', kind: 'food', foodTerm: null, money: 25 },
  { idea: 'pizza for me and my girlfriend', kind: 'food', foodTerm: 'pizza', groupSize: 2 },
  { idea: 'breakfast tacos tomorrow', kind: 'food', foodTerm: 'tacos', dayHint: 'tomorrow' },
  { idea: 'salads for a light lunch', kind: 'food', foodTerm: 'salads' },

  { idea: 'hike this saturday', kind: 'outdoor', dayHint: 'saturday' },
  { idea: 'beach day tomorrow', kind: 'outdoor', dayHint: 'tomorrow' },
  { idea: 'a picnic in the park this weekend', kind: 'outdoor', dayHint: 'weekend' },
  { idea: 'sunset at the lake', kind: 'outdoor' },
  // "camping" is an OUTDOOR_WORDS match, not TRIP_WORDS, in this app's own
  // taxonomy (a day trip to go camping is still "outdoors", not "trip" —
  // trip specifically means multi-day/away, per TRIP_WORDS).
  { idea: 'camping this weekend with 5 friends', kind: 'outdoor', dayHint: 'weekend', groupSize: 5 },
  { idea: 'go clubbing tonight', kind: 'nightlife', dayHint: 'today' },
  { idea: 'drinks after work', kind: 'nightlife' },
  { idea: 'a bar crawl this friday', kind: 'nightlife', dayHint: 'friday' },
  { idea: 'a weekend trip for 4 of us', kind: 'trip', groupSize: 4 },
  { idea: 'a road trip next week', kind: 'trip', dayHint: 'next week' },
  { idea: 'bowling tonight', kind: 'activity', dayHint: 'today' },
  { idea: 'mini golf this afternoon', kind: 'activity' },
  { idea: 'karaoke with the group of 9', kind: 'activity', groupSize: 9 },
  { idea: 'something to do right now, bored', kind: 'activity', rightNow: true },
  { idea: 'a free thing to do this weekend, no money', kind: 'activity', dayHint: 'weekend', budgetSignal: 'free' },
];

let pass = 0, fail = 0;
const failures = [];

function record(scenario, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push({ idea: scenario.idea, city: scenario.city, detail });
}

function pickFoodCatalogAnswer(parsed) {
  const term = parsed.foodTerm;
  if (term && FOOD_TERM_TO_CATALOG_PICK[term]) return FOOD_TERM_TO_CATALOG_PICK[term];
  return 'Something else';
}

function runScenario(scenario, city) {
  scenario.city = city.label;
  const parsed = intent.parse(scenario.idea);

  // Build a plan exactly the way the real app does post-fix: the creator's
  // own idea already answers "are you in?"
  const p = {
    id: 'test', intent: parsed, title: parsed.title,
    origin: { lat: city.lat, lon: city.lon, label: city.label },
    participants: [{ id: 'creator', name: 'Tester', answers: { availability: "I'm in" }, isCreator: true }],
    createdAt: new Date().toISOString(),
  };
  const creator = p.participants[0];

  // 1) The creator must never be asked "are you in?" on their own idea.
  const first = questions.next(p, creator);
  if (!first.done && first.question.id === 'availability') {
    record(scenario, false, 'creator was asked "Are you in?" on their own idea');
    return;
  }

  // 2) Walk the adaptive sequence to completion, answering the way a real
  //    person asking exactly this question would — this is what actually
  //    populates state.soft.food / dietary / budget for the assertions below.
  for (let step = 0; step < 12; step++) {
    const q = questions.next(p, creator);
    if (q.done) break;
    const id = q.question.id;
    let value;
    if (id === 'food') value = [pickFoodCatalogAnswer(parsed)];
    else if (id === 'dietary') value = scenario.dietary ? [scenario.dietary] : ['No restrictions'];
    else if (id === 'budget') {
      value = scenario.budgetSignal === 'free' ? '$0 — free only'
        : scenario.money != null ? (CATEGORIES.budget.find(o => o.includes(String(scenario.money))) || 'Under $50')
        : scenario.budgetSignal === 'cheap' ? 'Under $25'
        : 'Under $50';
    }
    else if (id === 'day') value = 'Today';
    else if (Array.isArray(q.question.options)) value = q.question.options[0];
    else value = q.question.options(consensus.build(p))[0];
    creator.answers[id] = value;
  }

  const state = consensus.build(p);

  // 3) Group-size assertion: what was literally stated in the sentence
  //    must survive parsing exactly.
  if (scenario.groupSize != null && parsed.groupSize !== scenario.groupSize) {
    record(scenario, false, `groupSize parsed as ${parsed.groupSize}, expected ${scenario.groupSize}`);
    return;
  }

  // 4) Right-now assertion.
  if (scenario.rightNow && !parsed.rightNow) {
    record(scenario, false, 'rightNow words present but parsed.rightNow is false');
    return;
  }

  // 5) Day-hint assertion: a named day must actually be captured, not
  //    silently vanish (the exact class of bug that made events schedule
  //    for the wrong day earlier this project) — and must resolve to a
  //    real date through the same resolver consensus.build() uses.
  if (scenario.dayHint) {
    if (!parsed.dayHint) {
      record(scenario, false, `expected a day hint ("${scenario.dayHint}") but parser found none`);
      return;
    }
    if (!state.hard.date) {
      record(scenario, false, `dayHint "${parsed.dayHint}" was parsed but never resolved to a real date`);
      return;
    }
  }

  // 6) The core bug class: for food scenarios, whatever ends up in the
  //    actual Places search query must reflect what was asked for, not a
  //    generic fallback that ignores it.
  if (scenario.kind === 'food') {
    if (!parsed.needsFood) {
      record(scenario, false, 'needsFood is false for a food request — question flow never even offers cuisine');
      return;
    }
    const terms = plan.searchTerms(state);
    const foodSlot = terms.find(t => t.slot === 'food');
    if (!foodSlot) {
      record(scenario, false, 'no food search term generated at all');
      return;
    }
    if (scenario.foodTerm) {
      const q = foodSlot.query.toLowerCase();
      const catalogPick = pickFoodCatalogAnswer(parsed);
      // Acceptable outcomes: the query names the specific food, OR the
      // group's real catalog vote (e.g. explicitly picking "Pizza") wins —
      // both are honest. What's NOT acceptable is a bare, generic fallback
      // that drops the request entirely.
      const generic = q === 'restaurant' || q === 'cheap eats';
      const matches = q.includes(scenario.foodTerm) || (catalogPick !== 'Something else' && q.includes(catalogPick.toLowerCase()));
      if (generic || !matches) {
        record(scenario, false, `asked for "${scenario.foodTerm}" but search query became "${foodSlot.query}"`);
        return;
      }
    }
  }

  // 7) Non-food categories must actually be recognized (outdoors/nightlife/
  //    trip), not silently collapse into a generic catch-all — the same
  //    class of bug as the food fallback, just for other request types.
  if (scenario.kind === 'outdoor' && !parsed.categories.includes('outdoors')) {
    record(scenario, false, 'outdoor request not recognized as outdoors category');
    return;
  }
  if (scenario.kind === 'nightlife' && !parsed.categories.includes('nightlife')) {
    record(scenario, false, 'nightlife request not recognized as nightlife category');
    return;
  }
  if (scenario.kind === 'trip' && !(parsed.categories.includes('trip') || parsed.multiStop)) {
    record(scenario, false, 'trip request not recognized as a trip');
    return;
  }

  // 8) Dietary constraint must survive into the hard-constraint set.
  if (scenario.dietary && !state.hard.dietary.includes(scenario.dietary)) {
    record(scenario, false, `dietary constraint "${scenario.dietary}" did not survive into group state`);
    return;
  }

  record(scenario, true);
}

console.log(`\nSCENARIO AGENT — ${SCENARIOS.length} real questions across ${CITIES.length} US cities\n`);
SCENARIOS.forEach((scenario, i) => {
  const city = CITIES[i % CITIES.length];
  runScenario(scenario, city);
});

for (const f of failures) {
  console.log(`  ✗ [${f.city}] "${f.idea}"\n      ${f.detail}`);
}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
