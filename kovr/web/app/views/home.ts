/**
 * Home — the hub.
 *
 * Everything on, across every competition KOVR pulls: a hero for the event
 * most worth opening the app for, a live rail, and the full board below,
 * filterable by sport without leaving the page.
 */

import { h, raw, classes } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import type { FeedEntry, FeedSections } from '../api.js';
import {
  emptyState,
  eventGrid,
  freshnessBanner,
  freshnessLine,
  heroCard,
  section,
  skeletonList,
} from '../components.js';
import { categoryIcon, icon } from '../icons.js';

/** Sport filter, held across renders so it survives a refresh. */
let activeLeague: string | null = null;

export function setLeagueFilter(leagueId: string | null): void {
  activeLeague = leagueId;
}

export function currentLeagueFilter(): string | null {
  return activeLeague;
}

export function homeSkeleton(): RawHtml {
  return h`<div class="view">
    <div class="skeleton skeleton--hero"></div>
    ${skeletonList(4, 'card')}
  </div>`;
}

function filterRail(feed: FeedSections): RawHtml {
  if (feed.leagues.length <= 1) return raw('');

  return h`
    <div class="chip-rail" role="tablist" aria-label="Filter by sport">
      <button class="chip" type="button" role="tab" data-league-filter=""
        aria-pressed="${activeLeague === null ? 'true' : 'false'}">
        All<span class="chip__count">${feed.totalEvents}</span>
      </button>
      ${feed.leagues.map(
        (league) => h`
          <button class="chip" type="button" role="tab" data-league-filter="${league.id}"
            aria-pressed="${activeLeague === league.id ? 'true' : 'false'}">
            ${categoryIcon(league.categoryId, 15)} ${league.shortName}
            <span class="chip__count">${league.count}</span>
          </button>`,
      )}
    </div>`;
}

function matchesFilter(entry: FeedEntry): boolean {
  return activeLeague === null || entry.leagueId === activeLeague;
}

export async function renderHome(): Promise<RawHtml> {
  let response;
  try {
    response = await api.feed();
  } catch {
    return h`<div class="view">${freshnessBanner({
      source: 'unavailable',
      lastUpdatedAt: null,
      ageMs: null,
      stale: true,
      error: 'KOVR could not reach the server.',
    })}</div>`;
  }

  const feed = response.data;

  if (feed.totalEvents === 0) {
    return h`
      <div class="view">
        ${freshnessBanner(response.freshness)}
        ${emptyState(
          'Nothing on right now',
          'KOVR shows the events its data provider currently lists. Check back when the next card is announced.',
          'empty',
        )}
      </div>`;
  }

  // When a sport is selected, the hero follows it rather than staying on a
  // different competition's event.
  const filteredLive = feed.live.filter(matchesFilter);
  const filteredNext = feed.next.filter(matchesFilter);
  const hero =
    activeLeague === null
      ? feed.headline
      : (filteredLive[0] ??
        filteredNext[0] ??
        feed.byLeague.find((group) => group.league.id === activeLeague)?.events[0] ??
        null);

  const shown = new Set<string>();
  const unseen = (entries: FeedEntry[]): FeedEntry[] =>
    entries.filter((entry) => {
      if (!matchesFilter(entry) || shown.has(entry.event.id)) return false;
      shown.add(entry.event.id);
      return true;
    });

  if (hero) shown.add(hero.event.id);

  const sections: RawHtml[] = [];

  const live = unseen(feed.live);
  if (live.length > 0) {
    sections.push(section(`Live now`, eventGrid(live)));
  }

  const next = unseen(feed.next);
  if (next.length > 0) {
    sections.push(section('Starting soon', eventGrid(next)));
  }

  for (const group of feed.byLeague) {
    if (activeLeague !== null && group.league.id !== activeLeague) continue;
    const events = unseen(group.events);
    if (events.length === 0) continue;
    sections.push(
      section(group.league.shortName, eventGrid(events), {
        label: 'All',
        attr: `data-open-league="${group.league.id}"`,
      }),
    );
  }

  const nothingLeft = sections.length === 0 && !hero;

  return h`
    <div class="view view--home">
      ${freshnessBanner(response.freshness)}
      ${hero ? heroCard(hero) : raw('')}
      ${filterRail(feed)}
      ${
        nothingLeft
          ? emptyState('Nothing in this sport right now', 'Pick another sport, or check back shortly.')
          : raw('')
      }
      ${sections}
      <div class="view__foot">
        ${freshnessLine(response.freshness)}
        <button class="${classes('btn', 'btn--ghost', 'btn--sm')}" type="button" data-reload>
          ${icon('refresh', 14)} Refresh
        </button>
      </div>
    </div>`;
}
