/**
 * DEVELOPMENT TOOL — not part of the application.
 *
 * Runs KOVR against the scripted fixture provider from `test/support/`, so
 * the interface can be exercised without a provider key or network access.
 * Competitor names are invented and obviously so.
 *
 * Nothing here is reachable from `npm start`: the real server always uses a
 * real provider, and reports data as unavailable when it cannot reach one.
 */

import { createContext } from '../src/runtime/context.js';
import { createKovrServer } from '../src/http/server.js';
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
import type { EventWithMarkets } from '../src/domain/types.js';

const PORT = Number(process.env['KOVR_PREVIEW_PORT'] ?? 4399);

const FIGHTS: Array<[string, string]> = [
  ['Ramos Vega', 'Osei Dunne'],
  ['Kaito Brennan', 'Milo Farrow'],
  ['Devon Achebe', 'Yusuf Lindqvist'],
  ['Arturo Calle', 'Nikolai Braun'],
];

const GAMES: Array<[string, string]> = [
  ['Harbor City Tide', 'Granite Falls Forge'],
  ['Cedar Ridge Kings', 'Ironport Vanguard'],
  ['Lakeshore Union', 'Summit Park Rail'],
];

function fixtures(): { ufc: EventWithMarkets[]; nfl: EventWithMarkets[] } {
  const ufc = FIGHTS.map(([away, home], index) => {
    const event = buildEvent({
      providerEventId: `preview-ufc-${index}`,
      league: UFC_LEAGUE,
      competitors: [away, home],
      startTime: isoIn(index === 0 ? -0.4 : 3 + index * 3),
      status: index === 0 ? 'LIVE' : 'UPCOMING',
    });
    const prices: [number, number] = index === 0 ? [125, -150] : index === 1 ? [-110, -110] : index === 2 ? [280, -350] : [165, -195];
    return { event, markets: [moneylineMarket(event, prices)] };
  });

  const nfl = GAMES.map(([away, home], index) => {
    const event = buildEvent({
      providerEventId: `preview-nfl-${index}`,
      league: NFL_LEAGUE,
      competitors: [away, home],
      startTime: isoIn(5 + index * 20),
    });
    return {
      event,
      markets: [
        moneylineMarket(event, index === 0 ? [-125, 105] : index === 1 ? [160, -190] : [-145, 122]),
        spreadMarket(event, [2.5, -2.5], [-110, -110]),
        totalsMarket(event, 47.5, [-108, -112]),
      ],
    };
  });

  return { ufc, nfl };
}

function main(): void {
  process.stdout.write(
    '\n  KOVR PREVIEW — fixture data, not real sports data.\n' +
      '  Competitor names are invented. Use `npm start` for the real application.\n\n',
  );

  const provider = new FakeProvider();
  const { ufc, nfl } = fixtures();
  provider.setLeagueEvents(UFC_LEAGUE.providerKey, ufc);
  provider.setLeagueEvents(NFL_LEAGUE.providerKey, nfl);

  const context = createContext(provider);
  createKovrServer(context).listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`  http://127.0.0.1:${PORT}\n\n`);
  });
}

main();
