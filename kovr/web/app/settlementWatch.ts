/**
 * Settlement.
 *
 * Asks the server for confirmed status and results on the events this
 * device has open bets on, then grades them locally with the same engine
 * the tests cover. Runs on a timer and on every foreground.
 */

import { api } from './api.js';
import { toast } from './store.js';
import { store } from './store.js';
import { money } from './format.js';
import { preferences } from './preferences.js';
import { ledger } from './ledgerClient.js';

const POLL_MS = 60_000;
let timer: number | null = null;
let running = false;

function describe(status: string, payoutCents: number): string {
  switch (status) {
    case 'WON':
      return `Bet won — ${money(payoutCents)} returned`;
    case 'LOST':
      return 'Bet lost';
    case 'PUSH':
      return `Push — ${money(payoutCents)} returned`;
    case 'VOID':
      return `Void — ${money(payoutCents)} returned`;
    default:
      return `Bet ${status.toLowerCase()}`;
  }
}

export async function runSettlement(announce = true): Promise<number> {
  if (running) return 0;
  running = true;

  try {
    const book = await ledger();
    const openIds = await book.openEventIds();
    if (openIds.length === 0) return 0;

    const response = await api.settlement(openIds);
    const facts = new Map(response.data.map((fact) => [fact.id, { status: fact.status, result: fact.result }]));
    const outcomes = await book.settle(facts);

    const graded = outcomes.filter((outcome) => outcome.status !== 'PENDING');
    if (graded.length === 0) return 0;

    await store.refreshWallet();
    await store.refreshCounts();
    void store.refreshRewards();

    if (announce && preferences().notifyOnSettlement) {
      for (const outcome of graded) {
        toast(describe(outcome.status, outcome.payoutCents), outcome.status === 'WON' ? 'success' : 'info');
      }
    }
    return graded.length;
  } catch {
    // A failed check is not worth interrupting anyone over; the next one
    // will try again, and nothing is graded on incomplete information.
    return 0;
  } finally {
    running = false;
  }
}

export function startSettlementWatch(): void {
  if (timer !== null) return;
  void runSettlement(false);
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void runSettlement();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runSettlement();
  });
}
