// @ts-nocheck
/**
 * Google Places from the browser.
 *
 * Normal build: proxied through the Planzo server, which holds the key in
 * its own env — nothing billable ever touches the client. Single-file
 * download build: no server to call, so it falls back to a key the user
 * pastes into Settings on their own device.
 *
 * Photo policy: at most ONE photo per venue, at the smallest usable width,
 * and once fetched the resolved URL is stored permanently against the place
 * id — we never pay for the same venue's photo twice.
 */
import cache from './cache.js';
import store from './store.js';
import { config, spendGuard, hasServer } from '../config';

const SEARCH_FIELDS = [
  'places.id','places.displayName','places.formattedAddress','places.location',
  'places.rating','places.userRatingCount','places.priceLevel','places.types',
  'places.currentOpeningHours.openNow','places.websiteUri','places.googleMapsUri',
  'places.photos',
].join(',');

export const enabled = () => hasServer || Boolean(config.get().places);

function normalize(p) {
  return {
    providerId: p.id, provider: 'google_places',
    name: p.displayName?.text || null,
    address: p.formattedAddress || null,
    lat: p.location?.latitude ?? null, lon: p.location?.longitude ?? null,
    rating: p.rating ?? null, ratingCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ?? null, types: p.types || [],
    openNow: p.currentOpeningHours?.openNow ?? null,
    website: p.websiteUri || null,
    mapsUrl: p.googleMapsUri || (p.id ? `https://www.google.com/maps/place/?q=place_id:${p.id}` : null),
    photoRef: p.photos?.[0]?.name || null,
    fetchedAt: new Date().toISOString(),
  };
}

async function searchViaServer(query, lat, lon, limit) {
  const params = new URLSearchParams({ q: query });
  if (Number.isFinite(lat)) params.set('lat', String(lat));
  if (Number.isFinite(lon)) params.set('lon', String(lon));
  try {
    const res = await fetch(`${config.get().serverUrl}/api/discover?${params}`);
    const j = await res.json();
    if (!j.available) return { available: false, reason: j.reason || 'provider_unavailable' };
    return { available: true, cached: Boolean(j.cached), places: (j.places || []).slice(0, limit) };
  } catch {
    return { available: false, reason: 'provider_unreachable' };
  }
}

export async function search({ query, lat, lon, radiusMeters = 16000, limit = 12, openNow }) {
  if (!enabled()) return { available: false, reason: 'places_not_configured' };
  if (!query) return { available: false, reason: 'no_query' };

  if (hasServer) return searchViaServer(query, lat, lon, limit);

  const key = `places:search:${query.toLowerCase().trim()}:${lat?.toFixed(2)},${lon?.toFixed(2)}:${radiusMeters}`;
  const pre = await store.get('cache:' + key);
  if (pre?.v) return { available: true, cached: true, places: pre.v.slice(0, limit) };

  if (!spendGuard('places')) return { available: false, reason: 'daily_cap_reached' };

  const { value } = await cache.wrap(key, cache.TTL.place_search, async () => {
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.get().places,
          'X-Goog-FieldMask': SEARCH_FIELDS,
        },
        body: JSON.stringify({
          textQuery: query, maxResultCount: 20, openNow: openNow || undefined,
          locationBias: Number.isFinite(lat) && Number.isFinite(lon)
            ? { circle: { center: { latitude: lat, longitude: lon }, radius: radiusMeters } }
            : undefined,
        }),
      });
      if (!res.ok) return undefined;
      const j = await res.json();
      return (j.places || []).map(normalize);
    } catch { return undefined; }
  });

  if (!value) return { available: false, reason: 'provider_unavailable' };
  return { available: true, cached: false, places: value.slice(0, limit) };
}

/**
 * One exterior photo per venue, cached forever against the place id.
 * $0.007 each, so this is deliberately called only for a venue that has
 * actually earned a place in a plan or a detail view — never per feed card.
 */
export async function photoFor(place, widthPx = 400) {
  if (!place?.photoRef || !enabled()) return null;
  const key = `photo:${place.providerId}`;
  const cached = await store.get(key);
  if (cached) return cached;

  if (hasServer) {
    try {
      const res = await fetch(
        `${config.get().serverUrl}/api/places/photo?ref=${encodeURIComponent(place.photoRef)}&w=${widthPx}`
      );
      const j = await res.json();
      if (j.uri) await store.set(key, j.uri);
      return j.uri || null;
    } catch { return null; }
  }

  if (!spendGuard('places')) return null;
  const url = `https://places.googleapis.com/v1/${place.photoRef}/media`
    + `?maxWidthPx=${widthPx}&skipHttpRedirect=true&key=${config.get().places}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const uri = j.photoUri || null;
    if (uri) await store.set(key, uri);
    return uri;
  } catch { return null; }
}

export async function details() { return { available: false, reason: 'not_needed_client_side' }; }
export default { search, photoFor, details, enabled };
