'use strict';
/**
 * Adaptive question selection. Zero AI cost.
 *
 * For a given participant, pick the ONE question that removes the most
 * uncertainty from the group's current state — skipping anything they have
 * already answered, anything irrelevant to this plan, and anything the group
 * has already converged on.
 *
 * Convergence is the important part. Once a dimension is settled, later
 * participants get the narrowing follow-up instead of the question that is
 * already answered. That is spec §12 / §6, implemented as ordering rather
 * than as a prompt.
 */
const { QUESTIONS } = require('./catalog');
const consensus = require('./consensus');

/**
 * @returns {{done:true, state:object}|{done:false, question:object, progress:object}}
 */
function next(plan, participant) {
  const state = consensus.build(plan);
  const answers = participant.answers || {};

  // 1. Availability always comes first — it gates everything downstream.
  if (answers.availability == null) {
    const q = QUESTIONS.find(q => q.id === 'availability');
    return frame(q, state, plan, participant);
  }
  // Someone who is out is not asked to plan an outing they are not attending.
  if (answers.availability === "Can't make it") return { done: true, state, reason: 'declined' };

  // 2. A converged dimension turns into its narrowing follow-up.
  const narrowing = consensus.narrowingFor(state);
  if (narrowing && answers[narrowing.id] == null && answers.food == null) {
    return frame(narrowing, state, plan, participant);
  }

  // 3. Otherwise: the highest-value applicable question this person has not answered.
  const candidates = QUESTIONS
    .filter(q => answers[q.id] == null)
    .filter(q => { try { return q.applies(state); } catch { return false; } })
    .filter(q => !isSettled(q, state))
    .sort((a, b) => score(b, state) - score(a, state));

  if (!candidates.length) return { done: true, state };
  return frame(candidates[0], state, plan, participant);
}

/**
 * A soft question is settled when the group has clearly converged AND enough
 * people have answered that one more vote cannot change the outcome.
 * Hard constraints are never settled — every person's ceiling matters.
 */
function isSettled(q, state) {
  if (q.kind === 'hard') return false;
  const s = state.soft[q.id];
  return Boolean(s && s.converged && s.leadShare >= 0.7);
}

function score(q, state) {
  let s = q.weight;
  const soft = state.soft[q.id];
  // A dimension already leaning one way is worth less than an open one.
  if (soft) s *= (1 - soft.leadShare * 0.6);
  return s;
}

function frame(q, state, plan, participant) {
  const answered = Object.keys(participant.answers || {}).length;
  const applicable = QUESTIONS.filter(x => { try { return x.applies(state); } catch { return false; } }).length;
  return {
    done: false,
    question: {
      id: q.id,
      text: q.text,
      options: q.options,
      multi: Boolean(q.multi),
      kind: q.kind,
      because: q.because || null,
    },
    progress: { answered, estimatedTotal: Math.max(answered + 1, Math.min(applicable, 6)) },
    state: publicState(state),
  };
}

/** Group state safe to send to an anonymous participant. No contact info. */
function publicState(state) {
  return {
    participantCount: state.participantCount,
    confirmedCount: state.confirmedCount,
    maybeCount: state.maybeCount,
    attendingCount: state.attendingCount,
    leaning: Object.fromEntries(
      Object.entries(state.soft)
        .filter(([, v]) => v && v.converged)
        .map(([k, v]) => [k, v.leader])
    ),
    readyToPlan: state.readyToPlan,
  };
}

module.exports = { next, publicState };
