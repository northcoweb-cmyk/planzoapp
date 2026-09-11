'use strict';
/**
 * Weather via Open-Meteo — free, keyless, no account, no bill.
 * Chosen deliberately: weather is needed on nearly every plan, so a paid
 * per-call provider here would be a recurring cost for no advantage.
 */
const cache = require('../lib/cache');

const CODES = {
  0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast', 45:'Fog', 48:'Freezing fog',
  51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle', 61:'Light rain', 63:'Rain', 65:'Heavy rain',
  71:'Light snow', 73:'Snow', 75:'Heavy snow', 80:'Rain showers', 81:'Rain showers', 82:'Heavy showers',
  95:'Thunderstorms', 96:'Thunderstorms with hail', 99:'Severe thunderstorms',
};

// new Date().toISOString().slice(0,10) is the UTC date — for anyone west
// of Greenwich in the evening, UTC has already rolled to tomorrow, so
// "today's weather" with no explicit date silently became tomorrow's
// forecast. This uses the wall-clock local date of whatever runs it
// instead; the caller should still pass an explicit dateISO when it knows
// the user's own local date (the browser client does).
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * @returns {{available:true, ...}|{available:false, reason:string}}
 * Never returns invented weather. An outage reports unavailable.
 */
async function forecast(lat, lon, dateISO) {
  if (process.env.PLANZO_WEATHER_ENABLED === 'false') return { available: false, reason: 'disabled' };
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { available: false, reason: 'no_location' };

  const day = (dateISO || localToday()).slice(0, 10);
  const key = `weather:${lat.toFixed(2)},${lon.toFixed(2)}:${day}`;

  const { value, cached } = await cache.wrap(key, cache.TTL.weather, async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`
      + `&hourly=temperature_2m,precipitation_probability,weather_code`
      + `&temperature_unit=fahrenheit&timezone=auto&start_date=${day}&end_date=${day}`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) return undefined;
      const j = await res.json();
      const d = j.daily;
      if (!d || !d.time || !d.time.length) return undefined;
      return {
        date: d.time[0],
        code: d.weather_code[0],
        summary: CODES[d.weather_code[0]] || 'Unknown',
        highF: Math.round(d.temperature_2m_max[0]),
        lowF: Math.round(d.temperature_2m_min[0]),
        precipChance: d.precipitation_probability_max[0],
        hourly: (j.hourly?.time || []).map((t2, i) => ({
          time: t2, tempF: Math.round(j.hourly.temperature_2m[i]), precip: j.hourly.precipitation_probability[i],
        })),
        source: 'open-meteo', fetchedAt: new Date().toISOString(),
      };
    } catch { return undefined; }
    finally { clearTimeout(t); }
  });

  if (!value) return { available: false, reason: 'provider_unavailable' };
  return { available: true, cached, ...value };
}

/** Would this weather ruin an outdoor plan? Used by the ranker. */
function outdoorPenalty(w) {
  if (!w || !w.available) return 0;
  let p = 0;
  if (w.precipChance >= 60) p += 0.5;
  else if (w.precipChance >= 35) p += 0.25;
  if ([95, 96, 99, 65, 75, 82].includes(w.code)) p += 0.4;
  if (w.highF <= 40) p += 0.35;
  if (w.highF >= 97) p += 0.25;
  return Math.min(1, p);
}

module.exports = { forecast, outdoorPenalty, CODES };
