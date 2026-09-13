'use strict';
/**
 * Planzo test suite. No framework — node scripts/test.js.
 * Covers the parts the spec calls mandatory: the decision engine's handling
 * of conflicting preferences, $0 budgets, the ticket state matrix, and the
 * simultaneous-scan race.
 */
require('../lib/env');
process.env.PLANZO_SECRET = process.env.PLANZO_SECRET || 'test-secret-'.repeat(4);

const assert = require('assert');
let pass = 0, fail = 0;
const results = [];
async function t(name, fn) {
  try { await fn(); pass++; results.push(`  ✓ ${name}`); }
  catch (e) { fail++; results.push(`  ✗ ${name}\n      ${e.message}`); }
}

const consensus = require('../engine/consensus');
const questions = require('../engine/questions');
const intent = require('../engine/intent');
const planEngine = require('../engine/plan');
const tickets = require('../engine/tickets');
const store = require('../lib/store');
const ids = require('../lib/ids');
const places = require('../services/places');

const mkPlan = (participants, over = {}) => ({
  id: 'test' + Math.random().toString(36).slice(2, 8),
  intent: { needsFood: true, categories: ['food'], title: 'Test' },
  participants: participants.map((a, i) => ({ id: 'p' + i, name: 'P' + i, answers: a })),
  ...over,
});

(async () => {
console.log('\nINTENT PARSING');
await t('reads group size from "7 of us"', () => {
  assert.strictEqual(intent.parse('7 of us want something cheap Saturday').groupSize, 7);
});
await t('reads "me and 4 friends" as 5', () => {
  assert.strictEqual(intent.parse('me and 4 friends want to go to the beach').groupSize, 5);
});
await t('flags a $0 budget from "free"', () => {
  assert.strictEqual(intent.parse('find us something free tonight').budgetSignal, 'free');
});
await t('detects food intent and evening timing from "dinner tonight"', () => {
  const i = intent.parse('dinner tonight');
  assert.ok(i.needsFood); assert.strictEqual(i.timeOfDay, 'Evening');
});
await t('treats "my girlfriend" as a group of 2', () => {
  assert.strictEqual(intent.parse('what should me and my girlfriend do tonight').groupSize, 2);
});
await t('"pizza rn" is flagged rightNow, so closed places get excluded not just deprioritized', () => {
  const i = intent.parse('I want pizza rn');
  assert.strictEqual(i.rightNow, true);
  assert.strictEqual(i.dayHint, 'today');
});
await t('"asap" and "immediately" are also right-now signals', () => {
  assert.strictEqual(intent.parse('need a table asap').rightNow, true);
  assert.strictEqual(intent.parse('get there immediately').rightNow, true);
});
await t('the literal word "today" sets a day hint on its own, not just "tonight"', () => {
  // Regression: only "tonight" ever set dayHint — "I wanna go fishing
  // today" silently lost its date and fell through to asking the day
  // question despite the person having already answered it.
  assert.strictEqual(intent.parse('I wanna go fishing today').dayHint, 'today');
  assert.strictEqual(intent.parse('bowling today').dayHint, 'today');
});
await t('"getaway" is recognized as a trip, same as "road trip" or "vacation"', () => {
  const i = intent.parse('a weekend getaway next week');
  assert.ok(i.categories.includes('trip'));
});
await t('"hungry" and "starving" alone are food requests, not just named dishes', () => {
  // Regression: "hungry what's close and open rn" set needsFood: false,
  // so the food question never even got asked and the search ran a
  // generic "things to do" query for someone who explicitly said they
  // wanted food.
  assert.strictEqual(intent.parse("hungry what's close and open rn").needsFood, true);
  assert.strictEqual(intent.parse('starving, need food asap').needsFood, true);
});
await t('a specific outdoor activity survives into the actual search, not a generic "park"', () => {
  // Same bug class as food: "fishing today" got flagged as outdoors
  // correctly, but the search itself ran for the hardcoded word "park".
  const consensus = require('../engine/consensus');
  const p = intent.parse('I wanna go fishing today');
  assert.strictEqual(p.outdoorTerm, 'fishing spot');
  const state = consensus.build({ intent: p, participants: [{ id: 'a', answers: { availability: "I'm in" } }] });
  const terms = planEngine.searchTerms(state);
  const act = terms.find(t => t.slot === 'activity');
  assert.strictEqual(act.query, 'fishing spot');
});
await t('"let\'s go get drinks" is nightlife, not a sit-down meal', () => {
  const i = intent.parse("let's go get drinks tonight");
  assert.ok(i.categories.includes('nightlife'));
  assert.strictEqual(i.needsFood, false);
});
await t('"dinner and drinks" still detects food from "dinner" alone', () => {
  const i = intent.parse('dinner and drinks tonight');
  assert.ok(i.needsFood);
  assert.ok(i.categories.includes('nightlife'));
});

console.log('\nPLAN GENERATION — OPEN-NOW FILTERING');
await t('a closed place is excluded outright when the request was for right now', () => {
  const state = { hard: {}, intent: { rightNow: true } };
  assert.strictEqual(planEngine.fits({ openNow: false }, state), false);
  assert.strictEqual(planEngine.fits({ openNow: true }, state), true);
});
await t('a closed place is NOT excluded for a plan that has no "right now" urgency', () => {
  const state = { hard: {}, intent: { rightNow: false } };
  assert.strictEqual(planEngine.fits({ openNow: false }, state), true);
});
await t('unknown open-status (openNow undefined) is never excluded — only a confirmed "closed" is', () => {
  const state = { hard: {}, intent: { rightNow: true } };
  assert.strictEqual(planEngine.fits({}, state), true);
});

console.log('\nQUESTIONS — CONTEXT-AWARE OPTIONS');
await t('the dealbreaker question drops "No drinking" when the group explicitly wants nightlife', () => {
  const { QUESTIONS } = require('../engine/catalog');
  const dealbreaker = QUESTIONS.find(q => q.id === 'dealbreaker');
  const opts = dealbreaker.options({ intent: { categories: ['nightlife'] } });
  assert.ok(!opts.includes('No drinking'));
});
await t('the dealbreaker question KEEPS "No drinking" for an ordinary (non-nightlife) plan', () => {
  const consensusState = consensus.build(mkPlan([{ availability: "I'm in" }], {
    intent: { needsFood: true, categories: ['food'], title: 'Dinner' },
  }));
  const { QUESTIONS } = require('../engine/catalog');
  const dealbreaker = QUESTIONS.find(q => q.id === 'dealbreaker');
  const opts = dealbreaker.options(consensusState);
  assert.ok(opts.includes('No drinking'));
});
await t('the transport question now applies to a solo plan too (used to require 2+ people)', () => {
  const { QUESTIONS } = require('../engine/catalog');
  const transport = QUESTIONS.find(q => q.id === 'transport');
  assert.strictEqual(transport.applies({ participantCount: 1 }), true);
});
await t('the food question allows picking multiple cuisines, capped at 3', () => {
  const { QUESTIONS } = require('../engine/catalog');
  const food = QUESTIONS.find(q => q.id === 'food');
  assert.strictEqual(food.multi, true);
  assert.strictEqual(food.maxPicks, 3);
});
await t('maxPicks is threaded through to the framed question a participant sees', () => {
  const plan = mkPlan([{ availability: "I'm in", budget: 'Flexible', day: 'Today', distance: 'Anywhere reasonable' }]);
  const q = questions.next(plan, { id: 'p0', name: 'P0', answers: { availability: "I'm in", budget: 'Flexible', day: 'Today', distance: 'Anywhere reasonable' } });
  assert.strictEqual(q.done, false);
  assert.strictEqual(q.question.id, 'food');
  assert.strictEqual(q.question.maxPicks, 3);
});

console.log('\nCONSENSUS — DATE RESOLUTION');
await t('an explicit day in the request ("dinner Saturday") resolves to an actual date', () => {
  const s = consensus.build(mkPlan([{ availability: "I'm in" }], {
    intent: { needsFood: true, categories: ['food'], title: 'Saturday dinner', dayHint: 'saturday' },
  }));
  assert.ok(s.hard.date, 'expected a resolved ISO date');
  assert.match(s.hard.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(new Date(s.hard.date + 'T12:00:00').getDay(), 6); // Saturday
});
await t('"today" resolves to today\'s actual date', () => {
  const s = consensus.build(mkPlan([{ availability: "I'm in" }], {
    intent: { needsFood: true, categories: ['food'], title: 'Test', dayHint: 'today' },
  }));
  assert.strictEqual(s.hard.date, new Date().toISOString().slice(0, 10));
});
await t('the group\'s "day" answer resolves a date when the request itself named no day', () => {
  const s = consensus.build(mkPlan([
    { availability: "I'm in", day: 'Tomorrow' },
  ], { intent: { needsFood: true, categories: ['food'], title: 'Test' } }));
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  assert.strictEqual(s.hard.date, tomorrow.toISOString().slice(0, 10));
});
await t('the "day" question is skipped once the request itself named a day', () => {
  const { QUESTIONS } = require('../engine/catalog');
  const day = QUESTIONS.find(q => q.id === 'day');
  assert.strictEqual(day.applies({ intent: { dayHint: 'saturday' } }), false);
  assert.strictEqual(day.applies({ intent: {} }), true);
});
await t('a raw ISO date (an event\'s own date) resolves as itself, not as an unrecognized hint', () => {
  const s = consensus.build(mkPlan([{ availability: "I'm in" }], {
    intent: { needsFood: false, categories: ['Rock'], title: 'Concert', dayHint: '2026-11-03' },
  }));
  assert.strictEqual(s.hard.date, '2026-11-03');
});

console.log('\nPLAN GENERATION — SEEDED EVENTS');
await t('a plan seeded from a concert never asks the day question again', () => {
  const { QUESTIONS } = require('../engine/catalog');
  const day = QUESTIONS.find(q => q.id === 'day');
  // This is exactly what Discover.tsx's seedPlanFrom now sets for an event.
  assert.strictEqual(day.applies({ intent: { dayHint: '2026-11-03' } }), false);
});
await t('the seeded concert itself becomes a real itinerary stop, not a generic Places search', async () => {
  const plan = mkPlan([{ availability: "I'm in", budget: 'Flexible' }], {
    origin: { lat: 38.98, lon: -76.94, label: 'Test' },
    intent: {
      needsFood: false, categories: ['Rock'], title: 'Melanie C World Tour',
      dayHint: '2026-11-03', timeOfDay: 'Evening',
      seed: { kind: 'event', title: 'Melanie C World Tour', venue: '9:30 Club',
        address: '815 V St NW, Washington, DC', lat: 38.9169, lon: -77.0234,
        officialUrl: 'https://ticketmaster.example/event/abc' },
    },
  });
  const fp = await planEngine.generate(plan, { origin: plan.origin });
  const eventStop = fp.itinerary.find(i => i.kind === 'event');
  assert.ok(eventStop, 'expected an itinerary entry with kind "event"');
  assert.strictEqual(eventStop.place.name, 'Melanie C World Tour');
  assert.strictEqual(eventStop.place.address, '815 V St NW, Washington, DC');
  assert.strictEqual(eventStop.bookingUrl, 'https://ticketmaster.example/event/abc');
  assert.strictEqual(eventStop.unresolved, false, 'a known event is never "unresolved"');
});

console.log('\nCONSENSUS — HARD CONSTRAINTS INTERSECT');
await t("the group's budget is the LOWEST stated ceiling, not the average", () => {
  const s = consensus.build(mkPlan([
    { availability: "I'm in", budget: 'Flexible' },
    { availability: "I'm in", budget: 'Under $50' },
    { availability: "I'm in", budget: 'Under $25' },
  ]));
  assert.strictEqual(s.hard.budgetCeiling, 25);
});
await t('a $0 answer makes the whole plan free-only', () => {
  const s = consensus.build(mkPlan([
    { availability: "I'm in", budget: '$50–$100' },
    { availability: "I'm in", budget: '$0 — free only' },
  ]));
  assert.strictEqual(s.hard.freeOnly, true);
  assert.strictEqual(s.hard.budgetCeiling, 0);
});
await t('travel radius intersects to the tightest limit', () => {
  const s = consensus.build(mkPlan([
    { availability: "I'm in", distance: 'Anywhere reasonable' },
    { availability: "I'm in", distance: 'Up to 15 min' },
  ]));
  assert.strictEqual(s.hard.maxMinutes, 15);
});
await t('one dietary restriction binds the whole group', () => {
  const s = consensus.build(mkPlan([
    { availability: "I'm in", dietary: 'No restrictions' },
    { availability: "I'm in", dietary: ['Vegetarian', 'Nut allergy'] },
  ]));
  assert.deepStrictEqual(s.hard.dietary.sort(), ['Nut allergy', 'Vegetarian']);
});
await t('someone who is out does not constrain the plan', () => {
  const s = consensus.build(mkPlan([
    { availability: "I'm in", budget: 'Under $50' },
    { availability: "Can't make it", budget: '$0 — free only' },
  ]));
  assert.strictEqual(s.hard.budgetCeiling, 50);
  assert.strictEqual(s.hard.freeOnly, false);
});

console.log('\nCONSENSUS — SOFT CONVERGENCE (the 5-pizza / 2-burger case)');
const sevenPeople = mkPlan([
  { availability: "I'm in", food: 'Pizza' }, { availability: "I'm in", food: 'Pizza' },
  { availability: "I'm in", food: 'Pizza' }, { availability: "I'm in", food: 'Pizza' },
  { availability: "I'm in", food: 'Pizza' }, { availability: "I'm in", food: 'Burgers' },
  { availability: "I'm in", food: 'Burgers' },
]);
await t('recognises pizza as the group direction', () => {
  const s = consensus.build(sevenPeople);
  assert.strictEqual(s.soft.food.leader, 'Pizza');
  assert.strictEqual(s.soft.food.converged, true);
});
await t('keeps the burger minority on the record rather than discarding it', () => {
  const s = consensus.build(sevenPeople);
  assert.deepStrictEqual(s.soft.food.minority, [{ value: 'Burgers', count: 2 }]);
});
await t('asks the 8th person a PIZZA question, not "pizza or burgers?"', () => {
  const plan = JSON.parse(JSON.stringify(sevenPeople));
  plan.participants.push({ id: 'p7', name: 'Late', answers: { availability: "I'm in", budget: 'Under $25', distance: 'Up to 30 min' } });
  const q = questions.next(plan, plan.participants[7]);
  assert.strictEqual(q.done, false);
  assert.strictEqual(q.question.id, 'food_style');
  assert.ok(/pizza/i.test(q.question.text), `expected a pizza follow-up, got: ${q.question.text}`);
  assert.ok(q.question.options.includes('Veggie'));
});
await t('one lone vote is not treated as group consensus', () => {
  const s = consensus.build(mkPlan([{ availability: "I'm in", food: 'Sushi' }]));
  assert.strictEqual(s.soft.food.converged, false);
});

console.log('\nADAPTIVE QUESTIONS');
await t('availability is always asked first', () => {
  const plan = mkPlan([{}]);
  assert.strictEqual(questions.next(plan, plan.participants[0]).question.id, 'availability');
});
await t('someone who declines is asked nothing further', () => {
  const plan = mkPlan([{ availability: "Can't make it" }]);
  const q = questions.next(plan, plan.participants[0]);
  assert.strictEqual(q.done, true);
  assert.strictEqual(q.reason, 'declined');
});
await t('never re-asks a question this person already answered', () => {
  const plan = mkPlan([{ availability: "I'm in", budget: 'Under $25', distance: 'Up to 30 min', food: 'Pizza' }]);
  const seen = new Set();
  let p = plan.participants[0];
  for (let i = 0; i < 8; i++) {
    const q = questions.next(plan, p);
    if (q.done) break;
    assert.ok(!seen.has(q.question.id), `re-asked ${q.question.id}`);
    seen.add(q.question.id);
    p.answers[q.question.id] = q.question.options[0];
  }
});
await t('a hard constraint is asked of everyone even after convergence', () => {
  const plan = JSON.parse(JSON.stringify(sevenPeople));
  for (const x of plan.participants) x.answers.budget = 'Under $25';
  plan.participants.push({ id: 'new', name: 'New', answers: { availability: "I'm in", food_style: 'Veggie' } });
  const asked = [];
  const p = plan.participants[plan.participants.length - 1];
  for (let i = 0; i < 6; i++) {
    const q = questions.next(plan, p);
    if (q.done) break;
    asked.push(q.question.id);
    p.answers[q.question.id] = [].concat(q.question.options)[0];
  }
  assert.ok(asked.includes('budget'), `budget must still be asked; got ${asked}`);
});

console.log('\nPLAN GENERATION');
await t('"Deep" effort actually searches a wider pool and returns more real alternatives, not just a label', async () => {
  // Regression against Pro being pure marketing with no real effect: Deep
  // mode has to change actual behavior, or gating it behind a paywall is
  // dishonest. Mocks services/places.js directly since plan.js requires
  // that exact module instance.
  const origSearch = places.search;
  let capturedLimit = null;
  const fakePlaces = Array.from({ length: 15 }, (_, i) => ({
    providerId: `p${i}`, name: `Place ${i}`, rating: 4, address: '123 St',
    lat: 40.71, lon: -74.0, priceLevel: 'PRICE_LEVEL_MODERATE',
  }));
  places.search = async (opts) => {
    capturedLimit = opts.limit;
    return { available: true, cached: false, places: fakePlaces.slice(0, opts.limit) };
  };
  try {
    const plan = mkPlan([{ availability: "I'm in", budget: 'Flexible', distance: 'Anywhere reasonable', food: 'Pizza' }]);
    plan.origin = { lat: 40.7128, lon: -74.006, label: 'Test' };
    const quick = await planEngine.generate(plan, { origin: plan.origin, effort: 'Quick' });
    const quickLimit = capturedLimit;
    const deep = await planEngine.generate(plan, { origin: plan.origin, effort: 'Deep' });
    const deepLimit = capturedLimit;
    assert.ok(deepLimit > quickLimit, `Deep (${deepLimit}) should search more than Quick (${quickLimit})`);
    const foodStopQuick = quick.itinerary.find(i => i.kind === 'food');
    const foodStopDeep = deep.itinerary.find(i => i.kind === 'food');
    assert.ok(foodStopDeep.alternatives.length > foodStopQuick.alternatives.length,
      `Deep (${foodStopDeep.alternatives.length} alternatives) should offer more than Quick (${foodStopQuick.alternatives.length})`);
  } finally { places.search = origSearch; }
});
await t('produces a usable plan with no Places key — and says venues are unverified', async () => {
  const plan = mkPlan([
    { availability: "I'm in", budget: 'Under $25', distance: 'Up to 30 min', food: 'Pizza' },
    { availability: "I'm in", budget: 'Under $50', distance: 'Up to 30 min', food: 'Pizza' },
  ]);
  const out = await planEngine.generate(plan);
  assert.ok(out.itinerary.length >= 1);
  assert.strictEqual(out.cost.isEstimate, true);
  assert.ok(out.caveats.some(c => /venue/i.test(c)), 'must disclose unverified venues');
  assert.ok(!out.itinerary.some(i => i.place && i.place.name), 'must not invent a venue');
  // With no origin there is no journey to describe, so none is claimed.
  assert.ok(!out.itinerary.some(i => i.kind === 'depart'), 'invented a departure with nowhere to leave from');
});
await t('never prints two stops at the same clock time', async () => {
  const out = await planEngine.generate(mkPlan([
    { availability: "I'm in", budget: 'Under $50', distance: 'Up to 30 min', food: 'Pizza' },
    { availability: "I'm in", budget: 'Under $50', distance: 'Up to 30 min', food: 'Pizza' },
  ]));
  const times = out.itinerary.map(i => i.time);
  assert.strictEqual(new Set(times).size, times.length, `duplicate times: ${times.join(', ')}`);
});
await t('a named meal sets the time of day, so dinner is never at 10am', async () => {
  const parsed = intent.parse('7 of us want dinner saturday');
  const plan = mkPlan([
    { availability: "I'm in", budget: 'Under $50', food: 'Pizza', timing: 'Morning' },
    { availability: "I'm in", budget: 'Under $50', food: 'Pizza', timing: 'Morning' },
  ], { intent: parsed });
  const out = await planEngine.generate(plan);
  assert.ok(/PM/.test(out.itinerary[0].time), `dinner scheduled at ${out.itinerary[0].time}`);
});
await t('never invents an address when the provider is unavailable', async () => {
  const out = await planEngine.generate(mkPlan([{ availability: "I'm in", budget: 'Under $25', food: 'Sushi' }]));
  const json = JSON.stringify(out);
  assert.ok(!/\d+\s+(Main|Oak|Elm|First)\s+St/i.test(json), 'fabricated a street address');
});
await t('a $0 group gets a plan that costs $0', async () => {
  const out = await planEngine.generate(mkPlan([
    { availability: "I'm in", budget: '$0 — free only', distance: 'Walking distance' },
    { availability: "I'm in", budget: '$0 — free only', distance: 'Walking distance' },
  ], { intent: { needsFood: false, categories: ['outdoors'] } }));
  assert.strictEqual(out.cost.perPerson, 0);
});
await t('refuses to suggest walking for a long trip', () => {
  const opts = planEngine.transportOptions(42, 4, null);
  assert.ok(!opts.some(o => o.mode === 'Walk'), 'offered to walk 42 miles');
  assert.ok(['Drive', 'Rideshare', 'Public transit'].includes(opts[0].mode));
});
await t('labels every rideshare figure as an estimated range', () => {
  const r = planEngine.transportOptions(9, 4, null).find(o => o.mode === 'Rideshare');
  assert.strictEqual(r.estimate, true);
  assert.ok(Array.isArray(r.costRange));
});
await t('honours a stated transport preference', () => {
  assert.strictEqual(planEngine.transportOptions(9, 4, 'Public transit')[0].mode, 'Public transit');
});
await t('an explicit "Walking" preference actually offers Walk for a realistic walking distance', () => {
  // Regression: "I said I was walking and it told me driving was the
  // thing" — a 1.8-mile venue used to drop Walk from the candidate list
  // entirely (the ceiling was 1.2 miles regardless of what was asked
  // for), leaving nothing for the stated preference to elevate.
  const opts = planEngine.transportOptions(1.8, 2, 'Walking');
  assert.ok(opts.some(o => o.mode === 'Walk'), 'Walk was not even offered as a candidate');
  assert.strictEqual(opts[0].mode, 'Walk');
});
await t('"Walking" still refuses an actually unwalkable distance', () => {
  const opts = planEngine.transportOptions(10, 2, 'Walking');
  assert.ok(!opts.some(o => o.mode === 'Walk'), 'offered to walk 10 miles just because it was asked for');
});
await t('flags when the best plan still exceeds the tightest budget', async () => {
  const out = await planEngine.generate(mkPlan([
    { availability: "I'm in", budget: 'Under $25', distance: 'Up to 1 hour', food: 'Sushi' },
    { availability: "I'm in", budget: 'Under $25', distance: 'Up to 1 hour', food: 'Sushi' },
  ]));
  if (out.cost.perPerson > 25) assert.ok(out.caveats.some(c => /budget/i.test(c)));
});
await t('surfaces dietary restrictions as a caveat on the final plan', async () => {
  const out = await planEngine.generate(mkPlan([
    { availability: "I'm in", budget: 'Under $50', food: 'Pizza', dietary: 'Vegetarian' },
    { availability: "I'm in", budget: 'Under $50', food: 'Pizza' },
  ]));
  assert.ok(out.caveats.some(c => /Vegetarian/.test(c)));
});
await t('a vegetarian in a pizza group changes the actual search query', () => {
  const s = consensus.build(mkPlan([
    { availability: "I'm in", food: 'Pizza', dietary: 'No restrictions', budget: 'Under $25' },
    { availability: "I'm in", food: 'Pizza', dietary: 'No restrictions', budget: 'Under $25' },
    { availability: "I'm in", food: 'Pizza', dietary: 'Vegetarian', budget: 'Under $25' },
  ]));
  const q = planEngine.searchTerms(s).find(x => x.slot === 'food').query;
  assert.ok(/vegetarian/i.test(q), `minority constraint lost from query: "${q}"`);
});

console.log('\nTICKETS — STATE MATRIX');
const EV = 'ev_' + ids.token(6);
await store.set(`event:${EV}`, { id: EV, ownerId: 'owner1', staff: [], endsAt: null });

await t('ACTIVE + correct event → ENTRY GRANTED', async () => {
  const { credential } = await tickets.issue({ eventId: EV, attendeeName: 'Ryan' });
  const r = await tickets.checkIn(credential, EV, { id: 'owner1' });
  assert.strictEqual(r.result, tickets.RESULT.GRANTED);
  assert.strictEqual(r.attendeeName, 'Ryan');
});
await t('CHECKED_IN + correct event → ALREADY USED', async () => {
  const { credential } = await tickets.issue({ eventId: EV, attendeeName: 'Jake' });
  await tickets.checkIn(credential, EV, { id: 'owner1' });
  const second = await tickets.checkIn(credential, EV, { id: 'owner1' });
  assert.strictEqual(second.result, tickets.RESULT.ALREADY_USED);
});
await t('ACTIVE + wrong event → INVALID EVENT', async () => {
  const { credential } = await tickets.issue({ eventId: EV, attendeeName: 'Sam' });
  const r = await tickets.checkIn(credential, 'ev_someone_else', { id: 'owner1' });
  assert.strictEqual(r.result, tickets.RESULT.WRONG_EVENT);
});
await t('CANCELLED → TICKET CANCELLED', async () => {
  const { ticket, credential } = await tickets.issue({ eventId: EV, attendeeName: 'Alex' });
  await tickets.cancel(ticket.id);
  assert.strictEqual((await tickets.checkIn(credential, EV, { id: 'owner1' })).result, tickets.RESULT.CANCELLED);
});
await t('unknown token → INVALID TICKET', async () => {
  assert.strictEqual((await tickets.checkIn('bogus.token', EV, { id: 'owner1' })).result, tickets.RESULT.INVALID);
});
await t('a real ticket id with a forged token → INVALID TICKET', async () => {
  const { ticket } = await tickets.issue({ eventId: EV, attendeeName: 'Chris' });
  const r = await tickets.checkIn(`${ticket.id}.${ids.token(32)}`, EV, { id: 'owner1' });
  assert.strictEqual(r.result, tickets.RESULT.INVALID);
});
await t('the raw token is never stored or returned by a lookup', async () => {
  const { ticket } = await tickets.issue({ eventId: EV, attendeeName: 'Josh' });
  const fetched = await tickets.get(ticket.id);
  assert.strictEqual(fetched.tokenHash, undefined);
  assert.strictEqual(fetched.token, undefined);
});

console.log('\nTICKETS — RACE CONDITION (two scanners, same instant)');
await t('exactly ONE of 8 simultaneous scans succeeds', async () => {
  const { credential } = await tickets.issue({ eventId: EV, attendeeName: 'RaceTest' });
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) => tickets.checkIn(credential, EV, { id: 'staff' + i }))
  );
  const granted = results.filter(r => r.result === tickets.RESULT.GRANTED);
  const used = results.filter(r => r.result === tickets.RESULT.ALREADY_USED);
  assert.strictEqual(granted.length, 1, `expected 1 grant, got ${granted.length}`);
  assert.strictEqual(used.length, 7, `expected 7 rejections, got ${used.length}`);
});


console.log('\nMEMORY — stable vs temporary');
const mem = require('../engine/memory');
await t('an explicit statement is trusted more than an inference', () => {
  const a = mem.observe([], { category:'food', value:'Sushi', scope:'user', source:'explicit' });
  const b = mem.observe([], { category:'food', value:'Sushi', scope:'user', source:'inferred' });
  assert.ok(a[0].confidence > b[0].confidence);
});
await t('"no sushi tonight" NEVER becomes "Ryan hates sushi"', () => {
  let m = mem.observe([], { category:'food', value:'Sushi', scope:'user',
    stability:'temporary', source:'explicit', planId:'p1' });
  assert.strictEqual(m[0].stability, 'temporary');
  assert.strictEqual(m[0].planId, 'p1');
  // Repeat it four more times — it must still refuse to become a trait.
  for (let i = 0; i < 4; i++) m = mem.observe(m, { category:'food', value:'Sushi', scope:'user',
    stability:'temporary', source:'explicit', planId:'p' + i });
  assert.ok(m.every(x => x.stability === 'temporary'), 'a temporary memory promoted itself');
});
await t('temporary memory is scoped to its own plan and invisible to others', () => {
  const m = mem.observe([], { category:'food', value:'Sushi', scope:'user',
    stability:'temporary', source:'explicit', planId:'p1' });
  assert.strictEqual(mem.active(m, { planId: 'p1' }).length, 1);
  assert.strictEqual(mem.active(m, { planId: 'p2' }).length, 0);
});
await t('one contrary choice lowers confidence rather than erasing the memory', () => {
  let m = mem.observe([], { category:'food', value:'Sushi', scope:'user', source:'explicit' });
  const before = m[0].confidence;
  m = mem.contradict(m, { category:'food', value:'Sushi', scope:'user', source:'explicit' });
  assert.ok(m[0].confidence < before, 'confidence did not fall');
  assert.ok(m[0].confidence > 0, 'memory was erased by a single contradiction');
});
await t('repetition raises confidence but never reaches certainty', () => {
  let m = [];
  for (let i = 0; i < 40; i++) m = mem.observe(m, { category:'food', value:'Pizza', scope:'user', source:'explicit' });
  assert.ok(m[0].confidence <= 0.95, `confidence hit ${m[0].confidence}`);
  assert.ok(m[0].confidence > 0.8);
});
await t('an expired temporary memory is pruned', () => {
  const m = [{ id:'x', category:'food', value:'Sushi', stability:'temporary', source:'explicit',
    confidence:0.5, createdAt: new Date().toISOString(), lastConfirmedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString() }];
  assert.strictEqual(mem.prune(m).length, 0);
});
await t('a group profile stays silent until there is real behaviour', () => {
  const one = mem.groupProfile([{ participants: [{ answers: { food: 'Pizza' } }] }]);
  assert.strictEqual(one.confident, false);
  const many = mem.groupProfile(Array.from({ length: 4 }, () => ({
    participants: [{ answers: { food: 'Pizza' } }, { answers: { food: 'Pizza' } }] })));
  assert.strictEqual(many.confident, true);
  assert.strictEqual(many.food[0].value, 'Pizza');
});
await t('a dietary answer is learned as stable and explicit; a food answer is not', () => {
  const plan = { id:'p1', participants: [{ id:'u1', name:'Ryan',
    answers: { dietary: ['Vegetarian'], food: 'Pizza' } }] };
  const m = mem.learnFromPlan([], plan, 'u1');
  const diet = m.find(x => x.category === 'dietary');
  const food = m.find(x => x.category === 'food');
  assert.strictEqual(diet.stability, 'stable');
  assert.strictEqual(diet.source, 'explicit');
  assert.strictEqual(food.stability, 'habit');
  assert.strictEqual(food.source, 'inferred');
});

console.log('\nPERMISSIONS — role-based access');
const hosting = require('../engine/hosting');
const EVENT = hosting.createEvent({ id:'e1', ownerId:'owner', ownerName:'Ryan',
  title:'Fall Social', startsAt: new Date(Date.now() + 86400e3).toISOString(), capacity: 2 });
hosting.addStaff(EVENT, { id:'door', name:'Jake', role:'check_in' });

await t('the owner can do everything', () => {
  for (const a of ['event.delete','payment.edit','staff.manage','ticket.checkin'])
    assert.ok(hosting.can(a, { event: EVENT, userId: 'owner' }), a);
});
await t('door staff can check people in', () => {
  assert.ok(hosting.can('ticket.checkin', { event: EVENT, userId: 'door' }));
  assert.ok(hosting.can('attendees.view', { event: EVENT, userId: 'door' }));
});
await t('door staff CANNOT delete the event, touch payment, or add staff', () => {
  for (const a of ['event.delete','payment.edit','staff.manage','ownership.transfer'])
    assert.strictEqual(hosting.can(a, { event: EVENT, userId: 'door' }), false, a);
});
await t('a random attendee can do nothing at all', () => {
  for (const a of ['ticket.checkin','attendees.view','event.edit'])
    assert.strictEqual(hosting.can(a, { event: EVENT, userId: 'stranger' }), false, a);
});
await t('a full event refuses another "going" RSVP', () => {
  const e = hosting.createEvent({ id:'e2', ownerId:'o', ownerName:'O', title:'Small',
    startsAt: new Date().toISOString(), capacity: 1 });
  assert.strictEqual(hosting.rsvp(e, { id:'a', name:'A', status:'going' }).ok, true);
  assert.strictEqual(hosting.rsvp(e, { id:'b', name:'B', status:'going' }).ok, false);
  // Maybe is still allowed — capacity limits attendance, not interest.
  assert.strictEqual(hosting.rsvp(e, { id:'b', name:'B', status:'maybe' }).ok, true);
});
await t('the attendee list is hidden from non-staff', () => {
  assert.strictEqual(hosting.publicView(EVENT, { userId: 'stranger' }).attendees, undefined);
  assert.ok(Array.isArray(hosting.publicView(EVENT, { userId: 'owner' }).attendees));
});

console.log('\nEXPENSES');
const exp = require('../engine/expenses');
await t('a split never loses or invents a penny', () => {
  for (const [amount, n] of [[18000, 7], [10000, 3], [1, 5], [99999, 11]]) {
    const parts = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i }));
    const shares = exp.split(amount, parts);
    assert.strictEqual(shares.reduce((s, x) => s + x.cents, 0), amount, `${amount}/${n}`);
    assert.ok(Math.max(...shares.map(s => s.cents)) - Math.min(...shares.map(s => s.cents)) <= 1);
  }
});
await t('settle-up clears every balance to zero', () => {
  const parts = ['Ryan','Jake','Sarah','Alex'].map((n, i) => ({ id:'p'+i, name:n }));
  let ledger = exp.addExpense([], { id:'a', label:'Dinner', amountCents: 18000, paidBy:'p0', participants: parts });
  ledger = exp.addExpense(ledger, { id:'b', label:'Uber', amountCents: 4200, paidBy:'p1', participants: parts });
  const transfers = exp.settleUp(ledger, parts);
  const after = new Map(exp.balances(ledger, parts).map(b => [b.id, b.cents]));
  for (const tr of transfers) {
    after.set(tr.fromId, after.get(tr.fromId) + tr.cents);
    after.set(tr.toId, after.get(tr.toId) - tr.cents);
  }
  for (const [id, cents] of after) assert.strictEqual(cents, 0, `${id} left owing ${cents}`);
});
await t('nobody pays for an expense they were not part of', () => {
  const all = ['a','b','c'].map(n => ({ id:n, name:n }));
  const two = all.slice(0, 2);
  const ledger = exp.addExpense([], { id:'x', label:'Cab', amountCents: 3000, paidBy:'a', participants: two });
  assert.strictEqual(exp.balances(ledger, all).find(b => b.id === 'c').cents, 0);
});

console.log('\nCALENDAR');
const cal = require('../engine/calendar');
const CAL_PLAN = { id:'p1', title:'Saturday dinner', date:'2026-09-12', participants:[] };
const CAL_FP = { title:'Saturday dinner', date:'2026-09-12', cost:{ perPerson: 22 }, itinerary:[
  { time:'6:00 PM', title:'Dinner', kind:'food', durationMinutes:80,
    place:{ name:"Luigi's; Pizza, Bar", address:'123 Main St' } },
  { time:'7:20 PM', title:'Head home', kind:'return' }] };
await t('produces a well-formed VCALENDAR', () => {
  const ics = cal.planToIcs(CAL_PLAN, CAL_FP);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trim().endsWith('END:VCALENDAR'));
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
});
await t('escapes the characters RFC 5545 requires', () => {
  const ics = cal.planToIcs(CAL_PLAN, CAL_FP);
  const summary = ics.split('\r\n').find(l => l.startsWith('SUMMARY'));
  assert.ok(summary.includes('\\;'), `semicolon unescaped: ${summary}`);
  assert.ok(summary.includes('\\,'), `comma unescaped: ${summary}`);
});
await t('engine modules never use Node-only globals (they run in the browser too)', () => {
  const fs = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..', 'engine');
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const bad of ['Buffer.', 'process.exit', '__dirname']) {
      assert.ok(!src.includes(bad), `engine/${f} uses ${bad}, which does not exist in a browser`);
    }
  }
});
await t('folds lines to 75 octets', () => {
  const long = { ...CAL_FP, itinerary: [{ ...CAL_FP.itinerary[0], title: 'D'.repeat(200) }] };
  for (const line of cal.planToIcs(CAL_PLAN, long).split('\r\n')) {
    assert.ok(Buffer.byteLength(line) <= 75, `line too long: ${line.length}`);
  }
});
await t('surfaces a nudge for whoever has not responded', () => {
  const plan = { ...CAL_PLAN, participants: [
    { name:'Ryan', answers:{ availability:"I'm in" } }, { name:'Josh', answers:{} }] };
  const r = cal.remindersFor(plan, CAL_FP);
  const nudge = r.find(x => x.kind === 'nudge');
  assert.ok(nudge && nudge.people.includes('Josh'));
  assert.ok(!nudge.people.includes('Ryan'));
});

console.log('\nQR ENCODER');
const qr = require('../lib/qr');
await t('encodes across versions without error', () => {
  // 60 bytes fits version 4 at ECC M (64 data codewords), so 33 modules.
  for (const [text, expect] of [['HELLO', 21], ['x'.repeat(60), 33], ['x'.repeat(70), 37]]) {
    assert.strictEqual(qr.encode(text).size, expect, text.slice(0, 10));
  }
});
await t('every module is a real boolean, never a hole', () => {
  const { modules, size } = qr.encode('planzo-ticket-test');
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    assert.strictEqual(typeof modules[r][c], 'boolean', `hole at ${r},${c}`);
  }
});
await t('places all three finder patterns', () => {
  const { modules, size } = qr.encode('test');
  for (const [r, c] of [[0,0],[0,size-7],[size-7,0]]) {
    assert.strictEqual(modules[r][c], true);
    assert.strictEqual(modules[r+1][c+1], false);   // the light ring
    assert.strictEqual(modules[r+3][c+3], true);    // the dark core
  }
});
await t('refuses a payload it cannot encode rather than truncating it', () => {
  assert.throws(() => qr.encode('x'.repeat(400)), /too long/);
});
await t('emits valid SVG', () => {
  const svg = qr.toSvg('planzo');
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.ok(svg.includes('<path'));
});

console.log('\nTRIPS');
const trips = require('../engine/trips');
await t('builds one day per night plus arrival and departure', async () => {
  const plan = mkPlan([{ availability:"I'm in", budget:'Under $50', food:'Pizza' }]);
  const trip = await trips.generate(plan, { startDate:'2026-10-01', nights: 3 });
  assert.strictEqual(trip.days.length, 4);
  assert.strictEqual(trip.days[0].label, 'Arrival');
  assert.strictEqual(trip.days[3].label, 'Departure');
});
await t('never quotes a flight or a hotel it has not got', async () => {
  const trip = await trips.generate(mkPlan([{ availability:"I'm in", budget:'Under $50' }]), { nights: 2 });
  assert.strictEqual(trip.lodging.available, false);
  assert.strictEqual(trip.travel.available, false);
  assert.ok(!/\$\d/.test(JSON.stringify(trip.lodging)), 'invented a lodging price');
  assert.ok(/not included/i.test(trip.cost.note));
});

console.log('\nSEARCH');
const searchEng = require('../engine/search');
await t('strips time and money words from the provider query', () => {
  const f = searchEng.parseQuery('cheap tacos near me tonight under $20');
  assert.ok(!/tonight|near me|cheap|under/i.test(f.providerQuery), f.providerQuery);
  assert.ok(/tacos/i.test(f.providerQuery));
  assert.strictEqual(f.maxPrice, 20);
});
await t('recognises a $0 search', () => {
  assert.strictEqual(searchEng.parseQuery('free stuff near me tonight').free, true);
});
await t('an unavailable source explains itself and returns no results', async () => {
  // Provider-independent: whichever sources are configured, any section that
  // could NOT be grounded must carry a reason and must not carry results.
  const r = await searchEng.run('pizza', { lat: 38.9, lon: -76.9 });
  for (const sec of r.sections) {
    if (sec.available) {
      assert.ok(Array.isArray(sec.results) || sec.kind === 'events', `${sec.kind} claimed available with no data`);
    } else {
      assert.ok(sec.message, `${sec.kind} is unavailable but gives no reason`);
      assert.strictEqual(sec.results, undefined, `${sec.kind} returned results while unavailable`);
    }
  }
});

console.log('\nSECURITY');
await t('a tampered session token is rejected', () => {
  const s = ids.sign({ pid: 'p1', name: 'Ryan' });
  const [body, sig] = s.split('.');
  const forged = Buffer.from(JSON.stringify({ pid: 'admin', name: 'Ryan', exp: Date.now() + 1e6 })).toString('base64url');
  assert.strictEqual(ids.verify(`${forged}.${sig}`), null);
  assert.strictEqual(ids.verify(s).pid, 'p1');
});
await t('an expired session is rejected', () => {
  assert.strictEqual(ids.verify(ids.sign({ pid: 'p1' }, -10)), null);
});
await t('the store refuses to touch the northco namespace', async () => {
  await assert.rejects(async () => { await store.incrBy('northco:emailed', 1); });
});
await t('plan codes are unguessable and collision-free over 5k draws', () => {
  const set = new Set(Array.from({ length: 5000 }, () => ids.planCode()));
  assert.strictEqual(set.size, 5000);
});

console.log('\nCOST GOVERNOR');
const cost = require('../lib/cost');
await t('prices a Haiku call correctly', () => {
  const c = cost.estimateAiCost('claude-haiku-4-5-20251001', 1_000_000, 0);
  assert.strictEqual(Math.round(c * 100) / 100, 1.00);
});
await t('blocks spending once the daily ceiling is reached', async () => {
  // Start from a clean ledger — the counter persists between runs by design.
  const day = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  await store.del(`spend:ai:day:${day}`);
  await store.del(`spend:ai:month:${month}`);
  const before = await cost.reserve('ai', 0.001);
  assert.strictEqual(before.ok, true);
  await cost.record('ai', Number(process.env.PLANZO_AI_DAILY_USD || 1) + 1);
  const after = await cost.reserve('ai', 0.001);
  assert.strictEqual(after.ok, false);
  assert.strictEqual(after.reason, 'daily_ceiling');
});
await t('the AI gateway returns a failure, never a fabricated answer, when blocked', async () => {
  const ai = require('../services/ai');
  const r = await ai.ask({ prompt: 'hello' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.data, undefined);
});

console.log('\nOVER-BUDGET ADVICE');
// Regression coverage for the real report: "It said swap the food stop
// for a cheaper option — but there's no food option." The advice used to
// hardcode "swap the food stop" no matter what actually drove the cost.
await t('names the food stop when food is actually the biggest cost', () => {
  const msg = planEngine.overBudgetCaveat(60, 40, [{ label: 'Food', perPerson: 45 }, { label: 'Drive (round trip)', perPerson: 15 }]);
  assert.match(msg, /swap the food stop/);
});
await t('names transport instead of a nonexistent food stop when there is no food line', () => {
  const msg = planEngine.overBudgetCaveat(60, 40, [{ label: 'Drive (round trip)', perPerson: 60 }]);
  assert.doesNotMatch(msg, /food/i);
  assert.match(msg, /getting there/);
});
await t('falls back to a generic "cut a stop" when there is no cost line at all to blame', () => {
  const msg = planEngine.overBudgetCaveat(50, 40, []);
  assert.doesNotMatch(msg, /food/i);
  assert.match(msg, /cut a stop/);
});

console.log('\nPLACES — OPEN NOW');
// Regression coverage for the real bug this fixed: a venue's "open now"
// status was being frozen into a 12h-24h cache at fetch time, so a place
// that closed hours ago kept reading "Open now" until the cache expired.
// isOpenNow() is computed fresh from the venue's static weekly schedule on
// every read instead — these pin that computation down directly.
await t('no schedule at all is unknown, never a guess', () => {
  assert.strictEqual(places.isOpenNow(null), null);
  assert.strictEqual(places.isOpenNow([]), null);
});
await t('a single open-ended period means 24/7', () => {
  assert.strictEqual(places.isOpenNow([{ open: { day: 0, hour: 0, minute: 0 } }]), true);
});
await t('a same-day period is open inside its hours and closed outside them', () => {
  const periods = [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 0 } }];
  // Jan 1 2024 was a Monday.
  assert.strictEqual(places.isOpenNow(periods, new Date(2024, 0, 1, 12, 0)), true);
  assert.strictEqual(places.isOpenNow(periods, new Date(2024, 0, 1, 20, 0)), false);
  assert.strictEqual(places.isOpenNow(periods, new Date(2024, 0, 1, 8, 59)), false);
});
await t('an overnight period stays open past midnight into the close day', () => {
  // Friday 6pm to Saturday 2am. Jan 5 2024 = Friday, Jan 6 2024 = Saturday.
  const periods = [{ open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }];
  assert.strictEqual(places.isOpenNow(periods, new Date(2024, 0, 5, 23, 0)), true, 'Friday night');
  assert.strictEqual(places.isOpenNow(periods, new Date(2024, 0, 6, 1, 0)), true, 'Saturday after midnight, before close');
  assert.strictEqual(places.isOpenNow(periods, new Date(2024, 0, 6, 3, 0)), false, 'Saturday after close');
  assert.strictEqual(places.isOpenNow(periods, new Date(2024, 0, 5, 12, 0)), false, 'Friday afternoon, before open');
});

console.log('\n' + results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
})();
