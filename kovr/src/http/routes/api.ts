/**
 * The public API.
 *
 * Only `publicConfig()` crosses to the browser from the configuration, and
 * it carries no key. Every sports payload is wrapped with its freshness so
 * the interface can label stale data honestly instead of presenting it as
 * live.
 */

import { Router, HttpError, requireArray, requireNumber, fieldOf, optionalBoolean } from '../router.js';
import type { AppContext } from '../../services/context.js';
import { publicConfig } from '../../config/env.js';
import { parseAmountToCents, MoneyError } from '../../core/money.js';
import { parseAmericanOdds, OddsError } from '../../core/odds.js';
import { WalletError } from '../../services/walletService.js';
import type { SelectionRequest } from '../../services/betService.js';
import type { BetStatus } from '../../domain/types.js';
import { MediaService } from '../../services/mediaService.js';
import { seasonStateLabel } from '../../domain/catalog.js';
import { statusLabel } from '../../domain/status.js';

const SETTLED: readonly BetStatus[] = ['WON', 'LOST', 'PUSH', 'VOID', 'CANCELLED'];

/** Parse a betslip payload into validated selection requests. */
function parseSelections(body: unknown): SelectionRequest[] {
  const raw = requireArray(body, 'selections');
  if (raw.length === 0) throw new HttpError(400, 'Add a selection before placing a bet.', 'EMPTY_SLIP');

  return raw.map((item) => {
    const eventId = fieldOf(item, 'eventId');
    const marketKey = fieldOf(item, 'marketKey');
    const selectionId = fieldOf(item, 'selectionId');
    const displayedPrice = fieldOf(item, 'displayedPrice');

    if (typeof eventId !== 'string' || typeof marketKey !== 'string' || typeof selectionId !== 'string') {
      throw new HttpError(400, 'Each selection needs an event, a market and a selection.', 'INVALID_SELECTION');
    }
    try {
      return {
        eventId,
        marketKey,
        selectionId,
        displayedPrice: parseAmericanOdds(displayedPrice as string | number),
      };
    } catch (error) {
      if (error instanceof OddsError) {
        throw new HttpError(400, 'A selection carried a price that is not valid American odds.', 'INVALID_ODDS');
      }
      throw error;
    }
  });
}

function parseStake(body: unknown): number {
  const raw = (body as Record<string, unknown>)['stake'];
  try {
    if (typeof raw === 'string' || typeof raw === 'number') return parseAmountToCents(raw);
    return requireNumber(body, 'stakeCents');
  } catch (error) {
    if (error instanceof MoneyError) throw new HttpError(400, 'Enter a valid stake.', 'INVALID_STAKE');
    throw error;
  }
}

function parseAmount(body: unknown): number {
  const raw = (body as Record<string, unknown>)['amount'];
  try {
    if (typeof raw === 'string' || typeof raw === 'number') return parseAmountToCents(raw);
    return requireNumber(body, 'amountCents');
  } catch (error) {
    if (error instanceof MoneyError) throw new HttpError(400, 'Enter a valid amount.', 'INVALID_AMOUNT');
    throw error;
  }
}

export function apiRoutes(context: AppContext): Router {
  const router = new Router();

  /* ───────────────────────────── metadata ──────────────────────────── */

  router.get('/api/config', () => ({
    ...publicConfig(),
    simulated: true,
    notice: 'KOVR is a simulator. All balances, bets and payouts are demo values.',
  }));

  router.get('/api/status', async () => {
    const health = await context.provider.health();
    const home = context.sports.getHomeFeed();
    return {
      provider: {
        name: health.name,
        configured: health.configured,
        reachable: health.reachable,
        lastSuccessAt: health.lastSuccessAt,
        lastError: health.lastError,
      },
      freshness: home.freshness,
      leagues: context.sports.listLeagues().length,
    };
  });

  /* ────────────────────────────── sports ───────────────────────────── */

  router.get('/api/home', () => {
    const feed = context.sports.getHomeFeed();
    return {
      ...feed,
      wallet: context.wallet.getWallet(),
      openBets: context.betting.listBets(['OPEN'], 5),
      activity: context.activity.list(6),
    };
  });

  router.get('/api/sports', ({ url }) => {
    const onlyWithContent = url.searchParams.get('all') !== '1';
    const groups = context.sports.listLeagueGroups({ onlyWithContent });
    return {
      data: groups.map((group) => ({
        category: group.category,
        leagues: group.leagues.map((league) => ({
          ...league,
          seasonLabel: seasonStateLabel(league.seasonState),
        })),
      })),
      freshness: context.sports.getHomeFeed().freshness,
    };
  });

  router.get('/api/sports/:leagueId/events', ({ params }) => {
    const leagueId = params['leagueId'] ?? '';
    const league = context.sports.findLeague(leagueId);
    if (!league) throw new HttpError(404, 'That competition is not in the catalogue.', 'LEAGUE_NOT_FOUND');

    const events = context.sports.getLeagueEvents(leagueId);
    return {
      league: { ...league, seasonLabel: seasonStateLabel(league.seasonState) },
      data: events.data.map((entry) => ({
        ...entry,
        event: { ...entry.event, statusLabel: statusLabel(entry.event.status) },
      })),
      freshness: events.freshness,
    };
  });

  router.get('/api/events/:eventId', ({ params }) => {
    const found = context.sports.getEvent(params['eventId'] ?? '');
    if (!found.data) throw new HttpError(404, 'KOVR holds no record of that event.', 'EVENT_NOT_FOUND');
    return {
      data: {
        event: { ...found.data.event, statusLabel: statusLabel(found.data.event.status) },
        markets: found.data.markets,
      },
      freshness: found.freshness,
    };
  });

  /**
   * A user-triggered refresh. Goes through the same refresh manager as every
   * scheduled one, so pull-to-refresh cannot bypass the request budget.
   */
  router.post('/api/sports/:leagueId/refresh', async ({ params }) => {
    const leagueId = params['leagueId'] ?? '';
    if (!context.sports.findLeague(leagueId)) {
      throw new HttpError(404, 'That competition is not in the catalogue.', 'LEAGUE_NOT_FOUND');
    }
    const outcome = await context.sports.syncLeague(leagueId);
    return { ...outcome, events: context.sports.getLeagueEvents(leagueId) };
  });

  /* ─────────────────────────────── bets ────────────────────────────── */

  router.post('/api/bets/quote', ({ body }) => {
    const selections = parseSelections(body);
    const stakeCents = parseStake(body);
    const quote = context.betting.quote(selections, stakeCents);
    if ('error' in quote) throw new HttpError(409, quote.error, 'UNAVAILABLE');
    return { data: quote };
  });

  router.post('/api/bets', ({ body, response }) => {
    const selections = parseSelections(body);
    const stakeCents = parseStake(body);
    const acceptCurrentOdds = optionalBoolean(body, 'acceptCurrentOdds');

    const result = context.betting.place({ selections, stakeCents, acceptCurrentOdds });
    if (result.ok) {
      return { data: { bet: result.bet, wallet: result.wallet } };
    }

    // A moved price is a conversation, not a failure: 409 with the detail
    // the interface needs to offer the new number.
    response.statusCode = result.code === 'ODDS_CHANGED' ? 409 : 400;
    return result.code === 'ODDS_CHANGED'
      ? { error: result.message, code: result.code, changes: result.changes, quote: result.quote }
      : { error: result.message, code: result.code };
  });

  router.get('/api/bets', ({ url }) => {
    const filter = url.searchParams.get('status');
    const statuses = filter === 'open' ? (['OPEN'] as const) : filter === 'settled' ? SETTLED : undefined;
    return {
      data: context.betting.listBets(statuses),
      counts: context.betting.counts(),
    };
  });

  router.get('/api/bets/:betId', ({ params }) => {
    const bet = context.betting.findBet(params['betId'] ?? '');
    if (!bet) throw new HttpError(404, 'No such bet.', 'BET_NOT_FOUND');
    return { data: bet };
  });

  /* ────────────────────────────── wallet ───────────────────────────── */

  router.get('/api/wallet', () => ({
    data: context.wallet.getWallet(),
    reconciliation: context.wallet.reconcile(),
  }));

  router.get('/api/wallet/transactions', ({ url }) => ({
    data: context.wallet.listTransactions(Number(url.searchParams.get('limit') ?? 100)),
  }));

  router.post('/api/wallet/deposit', ({ body }) => {
    try {
      const transaction = context.wallet.deposit(parseAmount(body));
      return { data: { transaction, wallet: context.wallet.getWallet() } };
    } catch (error) {
      if (error instanceof WalletError) throw new HttpError(400, error.message, error.code);
      throw error;
    }
  });

  router.post('/api/wallet/withdraw', ({ body }) => {
    try {
      const transaction = context.wallet.withdraw(parseAmount(body));
      return { data: { transaction, wallet: context.wallet.getWallet() } };
    } catch (error) {
      if (error instanceof WalletError) throw new HttpError(400, error.message, error.code);
      throw error;
    }
  });

  /* ───────────────────────── activity and profile ──────────────────── */

  router.get('/api/activity', ({ url }) => ({
    data: context.activity.list(Number(url.searchParams.get('limit') ?? 50)),
  }));

  router.get('/api/profile', () => {
    const profile = context.wallet.getProfile();
    return {
      data: {
        ...profile,
        initials: MediaService.initialsFor(profile.displayName),
        counts: context.betting.counts(),
        wallet: context.wallet.getWallet(),
      },
    };
  });

  return router;
}
