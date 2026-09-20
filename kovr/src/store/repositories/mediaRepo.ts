/**
 * Verified artwork, keyed by stable entity id.
 *
 * KOVR resolves an image by id and only ever serves one marked `verified`.
 * An unverified or missing mapping yields null and the UI draws a neutral
 * fallback, because the wrong fighter's face is worse than no face.
 */

import type { Database } from '../db.js';
import { bool, num, str, strOrNull, toSqlBool } from '../rows.js';
import type { Row } from '../db.js';

export type MediaEntityType = 'PARTICIPANT' | 'LEAGUE' | 'CATEGORY' | 'EVENT';

export interface MediaAsset {
  entityType: MediaEntityType;
  entityId: string;
  entityName: string;
  imageUrl: string | null;
  source: string;
  verified: boolean;
  lastVerifiedAt: string | null;
}

export class MediaRepository {
  constructor(private readonly database: Database) {}

  private static toAsset(row: Row): MediaAsset {
    return {
      entityType: str(row, 'entity_type') as MediaEntityType,
      entityId: str(row, 'entity_id'),
      entityName: str(row, 'entity_name'),
      imageUrl: strOrNull(row, 'image_url'),
      source: str(row, 'source'),
      verified: bool(row, 'verified'),
      lastVerifiedAt: strOrNull(row, 'last_verified_at'),
    };
  }

  /**
   * Record a mapping. `verified` must be set deliberately by whoever can
   * vouch for the image actually depicting this entity; nothing in KOVR
   * flips it on automatically from a name search.
   */
  upsert(asset: MediaAsset, at: string): void {
    this.database.run(
      `INSERT INTO media_assets
         (entity_type, entity_id, entity_name, image_url, source, verified, last_verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET
         entity_name      = excluded.entity_name,
         image_url        = excluded.image_url,
         source           = excluded.source,
         verified         = excluded.verified,
         last_verified_at = excluded.last_verified_at`,
      asset.entityType,
      asset.entityId,
      asset.entityName,
      asset.imageUrl,
      asset.source,
      toSqlBool(asset.verified),
      asset.lastVerifiedAt,
      at,
    );
  }

  find(entityType: MediaEntityType, entityId: string): MediaAsset | null {
    const row = this.database.get(
      'SELECT * FROM media_assets WHERE entity_type = ? AND entity_id = ?',
      entityType,
      entityId,
    );
    return row ? MediaRepository.toAsset(row) : null;
  }

  /** Verified URLs for a batch of ids, so a card render costs one query. */
  findVerifiedUrls(entityType: MediaEntityType, entityIds: readonly string[]): Map<string, string> {
    const found = new Map<string, string>();
    if (entityIds.length === 0) return found;

    const unique = [...new Set(entityIds)];
    const placeholders = unique.map(() => '?').join(', ');
    for (const row of this.database.all(
      `SELECT entity_id, image_url FROM media_assets
        WHERE entity_type = ? AND verified = 1 AND image_url IS NOT NULL
          AND entity_id IN (${placeholders})`,
      entityType,
      ...unique,
    )) {
      const url = strOrNull(row, 'image_url');
      if (url) found.set(str(row, 'entity_id'), url);
    }
    return found;
  }

  list(entityType?: MediaEntityType, limit = 200): MediaAsset[] {
    const bounded = Math.min(1000, Math.max(1, limit));
    const rows = entityType
      ? this.database.all(
          'SELECT * FROM media_assets WHERE entity_type = ? ORDER BY entity_name LIMIT ?',
          entityType,
          bounded,
        )
      : this.database.all('SELECT * FROM media_assets ORDER BY entity_type, entity_name LIMIT ?', bounded);
    return rows.map(MediaRepository.toAsset);
  }

  stats(): { total: number; verified: number } {
    const row = this.database.get(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) AS verified FROM media_assets',
    );
    if (!row) return { total: 0, verified: 0 };
    return { total: num(row, 'total'), verified: Number(row['verified'] ?? 0) };
  }
}
