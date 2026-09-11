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
  const { value } = await cache.wrap(key, cache.TTL.geocode, async () => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&result_type=locality&key=${KEY}`;
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const j = await res.json();
      const result = (j.results || [])[0];
      if (!result) return undefined;
      const comp = result.address_components || [];
      const city = comp.find(c => c.types.includes('locality'))?.long_name
        || comp.find(c => c.types.includes('sublocality'))?.long_name
        || comp.find(c => c.types.includes('postal_town'))?.long_name;
      const state = comp.find(c => c.types.includes('administrative_area_level_1'))?.short_name;
      if (!city) return undefined;
      return state ? `${city}, ${state}` : city;
    } catch { return undefined; }
  });

  if (!value) return { available: false, reason: 'provider_unavailable' };
  return { available: true, city: value };
}

module.exports = { cityFor, enabled };
