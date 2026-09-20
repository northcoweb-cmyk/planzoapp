/**
 * Home.
 *
 * Sections are drawn only when they hold something. An empty rail is never
 * padded out to make the page look busier than the data is.
 */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import type { FeedEntry, HomeFeed } from '../api.js';
import { eventCard, emptyState, freshnessBanner, freshnessLine, skeletonList, walletSummary } from '../components.js';
import { money, moneySigned, eventTime, pluralise } from '../format.js';
import { store } from '../store.js';
import type { SportEvent } from '../../../src/domain/types.js';

function section(title: string, body: RawHtml, link?: { label: string; action: string }): RawHtml {
  return h`
    <section class="section">
      <div class="section__head">
        <h2 class="section-title">${title}</h2>
        ${link ? h`<button class="section__link" type="button" ${raw(link.action)}>${link.label} →</button>` : raw('')}
      </div>
      ${body}
    </section>`;
}

function cards(entries: FeedEntry[], leagueName: (event: SportEvent) => string, featured = false): RawHtml {
  return h`<div class="section event-grid">${entries.map((entry) =>
    eventCard(entry.event, {
      leagueShortName: leagueName(entry.event),
      markets: entry.markets,
      marketCount: entry.marketCount,
      featured,
    }),
  )}</div>`;
}

export function homeSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(1, 'row')}${skeletonList(3, 'card')}</div>`;
}

export async function renderHome(): Promise<RawHtml> {
  let feed: HomeFeed;
  try {
    feed = await api.home();
  } catch {
    return h`<div class="view">${freshnessBanner({
      source: 'unavailable',
      lastUpdatedAt: null,
      ageMs: null,
      stale: true,
      error: 'KOVR could not reach the server.',
    })}</div>`;
  }

  store.setWallet(feed.wallet);
  store.setOpenBetCount(feed.openBets.length);

  const leagueNameFor = (event: SportEvent): string =>
    feed.data.byLeague.find((entry) => entry.league.id === event.leagueId)?.league.shortName ??
    event.leagueId.toUpperCase();

  const sections: RawHtml[] = [];

  // An event appears once. Without this the same fight shows under Live,
  // Featured and its own league, which reads as padding rather than depth.
  const shown = new Set<string>();
  const unseen = (entries: FeedEntry[]): FeedEntry[] =>
    entries.filter((entry) => {
      if (shown.has(entry.event.id)) return false;
      shown.add(entry.event.id);
      return true;
    });

  if (feed.data.live.length > 0) {
    sections.push(
      section(
        'Live now',
        cards(unseen(feed.data.live), leagueNameFor),
        { label: 'All sports', action: 'data-nav="/sports"' },
      ),
    );
  }

  if (feed.data.featured.length > 0) {
    const featured = unseen(feed.data.featured).slice(0, 4);
    if (featured.length > 0) sections.push(section('Featured', cards(featured, leagueNameFor, true)));
  }

  if (feed.data.startingSoon.length > 0) {
    const soon = unseen(feed.data.startingSoon).slice(0, 6);
    if (soon.length > 0) sections.push(section('Starting soon', cards(soon, leagueNameFor)));
  }

  for (const entry of feed.data.byLeague.slice(0, 6)) {
    const remaining = unseen(entry.events).slice(0, 4);
    if (remaining.length === 0) continue;
    sections.push(
      section(
        entry.league.shortName,
        cards(remaining, () => entry.league.shortName),
        { label: 'View all', action: `data-open-league="${entry.league.id}"` },
      ),
    );
  }

  const openBets =
    feed.openBets.length > 0
      ? section(
          `Open ${pluralise(feed.openBets.length, 'bet')}`,
          h`<div class="card">${feed.openBets.map(
            (bet) => h`
              <button class="row row--button" type="button" data-nav="/bets">
                <span class="row__body">
                  <span class="row__title">${
                    bet.selections.length === 1
                      ? (bet.selections[0]?.selectionName ?? 'Selection')
                      : `${bet.selections.length}-leg parlay`
                  }</span>
                  <span class="row__meta">${
                    bet.selections[0] ? eventTime(bet.selections[0].eventStartTime) : ''
                  }</span>
                </span>
                <span class="row__value">
                  <span class="row__amount num">${money(bet.stakeCents)}</span>
                  <span class="row__meta num">to pay ${money(bet.potentialPayoutCents)}</span>
                </span>
              </button>`,
          )}</div>`,
          { label: 'My bets', action: 'data-nav="/bets"' },
        )
      : raw('');

  const activity =
    feed.activity.length > 0
      ? section(
          'Recent activity',
          h`<div class="card">${feed.activity.slice(0, 5).map(
            (item) => h`
              <div class="row">
                <span class="row__body">
                  <span class="row__title">${item.title}</span>
                  <span class="row__meta">${item.detail}</span>
                </span>
                <span class="row__value">
                  <span class="${
                    (item.amountCents ?? 0) >= 0 ? 'row__amount row__amount--credit num' : 'row__amount row__amount--debit num'
                  }">${moneySigned(item.amountCents ?? 0)}</span>
                </span>
              </div>`,
          )}</div>`,
          { label: 'All activity', action: 'data-nav="/activity"' },
        )
      : raw('');

  const nothing =
    sections.length === 0
      ? feed.freshness.source === 'unavailable'
        ? raw('')
        : emptyState(
            'No events to show',
            'KOVR shows the competitions its data provider currently offers. Nothing is scheduled with prices right now.',
          )
      : raw('');

  return h`
    <div class="view">
      ${freshnessBanner(feed.freshness)}
      ${walletSummary(
        feed.wallet.balanceCents,
        'Simulated funds. KOVR never holds or moves real money.',
      )}
      <div class="stat-grid">
        <div class="stat">
          <span class="stat__value num">${feed.openBets.length}</span>
          <span class="stat__label">Open bets</span>
        </div>
        <div class="stat">
          <span class="stat__value num">${feed.data.live.length}</span>
          <span class="stat__label">Live now</span>
        </div>
        <div class="stat">
          <span class="stat__value num">${feed.data.byLeague.length}</span>
          <span class="stat__label">Leagues</span>
        </div>
      </div>
      ${sections}
      ${openBets}
      ${activity}
      ${nothing}
      <div style="display:flex;justify-content:center;padding-top:4px">${freshnessLine(feed.freshness)}</div>
    </div>`;
}
