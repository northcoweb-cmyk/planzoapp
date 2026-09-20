/**
 * Developer tools.
 *
 * Reachable only when KOVR_ADMIN_ENABLED is set; every endpoint behind it
 * re-checks that flag server-side. Nothing here reveals the API key — only
 * whether one is configured and whether the last call worked.
 */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { dateTime, relativeAge } from '../format.js';

interface AdminStatus {
  provider: { name: string; configured: boolean; reachable: boolean; lastSuccessAt: string | null; lastError: string | null;
    quota: { remaining: number | null; used: number | null; lastHourRequests: number; hourlyBudget: number } };
  freshness: { source: string; ageMs: number | null; stale: boolean; error: string | null };
  database: Record<string, number>;
  media: { total: number; verified: number };
  wallet: { balanced: boolean; ledgerTotalCents: number; balanceCents: number; entries: number };
  inFlightRequests: number;
  pendingSettlementLeagues: string[];
  recentProviderRequests: Array<{
    endpoint: string; requestedAt: string; durationMs: number | null;
    httpStatus: number | null; ok: boolean; error: string | null; quotaRemaining: number | null;
  }>;
}

function statRow(label: string, value: string, tone: 'ok' | 'warn' | 'bad' | 'plain' = 'plain'): RawHtml {
  const colour = tone === 'ok' ? 'var(--win)' : tone === 'warn' ? 'var(--push)' : tone === 'bad' ? 'var(--red-bright)' : 'var(--text)';
  return h`
    <div class="row">
      <span class="row__body"><span class="row__title">${label}</span></span>
      <span class="row__value"><span class="row__amount num" style="color:${raw(colour)}">${value}</span></span>
    </div>`;
}

export async function renderAdmin(): Promise<RawHtml> {
  let status: AdminStatus;
  try {
    status = (await api.admin.status()) as unknown as AdminStatus;
  } catch {
    return h`
      <div class="view">
        <header class="view-header"><h1 class="view-title">Developer tools</h1></header>
        <div class="banner banner--error">${icon('alert', 16)}
          <div><p class="banner__title">Developer tools are disabled</p>
          <p>Set KOVR_ADMIN_ENABLED=1 in kovr/.env.local and restart the server.</p></div>
        </div>
      </div>`;
  }

  const counts = Object.entries(status.database).map(([key, value]) =>
    statRow(key.replace(/([A-Z])/g, ' $1').toLowerCase(), String(value)),
  );

  const requests =
    status.recentProviderRequests.length === 0
      ? h`<div class="row"><span class="row__body"><span class="row__meta">No provider requests yet.</span></span></div>`
      : h`${status.recentProviderRequests.map(
          (entry) => h`
            <div class="row">
              <span class="row__body">
                <span class="row__title">${entry.endpoint}</span>
                <span class="row__meta">${dateTime(entry.requestedAt)}${
                  entry.error ? h` · ${entry.error}` : raw('')
                }</span>
              </span>
              <span class="row__value">
                <span class="row__amount num" style="color:${raw(entry.ok ? 'var(--win)' : 'var(--red-bright)')}">
                  ${entry.httpStatus ?? 'ERR'}
                </span>
                <span class="row__meta num">${entry.durationMs === null ? '' : `${entry.durationMs}ms`}</span>
              </span>
            </div>`,
        )}`;

  return h`
    <div class="view">
      <header class="view-header">
        <h1 class="view-title">Developer tools</h1>
        <p class="muted" style="font-size:13px">Not shown to normal users. Enabled by environment only.</p>
      </header>

      <section class="section">
        <h2 class="section-title">Provider</h2>
        <div class="card">
          ${statRow('Name', status.provider.name)}
          ${statRow('Key configured', status.provider.configured ? 'yes' : 'no', status.provider.configured ? 'ok' : 'bad')}
          ${statRow('Reachable', status.provider.reachable ? 'yes' : 'no', status.provider.reachable ? 'ok' : 'warn')}
          ${statRow('Last success', status.provider.lastSuccessAt ? dateTime(status.provider.lastSuccessAt) : 'never')}
          ${statRow('Quota remaining', status.provider.quota.remaining === null ? 'unknown' : String(status.provider.quota.remaining))}
          ${statRow('Requests this hour', `${status.provider.quota.lastHourRequests} / ${status.provider.quota.hourlyBudget}`)}
          ${statRow('In flight', String(status.inFlightRequests))}
          ${status.provider.lastError ? statRow('Last error', status.provider.lastError, 'bad') : raw('')}
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Data freshness</h2>
        <div class="card">
          ${statRow('Source', status.freshness.source, status.freshness.source === 'live' ? 'ok' : 'warn')}
          ${statRow('Age', relativeAge(status.freshness.ageMs))}
          ${statRow('Stale', status.freshness.stale ? 'yes' : 'no', status.freshness.stale ? 'warn' : 'ok')}
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Wallet reconciliation</h2>
        <div class="card">
          ${statRow('Balanced', status.wallet.balanced ? 'yes' : 'NO', status.wallet.balanced ? 'ok' : 'bad')}
          ${statRow('Ledger total', String(status.wallet.ledgerTotalCents))}
          ${statRow('Stored balance', String(status.wallet.balanceCents))}
          ${statRow('Entries', String(status.wallet.entries))}
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Database</h2>
        <div class="card">${counts}</div>
      </section>

      <section class="section">
        <h2 class="section-title">Media assets</h2>
        <div class="card">
          ${statRow('Verified', `${status.media.verified} / ${status.media.total}`)}
        </div>
        <p class="dim" style="font-size:12px">
          Only verified mappings are ever served. Everything else draws a neutral monogram rather than risk
          attaching the wrong face to a competitor.
        </p>
      </section>

      <section class="section">
        <h2 class="section-title">Actions</h2>
        <div class="btn-grid">
          <button class="btn" type="button" data-admin="catalog">${icon('refresh', 15)} Catalogue</button>
          <button class="btn" type="button" data-admin="refresh">${icon('refresh', 15)} Odds</button>
          <button class="btn" type="button" data-admin="settle">${icon('check', 15)} Settle</button>
          <button class="btn" type="button" data-admin="cache">${icon('close', 15)} Cache</button>
          <button class="btn btn--primary" type="button" data-admin="reset">${icon('alert', 15)} Reset demo</button>
        </div>
        ${
          status.pendingSettlementLeagues.length > 0
            ? h`<p class="dim" style="font-size:12px">
                 Awaiting confirmed results: ${status.pendingSettlementLeagues.join(', ')}
               </p>`
            : raw('')
        }
      </section>

      <section class="section">
        <h2 class="section-title">Recent provider requests</h2>
        <div class="card">${requests}</div>
      </section>
    </div>`;
}
