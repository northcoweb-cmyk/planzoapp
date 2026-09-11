'use strict';
/**
 * Natural-language search (spec §49).
 *
 * Parses the query into structured filters with the same deterministic
 * parser the plan flow uses, then answers from whatever sources are
 * actually available. It never returns a result it cannot ground.
 */
const intent = require('./intent');
const places = require('../services/places');
const eventsSvc = require('../services/events');

/** "Free stuff near me tonight" → filters the providers can act on. */
function parseQuery(q) {
  const parsed = intent.parse(q);
  const lower = String(q || '').toLowerCase();
  const maxPrice = (lower.match(/under \$?(\d+)/) || [])[1];
  return {
    text: q,
    free: parsed.budgetSignal === 'free',
    maxPrice: maxPrice ? Number(maxPrice) : null,
    categories: parsed.categories,
    when: parsed.dayHint, timeOfDay: parsed.timeOfDay,
    needsFood: parsed.needsFood,
    // What to actually ask a place provider, stripped of the time and money
    // words that mean nothing to a venue search.
    providerQuery: String(q || '')
      .replace(/\b(tonight|tomorrow|this weekend|near me|nearby|cheap|free|under \$?\d+)\b/gi, '')
      .replace(/\s+/g, ' ').trim() || 'things to do',
  };
}

async function run(q, { lat, lon, planId } = {}) {
  const filters = parseQuery(q);
  const sections = [];

  const placeRes = await places.search({
    query: filters.free ? `free ${filters.providerQuery}` : filters.providerQuery,
    lat, lon, planId, limit: 10,
  });
  sections.push(placeRes.available
    ? { kind: 'places', available: true, results: placeRes.places, cached: placeRes.cached }
    : { kind: 'places', available: false, reason: placeRes.reason,
        message: placeRes.reason === 'places_not_configured'
          ? "Venue search isn't connected, so no places are listed rather than guessed."
          : "We couldn't verify places right now." });

  if (filters.categories.includes('event') || /concert|show|game|festival|comedy/i.test(q)) {
    const ev = await eventsSvc.search();
    sections.push({ kind: 'events', available: ev.available, reason: ev.reason, message: ev.message });
  }

  return { filters, sections, groundedResults: sections.some(s => s.available) };
}

module.exports = { run, parseQuery };
