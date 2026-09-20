/**
 * The sports API.
 *
 * Read-only and stateless. The provider key is used here and never leaves:
 * the browser gets normalised events, markets and prices, and nothing that
 * could be used to call the provider itself.
 *
 * Responses carry CDN cache headers so a managed host serves one copy to
 * every visitor instead of spending a provider request per view.
 */

import { HttpError, Router, requireArray } from '../router.js';
import type { RuntimeContext } from '../../runtime/context.js';
import { publicConfig } from '../../config/env.js';
import { statusLabel } from '../../domain/status.js';
import type { ServerResponse } from 'node:http';

/** Let the CDN hold a copy briefly, and serve it while revalidating. */
function cache(response: ServerResponse, seconds: number): void {
  response.setHeader('cache-control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=300`);
}

export function sportsRoutes(context: RuntimeContext): Router {
  const router = new Router();

  router.get('/api/config', () => ({ ...publicConfig() }));

  router.get('/api/status', async () => {
    const health = await context.provider.health();
    return {
      provider: {
        name: health.name,
        configured: health.configured,
        reachable: health.reachable,
        lastSuccessAt: health.lastSuccessAt,
        lastError: health.lastError,
        quota: health.quota,
      },
      cacheEntries: context.cache.size(),
      inFlight: context.refresh.inFlightCount(),
      recentRequests: context.requestLog.recent(15),
    };
  });

  /** The home hub: everything on, across every competition worth pulling. */
  router.get('/api/feed', async ({ response }) => {
    cache(response, 45);
    const feed = await context.sports.feed();
    return {
      data: {
        ...feed.data,
        live: feed.data.live.map(withLabel),
        headline: feed.data.headline ? withLabel(feed.data.headline) : null,
        next: feed.data.next.map(withLabel),
        byLeague: feed.data.byLeague.map((group) => ({ ...group, events: group.events.map(withLabel) })),
      },
      freshness: feed.freshness,
    };
  });

  router.get('/api/sports', async ({ response }) => {
    cache(response, 600);
    return context.sports.groups();
  });

  router.get('/api/league/:leagueId', async ({ params, response }) => {
    cache(response, 45);
    const result = await context.sports.leagueEvents(params['leagueId'] ?? '');
    if (!result.data) throw new HttpError(404, 'That competition is not available.', 'LEAGUE_NOT_FOUND');
    return {
      data: { league: result.data.league, events: result.data.events.map(withLabel) },
      freshness: result.freshness,
    };
  });

  router.get('/api/event/:eventId', async ({ params, response }) => {
    cache(response, 20);
    const result = await context.sports.event(params['eventId'] ?? '');
    if (!result.data) throw new HttpError(404, 'That event is not available.', 'EVENT_NOT_FOUND');
    return {
      data: {
        event: { ...result.data.event, statusLabel: statusLabel(result.data.event.status) },
        markets: result.data.markets,
      },
      freshness: result.freshness,
    };
  });

  /**
   * Confirmed status and result for a set of events, so the client can
   * settle its own open bets. Never cached at the edge: a settlement read
   * must not be served from a copy taken before the result landed.
   */
  router.post('/api/settlement', async ({ body, response }) => {
    response.setHeader('cache-control', 'no-store');
    const ids = requireArray(body, 'eventIds').filter((id): id is string => typeof id === 'string');
    return context.sports.settlementFacts(ids);
  });

  return router;
}

function withLabel<T extends { event: { status: Parameters<typeof statusLabel>[0] } }>(
  entry: T,
): T & { event: T['event'] & { statusLabel: string } } {
  return { ...entry, event: { ...entry.event, statusLabel: statusLabel(entry.event.status) } };
}
