/**
 * Journal Ingest Service
 * Handles journal capture with tier-gated market data capture
 */

import type { ResolvedTier } from '../../config/tiers.js';
import { tierGte } from '../../config/tiers.js';
import { journalIngestCapture as repoIngestCapture, type JournalCaptureIngest } from './repo.js';
import { buildAtTradeSnapshot, buildOrderPressureData } from '../market/snapshot.service.js';
import { getDatabase } from '../../db/sqlite.js';
import type { JournalEntryV1 } from './types.js';

/**
 * Ingest journal capture with tier-gated market data
 * 
 * Tier >= standard: capture market snapshot
 * Tier >= pro: capture market snapshot + RSI/trend
 * Tier >= high: capture market snapshot + RSI/trend + order pressure
 */
export async function journalIngestCapture(
  userId: string,
  capture: JournalCaptureIngest,
  tier: ResolvedTier
): Promise<JournalEntryV1> {
  // Create entry first
  const entry = repoIngestCapture(userId, capture);
  
  // Tier-gated market data capture
  const symbolOrAddress = capture.assetMint;
  const capturedAt = capture.timestampISO || new Date().toISOString();
  
  // Tier >= standard: capture basic market snapshot
  if (tierGte(tier, 'standard') && symbolOrAddress) {
    const snapshot = await buildAtTradeSnapshot(tier, symbolOrAddress, capturedAt);
    
    // Persist market snapshot
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO journal_market_snapshots_v1
      (user_id, entry_id, market_snapshot_json, captured_at)
      VALUES (?, ?, ?, ?)
    `).run(
      userId,
      entry.id,
      JSON.stringify(snapshot),
      capturedAt
    );
    
    // Tier >= high: capture order pressure
    if (tierGte(tier, 'high')) {
      const orderPressure = await buildOrderPressureData(symbolOrAddress);
      
      db.prepare(`
        INSERT OR REPLACE INTO journal_order_pressure_v1
        (user_id, entry_id, order_pressure_json, captured_at)
        VALUES (?, ?, ?, ?)
      `).run(
        userId,
        entry.id,
        JSON.stringify(orderPressure),
        capturedAt
      );
    }
  }
  
  // Tier < standard: DO NOT persist price/market data
  // Return entry without market data
  
  return entry;
}

