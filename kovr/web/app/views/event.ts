/**
 * One event, with every market the provider prices for it.
 *
 * Markets KOVR does not recognise are shown all the same, named from their
 * own key — the catalogue of what can be bet is the provider's to decide,
 * not a list baked into this file.
 */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { avatar, emptyState, freshnessBanner, freshnessLine, marketRow, statusPill, skeletonList } from '../components.js';
import { eventTime } from '../format.js';

export function eventSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(4, 'card')}</div>`;
}

export async function renderEvent(eventId: string): Promise<RawHtml> {
  const response = await api.event(eventId);
  const { event, markets } = response.data;
  const isCombat = event.categoryId === 'combat';

  const competitors = event.participants.map(
    (participant) => h`
      <div class="competitor">
        ${avatar(participant, isCombat)}
        <span class="competitor__name" style="font-size:17px">${participant.name}</span>
        ${participant.score !== null ? h`<span class="competitor__score num">${participant.score}</span>` : raw('')}
      </div>`,
  );

  const header = h`
    <section class="card event-card--featured" style="padding:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span class="event-card__league">${event.eventTitle ?? event.leagueId.toUpperCase()}</span>
        ${statusPill(event)}
        <span class="event-card__time">${eventTime(event.startTime)}</span>
      </div>
      <div class="matchup">
        ${isCombat ? h`${competitors[0] ?? raw('')}<div class="versus">VS</div>${competitors[1] ?? raw('')}` : competitors}
      </div>
      ${
        event.fight?.weightClass
          ? h`<p class="muted" style="font-size:12.5px;margin-top:12px">${event.fight.weightClass}</p>`
          : raw('')
      }
      ${event.venue ? h`<p class="dim" style="font-size:12px;margin-top:8px">${event.venue}</p>` : raw('')}
    </section>`;

  const closed = event.status !== 'UPCOMING';

  const marketSections =
    markets.length === 0
      ? emptyState(
          'Odds unavailable',
          'KOVR’s data provider is not currently pricing any market for this event. Nothing is shown rather than invented.',
        )
      : h`${markets.map(
          (market) => h`
            <section class="section">
              <div class="section__head">
                <h2 class="section-title">${market.name}</h2>
                <span class="dim" style="font-size:11px">${market.selections[0]?.bookmakerName ?? ''}</span>
              </div>
              ${marketRow({ event, leagueShortName: event.leagueId.toUpperCase(), market })}
            </section>`,
        )}`;

  return h`
    <div class="view">
      <button class="section__link" type="button" data-back
        style="display:flex;align-items:center;gap:6px;align-self:flex-start">
        ${icon('back', 15)} Back
      </button>
      ${freshnessBanner(response.freshness)}
      ${header}
      ${
        closed
          ? h`<div class="banner banner--info">${icon('clock', 16)}
               <div><p class="banner__title">Betting closed</p>
               <p>${event.statusLabel}. KOVR accepts bets only on events it can confirm have not started.</p></div>
             </div>`
          : raw('')
      }
      ${marketSections}
      <div style="display:flex;justify-content:center">${freshnessLine(response.freshness)}</div>
    </div>`;
}
