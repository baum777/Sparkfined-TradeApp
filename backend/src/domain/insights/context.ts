/**
 * Insight Context Builder
 * Assembles ONLY the data allowed for tier
 * Hard wall against overreach
 */

import type { JournalEntryV1 } from '../journal/types.js';
import type { AtTradeMarketSnapshot } from '../market/snapshot.service.js';
import type { DeltaSnapshot } from '../market/delta.service.js';
import type { InsightContext } from './types.js';
import type { ResolvedTier } from '../../config/tiers.js';
import { tierGte } from '../../config/tiers.js';
import { getDatabase } from '../../db/sqlite.js';
import type { JournalEntryRow } from '../journal/types.js';

/**
 * Build insight context for a journal entry
 * Only includes data allowed for the user's tier
 */
export async function buildInsightContext(
  userId: string,
  entry: JournalEntryV1,
  tier: ResolvedTier
): Promise<InsightContext> {
  const context: InsightContext = {
    entry,
  };
  
  // Tier >= standard: include at-trade market snapshot
  if (tierGte(tier, 'standard')) {
    // Load market snapshot from database if available
    const snapshot = await loadMarketSnapshot(userId, entry.id);
    if (snapshot) {
      context.atTradeSnapshot = snapshot;
    }
  }
  
  // Tier >= pro: include delta snapshots
  if (tierGte(tier, 'pro')) {
    const deltas = await loadDeltaSnapshots(userId, entry.id);
    if (deltas) {
      context.deltaSnapshots = deltas;
    }
    
    // Include confirmed entries history for cross-trade reasoning
    const confirmed = await loadConfirmedEntries(userId, entry.id);
    context.confirmedEntries = confirmed;
  }
  
  // Tier >= high: include order pressure
  if (tierGte(tier, 'high')) {
    const orderPressure = await loadOrderPressure(userId, entry.id);
    if (orderPressure) {
      context.orderPressure = orderPressure;
    }
  }
  
  return context;
}

/**
 * Load market snapshot from database
 */
async function loadMarketSnapshot(
  userId: string,
  entryId: string
): Promise<AtTradeMarketSnapshot | null> {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT market_snapshot_json
    FROM journal_market_snapshots_v1
    WHERE user_id = ? AND entry_id = ?
  `).get(userId, entryId) as { market_snapshot_json: string } | undefined;
  
  if (!row) return null;
  
  try {
    return JSON.parse(row.market_snapshot_json) as AtTradeMarketSnapshot;
  } catch {
    return null;
  }
}

/**
 * Load delta snapshots from database
 */
async function loadDeltaSnapshots(
  userId: string,
  entryId: string
): Promise<Record<string, DeltaSnapshot | null> | null> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT window, delta_snapshot_json
    FROM journal_delta_snapshots_v1
    WHERE user_id = ? AND entry_id = ?
  `).all(userId, entryId) as { window: string; delta_snapshot_json: string }[];
  
  if (rows.length === 0) return null;
  
  const deltas: Record<string, DeltaSnapshot | null> = {};
  for (const row of rows) {
    try {
      deltas[row.window] = JSON.parse(row.delta_snapshot_json) as DeltaSnapshot;
    } catch {
      deltas[row.window] = null;
    }
  }
  
  return deltas;
}

/**
 * Load confirmed entries for cross-trade reasoning
 */
async function loadConfirmedEntries(
  userId: string,
  excludeEntryId: string
): Promise<JournalEntryV1[]> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      id, user_id, side, status, timestamp, summary, day_key, created_at, updated_at,
      capture_source, capture_key, tx_signature, wallet, action_type, asset_mint, amount, price_hint, linked_entry_id
    FROM journal_entries_v2
    WHERE user_id = ? AND status = 'confirmed' AND id != ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(userId, excludeEntryId) as JournalEntryRow[];
  
  // Convert rows to JournalEntryV1 (simplified - would need full conversion)
  return rows.map(row => ({
    id: row.id,
    status: row.status as 'pending' | 'confirmed' | 'archived',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summary: row.summary,
    timestamp: row.timestamp,
    ...(row.capture_key ? {
      capture: {
        source: row.capture_source || 'unknown',
        txSignature: row.tx_signature || undefined,
        wallet: row.wallet || undefined,
        actionType: row.action_type || undefined,
        assetMint: row.asset_mint || undefined,
        amount: typeof row.amount === 'number' ? row.amount : undefined,
        priceHint: typeof row.price_hint === 'number' ? row.price_hint : undefined,
        captureKey: row.capture_key,
        linkedEntryId: row.linked_entry_id || undefined,
      }
    } : {}),
  }));
}

/**
 * Load order pressure data
 */
async function loadOrderPressure(
  userId: string,
  entryId: string
): Promise<{
  buySellImbalance?: number;
  largeTxCount?: number;
  avgTradeSizeDelta?: number;
} | null> {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT order_pressure_json
    FROM journal_order_pressure_v1
    WHERE user_id = ? AND entry_id = ?
  `).get(userId, entryId) as { order_pressure_json: string } | undefined;
  
  if (!row) return null;
  
  try {
    return JSON.parse(row.order_pressure_json);
  } catch {
    return null;
  }
}

