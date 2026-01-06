import { kv, kvKeys, kvTTL, getKVStore } from '../../kv';
import { getEnv } from '../../env';
import { journalRepoKV } from './repo';
import { buildOnchainContextSnapshot } from './onchain/snapshot';
import { mergeOnchainContextMeta } from './onchain/merge';
import { DexPaprikaAdapter } from './onchain/dexpaprika';
import { logger } from '../../logger';

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
  const { userId, entryId, symbolOrAddress, timestamp } = job;

  // 1. Load Entry
  const entry = await journalRepoKV.getEvent(userId, entryId);
  if (!entry) {
    logger.warn('Enrich job skipped: entry not found', { entryId });
    return;
  }
  
  // Idempotency check? 
  // If entry already has context, should we overwrite?
  // Plan says "Enrichment kann wiederholt werden". 
  // We proceed to refresh/ensure data.
  
  if (!symbolOrAddress) {
    logger.warn('Enrich job skipped: no symbolOrAddress', { entryId });
    return;
  }

  const env = getEnv();
  
  // 2. Build Snapshot
  // We use the job timestamp (entry creation time) as 'now' to align capture time text,
  // even though the data fetched is "current" real-time data.
  const { context, meta: snapshotMeta } = await buildOnchainContextSnapshot({
    symbolOrAddress,
    requestId: `enrich-${entryId}`,
    now: timestamp,
  });

  // 3. Resolve Symbol (Optional)
  const displayUpdate: { baseSymbol?: string; baseMint?: string } = { baseMint: symbolOrAddress };
  
  if (env.SYMBOL_RESOLUTION_ENABLED) {
    const tokenMeta = await resolveTokenMeta(symbolOrAddress);
    if (tokenMeta?.symbol) {
      displayUpdate.baseSymbol = tokenMeta.symbol;
    }
  }

  // 4. Merge & Save
  const newMeta = mergeOnchainContextMeta(entry.onchainContextMeta, {
    capturedAt: snapshotMeta.capturedAt,
    errors: snapshotMeta.errors,
    display: displayUpdate,
  });

  entry.onchainContext = context;
  entry.onchainContextMeta = newMeta;
  
  // Mark as updated? 
  // entry.updatedAt = new Date().toISOString(); 
  // We strictly speaking change the entry, so yes.
  // But maybe we don't want to bump 'updatedAt' for background enrichment?
  // Usually 'updatedAt' implies user modification or significant change. 
  // Let's leave updatedAt as is or update it. Repo puts raw event.
  // Let's update it to be safe for sync.
  entry.updatedAt = new Date().toISOString();

  await journalRepoKV.putEvent(userId, entry);
  
  logger.info('Enrichment complete', { userId, entryId, symbol: displayUpdate.baseSymbol });
}

/**
 * Helper: Resolve token metadata with caching
 */
async function resolveTokenMeta(mint: string): Promise<{ symbol?: string; name?: string } | null> {
  const cacheKey = kvKeys.tokenMeta(mint);
  
  // 1. Check Cache
  const cached = await kv.get<{ symbol?: string; name?: string; updatedAt: string }>(cacheKey);
  if (cached) return cached;

  // 2. Fetch from Provider (DexPaprika)
  const env = getEnv();
  // Using short timeout for resolution to stay snappy
  const adapter = new DexPaprikaAdapter(env.DEXPAPRIKA_BASE_URL, env.DEXPAPRIKA_API_KEY);
  
  try {
    const data = await adapter.fetchTokenData(mint, 800); // 800ms timeout
    const result = { 
      symbol: data.symbol, 
      name: data.name, 
      updatedAt: new Date().toISOString() 
    };
    
    // Only cache if we got something useful
    if (result.symbol || result.name) {
      await kv.set(cacheKey, result, kvTTL.tokenMeta);
    }
    return result;
  } catch (e) {
    // Log debug, not error, as this is optional enhancement
    logger.debug('Token resolution failed', { mint, error: String(e) });
    return null;
  }
}

