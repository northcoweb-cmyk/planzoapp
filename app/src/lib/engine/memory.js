// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/memory.js — edit the source, then run scripts-port.mjs */
/**
 * Memory (spec §15, §20–22).
 *
 * Structured, not a transcript. Every memory carries scope, stability,
 * source and confidence, and the rules below are the point of the whole
 * system:
 *
 *   - Temporary context NEVER overwrites a stable preference. "No sushi
 *     tonight" is about tonight; it does not become "Ryan hates sushi".
 *   - A single contrary choice does not rewrite someone's personality.
 *     Confidence moves gradually, and an explicit statement moves it more
 *     than an inferred one.
 *   - Inferred memories are never treated as fact.
 */

const STABILITY = { STABLE: 'stable', HABIT: 'habit', TEMPORARY: 'temporary' };
const SOURCE = { EXPLICIT: 'explicit', INFERRED: 'inferred' };

/** How much one new observation moves confidence. */
const LEARN_RATE = { explicit: 0.34, inferred: 0.12 };
const DECAY_DAYS = { stable: 400, habit: 120, temporary: 1 };

const key = m => `${m.category}:${String(m.value).toLowerCase()}`;

/**
 * Fold an observation into an existing memory set.
 * Returns a NEW array; never mutates the input.
 */
function observe(memories, obs) {
  const now = obs.at || new Date().toISOString();
  const list = (memories || []).map(m => ({ ...m }));
  const stability = obs.stability || STABILITY.HABIT;
  const source = obs.source || SOURCE.INFERRED;
  const rate = LEARN_RATE[source];

  const existing = list.find(m => key(m) === key(obs) && m.scope === obs.scope);

  // A temporary observation is scoped to its plan and can never promote
  // itself into a lasting preference, however often it recurs.
  if (stability === STABILITY.TEMPORARY) {
    list.push({
      id: `${key(obs)}:${obs.planId || now}`,
      category: obs.category, value: obs.value, scope: obs.scope,
      stability: STABILITY.TEMPORARY, source, confidence: 0.5,
      planId: obs.planId || null, createdAt: now, lastConfirmedAt: now,
      expiresAt: obs.expiresAt || new Date(Date.parse(now) + 36 * 3600e3).toISOString(),
    });
    return list;
  }

  if (!existing) {
    list.push({
      id: key(obs), category: obs.category, value: obs.value, scope: obs.scope,
      stability, source,
      confidence: source === SOURCE.EXPLICIT ? 0.6 : 0.35,
      planId: null, createdAt: now, lastConfirmedAt: now, expiresAt: null,
      observations: 1,
    });
    return list;
  }

  // Reinforce. Confidence approaches 1 asymptotically — repetition raises
  // it, but nothing ever becomes certain.
  existing.confidence = Math.min(0.95, existing.confidence + (1 - existing.confidence) * rate);
  existing.observations = (existing.observations || 1) + 1;
  existing.lastConfirmedAt = now;
  if (source === SOURCE.EXPLICIT) existing.source = SOURCE.EXPLICIT;
  // Enough repeat observations turn a one-off into a habit, never straight
  // into a stable trait — those are only ever stated outright.
  if (existing.observations >= 4 && existing.stability === STABILITY.HABIT && stability === STABILITY.HABIT) {
    existing.confidence = Math.min(0.95, existing.confidence + 0.05);
  }
  if (stability === STABILITY.STABLE && source === SOURCE.EXPLICIT) {
    existing.stability = STABILITY.STABLE;
  }
  return list;
}

/**
 * Record a contradiction. This LOWERS confidence; it does not delete the
 * memory. Someone eating a burger tonight is not evidence they never liked
 * sushi (spec §22).
 */
function contradict(memories, obs) {
  const list = (memories || []).map(m => ({ ...m }));
  const existing = list.find(m => key(m) === key(obs) && m.scope === obs.scope);
  if (!existing) return list;
  const rate = LEARN_RATE[obs.source || SOURCE.INFERRED];
  existing.confidence = Math.max(0.05, existing.confidence - existing.confidence * rate);
  existing.lastContradictedAt = obs.at || new Date().toISOString();
  return list;
}

/** Drop expired temporary memories and stale low-confidence guesses. */
function prune(memories, now = Date.now()) {
  return (memories || []).filter(m => {
    if (m.expiresAt && Date.parse(m.expiresAt) < now) return false;
    const age = (now - Date.parse(m.lastConfirmedAt || m.createdAt)) / 86400e3;
    if (age > (DECAY_DAYS[m.stability] || 120)) return false;
    if (m.source === SOURCE.INFERRED && m.confidence < 0.15) return false;
    return true;
  });
}

/**
 * What the planner is allowed to act on: confident, non-temporary memories,
 * plus anything temporary scoped to THIS plan.
 */
function active(memories, { planId } = {}) {
  return prune(memories).filter(m =>
    m.stability === STABILITY.TEMPORARY
      ? m.planId === planId
      : m.confidence >= 0.45
  );
}

/** Turn a completed plan's answers into observations. */
function learnFromPlan(memories, plan, participantId) {
  const p = (plan.participants || []).find(x => x.id === participantId);
  if (!p) return memories;
  let list = memories;
  const at = new Date().toISOString();
  const MAP = {
    food:      { category: 'food',      stability: STABILITY.HABIT },
    vibe:      { category: 'activity',  stability: STABILITY.HABIT },
    transport: { category: 'transport', stability: STABILITY.HABIT },
    budget:    { category: 'budget',    stability: STABILITY.HABIT },
    dietary:   { category: 'dietary',   stability: STABILITY.STABLE, source: SOURCE.EXPLICIT },
  };
  for (const [qid, cfg] of Object.entries(MAP)) {
    const answer = p.answers?.[qid];
    if (answer == null) continue;
    for (const value of [].concat(answer)) {
      if (!value || value === 'No restrictions' || value === 'No preference') continue;
      list = observe(list, { ...cfg, value, scope: 'user', source: cfg.source || SOURCE.INFERRED, at, planId: plan.id });
    }
  }
  return prune(list);
}

/** Group memory: what this group tends to do, aggregated from its plans. */
function groupProfile(plans) {
  const tally = { food: {}, vibe: {}, transport: {}, budget: {} };
  const sizes = [];
  for (const plan of plans || []) {
    sizes.push((plan.participants || []).length);
    for (const p of plan.participants || []) {
      for (const cat of Object.keys(tally)) {
        for (const v of [].concat(p.answers?.[cat] || [])) {
          if (v) tally[cat][v] = (tally[cat][v] || 0) + 1;
        }
      }
    }
  }
  const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([value, count]) => ({ value, count }));
  return {
    planCount: (plans || []).length,
    typicalSize: sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : null,
    food: top(tally.food), vibe: top(tally.vibe),
    transport: top(tally.transport), budget: top(tally.budget),
    // Below three plans there is not enough behaviour to call anything a
    // pattern, so the planner is told not to lean on it.
    confident: (plans || []).length >= 3,
  };
}

export { observe, contradict, prune, active, learnFromPlan, groupProfile, STABILITY, SOURCE };
export default { observe, contradict, prune, active, learnFromPlan, groupProfile, STABILITY, SOURCE };