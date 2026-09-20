/**
 * Sports navigation and a single competition's card.
 *
 * The catalogue is whatever the provider currently offers, grouped by KOVR's
 * own categories. Competitions with nothing on are hidden by default and can
 * be shown with the "all competitions" toggle, which is the honest way to
 * present a catalogue that changes with the seasons.
 */

import { h } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import { categoryIcon, icon } from '../icons.js';
import { eventCard, emptyState, freshnessBanner, leagueRow, skeletonList } from '../components.js';

let showAll = false;

export function toggleShowAll(): boolean {
  showAll = !showAll;
  return showAll;
}

export function sportsSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(6, 'row')}</div>`;
}

export async function renderSports(): Promise<RawHtml> {
  const response = await api.sports(showAll);

  if (response.data.length === 0) {
    return h`
      <div class="view">
        <header class="view-header"><h1 class="view-title">Sports</h1></header>
        ${freshnessBanner(response.freshness)}
        ${emptyState(
          'No competitions available',
          'KOVR lists whatever its data provider currently offers. Nothing is in season with prices right now.',
        )}
      </div>`;
  }

  const groups = response.data.map(
    (group) => h`
      <section class="section">
        <div class="section__head">
          <h2 class="section-title" style="display:flex;align-items:center;gap:9px">
            <span class="avatar" aria-hidden="true">${categoryIcon(group.category.id, 17)}</span>
            ${group.category.name}
          </h2>
          <span class="dim" style="font-size:12px">${group.leagues.length}</span>
        </div>
        <div class="card">${group.leagues.map((league) => leagueRow(league))}</div>
      </section>`,
  );

  return h`
    <div class="view">
      <header class="view-header">
        <h1 class="view-title">Sports</h1>
        <p class="muted" style="font-size:13px">
          ${response.data.reduce((total, group) => total + group.leagues.length, 0)} competitions across
          ${response.data.length} sports
        </p>
      </header>
      ${freshnessBanner(response.freshness)}
      <button class="btn btn--ghost btn--block btn--sm" type="button" data-toggle-all>
        ${icon('sports', 15)} ${showAll ? 'Show only what is on now' : 'Show all competitions'}
      </button>
      ${groups}
    </div>`;
}

export async function renderLeague(leagueId: string): Promise<RawHtml> {
  const response = await api.leagueEvents(leagueId);

  const body =
    response.data.length === 0
      ? emptyState(
          `Nothing scheduled in ${response.league.shortName}`,
          `KOVR shows only what its provider currently lists. This competition reads as: ${response.league.seasonLabel.toLowerCase()}.`,
        )
      : h`<div class="section event-grid">${response.data.map((entry) =>
          eventCard(entry.event, {
            leagueShortName: response.league.shortName,
            markets: entry.markets,
            marketCount: entry.marketCount,
          }),
        )}</div>`;

  return h`
    <div class="view">
      <button class="section__link" type="button" data-nav="/sports"
        style="display:flex;align-items:center;gap:6px;align-self:flex-start">
        ${icon('back', 15)} Sports
      </button>
      <header class="view-header">
        <h1 class="view-title">${response.league.shortName}</h1>
        <p class="muted" style="font-size:13px">${response.league.name} · ${response.league.seasonLabel}</p>
      </header>
      ${freshnessBanner(response.freshness)}
      <button class="btn btn--ghost btn--sm" type="button" data-refresh-league="${leagueId}"
        style="align-self:flex-start">
        ${icon('refresh', 15)} Refresh odds
      </button>
      ${body}
    </div>`;
}
