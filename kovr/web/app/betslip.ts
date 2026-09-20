/**
 * The betslip.
 *
 * The preview here uses the *same* odds engine the server settles with —
 * `src/core/odds.ts` is compiled into both builds — so the number on the
 * button and the number in the ledger cannot drift apart.
 *
 * The server still revalidates every price at placement. What the slip holds
 * is a record of what the user was shown, not an instruction on what to
 * charge.
 */

import { h, raw, render, classes } from './dom.js';
import type { RawHtml } from './dom.js';
import { icon } from './icons.js';
import { money, odds as fmtOdds, eventTime } from './format.js';
import { store, toast } from './store.js';
import type { SlipLeg } from './store.js';
import { api, ApiError } from './api.js';
import type { OddsChangeView } from './api.js';
import { combineParlayOdds, payoutCents, profitCents } from '../../src/core/odds.js';
import { parseAmountToCents, MoneyError } from '../../src/core/money.js';

/** A pending price movement the user has been asked to accept. */
let pendingChanges: OddsChangeView[] | null = null;
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
    leg.line === null ? '' : leg.marketKey.startsWith('total') ? ` ${leg.line}` : leg.line > 0 ? ` +${leg.line}` : ` ${leg.line}`;

  return h`
    <div class="slip-leg">
      <span class="slip-leg__body">
        <span class="slip-leg__pick">${leg.selectionName}${lineLabel}</span>
        <span class="slip-leg__meta">${leg.marketName} · ${leg.eventName}</span>
        <span class="slip-leg__meta">${leg.leagueShortName} · ${eventTime(leg.eventStartTime)}</span>
      </span>
      <span class="slip-leg__price num">${fmtOdds(leg.price)}</span>
      <button class="slip-leg__remove" type="button" data-remove-leg="${leg.selectionId}"
        aria-label="Remove ${leg.selectionName}">${icon('close', 14)}</button>
    </div>`;
}

function changesPanel(changes: OddsChangeView[]): RawHtml {
  return h`
    <div class="odds-change" role="alert">
      <p class="odds-change__title">${icon('alert', 15)} ${
        changes.length === 1 ? 'Odds changed' : `${changes.length} prices changed`
      }</p>
      ${changes.map(
        (change) => h`
          <div class="odds-change__row">
            <span style="flex:1;min-width:0">${change.selectionName}</span>
            <span class="odds-change__old num">${fmtOdds(change.previousPrice)}</span>
            <span class="odds-change__arrow">→</span>
            <span class="odds-change__new num">${fmtOdds(change.currentPrice)}</span>
          </div>`,
      )}
      <div style="display:flex;gap:8px">
        <button class="btn btn--ghost btn--sm" style="flex:1" type="button" data-reject-odds>Cancel</button>
        <button class="btn btn--primary btn--sm" style="flex:1" type="button" data-accept-odds>Accept new odds</button>
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
          <button class="slip-leg__remove" type="button" data-close-slip aria-label="Close betslip"
            style="margin-left:auto">${icon('close', 14)}</button>
        </header>
        <div class="slip__body">
          <div class="empty" style="border:0;background:none;padding:36px 16px">
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
        <button class="slip-leg__remove" type="button" data-close-slip aria-label="Close betslip">
          ${icon('close', 14)}
        </button>
      </header>

      <div class="slip__body">
        ${legs.map(legRow)}
      </div>

      <footer class="slip__foot">
        ${/* Pinned in the footer, not the scrolling body: a decision the user
             must make should never be below the fold. */ ''}
        ${pendingChanges ? changesPanel(pendingChanges) : raw('')}
        <div class="btn-grid">
          ${[10, 25, 50, 100].map(
            (amount) => h`<button class="btn btn--sm" type="button" data-quick-stake="${String(amount)}">$${amount}</button>`,
          )}
        </div>

        <div class="stake-field">
          <span class="stake-field__prefix">$</span>
          <input type="text" inputmode="decimal" placeholder="0.00" value="${state.stakeInput}"
            data-stake-input aria-label="Stake" autocomplete="off" />
          <span class="dim" style="font-size:12px">${legs.length > 1 ? `${legs.length} legs` : 'Single'}</span>
        </div>

        ${
          overBalance
            ? h`<p style="font-size:12.5px;color:var(--red-bright)">
                 Stake exceeds your simulated balance of ${money(balance)}.
               </p>`
            : raw('')
        }

        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="payout-line">
            <span class="muted">Odds</span>
            <span class="payout-line__value num">${fmtOdds(combined)}</span>
          </div>
          <div class="payout-line">
            <span class="muted">Potential profit</span>
            <span class="payout-line__value num">${money(profit)}</span>
          </div>
          <div class="payout-line payout-line--total">
            <span>Potential payout</span>
            <span class="payout-line__value num">${money(payout)}</span>
          </div>
        </div>

        <button class="${classes('btn', 'btn--primary', 'btn--block')}" type="button" data-place-bet
          ${canPlace ? raw('') : raw('disabled')}>
          ${placing ? 'Placing…' : stakeCents === null ? 'Enter a stake' : `Place bet · ${money(stakeCents)}`}
        </button>

        <p class="dim" style="font-size:11px;text-align:center">
          Simulated wager. Prices are revalidated when you place.
        </p>
      </footer>
    </div>`;
}

/** Place the slip. Handles the odds-change conversation. */
export async function placeBet(accept = false): Promise<boolean> {
  const state = store.get();
  const stakeCents = stakeCentsFrom(state.stakeInput);
  if (stakeCents === null || state.slip.length === 0) return false;

  placing = true;
  try {
    const result = await api.placeBet(
      state.slip.map((leg) => ({
        eventId: leg.eventId,
        marketKey: leg.marketKey,
        selectionId: leg.selectionId,
        displayedPrice: leg.price,
      })),
      stakeCents,
      accept,
    );

    pendingChanges = null;
    store.setWallet(result.data.wallet);
    store.clearSlip();
    store.setStake('');
    toast(`Bet placed — ${money(result.data.bet.potentialPayoutCents)} to pay`, 'success');
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ODDS_CHANGED' && error.payload?.changes) {
      // Show the move and let the user decide; nothing is placed meanwhile.
      pendingChanges = error.payload.changes;
      for (const change of error.payload.changes) {
        store.repriceLeg(
          state.slip.find((leg) => leg.selectionName === change.selectionName)?.selectionId ?? '',
          change.currentPrice,
        );
      }
      store.openSlip();
      return false;
    }
    toast(error instanceof ApiError ? error.message : 'Could not place that bet.', 'error');
    return false;
  } finally {
    placing = false;
  }
}

export function mountBetslip(target: Element): void {
  render(target, betslipMarkup());
}
