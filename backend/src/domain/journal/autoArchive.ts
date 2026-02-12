import { getDatabase } from '../../db/index.js';

export type AutoArchiveReason = 'matched_sell' | 'user_action' | 'policy';

/**
 * Find the "best" pending BUY for an asset and archive it (system-only).
 *
 * Deterministic selection:
 * - nearest prior by timestamp (max timestamp < sellTimestampISO)
 * - tie-break: created_at desc, then id desc (lexicographic)
 */
export async function matchPendingBuyCandidateId(params: {
  userId: string;
  assetMint: string;
  sellTimestampISO: string;
}): Promise<string | null> {
  const db = getDatabase();
  const row = await db
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
    .get<{ id: string }>(params.userId, params.assetMint, params.sellTimestampISO);
  return row?.id ?? null;
}

