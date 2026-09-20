/**
 * Stable identity for events and competitors.
 *
 * Identity in KOVR is never a display name. Where a provider publishes its
 * own identifier, KOVR uses it. Where it does not — The Odds API names teams
 * and fighters but issues ids only for events — KOVR derives a deterministic
 * id from the competition plus the exact provider-supplied name.
 *
 * That derivation is a hash of an exact string, not a fuzzy match: the same
 * competitor yields the same id on every refresh, and two different names
 * never collapse into one. It is what lets a verified fighter photo stay
 * attached to the right fighter.
 */

import { createHash } from 'node:crypto';

function digest(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Canonical form of a competitor name, used only as hash input.
 *
 * Case and surrounding whitespace are normalised because providers are
 * inconsistent about both for the same entity. Nothing else is stripped:
 * "St. Louis" and "St Louis" stay distinct rather than being guessed into
 * each other, which is the failure mode this module exists to prevent.
 */
export function canonicalName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Deterministic competitor id, namespaced by competition. */
export function participantIdFor(providerLeagueKey: string, name: string): string {
  const canonical = canonicalName(name);
  if (canonical === '') throw new Error('cannot derive a participant id from an empty name');
  return `p_${digest(`${providerLeagueKey}|${canonical}`)}`;
}

/** KOVR's internal event id, namespaced by provider so ids never collide. */
export function internalEventId(providerName: string, providerEventId: string): string {
  return `evt_${digest(`${providerName}|${providerEventId}`)}`;
}

/** Stable id for one selection inside a market. */
export function selectionIdFor(marketKey: string, outcomeName: string, line: number | null): string {
  const parts = [marketKey, canonicalName(outcomeName), line === null ? '' : line.toFixed(2)];
  return `sel_${digest(parts.join('|'))}`;
}

/** Opaque, unguessable id for a KOVR-owned row (bets, transactions, …). */
export function newId(prefix: string): string {
  return `${prefix}_${createHash('sha256')
    .update(`${Date.now()}|${Math.random()}|${process.hrtime.bigint()}`)
    .digest('hex')
    .slice(0, 20)}`;
}
