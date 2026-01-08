import { logger } from '../../logger';
import { getKVStore, kvKeys } from '../../kv';

export interface EnrichJob {
  userId: string;
  entryId: string;
  symbolOrAddress?: string;
  timestamp: string; // for snapshot reference (usually entry.createdAt)
}

/**
 * Add an enrichment job to the queue
 */
export async function enqueueEnrichJob(job: EnrichJob): Promise<void> {
  const key = kvKeys.journalEnrichQueue();
  // Use rpush to add to the tail of the list
  await getKVStore().rpush(key, JSON.stringify(job));
}

/**
 * Remove and return the next job from the queue
 */
export async function dequeueEnrichJob(): Promise<EnrichJob | null> {
  const key = kvKeys.journalEnrichQueue();
  // Use lpop to remove from the head of the list
  const item = await getKVStore().lpop(key);
  if (!item) return null;
  
  try {
    return JSON.parse(item) as EnrichJob;
  } catch (e) {
    logger.error('Failed to parse enrich job', { error: String(e), item });
    return null;
  }
}

/**
 * Process a single enrichment job
 * - Fetches snapshot (Price, Liquidity, etc.)
 * - Resolves Symbol (if enabled)
 * - Merges metadata safely
 */
export async function processEnrichJob(job: EnrichJob): Promise<void> {
  // Journal v1 is a Diary/Reflection system (no trading/onchain enrichment).
  // This job processor is intentionally a no-op to avoid reintroducing trading fields.
  logger.info('Enrich job skipped (disabled for Journal v1)', {
    userId: job.userId,
    entryId: job.entryId,
  });
}

