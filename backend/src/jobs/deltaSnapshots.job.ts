/**
 * Delta Snapshots Job
 * Computes post-trade delta snapshots for pro+ tier entries
 * Runs periodically to compute +15m, +1h, +4h deltas
 */

import { logger } from '../observability/logger.js';
import { getDatabase } from '../db/sqlite.js';
import { journalGetById } from '../domain/journal/repo.js';
import { computeAllDeltaSnapshots } from '../domain/market/delta.service.js';
import type { AtTradeMarketSnapshot } from '../domain/market/snapshot.service.js';

export interface DeltaSnapshotsJobResult {
  processed: number;
  computed: number;
  skipped: number;
}

/**
 * Run delta snapshots job
 * Processes pending/confirmed entries for pro+ tier users
 * Computes delta snapshots for entries that have passed the time windows
 */
export async function runDeltaSnapshotsJob(): Promise<DeltaSnapshotsJobResult> {
  const db = getDatabase();
  let processed = 0;
  let computed = 0;
  let skipped = 0;
  
  // Find entries that need delta computation
  // Only for entries with market snapshots (tier >= standard)
  // Only compute for pro+ tier users
  const entries = db.prepare(`
    SELECT DISTINCT e.user_id, e.id, e.timestamp, e.status
    FROM journal_entries_v2 e
    INNER JOIN journal_market_snapshots_v1 s ON e.user_id = s.user_id AND e.id = s.entry_id
    WHERE e.status IN ('pending', 'confirmed')
      AND e.timestamp IS NOT NULL
  `).all() as Array<{
    user_id: string;
    id: string;
    timestamp: string;
    status: string;
  }>;
  
  for (const entry of entries) {
    processed++;
    
    try {
      // Check if user is pro+ tier
      // Note: In production, you'd want to cache tier lookups
      // For now, we'll check if delta snapshots table has entries (indirect check)
      // Or we could add a tier column to entries, but that's a design decision
      
      // Load market snapshot
      const snapshotRow = db.prepare(`
        SELECT market_snapshot_json
        FROM journal_market_snapshots_v1
        WHERE user_id = ? AND entry_id = ?
      `).get(entry.user_id, entry.id) as { market_snapshot_json: string } | undefined;
      
      if (!snapshotRow) {
        skipped++;
        continue;
      }
      
      const atTradeSnapshot = JSON.parse(snapshotRow.market_snapshot_json) as AtTradeMarketSnapshot;

      // HARD GATE (spec): standard/free MUST NOT compute or persist deltas.
      // We don't persist user tiers in DB, so we infer pro+ eligibility from the snapshot payload:
      // - pro+ capture includes indicator fields (rsi14/trendState)
      // - standard capture does not
      const inferredProPlus = Object.prototype.hasOwnProperty.call(atTradeSnapshot, 'rsi14')
        || Object.prototype.hasOwnProperty.call(atTradeSnapshot, 'trendState');
      if (!inferredProPlus) {
        skipped++;
        continue;
      }
      
      // Get asset mint from entry
      const entryFull = journalGetById(entry.user_id, entry.id);
      if (!entryFull || !entryFull.capture?.assetMint) {
        skipped++;
        continue;
      }
      
      // Compute delta snapshots
      const deltas = await computeAllDeltaSnapshots(
        entryFull.capture.assetMint,
        atTradeSnapshot,
        entry.timestamp
      );
      
      // Persist delta snapshots
      for (const [window, delta] of Object.entries(deltas)) {
        if (delta) {
          db.prepare(`
            INSERT OR REPLACE INTO journal_delta_snapshots_v1
            (user_id, entry_id, window, delta_snapshot_json, captured_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            entry.user_id,
            entry.id,
            window,
            JSON.stringify(delta),
            delta.capturedAt
          );
          computed++;
        }
      }
    } catch (error) {
      logger.warn('Failed to compute delta snapshots for entry', {
        userId: entry.user_id,
        entryId: entry.id,
        error: String(error),
      });
      skipped++;
    }
  }
  
  logger.info('Delta snapshots job completed', {
    processed,
    computed,
    skipped,
  });
  
  return { processed, computed, skipped };
}

