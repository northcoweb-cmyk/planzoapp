// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/consensus.js — edit the source, then run scripts-port.mjs */
/**
 * Group state: the single structured view of what a group has decided.
 *
 * This is what makes Planzo a decision engine rather than a poll. Votes are
 * never simply counted:
 *   - HARD constraints intersect. One person's $20 ceiling caps the group.
 *     One person's nut allergy removes options for everybody. A hard
 *     constraint is never outvoted.
 *   - SOFT preferences are scored by a satisfaction function that rewards
 *     the option leaving the FEWEST people unhappy, not the option with the
 *     most first-place votes.
 *
 * Worked example (spec §6): 5 pizza, 1 vegetarian, 1 no preference.
 * Vote-counting picks any pizza place. This picks a pizza place with a
 * vegetarian option, because the vegetarian's hard constraint survives.
 */
import { BUDGET_CEILING, DISTANCE_MINUTES, NARROWING } from './catalog.js';

function tally(participants, questionId) {
  const counts = new Map();
  for (const p of participants) {
    const a = p.answers?.[questionId];
    if (a == null) continue;
    for (const v of [].concat(a)) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

/** Build the derived group state from raw participant answers. */
function build(plan) {
  const participants = plan.participants || [];
  const answered = participants.filter(p => Object.keys(p.answers || {}).length > 0);

  const availability = tally(participants, 'availability');
  const confirmedCount = availability.get("I'm in") || 0;
  const maybeCount = availability.get('Maybe') || 0;
  const outCount = availability.get("Can't make it") || 0;
  const attending = participants.filter(p => p.answers?.availability !== "Can't make it");

  // ── HARD: budget intersects to the lowest stated ceiling.
  let budgetCeiling = null, budgetStated = false;
  for (const p of attending) {
    const v = p.answers?.budget;
    if (v == null || !(v in BUDGET_CEILING)) continue;
    budgetStated = true;
    const c = BUDGET_CEILING[v];
    if (c === null) continue;               // "Flexible" constrains nothing
    budgetCeiling = budgetCeiling === null ? c : Math.min(budgetCeiling, c);
  }
  const freeOnly = budgetStated && budgetCeiling === 0;

  // ── HARD: travel radius intersects to the tightest stated limit.
  let maxMinutes = null;
  for (const p of attending) {
    const v = p.answers?.distance;
    if (v == null || !(v in DISTANCE_MINUTES)) continue;
    const m = DISTANCE_MINUTES[v];
    maxMinutes = maxMinutes === null ? m : Math.min(maxMinutes, m);
  }

  // ── HARD: dietary restrictions union. Every one of them must be satisfied.
  const dietary = new Set();
  for (const p of attending) {
    for (const v of [].concat(p.answers?.dietary || [])) {
      if (v && v !== 'No restrictions') dietary.add(v);
    }
  }

  const dealbreakers = new Set();
  for (const p of attending) {
    for (const v of [].concat(p.answers?.dealbreaker || [])) {
      if (v && !v.startsWith('Nothing —')) dealbreakers.add(v);
    }
  }

  // ── SOFT: leading direction per dimension, with a convergence measure.
  const soft = {};
  for (const q of ['food', 'vibe', 'transport', 'timing', 'food_style']) {
    const counts = tally(attending, q);
    if (!counts.size) { soft[q] = null; continue; }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, n]) => s + n, 0);
    const [leader, leadCount] = sorted[0];
    soft[q] = {
      leader,
      leadShare: leadCount / total,
      // Converged once the leader holds a majority AND at least two people
      // have weighed in — one vote is not a group direction.
      converged: leadCount / total >= 0.5 && total >= 2,
      counts: Object.fromEntries(sorted),
      minority: sorted.slice(1).map(([v, n]) => ({ value: v, count: n })),
    };
  }

  const answeredQuestions = new Set();
  for (const p of participants) for (const k of Object.keys(p.answers || {})) answeredQuestions.add(k);

  return {
    planId: plan.id,
    intent: plan.intent || {},
    participantCount: participants.length,
    answeredCount: answered.length,
    waitingOn: participants.filter(p => !p.answers?.availability).map(p => p.name),
    confirmedCount, maybeCount, outCount,
    attendingCount: attending.length,
    hard: {
      budgetCeiling, budgetStated, freeOnly,
      maxMinutes,
      dietary: [...dietary],
      dealbreakers: [...dealbreakers],
    },
    soft,
    answeredQuestions: answeredQuestions.size,
    /** Ready to generate once availability and the money question are settled. */
    readyToPlan: confirmedCount >= 1
      && participants.length >= 1
      && budgetStated
      && (soft.food?.converged || !plan.intent?.needsFood),
  };
}

/**
 * Satisfaction score for a soft option: the share of people for whom this
 * option is acceptable, weighted so a strong dislike costs more than a
 * missing first choice. Range 0–1.
 */
function satisfaction(state, dimension, option) {
  const s = state.soft[dimension];
  if (!s) return 0.5;
  const total = Object.values(s.counts).reduce((a, b) => a + b, 0) || 1;
  const forIt = s.counts[option] || 0;
  const against = total - forIt;
  return (forIt + against * 0.4) / total;   // silence/other-choice ≠ opposition
}

/** The narrowing follow-up for a converged dimension, if one exists. */
function narrowingFor(state) {
  const food = state.soft.food;
  if (food?.converged && !state.soft.food_style) {
    const n = NARROWING[food.leader];
    if (n) return { ...n, kind: 'soft', weight: 7, because: `${Math.round(food.leadShare * 100)}% of answers so far` };
  }
  return null;
}

export { build, satisfaction, narrowingFor, tally };
export default { build, satisfaction, narrowingFor, tally };