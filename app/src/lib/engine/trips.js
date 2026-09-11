// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/trips.js — edit the source, then run scripts-port.mjs */
/**
 * Multi-day trips (spec §12, §32). A Pro feature.
 *
 * A trip is a sequence of days, each planned by the same engine that
 * handles a single evening — so a trip inherits the group's constraints,
 * the honesty rules and the cost labelling for free.
 *
 * Flights and lodging are LISTINGS ONLY. Planzo never claims to have
 * booked anything, and with no provider configured it says so rather than
 * inventing a fare (spec §33).
 */
import planEngine from './plan.js';
import consensus from './consensus.js';

const DAY_SHAPES = [
  { label: 'Arrival', slots: ['settle in', 'dinner'] },
  { label: 'Full day', slots: ['activity', 'lunch', 'activity', 'dinner'] },
  { label: 'Departure', slots: ['breakfast', 'travel'] },
];

function shapeFor(index, total) {
  if (index === 0) return DAY_SHAPES[0];
  if (index === total - 1) return DAY_SHAPES[2];
  return DAY_SHAPES[1];
}

function datesBetween(startISO, nights) {
  const out = [];
  const d = new Date(startISO + 'T12:00:00');
  for (let i = 0; i <= nights; i++) {
    out.push(new Date(d.getTime() + i * 86400e3).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * @returns a trip with a per-day itinerary, a running cost estimate and
 *          explicit gaps where a provider would be needed.
 */
async function generate(plan, { destination, startDate, nights = 2, origin } = {}) {
  const state = consensus.build(plan);
  const group = Math.max(1, state.attendingCount || plan.participants.length || 1);
  const dates = datesBetween(startDate || new Date().toISOString().slice(0, 10), nights);
  const caveats = [];
  const days = [];

  for (let i = 0; i < dates.length; i++) {
    const shape = shapeFor(i, dates.length);
    // Each day is a normal Planzo plan against the trip's destination.
    const dayPlan = {
      ...plan,
      id: `${plan.id}:d${i}`,
      date: dates[i],
      intent: {
        ...plan.intent,
        needsFood: shape.slots.some(s => /dinner|lunch|breakfast/.test(s)),
        categories: ['food', ...(i > 0 && i < dates.length - 1 ? ['outdoors'] : [])],
        timeOfDay: null,
      },
      origin: destination || origin || plan.origin,
    };
    const generated = await planEngine.generate(dayPlan, { origin: destination || origin || plan.origin });
    days.push({ date: dates[i], label: shape.label, ...generated });
  }

  const perDay = days.reduce((s, d) => s + (d.cost?.perPerson || 0), 0);

  // Lodging and travel: structure, never invented prices.
  const lodging = {
    nights, available: false, reason: 'no_provider_configured',
    message: `Lodging listings aren't connected. Budget separately for ${nights} ${nights === 1 ? 'night' : 'nights'}.`,
  };
  const travel = {
    available: false, reason: 'no_provider_configured',
    message: 'Flight and long-distance listings need a travel provider. Nothing here is a quoted fare.',
  };
  caveats.push(lodging.message, travel.message);
  if (state.hard.budgetCeiling !== null) {
    caveats.push(`This total covers food and activities only, against the group's $${state.hard.budgetCeiling} ceiling. `
      + 'Lodging and getting there are on top.');
  }

  return {
    generatedAt: new Date().toISOString(),
    title: destination?.label ? `${destination.label} trip` : (plan.title || 'Trip'),
    destination: destination || null,
    startDate: dates[0], endDate: dates[dates.length - 1], nights,
    groupSize: group,
    days,
    lodging, travel,
    cost: {
      perPerson: Math.round(perDay * 100) / 100,
      total: Math.round(perDay * group * 100) / 100,
      isEstimate: true,
      note: 'Food and activities only. Lodging and travel are not included and were not quoted.',
    },
    caveats: [...new Set(caveats)],
    isPro: true,
  };
}

export { generate, datesBetween, shapeFor };
export default { generate, datesBetween, shapeFor };