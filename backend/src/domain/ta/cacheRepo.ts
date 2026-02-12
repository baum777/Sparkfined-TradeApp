import { getDatabase } from '../../db/index.js';
import type { TAReport } from './types.js';

/**
 * TA Cache Repository
 * Caches TA reports per DATA_STORES.md
 * TTL: 24 hours
 */

const TA_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

function getCacheKey(market: string, timeframe: string, replay: boolean, bucket: string): string {
  return `ta:${market}:${timeframe}:${replay}:${bucket}`;
}

export async function taCacheGet(
  market: string,
  timeframe: string,
  replay: boolean,
  bucket: string
): Promise<TAReport | null> {
  const db = getDatabase();
  const key = getCacheKey(market, timeframe, replay, bucket);
  const now = Math.floor(Date.now() / 1000);

  const row = await db.prepare(`
    SELECT payload_json FROM ta_cache_v1
    WHERE key = ? AND expires_at > ?
  `).get<{ payload_json: string }>(key, now);

  if (!row) {
    return null;
  }

  return JSON.parse(row.payload_json) as TAReport;
}

export async function taCacheSet(
  market: string,
  timeframe: string,
  replay: boolean,
  bucket: string,
  report: TAReport
): Promise<void> {
  const db = getDatabase();
  const key = getCacheKey(market, timeframe, replay, bucket);
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + TA_CACHE_TTL_SECONDS;

  await db.prepare(`
    INSERT OR REPLACE INTO ta_cache_v1 (key, payload_json, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(key, JSON.stringify(report), expiresAt, now);
}

export async function taCacheCleanup(): Promise<number> {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const result = await db.prepare(`
    DELETE FROM ta_cache_v1 WHERE expires_at <= ?
  `).run(now);

  return result.changes;
}
