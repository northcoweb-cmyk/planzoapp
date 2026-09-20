/**
 * Bet history.
 *
 * A settled bet shows the price it was struck at, for ever. Nothing here is
 * recalculated from a current market.
 */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { betStatusPill, emptyState, skeletonList } from '../components.js';
import { dateTime, money, odds as fmtOdds } from '../format.js';
import { ledger } from '../ledgerClient.js';
import type { Bet } from '../../../src/domain/types.js';

let tab: 'open' | 'settled' | 'all' = 'open';

export function setBetsTab(next: 'open' | 'settled' | 'all'): void {
  tab = next;
}

export function betsSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(3, 'card')}</div>`;
}

function betCard(bet: Bet, index: number): RawHtml {
  const legs = bet.selections.map(
    (selection) => h`
      <div class="bet-leg">
        <span class="bet-leg__body">
          <span class="bet-leg__pick">${selection.selectionName}${
            selection.line !== null ? ` ${selection.line > 0 ? `+${selection.line}` : selection.line}` : ''
          }</span>
          <span class="bet-leg__event">${selection.marketName} · ${selection.eventName}</span>
          <span class="bet-leg__event">${dateTime(selection.eventStartTime)}</span>
        </span>
        <span class="bet-leg__right">
          <span class="bet-leg__price num">${fmtOdds(selection.priceAmerican)}</span>
          ${selection.status !== 'OPEN' ? betStatusPill(selection.status) : raw('')}
        </span>
      </div>`,
  );

  const outcome =
    bet.status === 'OPEN'
      ? h`<span>To return <strong class="bet-card__payout num">${money(bet.potentialPayoutCents)}</strong></span>`
      : bet.status === 'WON'
        ? h`<span>Returned <strong class="bet-card__payout num win">${money(bet.payoutCents ?? 0)}</strong></span>`
        : bet.status === 'LOST'
          ? h`<span class="dim">No return</span>`
          : h`<span>Returned <strong class="bet-card__payout num">${money(bet.payoutCents ?? 0)}</strong></span>`;

  return h`
    <article class="card bet-card fade-up" style="animation-delay:${Math.min(index, 8) * 45}ms">
      <header class="bet-card__head">
        ${betStatusPill(bet.status)}
        <span class="muted">${
          bet.selections.length === 1 ? 'Single' : `${bet.selections.length}-leg parlay`
        } · ${fmtOdds(bet.priceAmerican)}</span>
        <span class="bet-card__stake num">${money(bet.stakeCents)}</span>
      </header>
      <div class="bet-card__legs">${legs}</div>
      <footer class="bet-card__foot">
        <span class="dim">${dateTime(bet.placedAt)}</span>
        ${outcome}
      </footer>
    </article>`;
}

export async function renderBets(): Promise<RawHtml> {
  const store = await ledger();
  const counts = await store.counts();
  const settledCount = counts.WON + counts.LOST + counts.PUSH + counts.VOID + counts.CANCELLED;
  const statuses =
    tab === 'open'
      ? (['OPEN'] as const)
      : tab === 'settled'
        ? (['WON', 'LOST', 'PUSH', 'VOID', 'CANCELLED'] as const)
        : undefined;
  const bets = await store.bets(statuses);

  const body =
    bets.length === 0
      ? emptyState(
          tab === 'open' ? 'No open bets' : tab === 'settled' ? 'No settled bets yet' : 'No bets yet',
          tab === 'open'
            ? 'Picks you place appear here until their event is confirmed final.'
            : tab === 'settled'
              ? 'A bet settles once a confirmed result comes in — never on the clock alone.'
              : 'Every bet you place, open or settled, shows up here.',
          'ticket',
        )
      : h`<div class="section">${bets.map(betCard)}</div>`;

  return h`
    <div class="view">
      <header class="view-header fade-up">
        <h1 class="view-title">My bets</h1>
        <p class="muted">${counts.OPEN} open · ${settledCount} settled</p>
      </header>
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" type="button" data-bets-tab="open"
          aria-selected="${tab === 'open' ? 'true' : 'false'}">Open (${counts.OPEN})</button>
        <button class="tab" role="tab" type="button" data-bets-tab="settled"
          aria-selected="${tab === 'settled' ? 'true' : 'false'}">Settled (${settledCount})</button>
        <button class="tab" role="tab" type="button" data-bets-tab="all"
          aria-selected="${tab === 'all' ? 'true' : 'false'}">All (${counts.OPEN + settledCount})</button>
      </div>
      ${body}
    </div>`;
}
