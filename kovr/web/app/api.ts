/**
 * The sports API client.
 *
 * Every request goes to KOVR's own origin, which holds the provider key.
 * The browser never sees a credential and never calls a provider directly.
 * Money lives in the ledger on this device, not behind any of these calls.
 */

import type {
  EventWithMarkets,
  Freshness,
  League,
  Market,
  SportCategory,
  SportEvent,
} from '../../src/domain/types.js';
import type { SettlementFact } from '../../src/domain/grading.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'No connection.');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, 'BAD_RESPONSE', 'Unexpected response from the server.');
    }
  }

  if (!response.ok) {
    const failure = (payload ?? {}) as { error?: string; code?: string };
    throw new ApiError(response.status, failure.code ?? 'ERROR', failure.error ?? 'Something went wrong.');
  }
  return payload as T;
}

/* ─────────────────────────────── shapes ─────────────────────────────── */

export type EventView = SportEvent & { statusLabel: string };

export interface FeedEntry {
  event: EventView;
  markets: Market[];
  marketCount: number;
  leagueShortName: string;
  leagueId: string;
}

export interface FeedSections {
  live: FeedEntry[];
  headline: FeedEntry | null;
  next: FeedEntry[];
  byLeague: Array<{ league: League; events: FeedEntry[] }>;
  leagues: Array<{ id: string; shortName: string; categoryId: string; count: number }>;
  totalEvents: number;
}

export interface Envelope<T> {
  data: T;
  freshness: Freshness;
}

export type LeagueView = League & { seasonLabel: string };

export interface PublicConfigView {
  providerConfigured: boolean;
  demoStartingBalanceCents: number;
  adminEnabled: boolean;
}

export const api = {
  config: () => request<PublicConfigView>('/api/config'),

  feed: () => request<Envelope<FeedSections>>('/api/feed'),

  sports: () => request<Envelope<Array<{ category: SportCategory; leagues: LeagueView[] }>>>('/api/sports'),

  league: (leagueId: string) =>
    request<Envelope<{ league: LeagueView; events: FeedEntry[] }>>(`/api/league/${encodeURIComponent(leagueId)}`),

  event: (eventId: string) =>
    request<Envelope<{ event: EventView; markets: EventWithMarkets['markets'] }>>(
      `/api/event/${encodeURIComponent(eventId)}`,
    ),

  /** Confirmed status and result for events the ledger has open bets on. */
  settlement: (eventIds: readonly string[]) =>
    request<Envelope<Array<{ id: string } & SettlementFact>>>('/api/settlement', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventIds }),
    }),

  status: () => request<Record<string, unknown>>('/api/status'),
};
