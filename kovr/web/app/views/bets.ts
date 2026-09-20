/**
 * Bet history.
 *
 * A settled bet shows the price it was struck at, for ever. Nothing on this
 * screen is recalculated from a current market.
 */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import { betStatusPill, emptyState, skeletonList } from '../components.js';
import { dateTime, money, odds as fmtOdds, pluralise } from '../format.js';
import type { Bet } from '../../../src/domain/types.js';

let tab: 'open' | 'settled' = 'open';

export function setBetsTab(next: 'open' | 'settled'): void {
  tab = next;
}

export function betsSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(3, 'card')}</div>`;
}

function betCard(bet: Bet): RawHtml {
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
        <span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="bet-leg__price num">${fmtOdds(selection.priceAmerican)}</span>
          ${selection.status !== 'OPEN' ? betStatusPill(selection.status) : raw('')}
        </span>
      </div>`,
  );

  const outcome =
    bet.status === 'OPEN'
      ? h`<span>To pay <strong class="bet-card__payout num">${money(bet.potentialPayoutCents)}</strong></span>`
      : bet.status === 'WON'
        ? h`<span>Returned <strong class="bet-card__payout num" style="color:var(--win)">${money(
            bet.payoutCents ?? 0,
          )}</strong></span>`
        : bet.status === 'LOST'
          ? h`<span class="dim">No return</span>`
          : h`<span>Stake returned <strong class="bet-card__payout num">${money(bet.payoutCents ?? 0)}</strong></span>`;

  return h`
    <article class="card bet-card">
      <header class="bet-card__head">
        ${betStatusPill(bet.status)}
        <span class="muted" style="font-size:12.5px">${
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
  const response = await api.bets(tab);
  const settledCount =
    response.counts.WON + response.counts.LOST + response.counts.PUSH + response.counts.VOID + response.counts.CANCELLED;

  const body =
    response.data.length === 0
      ? emptyState(
          tab === 'open' ? 'No open bets' : 'No settled bets yet',
          tab === 'open'
            ? 'Picks you place appear here until their event is confirmed final.'
            : 'A bet settles once KOVR receives a confirmed result from its data provider — never on the clock alone.',
          'ticket',
        )
      : h`<div class="section">${response.data.map(betCard)}</div>`;

  return h`
    <div class="view">
      <header class="view-header">
        <h1 class="view-title">My bets</h1>
        <p class="muted" style="font-size:13px">
          ${response.counts.OPEN} open · ${settledCount} settled
        </p>
      </header>
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" type="button" data-bets-tab="open"
          aria-selected="${tab === 'open' ? 'true' : 'false'}">Open (${response.counts.OPEN})</button>
        <button class="tab" role="tab" type="button" data-bets-tab="settled"
          aria-selected="${tab === 'settled' ? 'true' : 'false'}">Settled (${settledCount})</button>
      </div>
      ${body}
      ${
        response.counts.OPEN > 0 && tab === 'open'
          ? h`<p class="dim" style="font-size:12px;text-align:center">
               ${response.counts.OPEN} ${pluralise(response.counts.OPEN, 'bet')} awaiting a confirmed result.
             </p>`
          : raw('')
      }
    </div>`;
}
