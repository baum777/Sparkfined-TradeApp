import { logger } from '../observability/logger.js';

export interface JournalEnrichResult {
  processed: number;
  status: 'worked' | 'idle' | 'noop';
}

/**
 * Placeholder for journal enrichment queue processing.
 * The legacy Vercel cron consumed a KV-backed queue; the canonical backend
 * currently does not maintain that queue, so this job is a controlled no-op.
 */
export async function runJournalEnrichJob(): Promise<JournalEnrichResult> {
  logger.info('Journal enrich job invoked (noop placeholder)');
  return { processed: 0, status: 'noop' };
}

