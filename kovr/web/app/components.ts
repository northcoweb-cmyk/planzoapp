/**
 * Shared render pieces.
 *
 * Two rules recur here: a competitor with no verified photo gets a neutral
 * monogram rather than a photo of someone who merely has a similar name, and
 * a market with no price says so rather than showing a number KOVR invented
 * to fill the space.
 */

import { h, raw, classes } from './dom.js';
import type { RawHtml } from './dom.js';
import { icon, categoryIcon } from './icons.js';
import { countdown, eventTime, initials, odds as fmtOdds, relativeAge } from './format.js';
import type { Freshness, Market, Participant } from '../../src/domain/types.js';
import type { EventView, FeedEntry } from './api.js';
import { store } from './store.js';

/* ───────────────────────────── primitives ──────────────────────────── */

export function avatar(participant: Participant, round = false, size = 0): RawHtml {
  const cls = classes('avatar', round && 'avatar--round');
  const style = size > 0 ? `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.34)}px` : '';
  if (participant.imageUrl) {
    return h`<span class="${cls}" style="${style}"><img src="${participant.imageUrl}" alt="" loading="lazy" /></span>`;
  }
  return h`<span class="${cls}" style="${style}" aria-hidden="true">${initials(participant.name)}</span>`;
}

export function statusPill(event: EventView): RawHtml {
  if (event.status === 'LIVE' || event.status === 'PAUSED') {
    return h`<span class="pill pill--live"><span class="live-dot"></span>${
      event.status === 'PAUSED' ? 'Paused' : 'Live'
    }</span>`;
  }
  if (event.status === 'FINAL') return h`<span class="pill">Final</span>`;
  if (event.status === 'CANCELLED') return h`<span class="pill">Cancelled</span>`;
  if (event.status === 'POSTPONED') return h`<span class="pill">Postponed</span>`;
  if (event.status === 'UNKNOWN') return h`<span class="pill">Unconfirmed</span>`;
  return raw('');
}

export function betStatusPill(status: string): RawHtml {
  return h`<span class="pill pill--${status.toLowerCase()}">${status}</span>`;
}

export function emptyState(title: string, body: string, iconName = 'empty'): RawHtml {
  return h`
    <div class="empty fade-up">
      ${icon(iconName, 30)}
      <p class="empty__title">${title}</p>
      <p class="empty__body">${body}</p>
    </div>`;
}

export function skeletonList(count = 3, variant: 'card' | 'row' | 'hero' = 'card'): RawHtml {
  const items = Array.from({ length: count }, () => h`<div class="skeleton skeleton--${variant}"></div>`);
  return h`<div class="section" aria-busy="true">${items}</div>`;
}

/* ──────────────────────────── data honesty ─────────────────────────── */

export function freshnessBanner(freshness: Freshness): RawHtml {
  if (freshness.source === 'unavailable') {
    return h`
      <div class="banner banner--error fade-up" role="status">
        ${icon('alert', 16)}
        <div>
          <p class="banner__title">Live odds unavailable</p>
          <p>${freshness.error ?? 'KOVR could not reach its data provider.'}</p>
        </div>
      </div>`;
  }
  if (freshness.stale) {
    return h`
      <div class="banner banner--stale fade-up" role="status">
        ${icon('clock', 16)}
        <div>
          <p class="banner__title">Odds may be out of date</p>
          <p>Last updated ${relativeAge(freshness.ageMs)}${freshness.error ? h` — ${freshness.error}` : raw('')}</p>
        </div>
      </div>`;
  }
  return raw('');
}

export function freshnessLine(freshness: Freshness): RawHtml {
  if (freshness.lastUpdatedAt === null) return raw('');
  return h`<span class="${classes('freshness', freshness.stale && 'freshness--stale')}">
    ${icon('clock', 12)} Odds updated ${relativeAge(freshness.ageMs)}
  </span>`;
}

/* ─────────────────────────── odds and markets ──────────────────────── */

function lineLabel(line: number | null, marketKey: string): string {
  if (line === null) return '';
  if (marketKey.startsWith('total')) return ` ${line}`;
  return line > 0 ? ` +${line}` : ` ${line}`;
}

export interface OddsContext {
  event: EventView;
  leagueShortName: string;
  market: Market;
  /** Show the selection name above the price. Off for two-up hero buttons. */
  showLabel?: boolean;
}

export function oddsButton(context: OddsContext, index: number): RawHtml {
  const selection = context.market.selections[index];
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
      ${context.showLabel === false ? raw('') : h`<span class="odds-button__label">${label}</span>`}
      <span class="odds-button__price">${fmtOdds(selection.price)}</span>
    </button>`;
}

export function marketRow(context: OddsContext): RawHtml {
  const stacked = context.market.selections.length > 3;
  return h`<div class="${classes('odds-row', stacked && 'odds-row--stacked')}">
    ${context.market.selections.map((_, index) => oddsButton(context, index))}
  </div>`;
}

/* ─────────────────────── matchup with inline odds ──────────────────── */

/**
 * One competitor, with its price on the same line.
 *
 * Putting the button beside the name is the only layout that stays
 * unambiguous when two prices sit next to each other — a bare "-110" under
 * a two-name matchup does not say which side it belongs to.
 */
function competitorRow(
  entry: FeedEntry,
  index: number,
  options: { large?: boolean } = {},
): RawHtml {
  const participant = entry.event.participants[index];
  if (!participant) return raw('');

  const market = entry.markets[0];
  const selection = market?.selections[index];
  const isCombat = entry.event.categoryId === 'combat';
  const large = options.large === true;

  return h`
    <div class="${classes('competitor', large && 'competitor--large')}">
      ${avatar(participant, isCombat, large ? 48 : 34)}
      <span class="competitor__name">${participant.name}</span>
      ${
        participant.score !== null
          ? h`<span class="competitor__score num">${participant.score}</span>`
          : market && selection
            ? oddsButton(
                { event: entry.event, leagueShortName: entry.leagueShortName, market, showLabel: false },
                index,
              )
            : raw('')
      }
    </div>`;
}

function matchup(entry: FeedEntry, large = false): RawHtml {
  const isCombat = entry.event.categoryId === 'combat';
  return h`
    <div class="${classes('matchup', large && 'matchup--large')}">
      ${competitorRow(entry, 0, { large })}
      ${isCombat ? h`<div class="versus">VS</div>` : raw('')}
      ${competitorRow(entry, 1, { large })}
    </div>`;
}

/* ─────────────────────────────── the hero ──────────────────────────── */

/**
 * The card the app opens on: the event most worth looking at, priced, with
 * one obvious way in.
 */
export function heroCard(entry: FeedEntry): RawHtml {
  const { event } = entry;
  const live = event.status === 'LIVE' || event.status === 'PAUSED';

  return h`
    <section class="hero fade-up">
      <div class="hero__glow" aria-hidden="true"></div>
      <header class="hero__head">
        <span class="hero__league">${categoryIcon(event.categoryId, 14)} ${entry.leagueShortName}</span>
        ${live ? statusPill(event) : h`<span class="hero__when">${countdown(event.startTime)}</span>`}
      </header>

      ${matchup(entry, true)}

      ${entry.markets.length === 0 ? h`<div class="odds-unavailable">Odds unavailable</div>` : raw('')}

      <button class="hero__cta" type="button" data-open-event="${event.id}">
        ${entry.marketCount > 1 ? `All ${entry.marketCount} markets` : 'Full card'} ${icon('chevron', 14)}
      </button>
    </section>`;
}

/* ───────────────────────────── event cards ─────────────────────────── */

export function eventCard(entry: FeedEntry, index = 0): RawHtml {
  const { event } = entry;
  const live = event.status === 'LIVE' || event.status === 'PAUSED';

  return h`
    <article class="${classes('event-card', 'fade-up', live && 'event-card--live')}"
      style="animation-delay:${Math.min(index, 8) * 45}ms">
      <header class="event-card__head">
        <span class="event-card__league">${entry.leagueShortName}</span>
        ${live ? statusPill(event) : raw('')}
        <span class="event-card__time">${
          live ? (event.periodLabel ?? 'In progress') : eventTime(event.startTime)
        }</span>
      </header>

      ${matchup(entry)}

      <footer class="event-card__foot">
        ${entry.markets.length === 0 ? h`<span class="event-card__note">Odds unavailable</span>` : raw('')}
        <button class="event-card__more" type="button" data-open-event="${event.id}">
          ${entry.marketCount > 1 ? `${entry.marketCount} markets` : 'Details'} ${icon('chevron', 13)}
        </button>
      </footer>
    </article>`;
}

/* ──────────────────────────── section frame ────────────────────────── */

export function section(title: string, body: RawHtml, action?: { label: string; attr: string }): RawHtml {
  return h`
    <section class="section">
      <div class="section__head">
        <h2 class="section-title">${title}</h2>
        ${action ? h`<button class="section__link" type="button" ${raw(action.attr)}>${action.label}</button>` : raw('')}
      </div>
      ${body}
    </section>`;
}

export function eventGrid(entries: FeedEntry[]): RawHtml {
  return h`<div class="event-grid">${entries.map((entry, index) => eventCard(entry, index))}</div>`;
}
