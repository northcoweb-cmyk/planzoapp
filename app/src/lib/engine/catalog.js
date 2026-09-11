// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/catalog.js — edit the source, then run scripts-port.mjs */
/**
 * The question catalog and constraint taxonomy.
 *
 * Every question declares:
 *   id        stable key answers are stored under
 *   kind      'hard' constraints bound the solution; 'soft' can be traded off
 *   applies   predicate over group state — when this question is even relevant
 *   weight    how much uncertainty it removes (drives question ordering)
 *   options   fixed choices, or a generator that narrows using group state
 *
 * Narrowing lives in `options`. That is what makes the flow adaptive without
 * any model call: once five of seven say pizza, the food question stops being
 * "pizza or burgers" and becomes a pizza-shaped question for everyone left.
 */

const CATEGORIES = {
  food:      ['Pizza', 'Burgers', 'Mexican', 'Sushi', 'Wings', 'BBQ', 'Italian', 'Asian', 'Breakfast', 'Something else'],
  vibe:      ['Chill', 'Active', 'Party', 'Food-focused', 'Scenic', 'Surprise us'],
  distance:  ['Walking distance', 'Up to 15 min', 'Up to 30 min', 'Up to 1 hour', 'Anywhere reasonable'],
  budget:    ['$0 — free only', 'Under $25', 'Under $50', '$50–$100', 'Flexible'],
  transport: ['Driving', 'Rideshare', 'Public transit', 'Walking', 'Whatever works'],
  timing:    ['Morning', 'Afternoon', 'Evening', 'Late night', 'Flexible'],
  day:       ['Today', 'Tomorrow', 'This Friday', 'This Saturday', 'This Sunday', 'Next week'],
};

const DISTANCE_MINUTES = {
  'Walking distance': 15, 'Up to 15 min': 15, 'Up to 30 min': 30,
  'Up to 1 hour': 60, 'Anywhere reasonable': 90,
};

const BUDGET_CEILING = {
  '$0 — free only': 0, 'Under $25': 25, 'Under $50': 50, '$50–$100': 100, 'Flexible': null,
};

/** Follow-ups that fire once the group has clearly converged on a direction. */
const NARROWING = {
  Pizza:    { id: 'food_style', text: 'The group is leaning pizza. What sounds best?', options: ['Pepperoni', 'Cheese', 'Meat lovers', 'Veggie', 'No preference'] },
  Burgers:  { id: 'food_style', text: 'Burgers it is. What kind of spot?', options: ['Classic diner', 'Smash burgers', 'Sit-down restaurant', 'Fast and cheap', 'No preference'] },
  Mexican:  { id: 'food_style', text: 'Mexican is winning. What are you after?', options: ['Tacos', 'Burritos', 'Sit-down', 'Cheap and fast', 'No preference'] },
  Sushi:    { id: 'food_style', text: 'Sushi is leading. What works?', options: ['All-you-can-eat', 'Rolls only', 'Nice sit-down', 'No preference'] },
  Wings:    { id: 'food_style', text: 'Wings are leading. Where?', options: ['Sports bar', 'Takeout', 'Sit-down', 'No preference'] },
  BBQ:      { id: 'food_style', text: 'BBQ is leading. What kind of spot?', options: ['Casual counter', 'Sit-down', 'Cheap and fast', 'No preference'] },
  Italian:  { id: 'food_style', text: 'Italian is leading. What kind of spot?', options: ['Casual', 'Nice sit-down', 'Cheap and fast', 'No preference'] },
  Asian:    { id: 'food_style', text: 'Asian food is leading. Narrow it down?', options: ['Thai', 'Chinese', 'Korean', 'Vietnamese', 'No preference'] },
  Breakfast:{ id: 'food_style', text: 'Breakfast is leading. What kind?', options: ['Diner', 'Brunch spot', 'Coffee and pastries', 'No preference'] },
};

const QUESTIONS = [
  {
    id: 'availability', kind: 'hard', weight: 10,
    text: 'Are you in?',
    options: ["I'm in", 'Maybe', "Can't make it"],
    applies: () => true,
  },
  {
    id: 'budget', kind: 'hard', weight: 9,
    text: "What's your budget for this?",
    options: CATEGORIES.budget,
    applies: st => st.confirmedCount >= 1,
  },
  {
    id: 'distance', kind: 'hard', weight: 7,
    text: 'How far are you willing to go?',
    options: CATEGORIES.distance,
    applies: () => true,
  },
  {
    id: 'day', kind: 'hard', weight: 9,
    text: 'What day do you want to do this?',
    options: CATEGORIES.day,
    // Skipped only when the organizer's own words already named a day
    // ("dinner Saturday") — otherwise every plan asked for a time of day
    // but never an actual date, so plans could generate for "tonight"
    // even when nobody meant tonight.
    applies: st => !st.intent.dayHint,
  },
  {
    id: 'timing', kind: 'soft', weight: 6,
    text: 'When works for you?',
    options: CATEGORIES.timing,
    applies: st => !st.intent.timeOfDay,
  },
  {
    id: 'food', kind: 'soft', weight: 8,
    text: 'What do you want to eat?',
    options: CATEGORIES.food,
    applies: st => st.intent.needsFood,
  },
  {
    id: 'vibe', kind: 'soft', weight: 5,
    text: "What's the vibe?",
    options: CATEGORIES.vibe,
    applies: st => !st.intent.needsFood || st.intent.multiStop,
  },
  {
    id: 'transport', kind: 'soft', weight: 4,
    text: 'How are you getting there?',
    options: CATEGORIES.transport,
    // Used to only apply for groups of 2+, so a solo plan never asked and
    // silently defaulted to whatever transportOptions() ranked cheapest —
    // which could hand someone a "bike or scooter" plan they never chose.
    applies: () => true,
  },
  {
    id: 'dietary', kind: 'hard', weight: 6,
    text: 'Anything you cannot eat?',
    options: ['No restrictions', 'Vegetarian', 'Vegan', 'Gluten-free', 'Halal', 'Nut allergy', 'Other'],
    applies: st => st.intent.needsFood,
    multi: true,
  },
  {
    id: 'dealbreaker', kind: 'hard', weight: 3,
    text: 'Anything you definitely do not want to do?',
    // A function, not a fixed list: someone who explicitly asked for drinks
    // ("let's go get drinks") should never be offered "No drinking" as a
    // thing to rule out — that directly contradicts what they just said.
    options: st => {
      const opts = ['Nothing — I’m easy', 'Nothing expensive', 'No long drive', 'No late night', 'No crowds', 'No drinking'];
      return (st.intent.categories || []).includes('nightlife') ? opts.filter(o => o !== 'No drinking') : opts;
    },
    applies: st => st.answeredQuestions >= 3,
  },
];

export { QUESTIONS, CATEGORIES, NARROWING, DISTANCE_MINUTES, BUDGET_CEILING };
export default { QUESTIONS, CATEGORIES, NARROWING, DISTANCE_MINUTES, BUDGET_CEILING };