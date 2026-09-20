/**
 * The betslip.
 *
 * The preview uses the same odds engine the ledger settles with, so the
 * number on the button and the number in the history cannot drift apart.
 *
 * Placement re-fetches every event in the slip and reprices against what
 * comes back. The slip's own prices are a record of what the user was shown,
 * never an instruction on what to charge.
 */

import { h, raw, render, classes } from './dom.js';
import type { RawHtml } from './dom.js';
import { icon } from './icons.js';
import { money, odds as fmtOdds, countdown } from './format.js';
import { store, toast } from './store.js';
import type { SlipLeg } from './store.js';
import { api, ApiError } from './api.js';
import { ledger } from './ledgerClient.js';
import type { OddsChange } from '../../src/ledger/ledger.js';
import { combineParlayOdds, payoutCents, profitCents } from '../../src/core/odds.js';
import { parseAmountToCents, MoneyError } from '../../src/core/money.js';
import { preferences } from './preferences.js';
import type { EventWithMarkets } from '../../src/domain/types.js';

let pendingChanges: OddsChange[] | null = null;
let placing = false;

export function clearPendingChanges(): void {
  pendingChanges = null;
}

function stakeCentsFrom(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  try {
    const cents = parseAmountToCents(trimmed);
    return cents > 0 ? cents : null;
  } catch (error) {
    if (error instanceof MoneyError) return null;
    throw error;
  }
}

function legRow(leg: SlipLeg): RawHtml {
  const lineLabel =
    leg.line === null
      ? ''
      : leg.marketKey.startsWith('total')
        ? ` ${leg.line}`
        : leg.line > 0
          ? ` +${leg.line}`
          : ` ${leg.line}`;

  return h`
    <div class="slip-leg">
      <span class="slip-leg__body">
        <span class="slip-leg__pick">${leg.selectionName}${lineLabel}</span>
        <span class="slip-leg__meta">${leg.marketName} · ${leg.eventName}</span>
        <span class="slip-leg__meta">${leg.leagueShortName} · ${countdown(leg.eventStartTime)}</span>
      </span>
      <span class="slip-leg__price num">${fmtOdds(leg.price)}</span>
      <button class="slip-leg__remove" type="button" data-remove-leg="${leg.selectionId}"
        aria-label="Remove ${leg.selectionName}">${icon('close', 14)}</button>
    </div>`;
}

function changesPanel(changes: OddsChange[]): RawHtml {
  return h`
    <div class="odds-change" role="alert">
      <p class="odds-change__title">${icon('alert', 15)} ${
        changes.length === 1 ? 'Odds changed' : `${changes.length} prices changed`
      }</p>
      ${changes.map(
        (change) => h`
          <div class="odds-change__row">
            <span class="odds-change__name">${change.selectionName}</span>
            <span class="odds-change__old num">${fmtOdds(change.previousPrice)}</span>
            <span class="odds-change__arrow">→</span>
            <span class="odds-change__new num">${fmtOdds(change.currentPrice)}</span>
          </div>`,
      )}
      <div class="odds-change__actions">
        <button class="btn btn--ghost btn--sm" type="button" data-reject-odds>Cancel</button>
        <button class="btn btn--primary btn--sm" type="button" data-accept-odds>Accept</button>
      </div>
    </div>`;
}

export function betslipMarkup(): RawHtml {
  const state = store.get();
  const legs = state.slip;

  if (legs.length === 0) {
    return h`
      <div class="slip">
        <div class="slip__grip"></div>
        <header class="slip__head">
          <h2 class="slip__title">Betslip</h2>
          <button class="slip-leg__remove" type="button" data-close-slip aria-label="Close"
            style="margin-left:auto">${icon('close', 14)}</button>
        </header>
        <div class="slip__body">
          <div class="empty empty--bare">
            ${icon('slip', 30)}
            <p class="empty__title">Your betslip is empty</p>
            <p class="empty__body">Tap any price to add a selection.</p>
          </div>
        </div>
      </div>`;
  }

  const stakeCents = stakeCentsFrom(state.stakeInput);
  const combined = combineParlayOdds(legs.map((leg) => leg.price));
  const profit = stakeCents === null ? 0 : profitCents(stakeCents, combined);
  const payout = stakeCents === null ? 0 : payoutCents(stakeCents, combined);

  const balance = state.wallet?.balanceCents ?? 0;
  const overBalance = stakeCents !== null && stakeCents > balance;
  const canPlace = stakeCents !== null && !overBalance && !placing;

  return h`
    <div class="slip">
      <div class="slip__grip"></div>
      <header class="slip__head">
        <h2 class="slip__title">Betslip</h2>
        <span class="slip__count">${legs.length}</span>
        <button class="section__link" type="button" data-clear-slip style="margin-left:auto">Clear</button>
        <button class="slip-leg__remove" type="button" data-close-slip aria-label="Close">
          ${icon('close', 14)}
        </button>
      </header>

      <div class="slip__body">${legs.map(legRow)}</div>

      <footer class="slip__foot">
        ${pendingChanges ? changesPanel(pendingChanges) : raw('')}

        <div class="btn-grid btn-grid--four">
          ${[10, 25, 50, 100].map(
            (amount) => h`<button class="btn btn--sm" type="button" data-quick-stake="${String(amount)}">$${amount}</button>`,
          )}
        </div>

        <div class="stake-field stake-field--large">
          <span class="stake-field__prefix">$</span>
          <input type="text" inputmode="decimal" placeholder="0.00" value="${state.stakeInput}"
            data-stake-input aria-label="Stake" autocomplete="off" />
          <span class="dim">${legs.length > 1 ? `${legs.length} legs` : 'Single'}</span>
        </div>

        ${
          overBalance
            ? h`<p class="slip__warning">Stake exceeds your balance of ${money(balance)}.</p>`
            : raw('')
        }

        <div class="payout-block">
          <div class="payout-line">
            <span class="muted">Odds</span>
            <span class="payout-line__value num">${fmtOdds(combined)}</span>
          </div>
          <div class="payout-line">
            <span class="muted">To win</span>
            <span class="payout-line__value num">${money(profit)}</span>
          </div>
          <div class="payout-line payout-line--total">
            <span>Total return</span>
            <span class="payout-line__value num">${money(payout)}</span>
          </div>
        </div>

        <button class="${classes('btn', 'btn--primary', 'btn--block', 'btn--lg')}" type="button" data-place-bet
          ${canPlace ? raw('') : raw('disabled')}>
          ${placing ? 'Placing…' : stakeCents === null ? 'Enter a stake' : `Place bet · ${money(stakeCents)}`}
        </button>
      </footer>
    </div>`;
}

/** Fetch every event in the slip, so placement prices against live data. */
async function liveEvents(legs: readonly SlipLeg[]): Promise<Map<string, EventWithMarkets>> {
  const ids = [...new Set(legs.map((leg) => leg.eventId))];
  const live = new Map<string, EventWithMarkets>();

  await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await api.event(id);
        live.set(id, { event: response.data.event, markets: response.data.markets });
      } catch {
        // A missing event is simply absent, which placement reports as
        // EVENT_NOT_FOUND rather than betting against stale prices.
      }
    }),
  );
  return live;
}

export async function placeBet(accept = false): Promise<boolean> {
  const state = store.get();
  const stakeCents = stakeCentsFrom(state.stakeInput);
  if (stakeCents === null || state.slip.length === 0) return false;

  placing = true;
  try {
    const live = await liveEvents(state.slip);
    const book = await ledger();
    const result = await book.place(
      {
        selections: state.slip.map((leg) => ({
          eventId: leg.eventId,
          marketKey: leg.marketKey,
          selectionId: leg.selectionId,
          displayedPrice: leg.price,
        })),
        stakeCents,
        acceptCurrentOdds: accept,
      },
      live,
    );

    if (result.ok) {
      pendingChanges = null;
      store.setWallet(result.wallet);
      store.clearSlip();
      store.setStake(preferences().defaultStake);
      await store.refreshCounts();
      toast(`Bet placed — ${money(result.bet.potentialPayoutCents)} to return`, 'success');
      return true;
    }

    if (result.code === 'ODDS_CHANGED') {
      // An unambiguous improvement may skip the prompt when asked for; the
      // retry passes accept, so it cannot loop back to here.
      if (!accept && preferences().autoAcceptImprovedOdds && result.changes.every((change) => change.improved)) {
        for (const change of result.changes) store.repriceLeg(change.selectionId, change.currentPrice);
        return placeBet(true);
      }
      pendingChanges = result.changes;
      for (const change of result.changes) store.repriceLeg(change.selectionId, change.currentPrice);
      store.openSlip();
      return false;
    }

    toast(result.message, 'error');
    return false;
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Could not place that bet.', 'error');
    return false;
  } finally {
    placing = false;
  }
}

export function mountBetslip(target: Element): void {
  render(target, betslipMarkup());
}
