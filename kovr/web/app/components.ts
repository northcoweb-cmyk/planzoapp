/**
 * Shared render pieces.
 *
 * Two rules recur here and are worth stating once:
 *   - a competitor with no verified photo gets a neutral monogram, never a
 *     photo of someone who merely has a similar name;
 *   - a market with no price says so, rather than showing a number KOVR
 *     invented to fill the space.
 */

import { h, raw, classes } from './dom.js';
import type { RawHtml } from './dom.js';
import { icon, categoryIcon } from './icons.js';
import { eventTime, initials, money, odds as fmtOdds, relativeAge } from './format.js';
import type { Freshness, Market, Participant, SportEvent } from '../../src/domain/types.js';
import { store } from './store.js';

/* ───────────────────────────── primitives ──────────────────────────── */

/** Verified photo when one exists; a neutral monogram when one does not. */
export function avatar(participant: Participant, round = false): RawHtml {
  const cls = classes('avatar', round && 'avatar--round');
  if (participant.imageUrl) {
    return h`<span class="${cls}"><img src="${participant.imageUrl}" alt="" loading="lazy" /></span>`;
  }
  return h`<span class="${cls}" aria-hidden="true">${initials(participant.name)}</span>`;
}

export function statusPill(event: SportEvent): RawHtml {
  if (event.status === 'LIVE' || event.status === 'PAUSED') {
    return h`<span class="pill pill--live"><span class="live-dot"></span>${
      event.status === 'PAUSED' ? 'Paused' : 'Live'
    }</span>`;
  }
  if (event.status === 'FINAL') return h`<span class="pill">Final</span>`;
  if (event.status === 'CANCELLED') return h`<span class="pill">Cancelled</span>`;
  if (event.status === 'POSTPONED') return h`<span class="pill">Postponed</span>`;
  if (event.status === 'UNKNOWN') return h`<span class="pill">Status unconfirmed</span>`;
  return raw('');
}

export function betStatusPill(status: string): RawHtml {
  const cls = `pill pill--${status.toLowerCase()}`;
  return h`<span class="${cls}">${status}</span>`;
}

export function emptyState(title: string, body: string, iconName = 'empty'): RawHtml {
  return h`
    <div class="empty">
      ${icon(iconName, 30)}
      <p class="empty__title">${title}</p>
      <p class="empty__body">${body}</p>
    </div>`;
}

export function skeletonList(count = 3, variant: 'card' | 'row' = 'card'): RawHtml {
  const items = Array.from({ length: count }, () => h`<div class="skeleton skeleton--${variant}"></div>`);
  return h`<div class="section" aria-busy="true">${items}</div>`;
}

/* ──────────────────────────── data honesty ─────────────────────────── */

/**
 * The freshness notice.
 *
 * KOVR never presents stale data as live. When the provider is unreachable
 * and there is nothing cached, the banner says so and no events are drawn.
 */
export function freshnessBanner(freshness: Freshness): RawHtml {
  if (freshness.source === 'unavailable') {
    return h`
      <div class="banner banner--error" role="status">
        ${icon('alert', 16)}
        <div>
          <p class="banner__title">Live sports data temporarily unavailable</p>
          <p>${freshness.error ?? 'KOVR could not reach its sports data provider.'}</p>
        </div>
      </div>`;
  }

  // Served from KOVR's own store rather than a fresh provider call is not,
  // by itself, out of date — only age past the class threshold is.
  if (freshness.stale) {
    return h`
      <div class="banner banner--stale" role="status">
        ${icon('clock', 16)}
        <div>
          <p class="banner__title">Data may be outdated</p>
          <p>Last updated ${relativeAge(freshness.ageMs)}${
            freshness.error ? h` — ${freshness.error}` : raw('')
          }</p>
        </div>
      </div>`;
  }

  return raw('');
}

export function freshnessLine(freshness: Freshness): RawHtml {
  if (freshness.lastUpdatedAt === null) return raw('');
  const cls = classes('freshness', freshness.stale && 'freshness--stale');
  return h`<span class="${cls}">${icon('clock', 12)} Updated ${relativeAge(freshness.ageMs)}</span>`;
}

/* ─────────────────────────── odds and markets ──────────────────────── */

export interface OddsButtonContext {
  event: SportEvent;
  leagueShortName: string;
  market: Market;
}

function lineLabel(line: number | null, marketKey: string): string {
  if (line === null) return '';
  if (marketKey.startsWith('total')) return ` ${line}`;
  return line > 0 ? ` +${line}` : ` ${line}`;
}

/**
 * One price. Carries everything the betslip needs in data attributes, so a
 * tap records exactly the price that was on screen at that moment.
 */
export function oddsButton(context: OddsButtonContext, selectionIndex: number): RawHtml {
  const selection = context.market.selections[selectionIndex];
  if (!selection) return raw('');

  const selected = store.isSelected(selection.id);
  const closed = context.event.status !== 'UPCOMING';
  const label = `${selection.name}${lineLabel(selection.line, context.market.key)}`;

  return h`
    <button
      class="odds-button"
      type="button"
      data-odds-button
      aria-pressed="${selected ? 'true' : 'false'}"
      ${closed ? raw('disabled') : raw('')}
      data-event-id="${context.event.id}"
      data-event-name="${context.event.name}"
      data-event-start="${context.event.startTime}"
      data-league="${context.leagueShortName}"
      data-market-key="${context.market.key}"
      data-market-name="${context.market.name}"
      data-selection-id="${selection.id}"
      data-selection-name="${selection.name}"
      data-line="${selection.line === null ? '' : String(selection.line)}"
      data-price="${String(selection.price)}"
      aria-label="${label} at ${fmtOdds(selection.price)}"
    >
      <span class="odds-button__label">${label}</span>
      <span class="odds-button__price">${fmtOdds(selection.price)}</span>
    </button>`;
}

export function marketRow(context: OddsButtonContext): RawHtml {
  const stacked = context.market.selections.length > 3;
  const buttons = context.market.selections.map((_, index) => oddsButton(context, index));
  return h`<div class="${classes('odds-row', stacked && 'odds-row--stacked')}">${buttons}</div>`;
}

/* ───────────────────────────── event cards ─────────────────────────── */

export interface EventCardOptions {
  leagueShortName: string;
  /** The headline market to price the card with. Empty when none is offered. */
  markets: Market[];
  /** Total markets available, for the "N markets" affordance. */
  marketCount?: number;
  featured?: boolean;
}

/**
 * The standard event card: who, when, and the moneyline if one is priced.
 * Tapping the card opens the full market list.
 */
export function eventCard(event: SportEvent, options: EventCardOptions): RawHtml {
  const moneyline = options.markets.find((market) => market.kind === 'MONEYLINE');
  const isCombat = event.categoryId === 'combat';
  const live = event.status === 'LIVE' || event.status === 'PAUSED';

  const competitors = event.participants.map(
    (participant) => h`
      <div class="competitor">
        ${avatar(participant, isCombat)}
        <span class="competitor__name">${participant.name}</span>
        ${participant.score !== null ? h`<span class="competitor__score num">${participant.score}</span>` : raw('')}
      </div>`,
  );

  const matchup = isCombat
    ? h`<div class="matchup">${competitors[0] ?? raw('')}<div class="versus">VS</div>${competitors[1] ?? raw('')}</div>`
    : h`<div class="matchup">${competitors}</div>`;

  const headline = moneyline ?? options.markets[0];
  const prices = headline
    ? marketRow({ event, leagueShortName: options.leagueShortName, market: headline })
    : h`<div class="odds-unavailable">Odds unavailable for this event</div>`;

  return h`
    <article class="${classes('event-card', options.featured && 'event-card--featured')}">
      <header class="event-card__head">
        <span class="event-card__league">${options.leagueShortName}</span>
        ${live || event.status !== 'UPCOMING' ? statusPill(event) : raw('')}
        <span class="event-card__time">${
          event.status === 'LIVE' ? (event.periodLabel ?? 'In progress') : eventTime(event.startTime)
        }</span>
      </header>
      <div class="event-card__body">
        <button class="matchup-open" type="button" data-open-event="${event.id}" style="text-align:left;width:100%">
          ${matchup}
        </button>
        ${prices}
        ${
          (options.marketCount ?? options.markets.length) > 1
            ? h`<button class="section__link" type="button" data-open-event="${event.id}" style="align-self:flex-start">
                 ${options.marketCount ?? options.markets.length} markets →
               </button>`
            : raw('')
        }
      </div>
    </article>`;
}

/* ──────────────────────────── navigation ───────────────────────────── */

export function leagueRow(league: { id: string; shortName: string; name: string; seasonLabel: string; categoryId: string; liveEventCount: number; upcomingEventCount: number }): RawHtml {
  const badge =
    league.liveEventCount > 0
      ? h`<span class="pill pill--live"><span class="live-dot"></span>${league.liveEventCount} live</span>`
      : league.upcomingEventCount > 0
        ? h`<span class="pill">${league.upcomingEventCount}</span>`
        : h`<span class="pill">${league.seasonLabel}</span>`;

  return h`
    <button class="row row--button" type="button" data-open-league="${league.id}">
      <span class="avatar" aria-hidden="true">${categoryIcon(league.categoryId, 17)}</span>
      <span class="row__body">
        <span class="row__title">${league.shortName}</span>
        <span class="row__meta">${league.name}</span>
      </span>
      ${badge}
      ${icon('chevron', 16)}
    </button>`;
}

export function walletSummary(balanceCents: number, note: string): RawHtml {
  return h`
    <section class="wallet-hero">
      <p class="wallet-hero__label">Simulated balance</p>
      <p class="wallet-hero__amount">${money(balanceCents)}</p>
      <p class="wallet-hero__note">${note}</p>
    </section>`;
}

export function demoStrip(): RawHtml {
  return h`<div class="demo-strip"><span class="demo-strip__dot"></span>Simulator — demo funds only</div>`;
}
