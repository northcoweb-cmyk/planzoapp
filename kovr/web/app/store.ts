/**
 * Client state.
 *
 * The betslip is the only thing the browser owns. Prices held here are a
 * record of what the user was shown; the server revalidates every one at
 * placement and refuses the bet if the market has moved.
 */

import type { Wallet } from '../../src/domain/types.js';
import type { PublicConfigView } from './api.js';
import { ledger } from './ledgerClient.js';
import { computeRewards } from './rewards.js';
import type { RewardsSummary } from './rewards.js';

export interface SlipLeg {
  eventId: string;
  eventName: string;
  eventStartTime: string;
  leagueShortName: string;
  marketKey: string;
  marketName: string;
  selectionId: string;
  selectionName: string;
  line: number | null;
  /** The price on screen when the user tapped it. */
  price: number;
}

interface State {
  config: PublicConfigView | null;
  wallet: Wallet | null;
  slip: SlipLeg[];
  stakeInput: string;
  slipOpen: boolean;
  openBetCount: number;
  rewards: RewardsSummary | null;
}

type Listener = (state: State) => void;

const SLIP_KEY = 'kovr.slip.v1';
const STAKE_KEY = 'kovr.stake.v1';

function loadSlip(): SlipLeg[] {
  try {
    const stored = localStorage.getItem(SLIP_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (leg): leg is SlipLeg =>
        typeof leg === 'object' &&
        leg !== null &&
        typeof (leg as SlipLeg).eventId === 'string' &&
        typeof (leg as SlipLeg).selectionId === 'string' &&
        typeof (leg as SlipLeg).price === 'number',
    );
  } catch {
    // A private window or cleared storage is not an error worth showing.
    return [];
  }
}

function persist(state: State): void {
  try {
    localStorage.setItem(SLIP_KEY, JSON.stringify(state.slip));
    localStorage.setItem(STAKE_KEY, state.stakeInput);
  } catch {
    // Storage being unavailable must never break placing a bet.
  }
}

const state: State = {
  config: null,
  wallet: null,
  slip: loadSlip(),
  stakeInput: (() => {
    try {
      return localStorage.getItem(STAKE_KEY) ?? '';
    } catch {
      return '';
    }
  })(),
  slipOpen: false,
  openBetCount: 0,
  rewards: null,
};

const listeners = new Set<Listener>();

function emit(): void {
  persist(state);
  for (const listener of listeners) listener(state);
}

export const store = {
  get(): Readonly<State> {
    return state;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setConfig(config: PublicConfigView): void {
    state.config = config;
    emit();
  },

  setWallet(wallet: Wallet | null): void {
    state.wallet = wallet;
    emit();
  },

  /** Re-read the balance from the ledger on this device. */
  async refreshWallet(): Promise<Wallet> {
    const wallet = await (await ledger()).wallet();
    state.wallet = wallet;
    emit();
    return wallet;
  },

  async refreshCounts(): Promise<void> {
    const open = await (await ledger()).bets(['OPEN']);
    state.openBetCount = open.length;
    emit();
  },

  /** Recompute rewards from the ledger's transaction history. */
  async refreshRewards(): Promise<RewardsSummary> {
    const transactions = await (await ledger()).transactions(1000);
    const summary = computeRewards(transactions);
    state.rewards = summary;
    emit();
    return summary;
  },

  setOpenBetCount(count: number): void {
    state.openBetCount = count;
    emit();
  },

  isSelected(selectionId: string): boolean {
    return state.slip.some((leg) => leg.selectionId === selectionId);
  },

  /**
   * Add a pick, or remove it if it is already on the slip.
   *
   * A second pick in the same market replaces the first: a slip cannot hold
   * both sides of one line, because that is not a bet.
   */
  toggleLeg(leg: SlipLeg): 'added' | 'removed' | 'replaced' {
    const existing = state.slip.findIndex((item) => item.selectionId === leg.selectionId);
    if (existing >= 0) {
      state.slip.splice(existing, 1);
      emit();
      return 'removed';
    }

    const conflict = state.slip.findIndex(
      (item) => item.eventId === leg.eventId && item.marketKey === leg.marketKey,
    );
    if (conflict >= 0) {
      state.slip.splice(conflict, 1, leg);
      emit();
      return 'replaced';
    }

    state.slip.push(leg);
    emit();
    return 'added';
  },

  removeLeg(selectionId: string): void {
    state.slip = state.slip.filter((leg) => leg.selectionId !== selectionId);
    if (state.slip.length === 0) state.slipOpen = false;
    emit();
  },

  clearSlip(): void {
    state.slip = [];
    state.slipOpen = false;
    emit();
  },

  /** Update a leg's price after the user accepts a movement. */
  repriceLeg(selectionId: string, price: number): void {
    const leg = state.slip.find((item) => item.selectionId === selectionId);
    if (leg) {
      leg.price = price;
      emit();
    }
  },

  setStake(value: string): void {
    state.stakeInput = value;
    emit();
  },

  openSlip(): void {
    state.slipOpen = true;
    emit();
  },

  closeSlip(): void {
    state.slipOpen = false;
    emit();
  },
};

/* ───────────────────────────────── toasts ──────────────────────────── */

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

let toastId = 0;
const toasts: Toast[] = [];
const toastListeners = new Set<(items: Toast[]) => void>();

export function toast(message: string, kind: Toast['kind'] = 'info'): void {
  const item: Toast = { id: ++toastId, kind, message };
  toasts.push(item);
  for (const listener of toastListeners) listener([...toasts]);

  setTimeout(() => {
    const index = toasts.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) toasts.splice(index, 1);
    for (const listener of toastListeners) listener([...toasts]);
  }, 4200);
}

export function onToasts(listener: (items: Toast[]) => void): void {
  toastListeners.add(listener);
}
