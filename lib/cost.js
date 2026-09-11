'use strict';
/**
 * PLANZO SPEND GOVERNOR
 * ─────────────────────
 * Every call that costs money — AI tokens, Google Places requests — is
 * metered here BEFORE it is made and recorded AFTER it returns.
 *
 * Three ceilings, all hard:
 *   1. per-plan   — one plan can never burn the day's budget
 *   2. per-day    — resets at UTC midnight
 *   3. per-month  — resets on the 1st
 *
 * When a ceiling is hit, reserve() returns {ok:false}. Callers MUST then
 * degrade to the deterministic engine or report the data as unavailable.
 * They must never fabricate a result. Nothing retries past a ceiling.
 *
 * The ledger lives in Redis as atomic counters, so two concurrent requests
 * cannot both slip under the same ceiling.
 */
const store = require('./store');

const USD = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : d; };

const LIMITS = {
  ai: {
    perPlan: USD(process.env.PLANZO_AI_PER_PLAN_USD, 0.05),
    daily:   USD(process.env.PLANZO_AI_DAILY_USD, 1.00),
    monthly: USD(process.env.PLANZO_AI_MONTHLY_USD, 20.00),
  },
  places: {
    perPlan: USD(process.env.PLANZO_PLACES_PER_PLAN_USD, 0.10),
    daily:   USD(process.env.PLANZO_PLACES_DAILY_USD, 2.00),
    monthly: USD(process.env.PLANZO_PLACES_MONTHLY_USD, 40.00),
  },
};

/**
 * Published list prices, USD per million tokens.
 * Kept here so a price change is a one-line edit, not a hunt.
 */
const MODEL_PRICES = {
  // OpenAI
  'gpt-4.1-nano':              { in: 0.10,  out: 0.40 },
  'gpt-4.1-mini':              { in: 0.40,  out: 1.60 },
  'gpt-4o-mini':               { in: 0.15,  out: 0.60 },
  'gpt-4.1':                   { in: 2.00,  out: 8.00 },
  // Anthropic
  'claude-haiku-4-5-20251001': { in: 1.00,  out: 5.00 },
  'claude-sonnet-5':           { in: 3.00,  out: 15.00 },
  'claude-opus-5':             { in: 15.00, out: 75.00 },
};

/** Unknown model: price it as the most expensive one we know, so an
 *  unrecognised name can never sneak under a ceiling by being free. */
const FALLBACK_PRICE = { in: 15.00, out: 75.00 };

/** Google Maps Platform Places list price, USD per request. */
const PLACES_PRICES = { textsearch: 0.032, details: 0.017, nearby: 0.032 };

function estimateAiCost(model, inTokens, outTokens) {
  const p = MODEL_PRICES[model] || FALLBACK_PRICE;
  return (inTokens / 1e6) * p.in + (outTokens / 1e6) * p.out;
}

const dayKey   = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);

async function spent(service) {
  const [day, month] = await Promise.all([
    store.get(`spend:${service}:day:${dayKey()}`),
    store.get(`spend:${service}:month:${monthKey()}`),
  ]);
  return { day: Number(day) || 0, month: Number(month) || 0 };
}

/**
 * Ask permission to spend `estimateUsd` on `service`.
 * Returns {ok:true} or {ok:false, reason, ceiling, spent}.
 */
async function reserve(service, estimateUsd, { planId } = {}) {
  const limits = LIMITS[service];
  if (!limits) return { ok: false, reason: 'unknown_service' };

  const { day, month } = await spent(service);
  if (month + estimateUsd > limits.monthly)
    return { ok: false, reason: 'monthly_ceiling', ceiling: limits.monthly, spent: month };
  if (day + estimateUsd > limits.daily)
    return { ok: false, reason: 'daily_ceiling', ceiling: limits.daily, spent: day };

  if (planId) {
    const perPlan = Number(await store.get(`spend:${service}:plan:${planId}`)) || 0;
    if (perPlan + estimateUsd > limits.perPlan)
      return { ok: false, reason: 'plan_ceiling', ceiling: limits.perPlan, spent: perPlan };
  }
  return { ok: true };
}

/** Record actual spend. Always call this, even on a failed provider call. */
async function record(service, usd, { planId, detail } = {}) {
  if (!(usd > 0)) return;
  const ops = [
    store.incrBy(`spend:${service}:day:${dayKey()}`, usd, 60 * 60 * 48),
    store.incrBy(`spend:${service}:month:${monthKey()}`, usd, 60 * 60 * 24 * 40),
  ];
  if (planId) ops.push(store.incrBy(`spend:${service}:plan:${planId}`, usd, 60 * 60 * 24 * 30));
  await Promise.all(ops);
  await store.push('spend:log', {
    at: new Date().toISOString(), service, usd: Number(usd.toFixed(6)), planId: planId || null, detail: detail || null,
  }, 300);
}

/** Full picture for the ops dashboard. */
async function report() {
  const out = { generatedAt: new Date().toISOString(), services: {} };
  for (const service of Object.keys(LIMITS)) {
    const s = await spent(service);
    out.services[service] = {
      limits: LIMITS[service],
      // 6dp, not 4: a gpt-4.1-nano call costs ~$0.000023, so rounding to
      // 4 places reports every real charge as $0.0000 and makes the spend
      // dashboard look broken.
      spentToday: Number(s.day.toFixed(6)),
      spentThisMonth: Number(s.month.toFixed(6)),
      dailyRemaining: Number(Math.max(0, LIMITS[service].daily - s.day).toFixed(6)),
      monthlyRemaining: Number(Math.max(0, LIMITS[service].monthly - s.month).toFixed(6)),
      callsRemainingAtCurrentRate: null,   // filled in below when we have a rate
      blocked: s.day >= LIMITS[service].daily || s.month >= LIMITS[service].monthly,
    };
  }
  out.recent = (await store.get('spend:log')) || [];

  // How many more calls today's budget buys, based on what calls have
  // actually cost so far. Far more useful than a dollar figure at this scale.
  for (const [service, s] of Object.entries(out.services)) {
    const charges = out.recent.filter(r => r.service === service && r.usd > 0);
    if (!charges.length) continue;
    const avg = charges.reduce((a, b) => a + b.usd, 0) / charges.length;
    s.avgCostPerCall = Number(avg.toFixed(6));
    s.callsRemainingAtCurrentRate = Math.floor(s.dailyRemaining / avg);
  }
  return out;
}

module.exports = { reserve, record, report, spent, estimateAiCost, LIMITS, MODEL_PRICES, PLACES_PRICES };
