/**
 * The sports catalogue and a single competition's board.
 *
 * What KOVR lists is whatever the provider currently offers, grouped by
 * sport. A competition that comes into season appears on its own.
 */

import { h } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import { categoryIcon, icon } from '../icons.js';
import { emptyState, eventGrid, freshnessBanner, skeletonList } from '../components.js';

export function sportsSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(7, 'row')}</div>`;
}

export async function renderSports(): Promise<RawHtml> {
  const response = await api.sports();

  if (response.data.length === 0) {
    return h`
      <div class="view">
        <header class="view-header"><h1 class="view-title">Sports</h1></header>
        ${freshnessBanner(response.freshness)}
        ${emptyState('No competitions available', 'KOVR lists whatever its data provider currently offers.')}
      </div>`;
  }

  const total = response.data.reduce((sum, group) => sum + group.leagues.length, 0);

  return h`
    <div class="view">
      <header class="view-header fade-up">
        <h1 class="view-title">Sports</h1>
        <p class="muted">${total} competitions across ${response.data.length} sports</p>
      </header>
      ${freshnessBanner(response.freshness)}
      ${response.data.map(
        (group, index) => h`
          <section class="section fade-up" style="animation-delay:${Math.min(index, 8) * 40}ms">
            <div class="section__head">
              <h2 class="section-title section-title--icon">
                <span class="section-icon">${categoryIcon(group.category.id, 16)}</span>
                ${group.category.name}
              </h2>
              <span class="dim">${group.leagues.length}</span>
            </div>
            <div class="card">
              ${group.leagues.map(
                (league) => h`
                  <button class="row row--button" type="button" data-open-league="${league.id}">
                    <span class="row__body">
                      <span class="row__title">${league.shortName}</span>
                      <span class="row__meta">${league.name}</span>
                    </span>
                    ${
                      league.providerActive
                        ? h`<span class="pill pill--open">${league.seasonLabel}</span>`
                        : h`<span class="pill">${league.seasonLabel}</span>`
                    }
                    ${icon('chevron', 16)}
                  </button>`,
              )}
            </div>
          </section>`,
      )}
    </div>`;
}

export async function renderLeague(leagueId: string): Promise<RawHtml> {
  const response = await api.league(leagueId);
  const { league, events } = response.data;

  return h`
    <div class="view">
      <button class="back-link" type="button" data-nav="/sports">${icon('back', 15)} Sports</button>
      <header class="view-header fade-up">
        <h1 class="view-title">${league.shortName}</h1>
        <p class="muted">${league.name} · ${league.seasonLabel}</p>
      </header>
      ${freshnessBanner(response.freshness)}
      ${
        events.length === 0
          ? emptyState(
              `Nothing scheduled in ${league.shortName}`,
              'KOVR shows only what its provider currently lists for this competition.',
            )
          : eventGrid(events)
      }
    </div>`;
}
