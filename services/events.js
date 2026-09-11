'use strict';
/**
 * Event discovery — Ticketmaster Discovery API.
 *
 * Free tier: 5,000 requests/day, no billing account. That makes events the
 * one rich data source Planzo can lean on hard without a cost ceiling, so
 * this caches by area rather than metering spend.
 *
 * Honesty rules still apply. Ticketmaster omits priceRanges on a large share
 * of events; when it does, this reports the price as unavailable rather than
 * guessing one, and every event carries the official link so the user buys
 * from the real seller (spec §10, §29).
 */
const cache = require('../lib/cache');

const KEY = process.env.TICKETMASTER_API_KEY || '';
const PROVIDER = process.env.EVENT_PROVIDER || '';
const enabled = () => Boolean(PROVIDER === 'ticketmaster' && KEY);

/** Planzo category → Ticketmaster classification segment. */
const SEGMENTS = {
  concert: 'Music', music: 'Music', nightlife: 'Music',
  sports: 'Sports', comedy: 'Arts & Theatre', theatre: 'Arts & Theatre',
  festival: 'Music', family: 'Family',
};

function normalize(e) {
  const venue = (e._embedded?.venues || [])[0] || {};
  const price = (e.priceRanges || [])[0];
  const start = e.dates?.start || {};
  const img = (e.images || [])
    .filter(i => i.ratio === '16_9' && i.width >= 640)
    .sort((a, b) => a.width - b.width)[0] || (e.images || [])[0];

  return {
    provider: 'ticketmaster',
    providerId: e.id,
    title: e.name,
    // Ticketmaster returns date and time separately, and time is often absent
    // for all-day or unannounced events. Keep them separate rather than
    // fabricating a midnight start.
    date: start.localDate || null,
    time: start.localTime || null,
    timeTbd: Boolean(start.timeTBA || start.noSpecificTime),
    venue: venue.name || null,
    address: [venue.address?.line1, venue.city?.name, venue.state?.stateCode]
      .filter(Boolean).join(', ') || null,
    lat: venue.location ? Number(venue.location.latitude) : null,
    lon: venue.location ? Number(venue.location.longitude) : null,
    // Price is unavailable far more often than it is present. Say so.
    priceMin: price ? price.min : null,
    priceMax: price ? price.max : null,
    priceCurrency: price ? price.currency : null,
    priceAvailable: Boolean(price),
    ageRestriction: e.ageRestrictions?.legalAgeEnforced ? '21+' : null,
    category: e.classifications?.[0]?.segment?.name || null,
    genre: e.classifications?.[0]?.genre?.name || null,
    imageUrl: img?.url || null,
    officialUrl: e.url || null,
    onSale: e.dates?.status?.code || null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * @returns {{available:true, events:Array}|{available:false, reason, message}}
 */
async function search({ lat, lon, radiusMiles = 25, category, keyword, startDate, endDate, limit = 20 } = {}) {
  if (!enabled()) {
    return { available: false, reason: 'events_not_configured',
      message: "Live event listings aren't connected yet." };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { available: false, reason: 'no_location',
      message: 'We need your location to find events nearby.' };
  }

  const key = `events:tm:${lat.toFixed(2)},${lon.toFixed(2)}:${radiusMiles}:${category || 'all'}`
    + `:${keyword || ''}:${startDate || ''}`;

  const { value, cached: wasCached } = await cache.wrap(key, cache.TTL.event, async () => {
    const params = new URLSearchParams({
      apikey: KEY,
      latlong: `${lat},${lon}`,
      radius: String(radiusMiles),
      unit: 'miles',
      size: String(Math.min(50, limit * 2)),
      sort: 'date,asc',
    });
    if (SEGMENTS[category]) params.set('segmentName', SEGMENTS[category]);
    if (keyword) params.set('keyword', keyword);
    if (startDate) params.set('startDateTime', `${startDate}T00:00:00Z`);
    if (endDate) params.set('endDateTime', `${endDate}T23:59:59Z`);

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
        { signal: ctl.signal });
      if (!res.ok) return undefined;
      const j = await res.json();
      if (j.fault || j.errors) return undefined;
      return (j._embedded?.events || []).map(normalize);
    } catch { return undefined; }
    finally { clearTimeout(t); }
  });

  if (!value) {
    return { available: false, reason: 'provider_unavailable',
      message: "We couldn't verify event listings right now." };
  }
  return { available: true, cached: wasCached, events: value.slice(0, limit) };
}

/** Events usable as the anchor of a plan — dated, priced, still on sale. */
async function anchorable(opts) {
  const res = await search(opts);
  if (!res.available) return res;
  return {
    ...res,
    events: res.events.filter(e => e.date && e.onSale !== 'cancelled' && e.onSale !== 'offsale'),
  };
}

module.exports = { search, anchorable, enabled, normalize };
