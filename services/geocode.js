'use strict';
/**
 * Reverse geocoding — turns lat/lon into "City, ST" for display. Proxied
 * through the server exactly like Places, so the Google key never reaches
 * the client. Best-effort only: on any failure the caller falls back to a
 * generic label rather than guessing a city.
 */
const cache = require('../lib/cache');

const KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const enabled = () => Boolean(KEY);

/** @returns {{available:true, city:string}|{available:false, reason:string}} */
async function cityFor(lat, lon) {
  if (!enabled()) return { available: false, reason: 'geocode_not_configured' };
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { available: false, reason: 'no_location' };

  const key = `geocode:${lat.toFixed(3)},${lon.toFixed(3)}`;
  let googleStatus = null;
  const { value } = await cache.wrap(key, cache.TTL.geocode, async () => {
    try {
      // No result_type filter: restricting to exactly "locality" returned
      // ZERO_RESULTS for real coordinates that plainly have a city — safer
      // to fetch the full result set and pick the best component ourselves.
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${KEY}`;
      const res = await fetch(url);
      // Google's Geocoding API returns HTTP 200 even on REQUEST_DENIED,
      // OVER_QUERY_LIMIT, or ZERO_RESULTS — the real outcome is in the JSON
      // body's `status` field, not the HTTP status code. Checking only
      // `res.ok` (as this used to) meant every one of those failure modes
      // looked identical and silently returned nothing to debug.
      const j = await res.json();
      googleStatus = j.status || (res.ok ? 'UNKNOWN' : `HTTP_${res.status}`);
      if (j.status !== 'OK') return undefined;

      // Prefer a result that actually HAS a locality component, rather
      // than just taking results[0] (which is sometimes a plus-code or a
      // route with no city on it at all).
      const withCity = (j.results || []).find(r =>
        r.address_components?.some(c => c.types.includes('locality') || c.types.includes('postal_town')));
      const result = withCity || j.results?.[0];
      if (!result) return undefined;
      const comp = result.address_components || [];
      const city = comp.find(c => c.types.includes('locality'))?.long_name
        || comp.find(c => c.types.includes('postal_town'))?.long_name
        || comp.find(c => c.types.includes('sublocality'))?.long_name
        || comp.find(c => c.types.includes('administrative_area_level_2'))?.long_name;
      const state = comp.find(c => c.types.includes('administrative_area_level_1'))?.short_name;
      if (!city) return undefined;
      return state ? `${city}, ${state}` : city;
    } catch (err) { googleStatus = `EXCEPTION_${err.message}`; return undefined; }
  });

  if (!value) return { available: false, reason: 'provider_unavailable', detail: googleStatus };
  return { available: true, city: value };
}

module.exports = { cityFor, enabled };
