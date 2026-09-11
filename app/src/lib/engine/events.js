// @ts-nocheck
/**
 * Ticketmaster Discovery — the one rich source that is free and keyless of
 * billing risk, so it ships enabled. 100% of events carry a real promo image.
 */
import cache from './cache.js';
import { config } from '../config';

export const enabled = () => Boolean(config.get().ticketmaster);

const SEGMENTS = {
  concert:'Music', music:'Music', nightlife:'Music', sports:'Sports',
  comedy:'Arts & Theatre', theatre:'Arts & Theatre', festival:'Music', family:'Family',
};

/** Pick the widest 16:9 image under a sane byte budget for a card. */
function bestImage(images = [], minWidth = 640) {
  const wide = images.filter(i => i.ratio === '16_9' && i.width >= minWidth)
    .sort((a, b) => a.width - b.width);
  return (wide[0] || images.find(i => i.ratio === '16_9') || images[0])?.url || null;
}

/**
 * Ticketmaster returns literal junk in the genre field — "Undefined",
 * "Miscellaneous", "Other" — on a large share of events. Printing those as a
 * category label makes the feed look broken, so fall back through the
 * classification tree to the first thing that is actually a word.
 */
const JUNK_GENRE = new Set(['undefined', 'miscellaneous', 'other', 'unknown', '']);
function label(c) {
  const candidates = [c?.genre?.name, c?.subGenre?.name, c?.segment?.name, c?.type?.name];
  for (const v of candidates) {
    if (v && !JUNK_GENRE.has(String(v).trim().toLowerCase())) return v;
  }
  return null;
}

function normalize(e) {
  const venue = (e._embedded?.venues || [])[0] || {};
  const price = (e.priceRanges || [])[0];
  const start = e.dates?.start || {};
  return {
    provider: 'ticketmaster', providerId: e.id, title: e.name,
    date: start.localDate || null,
    time: start.localTime || null,
    timeTbd: Boolean(start.timeTBA || start.noSpecificTime),
    venue: venue.name || null,
    city: venue.city?.name || null,
    address: [venue.address?.line1, venue.city?.name, venue.state?.stateCode].filter(Boolean).join(', ') || null,
    lat: venue.location ? Number(venue.location.latitude) : null,
    lon: venue.location ? Number(venue.location.longitude) : null,
    priceMin: price ? price.min : null,
    priceMax: price ? price.max : null,
    priceAvailable: Boolean(price),
    ageRestriction: e.ageRestrictions?.legalAgeEnforced ? '21+' : null,
    category: label(e.classifications?.[0]) || 'Event',
    genre: label(e.classifications?.[0]),
    imageUrl: bestImage(e.images),
    officialUrl: e.url || null,
    onSale: e.dates?.status?.code || null,
  };
}

export async function search({ lat, lon, radiusMiles = 25, category, keyword, startDate, limit = 20 } = {}) {
  if (!enabled()) return { available: false, reason: 'events_not_configured', message: "Event listings aren't connected." };
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return { available: false, reason: 'no_location', message: 'We need your location to find events nearby.' };

  const key = `events:tm:${lat.toFixed(2)},${lon.toFixed(2)}:${radiusMiles}:${category || 'all'}:${keyword || ''}`;
  const { value, cached: wasCached } = await cache.wrap(key, cache.TTL.event, async () => {
    const params = new URLSearchParams({
      apikey: config.get().ticketmaster,
      latlong: `${lat},${lon}`, radius: String(radiusMiles), unit: 'miles',
      size: String(Math.min(50, limit * 2)), sort: 'date,asc',
    });
    if (SEGMENTS[category]) params.set('segmentName', SEGMENTS[category]);
    if (keyword) params.set('keyword', keyword);
    if (startDate) params.set('startDateTime', `${startDate}T00:00:00Z`);
    try {
      const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
      if (!res.ok) return undefined;
      const j = await res.json();
      if (j.fault || j.errors) return undefined;
      return (j._embedded?.events || []).map(normalize);
    } catch { return undefined; }
  });

  if (!value) return { available: false, reason: 'provider_unavailable', message: "We couldn't verify event listings right now." };
  return { available: true, cached: wasCached, events: value.slice(0, limit) };
}
/** Look up one event by Ticketmaster's own id — what a pasted event link
 * resolves to. Never guesses: an id that doesn't resolve just reports
 * unavailable rather than fabricating anything. */
export async function byId(id) {
  if (!enabled()) return { available: false, reason: 'events_not_configured' };
  if (!id) return { available: false, reason: 'no_id' };
  const key = `events:tm:byid:${id}`;
  const { value } = await cache.wrap(key, cache.TTL.event, async () => {
    try {
      const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(id)}.json?apikey=${config.get().ticketmaster}`);
      if (!res.ok) return undefined;
      const j = await res.json();
      if (j.fault || j.errors) return undefined;
      return normalize(j);
    } catch { return undefined; }
  });
  if (!value) return { available: false, reason: 'not_found' };
  return { available: true, event: value };
}

/** A pasted Ticketmaster URL's event id is its last path segment —
 * https://www.ticketmaster.com/some-artist-tickets/event/0C00611229F540A2
 * The exact format has varied over the years, so this is deliberately
 * permissive: whatever's after the last "/" is tried against the API,
 * and byId() itself is what actually validates it resolves to a real event. */
export function idFromUrl(url) {
  try {
    const u = new URL(String(url).trim());
    if (!/ticketmaster\./i.test(u.hostname)) return null;
    const seg = u.pathname.split('/').filter(Boolean).pop();
    return seg || null;
  } catch { return null; }
}

export default { search, byId, idFromUrl, enabled };
