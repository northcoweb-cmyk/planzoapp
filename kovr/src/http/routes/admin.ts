/**
 * The developer surface.
 *
 * Mounted only when KOVR_ADMIN_ENABLED is set. Every route here is gated on
 * that flag at request time, not merely at mount time, so a configuration
 * change cannot leave a stale open door. Nothing here reveals the API key —
 * only whether one is configured.
 */

import { HttpError, Router, requireString, optionalString } from '../router.js';
import type { AppContext } from '../../services/context.js';
import { config } from '../../config/env.js';
import type { MediaEntityType } from '../../store/repositories/mediaRepo.js';
import { num, str, strOrNull, numOrNull } from '../../store/rows.js';

const MEDIA_TYPES: readonly MediaEntityType[] = ['PARTICIPANT', 'LEAGUE', 'CATEGORY', 'EVENT'];

function requireAdmin(): void {
  if (!config().adminEnabled) {
    throw new HttpError(404, 'Not found.', 'NOT_FOUND');
  }
}

export function adminRoutes(context: AppContext): Router {
  const router = new Router();

  router.get('/api/admin/status', async () => {
    requireAdmin();
    const health = await context.provider.health();
    const home = context.sports.getHomeFeed();
    const wallet = context.wallet.reconcile();

    const requests = context.database
      .all(
        `SELECT endpoint, requested_at, duration_ms, http_status, ok, error, quota_remaining
           FROM provider_requests ORDER BY requested_at DESC LIMIT 25`,
      )
      .map((row) => ({
        endpoint: str(row, 'endpoint'),
        requestedAt: str(row, 'requested_at'),
        durationMs: numOrNull(row, 'duration_ms'),
        httpStatus: numOrNull(row, 'http_status'),
        ok: num(row, 'ok') === 1,
        error: strOrNull(row, 'error'),
        quotaRemaining: numOrNull(row, 'quota_remaining'),
      }));

    const counts = (table: string): number => {
      const row = context.database.get(`SELECT COUNT(*) AS n FROM ${table}`);
      return row ? num(row, 'n') : 0;
    };

    return {
      provider: health,
      freshness: home.freshness,
      database: {
        leagues: counts('leagues'),
        events: counts('events'),
        markets: counts('markets'),
        odds: counts('odds'),
        oddsSnapshots: counts('odds_snapshots'),
        bets: counts('bets'),
        settlements: counts('settlements'),
        transactions: counts('wallet_transactions'),
        cacheEntries: counts('provider_cache'),
      },
      media: context.media.stats(),
      wallet,
      inFlightRequests: context.refresh.inFlightCount(),
      pendingSettlementLeagues: context.settlement.pendingLeagues(),
      recentProviderRequests: requests,
    };
  });

  router.post('/api/admin/catalog/refresh', async () => {
    requireAdmin();
    const result = await context.sports.syncCatalog({ force: true });
    return { leagues: result.data.length, freshness: result.freshness };
  });

  router.post('/api/admin/refresh', async ({ body }) => {
    requireAdmin();
    const leagueId = optionalString(body, 'leagueId');
    const targets = leagueId ? [leagueId] : context.sports.refreshableLeagueIds().slice(0, 8);
    const outcomes = [];
    for (const id of targets) outcomes.push(await context.sports.syncLeague(id, { force: true }));
    return { outcomes };
  });

  router.post('/api/admin/statuses', async ({ body }) => {
    requireAdmin();
    const leagueId = requireString(body, 'leagueId');
    return context.sports.syncStatuses(leagueId);
  });

  router.post('/api/admin/settle', async () => {
    requireAdmin();
    return context.settlement.sweep();
  });

  router.post('/api/admin/settle/:eventId', ({ params }) => {
    requireAdmin();
    return { outcomes: context.settlement.settleEvent(params['eventId'] ?? '') };
  });

  router.post('/api/admin/reset', () => {
    requireAdmin();
    const view = context.wallet.resetDemo();
    return {
      wallet: view.wallet,
      note: 'Bets, settlements and the ledger were cleared. Sports and event data were not touched.',
    };
  });

  router.post('/api/admin/cache/clear', () => {
    requireAdmin();
    context.repositories.meta.clearCache();
    return { cleared: true };
  });

  /* ─────────────────────────────── media ───────────────────────────── */

  router.get('/api/admin/media', ({ url }) => {
    requireAdmin();
    const type = url.searchParams.get('type');
    const entityType = MEDIA_TYPES.find((candidate) => candidate === type);
    return { data: context.media.list(entityType) };
  });

  /**
   * Register artwork.
   *
   * `verified` is the operator asserting that the image really depicts this
   * entity. KOVR cannot establish that itself, so it does not pretend to:
   * unverified rows are stored but never served.
   */
  router.post('/api/admin/media', ({ body }) => {
    requireAdmin();
    const entityTypeRaw = requireString(body, 'entityType');
    const entityType = MEDIA_TYPES.find((candidate) => candidate === entityTypeRaw);
    if (!entityType) {
      throw new HttpError(400, `entityType must be one of ${MEDIA_TYPES.join(', ')}.`, 'INVALID_FIELD');
    }

    const imageUrl = optionalString(body, 'imageUrl');
    if (imageUrl !== null && !/^https:\/\//i.test(imageUrl)) {
      throw new HttpError(400, 'imageUrl must be an https URL.', 'INVALID_FIELD');
    }

    const at = new Date().toISOString();
    context.media.register(
      {
        entityType,
        entityId: requireString(body, 'entityId'),
        entityName: requireString(body, 'entityName'),
        imageUrl,
        source: optionalString(body, 'source') ?? 'operator',
        verified: (body as Record<string, unknown>)['verified'] === true,
        lastVerifiedAt: at,
      },
      at,
    );
    return { ok: true };
  });

  return router;
}
