// @ts-nocheck
/* The spend governor lives server-side. In the browser the guard is the
   per-day call cap in lib/config.ts, so this reports zero cost and never
   blocks — it exists only to satisfy the engine's import. */
export const PLACES_PRICES = { textsearch: 0.032, details: 0.017, nearby: 0.032 };
export const LIMITS = {};
export async function reserve() { return { ok: true }; }
export async function record() {}
export async function report() { return { services: {} }; }
export const estimateAiCost = () => 0;
export default { reserve, record, report, estimateAiCost, PLACES_PRICES, LIMITS };
