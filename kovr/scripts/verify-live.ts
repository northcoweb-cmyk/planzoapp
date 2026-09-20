/**
 * Real-data integration check.
 *
 *   npm run verify:live
 *
 * Calls the configured provider for real and reports what came back. Run it
 * after setting KOVR_ODDS_API_KEY, from a network that can reach the
 * provider. It is read-only: nothing is written to the database and no bet,
 * balance or settlement is touched.
 *
 * The key is never printed. Requests are reported by path only.
 */

import { config, loadEnvFiles } from '../src/config/env.js';
import { RequestLog } from '../src/runtime/cache.js';
import { TheOddsApiProvider } from '../src/providers/theoddsapi/provider.js';
import { ProviderError } from '../src/providers/SportsDataProvider.js';
import { isValidAmericanOdds, formatAmericanOdds } from '../src/core/odds.js';
import { hasCurrentContent } from '../src/domain/catalog.js';
import type { League } from '../src/domain/types.js';

const PASS = '  \u001b[32m✓\u001b[0m';
const FAIL = '  \u001b[31m✗\u001b[0m';
const INFO = '  \u001b[90m·\u001b[0m';

let failures = 0;

function check(ok: boolean, message: string): void {
  console.log(`${ok ? PASS : FAIL} ${message}`);
  if (!ok) failures++;
}

function note(message: string): void {
  console.log(`${INFO} ${message}`);
}

function describe(error: unknown): string {
  if (error instanceof ProviderError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  loadEnvFiles();
  const settings = config();

  console.log('\n  KOVR — live provider verification\n');

  if (settings.oddsApiKey === null) {
    console.log(`${FAIL} No KOVR_ODDS_API_KEY is configured.`);
    console.log('    Copy kovr/.env.example to kovr/.env.local and set the key, then re-run.\n');
    process.exit(1);
  }
  check(true, 'An API key is configured (value never printed)');

  const provider = new TheOddsApiProvider(new RequestLog());

  /* ── 1. Catalogue ─────────────────────────────────────────────────── */

  console.log('\n  Catalogue');
  let leagues: League[] = [];
  try {
    leagues = await provider.getLeagues();
    check(leagues.length > 0, `Discovered ${leagues.length} competitions`);

    const categories = new Set(leagues.map((league) => league.categoryId));
    check(categories.size > 1, `Spanning ${categories.size} sports: ${[...categories].sort().join(', ')}`);
    check(
      leagues.every((league) => league.providerKey !== '' && league.id !== ''),
      'Every competition normalised to a stable KOVR id',
    );

    const ufc = leagues.find((league) => league.id === 'ufc');
    const nfl = leagues.find((league) => league.id === 'nfl');
    note(`UFC present: ${ufc ? 'yes' : 'no'} · NFL present: ${nfl ? 'yes' : 'no'}`);
  } catch (error) {
    check(false, `Catalogue request failed — ${describe(error)}`);
    console.log('\n  Cannot continue without a catalogue.\n');
    process.exit(1);
  }

  /* ── 2. Events and odds ───────────────────────────────────────────── */

  // Prefer the primary sports, then fall back to whatever is on.
  const preferred = ['ufc', 'nfl', 'mlb', 'nba', 'nhl', 'epl'];
  const candidates = [
    ...preferred.map((id) => leagues.find((league) => league.id === id)).filter((l): l is League => l !== undefined),
    ...leagues.filter((league) => league.providerActive && !league.outrightsOnly),
  ];

  let priced = 0;
  let checkedLeagues = 0;

  for (const league of candidates.slice(0, 6)) {
    if (priced >= 2) break;
    checkedLeagues++;
    console.log(`\n  ${league.shortName} (${league.providerKey})`);

    try {
      const entries = await provider.getEventsWithOdds({ leagueKey: league.providerKey });
      note(`${entries.length} events returned`);
      if (entries.length === 0) {
        note('Nothing scheduled — KOVR would show this competition as having no current events');
        continue;
      }

      const first = entries[0];
      if (!first) continue;

      check(first.event.providerEventId !== '', `Event id present: ${first.event.providerEventId}`);
      check(first.event.participants.length >= 2, `Competitors: ${first.event.name}`);
      check(
        Number.isFinite(Date.parse(first.event.startTime)),
        `Start time parses: ${new Date(first.event.startTime).toISOString()}`,
      );
      check(
        ['UPCOMING', 'UNKNOWN'].includes(first.event.status),
        `Status normalised: ${first.event.status}`,
      );
      check(
        first.event.participants.every((p) => p.externalId.startsWith('p_')),
        'Competitors carry stable derived ids',
      );

      const withMarkets = entries.filter((entry) => entry.markets.length > 0);
      note(`${withMarkets.length} of ${entries.length} events carry priced markets`);

      const sample = withMarkets[0];
      if (!sample) {
        note('No markets priced right now — KOVR would show "Odds unavailable" rather than invent one');
        continue;
      }
      priced++;

      const market = sample.markets[0];
      if (!market) continue;

      check(market.selections.length > 0, `Market "${market.name}" has ${market.selections.length} selections`);
      check(
        market.selections.every((selection) => isValidAmericanOdds(selection.price)),
        `All prices are valid American odds: ${market.selections.map((s) => formatAmericanOdds(s.price)).join(' / ')}`,
      );
      check(
        market.selections.every((selection) => selection.bookmakerKey !== ''),
        `Priced by ${market.selections[0]?.bookmakerName ?? 'unknown'}`,
      );
      check(
        market.selections.every((selection) => Number.isFinite(Date.parse(selection.priceUpdatedAt))),
        'Every price carries a provider timestamp',
      );
      check(
        new Set(market.selections.map((s) => s.bookmakerKey)).size === 1,
        'One bookmaker prices the whole market',
      );

      note(`Markets offered: ${sample.markets.map((m) => m.name).join(', ')}`);
    } catch (error) {
      check(false, `${league.shortName} request failed — ${describe(error)}`);
    }
  }

  check(checkedLeagues > 0, `Checked ${checkedLeagues} competitions`);
  if (priced === 0) {
    note('No competition returned a priced market. That is a real state, not a failure —');
    note('KOVR would show "Odds unavailable" rather than fabricate a price.');
  }

  /* ── 3. Results ───────────────────────────────────────────────────── */

  console.log('\n  Results');
  const resultLeague = candidates[0];
  if (resultLeague) {
    try {
      const results = await provider.getResults(resultLeague.providerKey, 3);
      note(`${results.length} confirmed final results in the last 3 days for ${resultLeague.shortName}`);
      check(
        results.every((entry) => entry.result.confirmedAt !== ''),
        'Every result carries a confirmation timestamp',
      );
      check(
        results.every((entry) => entry.result.isDraw || entry.result.winnerExternalId !== null),
        'Every non-draw result names a winner by id',
      );
      if (results.length === 0) {
        note('None confirmed — KOVR would leave any bets on those events open rather than settle them.');
      }
    } catch (error) {
      check(false, `Results request failed — ${describe(error)}`);
    }
  }

  /* ── 4. Caching and budget ────────────────────────────────────────── */

  console.log('\n  Request accounting');
  const health = await provider.health();
  check(health.configured, 'Provider reports as configured');
  check(health.reachable, 'Provider reachable');
  note(`Quota remaining: ${health.quota.remaining ?? 'not reported'}`);
  note(`Requests used: ${health.quota.used ?? 'not reported'}`);
  note(`KOVR requests this run: ${health.quota.lastHourRequests} (budget ${health.quota.hourlyBudget}/hour)`);
  check(
    health.quota.lastHourRequests <= health.quota.hourlyBudget,
    'Stayed within the configured request budget',
  );

  /* ── 5. Failure handling ──────────────────────────────────────────── */

  console.log('\n  Failure handling');
  try {
    await provider.getEventsWithOdds({ leagueKey: 'not_a_real_sport_key' });
    check(false, 'An unknown competition should have raised');
  } catch (error) {
    check(error instanceof ProviderError, `Unknown competition raises a typed error — ${describe(error)}`);
  }

  const inSeason = leagues.filter((league) => hasCurrentContent(league.seasonState)).length;
  note(`${inSeason} competitions would be surfaced as having current content`);


  console.log(
    failures === 0
      ? '\n  \u001b[32mAll live checks passed.\u001b[0m\n'
      : `\n  \u001b[31m${failures} check(s) failed.\u001b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(`\n  Verification aborted: ${describe(error)}\n`);
  process.exit(1);
});
