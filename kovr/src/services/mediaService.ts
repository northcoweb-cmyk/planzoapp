/**
 * Artwork resolution.
 *
 * Images are looked up by stable entity id and served only when the mapping
 * is marked verified. There is no name search, no similarity match, and no
 * "close enough": an unresolved entity gets null, and the interface draws a
 * neutral monogram. Showing the wrong fighter is a worse failure than
 * showing no photo, so this layer is built to fail that way round.
 */

import type { Participant, SportEvent } from '../domain/types.js';
import type { MediaAsset, MediaRepository } from '../store/repositories/mediaRepo.js';

export class MediaService {
  constructor(private readonly media: MediaRepository) {}

  /** Attach verified photos to an event's competitors, in one query. */
  decorateEvents(events: readonly SportEvent[]): SportEvent[] {
    const participantIds = events.flatMap((event) => event.participants.map((p) => p.externalId));
    const participantImages = this.media.findVerifiedUrls('PARTICIPANT', participantIds);
    const eventImages = this.media.findVerifiedUrls(
      'EVENT',
      events.map((event) => event.id),
    );

    return events.map((event) => ({
      ...event,
      imageUrl: event.imageUrl ?? eventImages.get(event.id) ?? null,
      participants: event.participants.map(
        (participant): Participant => ({
          ...participant,
          imageUrl: participantImages.get(participant.externalId) ?? null,
        }),
      ),
    }));
  }

  decorateEvent(event: SportEvent): SportEvent {
    const [decorated] = this.decorateEvents([event]);
    return decorated ?? event;
  }

  /**
   * Register a mapping.
   *
   * `verified` is the caller's assertion that this URL really depicts this
   * entity. Nothing here can establish that on its own, so nothing here sets
   * it: it arrives from an operator through the developer API or a seed file.
   */
  register(asset: MediaAsset, at = new Date().toISOString()): void {
    this.media.upsert(asset, at);
  }

  find(entityType: MediaAsset['entityType'], entityId: string): MediaAsset | null {
    return this.media.find(entityType, entityId);
  }

  list(entityType?: MediaAsset['entityType']): MediaAsset[] {
    return this.media.list(entityType);
  }

  stats(): { total: number; verified: number } {
    return this.media.stats();
  }

  /**
   * Initials for the neutral fallback tile, e.g. "Israel Adesanya" -> "IA".
   * Purely typographic — it identifies nothing and claims nothing.
   */
  static initialsFor(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
    return `${(words[0] ?? '').charAt(0)}${(words[words.length - 1] ?? '').charAt(0)}`.toUpperCase();
  }
}
