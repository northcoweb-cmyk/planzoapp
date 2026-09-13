// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/plan.js — edit the source, then run scripts-port.mjs */
/**
 * Plan generation.
 *
 * Candidates are built from the group's HARD constraints, populated with
 * REAL places when Places is configured, ranked, and rendered as a timeline
 * with a cost breakdown.
 *
 * Two rules run through every line of this file:
 *   1. Nothing factual is invented. If Places is unavailable, the plan says
 *      so and still produces a usable shape (times, transport, budget) rather
 *      than naming a restaurant that may not exist.
 *   2. Every dollar figure is an estimate and is labelled as one, with its
 *      basis recorded in `costBasis`.
 */
import places from './places.js';
import weather from './weather.js';
import consensus from './consensus.js';

const PER_PERSON_FOOD = { 0: 0, 1: 14, 2: 26, 3: 45, 4: 75 };  // by Google price level
const GAS_PER_MILE = 0.16;
const RIDESHARE_BASE = 7, RIDESHARE_PER_MILE = 1.85;

function milesBetween(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(Number.isFinite)) return null;
  const R = 3958.8, rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Rank transport modes for a leg. Refuses absurd suggestions: a 60-minute
 * drive is never presented as a walk just because walking exists (spec §9).
 */
function transportOptions(miles, groupSize, preference) {
  if (miles == null) return [];
  const out = [];
  const driveMin = Math.round((miles / 28) * 60) + 4;

  // 1.2 miles is a fine default cutoff so a plan never presents a walk
  // nobody asked for — but someone who explicitly said "Walking" clearly
  // means it, and a 1.8-mile venue used to just silently drop Walk from
  // the candidate list entirely, leaving nothing for their stated
  // preference to elevate and letting Drive win by default. A real walking
  // preference gets a genuinely walkable ceiling (~50 min on foot) instead.
  const walkCeiling = preference === 'Walking' ? 2.5 : 1.2;
  if (miles <= walkCeiling) out.push({ mode: 'Walk', minutes: Math.round(miles * 20), costPerPerson: 0, estimate: false });
  if (miles <= 4)   out.push({ mode: 'Bike / scooter', minutes: Math.round(miles * 6), costPerPerson: miles <= 2 ? 0 : 5, estimate: true });

  out.push({
    mode: 'Drive', minutes: driveMin,
    costPerPerson: Math.round((miles * 2 * GAS_PER_MILE) / Math.max(1, Math.min(groupSize, 4)) * 100) / 100,
    estimate: true, note: 'Gas only. Parking not included.',
  });

  const cars = Math.ceil(groupSize / 4);
  const fare = RIDESHARE_BASE + miles * RIDESHARE_PER_MILE;
  out.push({
    mode: 'Rideshare', minutes: driveMin + 6,
    costPerPerson: Math.round(((fare * cars) / Math.max(1, groupSize)) * 100) / 100,
    costRange: [Math.round(fare * cars * 0.8), Math.round(fare * cars * 1.5)],
    estimate: true,
    note: 'Estimated range — surge pricing is not available to us. Confirm in the app.',
  });

  if (miles >= 2 && miles <= 25) {
    out.push({ mode: 'Public transit', minutes: Math.round(driveMin * 1.7), costPerPerson: 2.5, estimate: true,
      note: 'Typical local fare. Check your transit agency for exact pricing.' });
  }

  const pref = { Driving: 'Drive', Rideshare: 'Rideshare', 'Public transit': 'Public transit', Walking: 'Walk' }[preference];
  return out.sort((a, b) => {
    if (pref) { if (a.mode === pref) return -1; if (b.mode === pref) return 1; }
    return (a.costPerPerson * 6 + a.minutes) - (b.costPerPerson * 6 + b.minutes);
  });
}

/** Search terms implied by the group's state — the bridge to real places. */
function searchTerms(state) {
  const terms = [];
  const food = state.soft.food?.leader;
  const style = state.soft.food_style?.leader;
  const diet = state.hard.dietary;

  if (state.intent.needsFood || food) {
    // The group's own vote wins once they've actually voted on something
    // specific; otherwise fall back to the exact food the idea named
    // ("ice cream", "sushi", ...) rather than a generic "restaurant" that
    // ignores what was actually asked for.
    let q = food && food !== 'Something else' ? food : (state.intent.foodTerm || 'restaurant');
    if (style && style !== 'No preference') q = `${style} ${q}`;
    if (diet.includes('Vegetarian') || diet.includes('Vegan')) q += ' vegetarian options';
    if (diet.includes('Gluten-free')) q += ' gluten free';
    if (diet.includes('Halal')) q = `halal ${q}`;
    if (state.hard.freeOnly) q = 'cheap eats';
    // The itinerary slot title used to hardcode "Dinner" no matter what was
    // actually planned — an ice cream stop titled "Dinner" is exactly the
    // kind of mismatch that reads as "this app got it wrong."
    const specific = food && food !== 'Something else' ? food : state.intent.foodTerm;
    const mealLabel = { Morning: 'Breakfast', Afternoon: 'Lunch', 'Late night': 'Late bite' }[state.intent.timeOfDay] || 'Dinner';
    const label = specific ? specific.charAt(0).toUpperCase() + specific.slice(1) : mealLabel;
    terms.push({ slot: 'food', query: q, label });
  }

  const cats = state.intent.categories || [];
  if (cats.includes('outdoors') || state.soft.vibe?.leader === 'Scenic') {
    // Use the specific activity actually named ("fishing", "hiking", ...)
    // rather than always searching the generic word "park" — the same
    // fix already applied to food requests, for the same reason.
    const outdoorQuery = state.intent.outdoorTerm || (state.hard.freeOnly ? 'free park scenic overlook' : 'park');
    const label = state.intent.outdoorTerm
      ? state.intent.outdoorTerm.replace(/\b\w/g, c => c.toUpperCase())
      : 'Activity';
    terms.push({ slot: 'activity', query: outdoorQuery, label });
  }
  if (cats.includes('nightlife') || state.soft.vibe?.leader === 'Party') {
    terms.push({ slot: 'nightlife', query: 'bar', label: 'Out after' });
  }
  if (!terms.length) {
    terms.push({ slot: 'activity', query: state.hard.freeOnly ? 'free things to do' : 'things to do', label: 'Activity' });
  }
  return terms;
}

/**
 * The advice line for a plan that came in over budget. Used to always say
 * "swap the food stop" unconditionally — wrong on any plan with no food
 * stop at all (a hike, bowling, an activity-only day), where the actual
 * cost driver is transport (the only other thing this engine ever prices).
 * Pulled out as its own pure function so it's testable without a live
 * Places connection, which generate() otherwise requires to produce any
 * non-food cost line at all.
 */
function overBudgetCaveat(perPerson, budgetCeiling, costLines) {
  const biggest = [...costLines].sort((a, b) => b.perPerson - a.perPerson)[0];
  const fix = !biggest
    ? "cut a stop to bring the total down"
    : biggest.label === 'Food'
      ? "swap the food stop for a cheaper option to get under"
      : /round trip/.test(biggest.label)
        ? `switch how you're getting there — ${biggest.label.replace(' (round trip)', '').toLowerCase()} is the biggest line here — to get under`
        : `swap out ${biggest.label.toLowerCase()} for a cheaper option to get under`;
  return `This comes to about $${perPerson}/person, above the group's tightest budget of $${budgetCeiling}. `
    + `We kept it because it was the closest fit — ${fix}.`;
}

/** Does a place fit the group's hard constraints? */
function fits(place, state) {
  if (state.hard.freeOnly && place.priceLevel && place.priceLevel !== 'PRICE_LEVEL_FREE'
      && place.priceLevel !== 'PRICE_LEVEL_INEXPENSIVE') return false;
  if (state.hard.budgetCeiling !== null) {
    const level = priceLevelNum(place.priceLevel);
    if (level !== null && (PER_PERSON_FOOD[level] || 0) > state.hard.budgetCeiling) return false;
  }
  // "pizza right now" at 1:59am must never hand back a place that opens at
  // 11am — openNow===false is a hard exclusion here, not just a scoring
  // penalty, and only when the request was actually for right now (a plan
  // for Saturday shouldn't be filtered by whether a place happens to be
  // open at the moment the plan was created).
  if (state.intent.rightNow && place.openNow === false) return false;
  return true;
}

function priceLevelNum(pl) {
  return { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
           PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[pl] ?? null;
}

/** Score a candidate place: satisfaction, rating, price fit, distance. */
function scorePlace(place, state, origin) {
  let s = 0;
  if (place.rating) s += (place.rating - 3.2) * 0.9;
  if ((place.ratingCount || 0) > 60) s += 0.35;
  const lvl = priceLevelNum(place.priceLevel);
  if (lvl !== null && state.hard.budgetCeiling !== null) {
    const est = PER_PERSON_FOOD[lvl] || 0;
    s += est <= state.hard.budgetCeiling * 0.6 ? 0.6 : est <= state.hard.budgetCeiling ? 0.25 : -1.5;
  }
  const miles = milesBetween(origin, place);
  if (miles != null) {
    // A group that said "Walking" wants a place they can actually walk to,
    // not just a transport label that happens to say Walk when it's close
    // enough by chance — score by walking time instead of driving time so
    // the venue picker itself prefers what's genuinely nearby.
    const walking = state.soft.transport?.leader === 'Walking';
    const mins = walking ? miles * 20 : (miles / 28) * 60;
    if (state.hard.maxMinutes !== null && mins > state.hard.maxMinutes) s -= 3;  // hard limit
    s -= mins / (walking ? 25 : 45);
  }
  if (place.openNow === false) s -= 0.5;
  return s;
}

/**
 * Generate the plan.
 * @returns a plan object with itinerary, costs, weather, caveats and sources.
 */
async function generate(plan, { origin } = {}) {
  const state = consensus.build(plan);
  const group = Math.max(1, state.attendingCount || state.participantCount || plan.intent?.groupSize || 1);
  const start = origin || plan.origin || null;
  const caveats = [];
  const sources = [];

  const resolvedDate = plan.date || state.hard.date;

  // ── Weather (free, so always attempted for outdoor-capable plans)
  let wx = { available: false, reason: 'no_location' };
  if (start?.lat != null) {
    wx = await weather.forecast(start.lat, start.lon, resolvedDate);
    if (wx.available) sources.push({ kind: 'weather', provider: 'open-meteo', fetchedAt: wx.fetchedAt });
    else caveats.push("Weather data isn't available right now.");
  }

  // ── The seeded event (if this plan started from "Start an idea with
  // this" on a specific concert/show) is the actual reason the plan
  // exists — it goes in as a real stop using the venue/address/time
  // Ticketmaster already gave us, never a Places search for something
  // generic. Everything else in the itinerary fills in AROUND it.
  const slots = [];
  const seed = state.intent.seed;
  if (seed?.kind === 'event') {
    slots.push({
      slot: 'event', label: seed.title || plan.intent?.title || 'The show', resolved: true,
      pick: {
        name: seed.title || plan.title, address: seed.address, venue: seed.venue,
        lat: seed.lat, lon: seed.lon, website: seed.officialUrl, provider: 'ticketmaster',
      },
      alternatives: [],
    });
    sources.push({ kind: 'event', provider: 'ticketmaster', title: seed.title });
  }

  for (const term of searchTerms(state)) {
    const res = await places.search({
      query: term.query, lat: start?.lat, lon: start?.lon,
      radiusMeters: Math.min(50000, (state.hard.maxMinutes ?? 30) * 750),
      planId: plan.id, limit: 8,
    });
    if (!res.available) {
      slots.push({ ...term, resolved: false, reason: res.reason });
      continue;
    }
    sources.push({ kind: 'places', provider: 'google_places', query: term.query, cached: res.cached });
    const viable = res.places.filter(p => fits(p, state));
    const ranked = viable
      .map(p => ({ place: p, score: scorePlace(p, state, start) }))
      .sort((a, b) => b.score - a.score);
    slots.push({
      ...term, resolved: ranked.length > 0,
      pick: ranked[0]?.place || null,
      alternatives: ranked.slice(1, 4).map(r => r.place),
      filteredOut: res.places.length - viable.length,
    });
  }

  const unresolved = slots.filter(s => !s.resolved);
  if (unresolved.length) {
    const why = unresolved[0].reason;
    caveats.push(
      why === 'places_not_configured'
        ? "Live venue search isn't connected yet, so this plan has the shape and budget but no specific venues."
        : why?.endsWith('_ceiling')
          ? "Venue search hit today's spending limit. The plan structure is below; specific venues will fill in tomorrow."
          : "We couldn't verify venues right now, so none are named here rather than guessing."
    );
  }

  // ── Timeline
  // The organizer's own words name the occasion: "dinner Saturday" is dinner,
  // whatever the group answered to "when works for you?" — that question asks
  // about availability, not about what meal this is. The group vote only fills
  // the gap when the request itself gave no time signal.
  const baseHour = { Morning: 10, Afternoon: 13, Evening: 18, 'Late night': 21 }[
    state.intent.timeOfDay || state.soft.timing?.leader || 'Evening'
  ] || 18;

  const itinerary = [];
  const costLines = [];
  let clock = baseHour * 60;
  let cursor = start;

  // Only announce a departure when we can actually compute a journey. With no
  // origin or no resolved venue there is no travel time to state, and printing
  // "Leave" at the same minute as the first stop just looks broken.
  const canRoute = Boolean(start?.lat != null) && slots.some(s => s.pick);
  if (canRoute) {
    itinerary.push({ time: fmt(clock), title: 'Leave', detail: start?.label ? `From ${start.label}` : 'Meet up and head out', kind: 'depart' });
  }

  for (const slot of slots) {
    const dest = slot.pick;
    const miles = dest ? milesBetween(cursor, dest) : null;
    const opts = transportOptions(miles, group, state.soft.transport?.leader);
    const lead = opts[0];
    if (lead) {
      clock += lead.minutes;
      itinerary.push({
        time: fmt(clock - lead.minutes), title: `${lead.mode} — ${lead.minutes} min`,
        detail: miles != null ? `${miles.toFixed(1)} miles` : null,
        kind: 'travel', transport: opts, estimate: true,
      });
      if (lead.costPerPerson > 0) {
        costLines.push({ label: `${lead.mode} (round trip)`, perPerson: Math.round(lead.costPerPerson * 2 * 100) / 100,
          estimate: true, basis: lead.note || 'Distance-based estimate' });
      }
    }

    const dwell = slot.slot === 'food' ? 80 : slot.slot === 'nightlife' ? 120 : 150;
    // Distance from the user's own starting point specifically — not the
    // leg above (which is distance from the PREVIOUS stop, useful for "how
    // long to get there next" but not "how far is this place from me").
    // Every recommended place gets this, including alternatives, so a
    // group can actually tell how far they'd be traveling for each option.
    const milesFromUser = dest ? milesBetween(start, dest) : null;
    itinerary.push({
      time: fmt(clock), title: slot.label,
      kind: slot.slot,
      place: dest ? {
        name: dest.name, address: dest.address, rating: dest.rating, ratingCount: dest.ratingCount,
        priceLevel: dest.priceLevel, hours: dest.hours, phone: dest.phone,
        website: dest.website, mapsUrl: dest.mapsUrl, provider: dest.provider, fetchedAt: dest.fetchedAt,
        distanceMiles: milesFromUser != null ? Math.round(milesFromUser * 10) / 10 : null,
      } : null,
      unresolved: !slot.resolved,
      unresolvedMessage: slot.resolved ? null : "We couldn't verify a specific venue for this — pick one together and we'll fill in the details.",
      alternatives: (slot.alternatives || []).map(a => {
        const m = milesBetween(start, a);
        return { name: a.name, address: a.address, rating: a.rating, mapsUrl: a.mapsUrl,
          distanceMiles: m != null ? Math.round(m * 10) / 10 : null };
      }),
      bookingUrl: dest?.website || null,
      durationMinutes: dwell,
    });

    if (slot.slot === 'food') {
      const lvl = dest ? priceLevelNum(dest.priceLevel) : null;
      const est = lvl !== null ? PER_PERSON_FOOD[lvl] : (state.hard.budgetCeiling !== null ? Math.min(22, state.hard.budgetCeiling) : 22);
      if (est > 0) costLines.push({ label: 'Food', perPerson: est, estimate: true,
        basis: lvl !== null ? `Google price level ${lvl} for this venue` : 'Typical local spend — no venue confirmed' });
    }
    clock += dwell;
    if (dest) cursor = dest;
  }

  const backMiles = milesBetween(cursor, start);
  if (backMiles != null) {
    const back = transportOptions(backMiles, group, state.soft.transport?.leader)[0];
    if (back) {
      itinerary.push({ time: fmt(clock), title: `Head back — ${back.minutes} min`, kind: 'return',
        detail: `${backMiles.toFixed(1)} miles`, transport: transportOptions(backMiles, group, state.soft.transport?.leader) });
      clock += back.minutes;
    }
  } else if (canRoute) {
    itinerary.push({ time: fmt(clock), title: 'Head home', kind: 'return' });
  }

  const perPerson = Math.round(costLines.reduce((s, l) => s + l.perPerson, 0) * 100) / 100;
  const overBudget = state.hard.budgetCeiling !== null && perPerson > state.hard.budgetCeiling;
  if (overBudget) caveats.push(overBudgetCaveat(perPerson, state.hard.budgetCeiling, costLines));
  if (state.hard.dietary.length) {
    caveats.push(`Dietary needs in the group: ${state.hard.dietary.join(', ')}. Confirm the venue can accommodate before you go.`);
  }
  if (wx.available && weather.outdoorPenalty(wx) > 0.4 && (state.intent.categories || []).includes('outdoors')) {
    caveats.push(`Weather looks rough (${wx.summary}, ${wx.precipChance}% chance of rain, high ${wx.highF}°F). Consider an indoor backup.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    title: plan.intent?.title || plan.title || 'Your plan',
    date: resolvedDate || null,
    groupSize: group,
    confirmed: state.confirmedCount,
    window: `${fmt(baseHour * 60)} – ${fmt(clock)}`,
    itinerary,
    cost: {
      perPerson, total: Math.round(perPerson * group * 100) / 100,
      lines: costLines, isEstimate: true,
      note: 'Every figure here is an estimate. Nothing has been booked or charged.',
    },
    weather: wx,
    constraints: state.hard,
    leaning: Object.fromEntries(Object.entries(state.soft).filter(([, v]) => v?.converged).map(([k, v]) => [k, v.leader])),
    caveats,
    sources,
    unresolvedSlots: unresolved.length,
  };
}

function fmt(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${ampm}`;
}

export { generate, transportOptions, milesBetween, fmt, searchTerms, fits, overBudgetCaveat };
export default { generate, transportOptions, milesBetween, fmt, searchTerms, fits, overBudgetCaveat };