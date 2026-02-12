import { oracleGetDaily } from '../domain/oracle/repo.js';
import { logger } from '../observability/logger.js';

/**
 * Precomputes the oracle daily feed for the current day.
 * Mirrors the prior Vercel cron behavior at 06:00 UTC.
 */
export async function runOracleDailyJob(): Promise<void> {
  const now = new Date();
  const dateLabel = now.toISOString().slice(0, 10);

  try {
    await oracleGetDaily(now, 'system-cron');
    logger.info('Oracle daily job completed', { date: dateLabel });
  } catch (error) {
    logger.error('Oracle daily job failed', { date: dateLabel, error: String(error) });
    throw error;
  }
}

