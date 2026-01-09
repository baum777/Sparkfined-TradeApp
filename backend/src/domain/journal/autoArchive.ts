import { getDatabase } from '../../db/sqlite.js';

export type AutoArchiveReason = 'matched_sell' | 'user_action' | 'policy';

/**
 * Find the "best" pending BUY for an asset and archive it (system-only).
 *
 * Deterministic selection:
 * - nearest prior by timestamp (max timestamp < sellTimestampISO)
 * - tie-break: created_at desc, then id desc (lexicographic)
 */
export function matchPendingBuyCandidateId(params: {
  userId: string;
  assetMint: string;
  sellTimestampISO: string;
}): string | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
        SELECT id
        FROM journal_entries_v2
        WHERE user_id = ?
          AND status = 'pending'
          AND asset_mint = ?
          AND timestamp < ?
          AND action_type IN ('buy', 'swap')
        ORDER BY timestamp DESC, created_at DESC, id DESC
        LIMIT 1
      `
    )
    .get(params.userId, params.assetMint, params.sellTimestampISO) as { id: string } | undefined;
  return row?.id ?? null;
}

