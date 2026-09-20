/**
 * Runtime wiring.
 *
 * One object holding the provider, the cache and the sports surface. It is
 * created once per process (or per serverless instance) and holds no user
 * state — the ledger lives in the browser, so there is nothing here that a
 * cold start could lose but a cache.
 */

import { config } from '../config/env.js';
import type { SportsDataProvider } from '../providers/SportsDataProvider.js';
import { TheOddsApiProvider } from '../providers/theoddsapi/provider.js';
import { UnconfiguredProvider } from '../providers/unconfigured.js';
import { RefreshManager } from '../services/refreshManager.js';
import { SportsApi } from '../sports/sportsApi.js';
import { MemoryCacheStore, RequestLog } from './cache.js';

export interface RuntimeContext {
  provider: SportsDataProvider;
  refresh: RefreshManager;
  sports: SportsApi;
  cache: MemoryCacheStore;
  requestLog: RequestLog;
}

export function createContext(override?: SportsDataProvider): RuntimeContext {
  const cache = new MemoryCacheStore();
  const requestLog = new RequestLog();
  const provider =
    override ?? (config().oddsApiKey === null ? new UnconfiguredProvider() : new TheOddsApiProvider(requestLog));
  const refresh = new RefreshManager(cache);

  return { provider, refresh, sports: new SportsApi(provider, refresh), cache, requestLog };
}

let shared: RuntimeContext | null = null;

/** Reused across requests in the same process or serverless instance. */
export function context(): RuntimeContext {
  if (!shared) shared = createContext();
  return shared;
}

export function resetContext(): void {
  shared = null;
}
