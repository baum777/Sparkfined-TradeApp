import { logger } from '../observability/logger.js';
import { runOracleDailyJob } from './oracleDaily.js';
import { runJournalEnrichJob } from './journalEnrich.js';
import { runDeltaSnapshotsJob } from './deltaSnapshots.job.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;

function msUntilNextUtcHour(targetHour: number): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    targetHour,
    0,
    0,
    0,
  ));

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

function safeRun(name: string, fn: () => Promise<void>): () => void {
  return () => {
    fn().catch((error) => {
      logger.error(`${name} failed`, { error: String(error) });
    });
  };
}

export function startScheduledJobs(): { stop: () => void } {
  const timeouts: NodeJS.Timeout[] = [];
  const intervals: NodeJS.Timeout[] = [];

  // Oracle daily: run at 06:00 UTC, also warm cache on startup.
  const runOracle = safeRun('oracle-daily', runOracleDailyJob);
  runOracle();

  const oracleDelay = msUntilNextUtcHour(6);
  const oracleTimeout = setTimeout(() => {
    runOracle();
    const oracleInterval = setInterval(runOracle, DAY_MS);
    intervals.push(oracleInterval);
  }, oracleDelay);
  timeouts.push(oracleTimeout);

  // Journal enrich: run every 5 minutes (no-op placeholder for now), run once immediately.
  const runEnrich = safeRun('journal-enrich', async () => {
    const result = await runJournalEnrichJob();
    logger.info('Journal enrich tick', { ...result });
  });
  runEnrich();

  const enrichInterval = setInterval(runEnrich, FIVE_MIN_MS);
  intervals.push(enrichInterval);

  // Delta snapshots: run every 5 minutes (pro+ inferred from captured snapshot fields).
  const runDeltas = safeRun('delta-snapshots', async () => {
    const result = await runDeltaSnapshotsJob();
    logger.info('Delta snapshots tick', { ...result });
  });
  runDeltas();
  const deltasInterval = setInterval(runDeltas, FIVE_MIN_MS);
  intervals.push(deltasInterval);

  const stop = () => {
    timeouts.forEach(clearTimeout);
    intervals.forEach(clearInterval);
  };

  return { stop };
}

