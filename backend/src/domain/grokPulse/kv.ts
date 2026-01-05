import { kv } from '@vercel/kv';
import type { GrokSentimentSnapshot, PulseHistoryEntry } from './types.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../observability/logger.js';

// Keys
const KEYS = {
  snap: (addr: string) => `gp:v1:snap:${addr}`,
  hist: (addr: string) => `gp:v1:hist:${addr}`,
  quota: (date: string) => `gp:v1:quota:${date}`,
  lastRun: () => `gp:v1:meta:lastRun`,
};

function isKvEnabled() {
  const env = getEnv();
  return !!(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
}

// Memory fallback for dev
const memoryStore = new Map<string, any>();

export async function getPulseSnapshot(address: string): Promise<GrokSentimentSnapshot | null> {
  if (!isKvEnabled()) {
    return memoryStore.get(KEYS.snap(address)) || null;
  }
  try {
    return await kv.get<GrokSentimentSnapshot>(KEYS.snap(address));
  } catch (error) {
    logger.error('KV getSnapshot failed', { error: String(error) });
    return null;
  }
}

export async function setPulseSnapshot(address: string, snapshot: GrokSentimentSnapshot): Promise<void> {
  if (!isKvEnabled()) {
    memoryStore.set(KEYS.snap(address), snapshot);
    return;
  }
  try {
    await kv.set(KEYS.snap(address), snapshot);
  } catch (error) {
    logger.error('KV setSnapshot failed', { error: String(error) });
  }
}

export async function pushPulseHistory(address: string, entry: PulseHistoryEntry): Promise<void> {
  const key = KEYS.hist(address);
  if (!isKvEnabled()) {
    const list = memoryStore.get(key) || [];
    list.unshift(entry);
    if (list.length > 50) list.length = 50;
    memoryStore.set(key, list);
    return;
  }
  try {
    await kv.lpush(key, entry);
    await kv.ltrim(key, 0, 49); // Keep max 50
    await kv.expire(key, 7 * 24 * 60 * 60); // 7 days TTL
  } catch (error) {
    logger.error('KV pushHistory failed', { error: String(error) });
  }
}

export async function getPulseHistory(address: string): Promise<PulseHistoryEntry[]> {
  const key = KEYS.hist(address);
  if (!isKvEnabled()) {
    return memoryStore.get(key) || [];
  }
  try {
    return await kv.lrange(key, 0, 49);
  } catch (error) {
    logger.error('KV getHistory failed', { error: String(error) });
    return [];
  }
}

export async function incrementDailyUsage(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const key = KEYS.quota(today);
  
  if (!isKvEnabled()) {
    const count = (memoryStore.get(key) || 0) + 1;
    memoryStore.set(key, count);
    return count;
  }
  
  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, 24 * 60 * 60); // 24h
    }
    return count;
  } catch (error) {
    logger.error('KV incrementDailyUsage failed', { error: String(error) });
    return 0; // Fail open
  }
}

export async function setLastRun(ts: number): Promise<void> {
  if (!isKvEnabled()) {
    memoryStore.set(KEYS.lastRun(), ts);
    return;
  }
  try {
    await kv.set(KEYS.lastRun(), ts);
  } catch (error) {
    logger.error('KV setLastRun failed', { error: String(error) });
  }
}

export async function getLastRun(): Promise<number | null> {
  if (!isKvEnabled()) {
    return memoryStore.get(KEYS.lastRun()) || null;
  }
  try {
    return await kv.get<number>(KEYS.lastRun());
  } catch (error) {
    return null;
  }
}



