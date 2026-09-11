'use strict';
/**
 * Fixed-window rate limiter over the shared store.
 * Guards every route that can cost money or be abused:
 * plan creation, AI calls, waitlist signups, ticket validation, reminders.
 */
const store = require('./store');

const RULES = {
  waitlist:     { limit: 5,   windowSec: 3600 },
  plan_create:  { limit: 20,  windowSec: 3600 },
  plan_answer:  { limit: 200, windowSec: 3600 },
  ai:           { limit: 60,  windowSec: 3600 },
  checkin:      { limit: 600, windowSec: 3600 },
  reminder:     { limit: 10,  windowSec: 3600 },
  event_create: { limit: 10,  windowSec: 86400 },
  default:      { limit: 120, windowSec: 3600 },
};

/** @returns {{ok:boolean, remaining:number, retryAfter:number}} */
async function check(bucket, identity) {
  const rule = RULES[bucket] || RULES.default;
  const window = Math.floor(Date.now() / 1000 / rule.windowSec);
  const key = `rl:${bucket}:${window}:${identity}`;
  const count = await store.incrBy(key, 1, rule.windowSec + 60);
  return {
    ok: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfter: rule.windowSec,
  };
}

module.exports = { check, RULES };
