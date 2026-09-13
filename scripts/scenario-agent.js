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

// ── 50 hand-written scenarios: idea text, kind of expectation, and any
// specifics — kind: 'food' | 'outdoor' | 'nightlife' | 'trip' | 'activity'
const SCENARIOS_HANDWRITTEN = [
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

// ── 250 more, generated from real phrasing patterns rather than hand-typed
// one at a time — each still carries an exact, checkable expectation, and
// each gets a persona purely for the report (this is what a specific kind
// of person, in their own voice, would actually type). The generator
// exists so 300 stays a real, maintained regression corpus instead of a
// one-time wall of text — add a term or a builder and the count grows on
// its own with the same rigor as every hand-written scenario above.
const PERSONAS = [
  'Broke college student', 'Hangry friend', 'Excited planner', 'Chill weekend warrior',
  'Practical parent', 'Spontaneous night owl', 'Budget-conscious grad student',
  'Big group organizer', 'Solo adventurer', 'Indecisive roommate', 'Overworked professional',
  'First date planner', 'Visiting-town tourist', 'Post-gym friend group', 'Last-minute planner',
];
let personaCounter = 0;
const nextPersona = () => PERSONAS[personaCounter++ % PERSONAS.length];

function expand(terms, builders, kindFor) {
  const out = [];
  for (const term of terms) {
    for (const build of builders) {
      const { idea, extra } = build(term);
      out.push({ idea, kind: kindFor(term), persona: nextPersona(), ...extra });
    }
  }
  return out;
}

// Specific, named foods — every one must survive into the actual search
// query (or an honest catalog vote), never collapse into "restaurant".
const FOOD_TERMS = ['ice cream', 'sushi', 'tacos', 'ramen', 'bagels', 'bbq', 'boba',
  'pho', 'dessert', 'korean food', 'pizza', 'wings'];
const FOOD_BUILDERS = [
  (t) => ({ idea: `${t} tonight`, extra: { foodTerm: t, dayHint: 'today' } }),
  (t) => ({ idea: `${t} tomorrow`, extra: { foodTerm: t, dayHint: 'tomorrow' } }),
  (t) => ({ idea: `${t} this weekend for the group`, extra: { foodTerm: t, dayHint: 'weekend' } }),
  (t) => ({ idea: `cheap ${t}, we're broke`, extra: { foodTerm: t, budgetSignal: 'cheap' } }),
  (t) => ({ idea: `${t} for 6 people`, extra: { foodTerm: t, groupSize: 6 } }),
  (t) => ({ idea: `me and 3 friends want ${t}`, extra: { foodTerm: t, groupSize: 4 } }),
  (t) => ({ idea: `${t} asap im starving`, extra: { foodTerm: t, rightNow: true } }),
  (t) => ({ idea: `craving ${t}, any spots open rn`, extra: { foodTerm: t, rightNow: true } }),
  (t) => ({ idea: `${t} under $20`, extra: { foodTerm: t, money: 20 } }),
  (t) => ({ idea: `${t} for a group of 9 this friday`, extra: { foodTerm: t, groupSize: 9, dayHint: 'friday' } }),
];
const FOOD_SCENARIOS = expand(FOOD_TERMS, FOOD_BUILDERS, () => 'food');

// Hungry/vague food asks with no named cuisine — a generic query IS the
// honest answer here, unlike the scenarios above.
const HUNGRY_SCENARIOS = [
  { idea: 'hungry what\'s close and open rn', kind: 'food', rightNow: true },
  { idea: 'starving, need food asap', kind: 'food', rightNow: true },
  { idea: 'im so hungry rn nothing specific just food', kind: 'food', rightNow: true },
  { idea: 'need to eat something before this afternoon', kind: 'food', dayHint: null },
  { idea: 'grab a bite to eat tonight?', kind: 'food', dayHint: 'today' },
  { idea: 'famished, what\'s around', kind: 'food' },
  { idea: 'anyone hungry, need food for 5 of us', kind: 'food', groupSize: 5 },
  { idea: 'hungry and broke, cheap food only', kind: 'food', budgetSignal: 'cheap' },
  { idea: 'we need dinner tonight, nothing specific', kind: 'food', dayHint: 'today' },
  { idea: 'lunch spot for 4, don\'t care what kind', kind: 'food', groupSize: 4 },
].map(s => ({ ...s, persona: nextPersona() }));

// Outdoor activities — same rule as food: the specific thing named has to
// survive into the actual search, not get flattened into a generic "park".
const OUTDOOR_TERMS = ['fishing', 'hiking', 'kayaking', 'camping', 'a picnic', 'the beach', 'swimming'];
const OUTDOOR_BUILDERS = [
  (t) => ({ idea: `I wanna go ${t.startsWith('the') || t.startsWith('a ') ? t.replace(/^(the|a) /, '') : t} today`, extra: { dayHint: 'today' } }),
  (t) => ({ idea: `${t} this saturday with the crew`, extra: { dayHint: 'saturday' } }),
  (t) => ({ idea: `let's do ${t} tomorrow`, extra: { dayHint: 'tomorrow' } }),
  (t) => ({ idea: `${t} this weekend for 6 of us`, extra: { dayHint: 'weekend', groupSize: 6 } }),
  (t) => ({ idea: `free ${t} spot, no money this week`, extra: { budgetSignal: 'free' } }),
  (t) => ({ idea: `bored, thinking ${t} today?`, extra: { dayHint: 'today' } }),
];
const OUTDOOR_SCENARIOS = expand(OUTDOOR_TERMS, OUTDOOR_BUILDERS, () => 'outdoor');

const NIGHTLIFE_TERMS = ['drinks', 'a bar', 'clubbing', 'a night out'];
const NIGHTLIFE_BUILDERS = [
  (t) => ({ idea: `${t} tonight, who's in`, extra: { dayHint: 'today' } }),
  (t) => ({ idea: `${t} this friday`, extra: { dayHint: 'friday' } }),
  (t) => ({ idea: `${t} for my birthday, 8 of us`, extra: { groupSize: 8 } }),
  (t) => ({ idea: `cheap ${t}, tight on cash`, extra: { budgetSignal: 'cheap' } }),
  (t) => ({ idea: `${t} right now, bored at home`, extra: { rightNow: true } }),
];
const NIGHTLIFE_SCENARIOS = expand(NIGHTLIFE_TERMS, NIGHTLIFE_BUILDERS, () => 'nightlife');

const EVENT_TERMS = ['concert', 'a comedy show', 'the game', 'a festival', 'a show'];
const EVENT_BUILDERS = [
  (t) => ({ idea: `${t} tonight what's the move`, extra: { dayHint: 'today' } }),
  (t) => ({ idea: `${t} this weekend, anyone down`, extra: { dayHint: 'weekend' } }),
  (t) => ({ idea: `thinking about ${t} tomorrow`, extra: { dayHint: 'tomorrow' } }),
  (t) => ({ idea: `${t} for 4 of us this saturday`, extra: { dayHint: 'saturday', groupSize: 4 } }),
  (t) => ({ idea: `${t} tickets, what's the plan`, extra: {} }),
];
const EVENT_SCENARIOS = expand(EVENT_TERMS, EVENT_BUILDERS, () => 'event');

const TRIP_TERMS = ['a weekend trip', 'a road trip', 'a getaway', 'a trip somewhere'];
const TRIP_BUILDERS = [
  (t) => ({ idea: `${t} next week`, extra: { dayHint: 'next week' } }),
  (t) => ({ idea: `${t} for 4 of us this weekend`, extra: { dayHint: 'weekend', groupSize: 4 } }),
  (t) => ({ idea: `planning ${t}, need ideas`, extra: {} }),
  (t) => ({ idea: `cheap ${t}, we're all broke`, extra: { budgetSignal: 'cheap' } }),
];
const TRIP_SCENARIOS = expand(TRIP_TERMS, TRIP_BUILDERS, () => 'trip');

const ACTIVITY_TERMS = ['bowling', 'mini golf', 'karaoke', 'an escape room'];
const ACTIVITY_BUILDERS = [
  (t) => ({ idea: `${t} tonight`, extra: { dayHint: 'today' } }),
  (t) => ({ idea: `${t} this weekend for the group`, extra: { dayHint: 'weekend' } }),
  (t) => ({ idea: `${t} with 9 of us`, extra: { groupSize: 9 } }),
  (t) => ({ idea: `cheap ${t}, low on funds`, extra: { budgetSignal: 'cheap' } }),
  (t) => ({ idea: `${t} right now, bored out of my mind`, extra: { rightNow: true } }),
];
const ACTIVITY_SCENARIOS = expand(ACTIVITY_TERMS, ACTIVITY_BUILDERS, () => 'activity');

// Genuinely open-ended — no category signal at all. The honest outcome is
// the generic "things to do" fallback, not a crash and not a made-up
// category the person never actually named.
const OPENENDED_SCENARIOS = [
  { idea: 'friends and I need a good plan we are bored', kind: 'openended' },
  { idea: 'nothing to do tonight, help', kind: 'openended', dayHint: 'today' },
  { idea: 'nothing planned this weekend, need ideas', kind: 'openended', dayHint: 'weekend' },
  { idea: 'we are so bored someone save us', kind: 'openended' },
  { idea: 'need something to do, anything really', kind: 'openended' },
  { idea: 'group of us just want to do SOMETHING today', kind: 'openended', dayHint: 'today', groupSize: null },
  { idea: 'im free tonight, surprise me', kind: 'openended', dayHint: 'today' },
  { idea: 'no plans this weekend, whatever works', kind: 'openended', dayHint: 'weekend' },
  { idea: 'bored bored bored, someone give me an idea', kind: 'openended' },
  { idea: 'need a plan, open to anything, 5 of us', kind: 'openended', groupSize: 5 },
  { idea: 'what should we do tonight', kind: 'openended', dayHint: 'today' },
  { idea: 'help me plan something fun this weekend', kind: 'openended', dayHint: 'weekend' },
  { idea: 'stuck inside, need an idea asap', kind: 'openended', rightNow: true },
  { idea: 'anything to do around here right now', kind: 'openended', rightNow: true },
  { idea: 'give me literally any idea for tonight', kind: 'openended', dayHint: 'today' },
].map(s => ({ ...s, persona: nextPersona() }));

const SCENARIOS = [
  ...SCENARIOS_HANDWRITTEN.map(s => ({ ...s, persona: nextPersona() })),
  ...FOOD_SCENARIOS, ...HUNGRY_SCENARIOS, ...OUTDOOR_SCENARIOS,
  ...NIGHTLIFE_SCENARIOS, ...EVENT_SCENARIOS, ...TRIP_SCENARIOS,
  ...ACTIVITY_SCENARIOS, ...OPENENDED_SCENARIOS,
];

let pass = 0, fail = 0;
const failures = [];

function record(scenario, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push({ idea: scenario.idea, city: scenario.city, persona: scenario.persona, detail });
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
  //    trip/event), not silently collapse into a generic catch-all — the
  //    same class of bug as the food fallback, just for other request types.
  if (scenario.kind === 'outdoor') {
    if (!parsed.categories.includes('outdoors')) {
      record(scenario, false, 'outdoor request not recognized as outdoors category');
      return;
    }
    // Same rigor as food: a specific outdoor activity named in the idea
    // must survive into the actual search query, not fall back to the
    // generic "park" default that ignores what was actually asked for.
    if (parsed.outdoorTerm) {
      const terms = plan.searchTerms(consensus.build(p));
      const actSlot = terms.find(t => t.slot === 'activity');
      const genericFallback = actSlot?.query === 'park' || actSlot?.query === 'free park scenic overlook';
      if (!actSlot || genericFallback) {
        record(scenario, false, `named a specific outdoor activity but search query became "${actSlot?.query}"`);
        return;
      }
    }
  }
  if (scenario.kind === 'nightlife' && !parsed.categories.includes('nightlife')) {
    record(scenario, false, 'nightlife request not recognized as nightlife category');
    return;
  }
  if (scenario.kind === 'trip' && !(parsed.categories.includes('trip') || parsed.multiStop)) {
    record(scenario, false, 'trip request not recognized as a trip');
    return;
  }
  if (scenario.kind === 'event' && !parsed.categories.includes('event')) {
    record(scenario, false, 'event request not recognized as an event category');
    return;
  }
  // Open-ended asks ("we're bored") have no category signal by design —
  // the only real requirement is that the engine doesn't crash and still
  // produces at least one usable search term (the honest generic
  // fallback), not that it invents a category nobody actually named.
  if (scenario.kind === 'openended') {
    const terms = plan.searchTerms(consensus.build(p));
    if (!terms.length) {
      record(scenario, false, 'open-ended request produced no search term at all');
      return;
    }
    if (!parsed.title) {
      record(scenario, false, 'open-ended request produced no plan title');
      return;
    }
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
  console.log(`  ✗ [${f.persona} · ${f.city}] "${f.idea}"\n      ${f.detail}`);
}
console.log(`\n${pass} passed, ${fail} failed (of ${SCENARIOS.length})\n`);
process.exit(fail ? 1 : 0);
