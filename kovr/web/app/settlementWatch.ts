/**
 * Settlement alerts.
 *
 * Polls the user's own bets and raises an in-app alert the first time one
 * changes out of OPEN. Deliberately not a browser push notification: KOVR
 * has no account, no server-side subscription and nothing to push with, and
 * asking for notification permission it cannot honour would be theatre.
 */

import { api } from './api.js';
import { toast } from './store.js';
import { money } from './format.js';
import { preferences } from './preferences.js';

const POLL_MS = 45_000;

let known = new Map<string, string>();
let timer: number | null = null;

function describe(status: string, payoutCents: number | null): string {
  switch (status) {
    case 'WON':
      return `Bet won — ${money(payoutCents ?? 0)} returned`;
    case 'LOST':
      return 'Bet lost';
    case 'PUSH':
      return `Push — ${money(payoutCents ?? 0)} stake returned`;
    case 'VOID':
      return `Voided — ${money(payoutCents ?? 0)} stake returned`;
    case 'CANCELLED':
      return 'Event cancelled — stake returned';
    default:
      return `Bet ${status.toLowerCase()}`;
  }
}

async function poll(): Promise<void> {
  if (!preferences().notifyOnSettlement) return;
  if (document.visibilityState !== 'visible') return;

  try {
    const response = await api.bets();
    const next = new Map<string, string>();

    for (const bet of response.data) {
      next.set(bet.id, bet.status);
      const previous = known.get(bet.id);
      // Only a transition out of OPEN is news; a bet first seen already
      // settled predates this session and is not announced.
      if (previous === 'OPEN' && bet.status !== 'OPEN') {
        toast(describe(bet.status, bet.payoutCents), bet.status === 'WON' ? 'success' : 'info');
      }
    }
    known = next;
  } catch {
    // A failed poll is not worth interrupting the user over.
  }
}

export function startSettlementWatch(): void {
  if (timer !== null) return;
  void poll();
  timer = window.setInterval(() => void poll(), POLL_MS);
}

export function stopSettlementWatch(): void {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}
