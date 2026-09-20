/** Builds an isolated KOVR context over an in-memory database. */

import { createInMemoryDatabase } from '../../src/store/db.js';
import type { Database } from '../../src/store/db.js';
import { createContext } from '../../src/services/context.js';
import type { AppContext } from '../../src/services/context.js';
import { categoryById } from '../../src/domain/catalog.js';
import type { EventWithMarkets, League } from '../../src/domain/types.js';
import { FakeProvider } from './fakeProvider.js';

export interface Harness {
  context: AppContext;
  provider: FakeProvider;
  database: Database;
  /** Persist a league and its events exactly as a sync would. */
  seed(league: League, entries: EventWithMarkets[]): void;
  close(): void;
}

export function createHarness(): Harness {
  const database = createInMemoryDatabase();
  const provider = new FakeProvider();
  const appContext = createContext(database, provider);

  return {
    context: appContext,
    provider,
    database,
    seed(league, entries) {
      const at = new Date().toISOString();
      appContext.repositories.catalog.upsertCategory(categoryById(league.categoryId));
      appContext.repositories.catalog.upsertLeague(league, at);
      provider.setLeagueEvents(league.providerKey, entries);
      for (const entry of entries) {
        appContext.repositories.events.saveEvent(entry.event);
        if (entry.markets.length > 0) {
          appContext.repositories.events.saveMarkets(entry.event.id, entry.markets, at);
        }
      }
      appContext.sports.recomputeSeasonState(league.id);
    },
    close() {
      database.close();
    },
  };
}
