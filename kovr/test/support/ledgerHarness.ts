/** Builds a Ledger over in-memory storage, with helpers for live markets. */

import { Ledger } from '../../src/ledger/ledger.js';
import { MemoryStorage } from '../../src/ledger/storage.js';
import type { EventWithMarkets, SportEvent } from '../../src/domain/types.js';

export const OPENING_BALANCE = 1_000_000;

export function createLedger(openingBalanceCents = OPENING_BALANCE): Ledger {
  return new Ledger(new MemoryStorage(), openingBalanceCents);
}

/** The live-market map the ledger reads prices from at placement. */
export function liveMap(...entries: EventWithMarkets[]): Map<string, EventWithMarkets> {
  return new Map(entries.map((entry) => [entry.event.id, entry]));
}

export function eventMap(...events: SportEvent[]): Map<string, SportEvent> {
  return new Map(events.map((event) => [event.id, event]));
}

/** A copy of an event carrying a confirmed result, as a settled fetch would. */
export function withResult(event: SportEvent, result: SportEvent['result']): SportEvent {
  return { ...event, status: 'FINAL', result };
}

export function cancelled(event: SportEvent): SportEvent {
  return { ...event, status: 'CANCELLED' };
}
