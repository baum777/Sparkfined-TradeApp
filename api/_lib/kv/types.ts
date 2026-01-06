/**
 * KV Store Types
 * Based on CONTRACTS.md and DATA_STORES.md key patterns
 */

// KV Key Prefixes - frozen per requirements
// Note: KV_KEY_MAP.md was not found, deriving from CONTRACTS.md
export const KV_PREFIX = 'sf:v1:' as const;

export const kvKeys = {
  // Alerts
  alertDef: (alertId: string) => `${KV_PREFIX}alerts:def:${alertId}`,
  alertState: (alertId: string) => `${KV_PREFIX}alerts:state:${alertId}`,
  alertIndex: () => `${KV_PREFIX}alerts:index`,
  
  // Alert emit dedupe
  alertEmitDedupe: (alertId: string, stage: string, windowId: string) =>
    `${KV_PREFIX}alerts:emit_dedupe:${alertId}:${stage}:${windowId}`,
  
  // Watch candidates (TWO_STAGE)
  watchIndex: () => `${KV_PREFIX}alerts:watch:index`,
  watchCandidate: (alertId: string, symbolOrAddress: string, timeframe: string) =>
    `${KV_PREFIX}alerts:watch:${alertId}:${symbolOrAddress}:${timeframe}`,
  
  // Dead token sessions
  deadSessionIndex: () => `${KV_PREFIX}dead:session:index`,
  deadSession: (alertId: string, symbolOrAddress: string, timeframe: string) =>
    `${KV_PREFIX}dead:session:${alertId}:${symbolOrAddress}:${timeframe}`,
  
  // Idempotency
  idempotency: (scope: string, key: string) => `${KV_PREFIX}idem:${scope}:${key}`,
  
  // Journal (userId-scoped - MULTITENANT)
  // Schema: sf:v1:journal:{userId}:entry:{id}
  journalEntry: (userId: string, id: string) => `${KV_PREFIX}journal:${userId}:entry:${id}`,
  // Schema: sf:v1:journal:{userId}:day:{YYYY-MM-DD}:ids
  journalDayIds: (userId: string, dayKey: string) => `${KV_PREFIX}journal:${userId}:day:${dayKey}:ids`,
  // Schema: sf:v1:journal:{userId}:status:{STATUS}:ids
  journalStatusIds: (userId: string, status: string) => `${KV_PREFIX}journal:${userId}:status:${status}:ids`,
  // Schema: sf:v1:journal:{userId}:index:updatedAt
  journalUpdatedAt: (userId: string) => `${KV_PREFIX}journal:${userId}:index:updatedAt`,
  
  // Oracle
  oracleSnapshot: (date: string) => `${KV_PREFIX}oracle:snapshot:${date}`,
  oracleLatest: () => `${KV_PREFIX}oracle:latest`,
  oracleReadGlobal: () => `${KV_PREFIX}oracle:read:global`,
  oracleRead: (userId: string, insightId: string) => 
    `${KV_PREFIX}oracle:read:${userId}:${insightId}`,
  
  // TA Cache (includes replay flag per CONTRACTS.md)
  taCache: (marketKey: string, timeframe: string, replay: boolean, asOfTs: string) =>
    `${KV_PREFIX}ta:cache:${marketKey}:${timeframe}:${replay}:${asOfTs}`,
  
  // Rate limiting
  rateLimit: (resource: string, id: string, bucket: string) =>
    `${KV_PREFIX}rl:${resource}:${id}:${bucket}`,
  
  // Provider cache
  cacheCandles: (provider: string, marketKey: string, timeframe: string) =>
    `${KV_PREFIX}cache:candles:${provider}:${marketKey}:${timeframe}`,
  cacheHolders: (marketKey: string) =>
    `${KV_PREFIX}cache:holders:${marketKey}`,
  
  // Alert events
  alertEvent: (eventId: string) => `${KV_PREFIX}events:alert:${eventId}`,
  alertEventsIndex: () => `${KV_PREFIX}events:alert:index`,

  // Reasoning cache
  reasoningCache: (type: string, referenceId: string, version: string, cacheKey: string) =>
    `${KV_PREFIX}reasoning:cache:${type}:${referenceId}:${version}:${cacheKey}`,

  // Grok Pulse
  pulseLatest: (query: string) => `${KV_PREFIX}pulse:latest:${query}`,
  pulseHistory: (query: string) => `${KV_PREFIX}pulse:history:${query}`,
  pulseLock: (query: string) => `${KV_PREFIX}pulse:lock:${query}`,

  // Phase B: Auto Trade Capture
  profileV1: (userId: string) => `${KV_PREFIX}profile:${userId}:v1`,
  walletIndexV1: (walletAddress: string) => `${KV_PREFIX}walletIndex:${walletAddress}:v1`,
  walletSigDedupe: (walletAddress: string, signature: string) => `${KV_PREFIX}dedupe:wallet:${walletAddress}:sig:${signature}`,
  heliusWebhookLock: () => `${KV_PREFIX}lock:helius:webhook:update`,
} as const;

// TTL constants in seconds
export const kvTTL = {
  // Idempotency keys: 24h
  idempotency: 24 * 60 * 60,
  // Watch candidates: 24h
  watchCandidate: 24 * 60 * 60,
  // Dead token session: 13h (12h session + 1h buffer)
  deadSession: 13 * 60 * 60,
  // Alert emit dedupe: 24h
  alertEmitDedupe: 24 * 60 * 60,
  // Alert events: 30 days
  alertEvent: 30 * 24 * 60 * 60,
  // Oracle daily: 36h
  oracleDaily: 36 * 60 * 60,
  // TA cache: 24h
  taCache: 24 * 60 * 60,
  // Reasoning cache: 24h
  reasoningCache: 24 * 60 * 60,
  // Rate limit buckets: 1h
  rateLimit: 60 * 60,
  // Provider cache: candles 5min, holders 30min
  cacheCandles: 5 * 60,
  cacheHolders: 30 * 60,
  // Pulse
  pulseLatest: 24 * 60 * 60, // 24h cache for latest
  pulseHistory: 7 * 24 * 60 * 60, // 7 days for history
  pulseLock: 60, // 1 min lock
  
  // Phase B: Auto Trade Capture
  walletSigDedupe: 90 * 24 * 60 * 60, // 90 days
  heliusWebhookLock: 30, // 30 seconds
} as const;

// KV Store Interface
export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  getByPrefix<T>(prefix: string): Promise<Array<{ key: string; value: T }>>;
  exists(key: string): Promise<boolean>;
  // Updated to support increment amount
  incr(key: string, amount?: number, ttlSeconds?: number): Promise<number>;
}
