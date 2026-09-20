/**
 * One event, with every market priced for it.
 *
 * Markets KOVR does not recognise are shown all the same, named from their
 * own key — what can be bet is the provider's to decide, not a list baked
 * into this file.
 */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { avatar, emptyState, freshnessBanner, freshnessLine, marketRow, statusPill, skeletonList } from '../components.js';
import { countdown, eventTime } from '../format.js';

export function eventSkeleton(): RawHtml {
  return h`<div class="view"><div class="skeleton skeleton--hero"></div>${skeletonList(3, 'card')}</div>`;
}

export async function renderEvent(eventId: string): Promise<RawHtml> {
  const response = await api.event(eventId);
  const { event, markets } = response.data;
  const isCombat = event.categoryId === 'combat';
  const live = event.status === 'LIVE' || event.status === 'PAUSED';
  const closed = event.status !== 'UPCOMING';

  const sides = event.participants.map(
    (participant) => h`
      <div class="competitor competitor--large">
        ${avatar(participant, isCombat, 48)}
        <span class="competitor__name">${participant.name}</span>
        ${participant.score !== null ? h`<span class="competitor__score num">${participant.score}</span>` : raw('')}
      </div>`,
  );

  return h`
    <div class="view">
      <button class="back-link" type="button" data-back>${icon('back', 15)} Back</button>
      ${freshnessBanner(response.freshness)}

      <section class="hero hero--detail fade-up">
        <div class="hero__glow" aria-hidden="true"></div>
        <header class="hero__head">
          <span class="hero__league">${event.eventTitle ?? event.leagueId.toUpperCase()}</span>
          ${live ? statusPill(event) : h`<span class="hero__when">${countdown(event.startTime)}</span>`}
        </header>
        <div class="matchup matchup--large">
          ${sides[0] ?? raw('')}
          ${isCombat ? h`<div class="versus">VS</div>` : raw('')}
          ${sides[1] ?? raw('')}
        </div>
        <p class="hero__meta">${eventTime(event.startTime)}${
          event.venue ? h` · ${event.venue}` : raw('')
        }${event.fight?.weightClass ? h` · ${event.fight.weightClass}` : raw('')}</p>
      </section>

      ${
        closed
          ? h`<div class="banner banner--info">${icon('clock', 16)}
               <div><p class="banner__title">Betting closed</p>
               <p>${event.statusLabel}. KOVR accepts bets only on events it can confirm have not started.</p></div>
             </div>`
          : raw('')
      }

      ${
        markets.length === 0
          ? emptyState(
              'Odds unavailable',
              'No market is currently priced for this event. Nothing is shown rather than invented.',
            )
          : h`${markets.map(
              (market, index) => h`
                <section class="section fade-up" style="animation-delay:${Math.min(index, 8) * 40}ms">
                  <div class="section__head">
                    <h2 class="section-title">${market.name}</h2>
                    <span class="dim">${market.selections[0]?.bookmakerName ?? ''}</span>
                  </div>
                  ${marketRow({ event, leagueShortName: event.leagueId.toUpperCase(), market })}
                </section>`,
            )}`
      }

      <div class="view__foot">${freshnessLine(response.freshness)}</div>
    </div>`;
}
