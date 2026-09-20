/**
 * DEVELOPMENT TOOL — not part of the application.
 *
 * Runs KOVR against the scripted fixture provider from `test/support/`, so
 * the interface can be exercised without a provider key or network access.
 *
 * The fixture data is obviously synthetic and is labelled as such. Nothing
 * here is reachable from `npm start`: the real server always uses a real
 * provider, and reports data as unavailable when it cannot reach one.
 */

import { createInMemoryDatabase } from '../src/store/db.js';
import { createContext } from '../src/services/context.js';
import { createKovrServer } from '../src/http/server.js';
import { categoryById } from '../src/domain/catalog.js';
import {
  FakeProvider,
  NFL_LEAGUE,
  UFC_LEAGUE,
  buildEvent,
  isoIn,
  moneylineMarket,
  spreadMarket,
  totalsMarket,
} from '../test/support/fakeProvider.js';
import type { EventWithMarkets, League } from '../src/domain/types.js';

const PORT = Number(process.env['KOVR_PREVIEW_PORT'] ?? 4399);

/** Deliberately fictional names, so fixture data can never be mistaken for real. */
const FIXTURE_CARD: Array<[string, string]> = [
  ['Ramos Vega', 'Osei Dunne'],
  ['Kaito Brennan', 'Milo Farrow'],
  ['Devon Achebe', 'Yusuf Lindqvist'],
];

const FIXTURE_GAMES: Array<[string, string]> = [
  ['Harbor City Tide', 'Granite Falls Forge'],
  ['Cedar Ridge Kings', 'Ironport Vanguard'],
];

function buildFixtures(): Array<{ league: League; entries: EventWithMarkets[] }> {
  const fights = FIXTURE_CARD.map(([away, home], index) => {
    const event = buildEvent({
      providerEventId: `preview-ufc-${index}`,
      league: UFC_LEAGUE,
      competitors: [away, home],
      startTime: isoIn(4 + index * 2),
    });
    const prices: [number, number] = index === 0 ? [125, -150] : index === 1 ? [-110, -110] : [280, -350];
    return { event, markets: [moneylineMarket(event, prices)] };
  });

  const games = FIXTURE_GAMES.map(([away, home], index) => {
    const event = buildEvent({
      providerEventId: `preview-nfl-${index}`,
      league: NFL_LEAGUE,
      competitors: [away, home],
      startTime: isoIn(26 + index * 24),
    });
    return {
      event,
      markets: [
        moneylineMarket(event, index === 0 ? [-125, 105] : [160, -190]),
        spreadMarket(event, [2.5, -2.5], [-110, -110]),
        totalsMarket(event, 47.5, [-108, -112]),
      ],
    };
  });

  return [
    { league: UFC_LEAGUE, entries: fights },
    { league: NFL_LEAGUE, entries: games },
  ];
}

function main(): void {
  process.stdout.write(
    '\n  ⚠  KOVR PREVIEW — fixture data, not real sports data.\n' +
      '     Competitor names are invented. Use `npm start` for the real application.\n\n',
  );

  const database = createInMemoryDatabase();
  const provider = new FakeProvider();
  const context = createContext(database, provider);
  context.wallet.ensureDemoAccount();

  const at = new Date().toISOString();
  for (const { league, entries } of buildFixtures()) {
    context.repositories.catalog.upsertCategory(categoryById(league.categoryId));
    context.repositories.catalog.upsertLeague(league, at);
    provider.setLeagueEvents(league.providerKey, entries);
    for (const entry of entries) {
      context.repositories.events.saveEvent(entry.event);
      context.repositories.events.saveMarkets(entry.event.id, entry.markets, at);
    }
    context.sports.recomputeSeasonState(league.id);
  }

  createKovrServer(context).listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`  Preview running at http://127.0.0.1:${PORT}\n\n`);
  });
}

main();
