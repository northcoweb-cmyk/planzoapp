/**
 * The API client.
 *
 * Every request goes to KOVR's own origin. The browser never holds a
 * provider credential and never calls a provider directly, so there is
 * nothing here to leak.
 */

import type {
  ActivityItem,
  Bet,
  BetStatus,
  Envelope,
  EventWithMarkets,
  Freshness,
  League,
  SportCategory,
  SportEvent,
  Wallet,
  WalletTransaction,
} from '../../src/domain/types.js';

export interface ApiFailure {
  error: string;
  code: string;
  changes?: OddsChangeView[];
  quote?: QuoteView;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly payload: ApiFailure | null = null,
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
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'KOVR could not reach the server.');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, 'BAD_RESPONSE', 'The server returned an unexpected response.');
    }
  }

  if (!response.ok) {
    const failure = (payload ?? {}) as ApiFailure;
    throw new ApiError(
      response.status,
      failure.code ?? 'ERROR',
      failure.error ?? 'Something went wrong.',
      failure,
    );
  }
  return payload as T;
}

const get = <T>(path: string): Promise<T> => request<T>(path);
const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

/* ─────────────────────────────── shapes ─────────────────────────────── */

export interface PublicConfigView {
  providerConfigured: boolean;
  demoStartingBalanceCents: number;
  adminEnabled: boolean;
  simulated: boolean;
  notice: string;
}

/** An event as the feed serves it, with its headline price attached. */
export interface FeedEntry {
  event: SportEvent;
  markets: EventWithMarkets['markets'];
  marketCount: number;
}

export interface HomeFeed {
  data: {
    live: FeedEntry[];
    featured: FeedEntry[];
    startingSoon: FeedEntry[];
    byLeague: Array<{ league: League; events: FeedEntry[] }>;
  };
  freshness: Freshness;
  wallet: Wallet;
  openBets: Bet[];
  activity: ActivityItem[];
}

export type LeagueView = League & { seasonLabel: string };

export interface SportsResponse {
  data: Array<{ category: SportCategory; leagues: LeagueView[] }>;
  freshness: Freshness;
}

export interface LeagueEventsResponse {
  league: LeagueView;
  data: Array<Omit<FeedEntry, 'event'> & { event: SportEvent & { statusLabel: string } }>;
  freshness: Freshness;
}

export interface EventResponse {
  data: { event: SportEvent & { statusLabel: string }; markets: EventWithMarkets['markets'] };
  freshness: Freshness;
}

export interface QuoteView {
  stakeCents: number;
  combinedPrice: number;
  profitCents: number;
  payoutCents: number;
  legs: Array<{
    eventId: string;
    eventName: string;
    marketKey: string;
    marketName: string;
    selectionId: string;
    selectionName: string;
    price: number;
    line: number | null;
  }>;
}

export interface OddsChangeView {
  eventId: string;
  eventName: string;
  selectionName: string;
  marketName: string;
  previousPrice: number;
  currentPrice: number;
  improved: boolean;
  message: string;
}

export interface PlacedBetResponse {
  data: { bet: Bet; wallet: Wallet };
}

export interface BetsResponse {
  data: Bet[];
  counts: Record<BetStatus, number>;
}

export interface ProfileResponse {
  data: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    initials: string;
    isDemo: boolean;
    createdAt: string;
    counts: Record<BetStatus, number>;
    wallet: Wallet;
  };
}

export interface StatusResponse {
  provider: {
    name: string;
    configured: boolean;
    reachable: boolean;
    lastSuccessAt: string | null;
    lastError: string | null;
  };
  freshness: Freshness;
  leagues: number;
}

export interface SelectionPayload {
  eventId: string;
  marketKey: string;
  selectionId: string;
  displayedPrice: number;
}

/* ─────────────────────────────── surface ────────────────────────────── */

export const api = {
  config: () => get<PublicConfigView>('/api/config'),
  status: () => get<StatusResponse>('/api/status'),
  home: () => get<HomeFeed>('/api/home'),
  sports: (all = false) => get<SportsResponse>(`/api/sports${all ? '?all=1' : ''}`),
  leagueEvents: (leagueId: string) =>
    get<LeagueEventsResponse>(`/api/sports/${encodeURIComponent(leagueId)}/events`),
  refreshLeague: (leagueId: string) =>
    post<{ source: string; error: string | null }>(`/api/sports/${encodeURIComponent(leagueId)}/refresh`),
  event: (eventId: string) => get<EventResponse>(`/api/events/${encodeURIComponent(eventId)}`),

  quote: (selections: SelectionPayload[], stakeCents: number) =>
    post<{ data: QuoteView }>('/api/bets/quote', { selections, stakeCents }),
  placeBet: (selections: SelectionPayload[], stakeCents: number, acceptCurrentOdds = false) =>
    post<PlacedBetResponse>('/api/bets', { selections, stakeCents, acceptCurrentOdds }),
  bets: (status?: 'open' | 'settled') => get<BetsResponse>(`/api/bets${status ? `?status=${status}` : ''}`),

  wallet: () => get<{ data: Wallet; reconciliation: { balanced: boolean } }>('/api/wallet'),
  transactions: () => get<{ data: WalletTransaction[] }>('/api/wallet/transactions'),
  deposit: (amountCents: number) =>
    post<{ data: { wallet: Wallet } }>('/api/wallet/deposit', { amountCents }),
  withdraw: (amountCents: number) =>
    post<{ data: { wallet: Wallet } }>('/api/wallet/withdraw', { amountCents }),

  activity: () => get<{ data: ActivityItem[] }>('/api/activity'),
  profile: () => get<ProfileResponse>('/api/profile'),

  admin: {
    status: () => get<Record<string, unknown>>('/api/admin/status'),
    refreshCatalog: () => post<Record<string, unknown>>('/api/admin/catalog/refresh'),
    refresh: (leagueId?: string) => post<Record<string, unknown>>('/api/admin/refresh', { leagueId }),
    settle: () => post<Record<string, unknown>>('/api/admin/settle'),
    reset: () => post<Record<string, unknown>>('/api/admin/reset'),
    clearCache: () => post<Record<string, unknown>>('/api/admin/cache/clear'),
  },
};

export type { Envelope };
