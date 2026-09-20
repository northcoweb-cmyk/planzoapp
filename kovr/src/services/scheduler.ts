/**
 * Background refresh.
 *
 * One timer drives every periodic job, at intervals matched to how fast the
 * underlying data actually changes. Live events are checked often; the
 * competition catalogue is checked twice a day. Each tick works through a
 * bounded slice of leagues so a large catalogue cannot spend the request
 * budget in a single pass.
 */

import type { AppContext } from './context.js';
import { RefreshManager } from './refreshManager.js';

export interface SchedulerOptions {
  /** How often the tick runs. Individual jobs have their own cadences. */
  tickMs?: number;
  /** Leagues refreshed per tick. Keeps a broad catalogue within budget. */
  leaguesPerTick?: number;
  onError?: (message: string) => void;
}

const MINUTE = 60_000;

export class RefreshScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private cursor = 0;

  private lastCatalogSync = 0;
  private lastStatusSync = 0;
  private lastSettlementSweep = 0;

  private readonly tickMs: number;
  private readonly leaguesPerTick: number;
  private readonly onError: (message: string) => void;

  constructor(
    private readonly context: AppContext,
    options: SchedulerOptions = {},
  ) {
    this.tickMs = options.tickMs ?? MINUTE;
    this.leaguesPerTick = options.leaguesPerTick ?? 3;
    this.onError = options.onError ?? (() => {});
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    // Do not hold the process open for the sake of a refresh timer.
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One pass. Safe to call directly; overlapping calls are ignored. */
  async tick(now = Date.now()): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      if (!this.context.provider.isConfigured()) return;

      if (now - this.lastCatalogSync > 12 * 60 * MINUTE) {
        this.lastCatalogSync = now;
        await this.guard('catalogue', () => this.context.sports.syncCatalog());
      }

      const leagues = this.context.sports.refreshableLeagueIds();
      if (leagues.length > 0) {
        for (let i = 0; i < Math.min(this.leaguesPerTick, leagues.length); i++) {
          const leagueId = leagues[(this.cursor + i) % leagues.length];
          if (leagueId) await this.guard(`league ${leagueId}`, () => this.context.sports.syncLeague(leagueId));
        }
        this.cursor = (this.cursor + this.leaguesPerTick) % leagues.length;
      }

      // Live statuses matter most, so they get their own faster cadence.
      if (now - this.lastStatusSync > 2 * MINUTE) {
        this.lastStatusSync = now;
        for (const leagueId of leagues.slice(0, 3)) {
          await this.guard(`statuses ${leagueId}`, () => this.context.sports.syncStatuses(leagueId));
        }
      }

      if (now - this.lastSettlementSweep > 5 * MINUTE) {
        this.lastSettlementSweep = now;
        await this.guard('settlement', () => this.context.settlement.sweep());
      }
    } finally {
      this.running = false;
    }
  }

  private async guard(label: string, job: () => Promise<unknown>): Promise<void> {
    try {
      await job();
    } catch (error) {
      // A failed refresh degrades the data's freshness; it must never take
      // the server down or stop the next job in the tick.
      this.onError(`${label}: ${RefreshManager.describe(error)}`);
    }
  }
}
