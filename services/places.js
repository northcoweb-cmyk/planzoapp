'use strict';
/**
 * Google Places. Metered, cached hard, and honest when it has nothing.
 *
 * Cost discipline (Places is the single most expensive API in this product):
 *   - Text Search results are cached 12h and reused across every plan in the
 *     same area. Seven friends planning dinner cost ONE search, not seven.
 *   - Place Details is only fetched for places a group actually shortlists,
 *     never for a whole result page.
 *   - Field masks are minimal. Unrequested fields are billed fields.
 *   - Without a key, every function reports unavailable. Nothing is invented.
 */
const cache = require('../lib/cache');
const cost = require('../lib/cost');

const KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const enabled = () => Boolean(KEY);

const SEARCH_FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.rating', 'places.userRatingCount', 'places.priceLevel', 'places.types',
  'places.currentOpeningHours.openNow', 'places.websiteUri', 'places.googleMapsUri',
  'places.photos',
].join(',');

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
  'priceLevel', 'types', 'nationalPhoneNumber', 'websiteUri',
  'currentOpeningHours', 'regularOpeningHours', 'googleMapsUri',
].join(',');

function normalize(p) {
  return {
    providerId: p.id,
    provider: 'google_places',
    name: p.displayName?.text || null,
    address: p.formattedAddress || null,
    lat: p.location?.latitude ?? null,
    lon: p.location?.longitude ?? null,
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ?? null,
    types: p.types || [],
    openNow: p.currentOpeningHours?.openNow ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions || null,
    phone: p.nationalPhoneNumber || null,
    website: p.websiteUri || null,
    mapsUrl: p.googleMapsUri || (p.id ? `https://www.google.com/maps/place/?q=place_id:${p.id}` : null),
    photoRef: p.photos?.[0]?.name || null,
    fetchedAt: new Date().toISOString(),
  };
}

/** One exterior photo per venue, resolved once and cached forever server-side. */
async function photoFor(photoRef, widthPx = 400) {
  if (!enabled() || !photoRef) return null;
  const key = `places:photo:${photoRef}`;
  const store = require('../lib/store');
  const cached = await store.get(key);
  if (cached?.v) return cached.v;

  const permit = await cost.reserve('places', cost.PLACES_PRICES.photo || 0.007, {});
  if (!permit.ok) return null;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=${widthPx}&skipHttpRedirect=true&key=${KEY}`
    );
    await cost.record('places', cost.PLACES_PRICES.photo || 0.007, { detail: 'photo' });
    if (!res.ok) return null;
    const j = await res.json();
    const uri = j.photoUri || null;
    if (uri) await store.set(key, uri);
    return uri;
  } catch { return null; }
}

/**
 * @returns {{available:true, places:Array}|{available:false, reason:string}}
 */
async function search({ query, lat, lon, radiusMeters = 16000, limit = 12, planId, openNow }) {
  if (!enabled()) return { available: false, reason: 'places_not_configured' };
  if (!query) return { available: false, reason: 'no_query' };

  const key = `places:search:${query.toLowerCase().trim()}:${lat?.toFixed(2)},${lon?.toFixed(2)}:${radiusMeters}`;
  const pre = await require('../lib/store').get(`cache:${key}`);
  if (pre && pre.v) return { available: true, cached: true, places: pre.v.slice(0, limit) };

  const permit = await cost.reserve('places', cost.PLACES_PRICES.textsearch, { planId });
  if (!permit.ok) {
    console.warn(`[places] blocked: ${permit.reason}`);
    return { available: false, reason: permit.reason };
  }

  const { value } = await cache.wrap(key, cache.TTL.place_search, async () => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': SEARCH_FIELDS },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 20,
          openNow: openNow || undefined,
          locationBias: Number.isFinite(lat) && Number.isFinite(lon)
            ? { circle: { center: { latitude: lat, longitude: lon }, radius: radiusMeters } }
            : undefined,
        }),
      });
      await cost.record('places', cost.PLACES_PRICES.textsearch, { planId, detail: 'textsearch' });
      if (!res.ok) return undefined;
      const j = await res.json();
      return (j.places || []).map(normalize);
    } catch { return undefined; }
    finally { clearTimeout(t); }
  });

  if (!value) return { available: false, reason: 'provider_unavailable' };
  return { available: true, cached: false, places: value.slice(0, limit) };
}

async function details(providerId, { planId } = {}) {
  if (!enabled()) return { available: false, reason: 'places_not_configured' };
  const key = `places:details:${providerId}`;
  const pre = await require('../lib/store').get(`cache:${key}`);
  if (pre && pre.v) return { available: true, cached: true, place: pre.v };

  const permit = await cost.reserve('places', cost.PLACES_PRICES.details, { planId });
  if (!permit.ok) return { available: false, reason: permit.reason };

  const { value } = await cache.wrap(key, cache.TTL.place_details, async () => {
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(providerId)}`, {
        headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': DETAIL_FIELDS },
      });
      await cost.record('places', cost.PLACES_PRICES.details, { planId, detail: 'details' });
      if (!res.ok) return undefined;
      return normalize(await res.json());
    } catch { return undefined; }
  });

  if (!value) return { available: false, reason: 'provider_unavailable' };
  return { available: true, place: value };
}

module.exports = { search, details, photoFor, enabled };
