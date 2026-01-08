/**
 * API Library Index
 * Re-exports commonly used utilities
 */

// Environment
export * from './env';

// Request/Response
export * from './request-id';
export * from './response';
export * from './errors';
export * from './handler';
export * from './logger';

// Validation (schemas and validation helpers only)
export {
  validateBody,
  validateQuery,
  isValidTicker,
  isValidSolanaAddress,
  normalizeSymbolOrAddress,
  journalCreateRequestSchema,
  journalListQuerySchema,
  createAlertRequestSchema,
  updateAlertRequestSchema,
  alertsListQuerySchema,
  alertEventsQuerySchema,
  alertEvaluateRequestSchema,
  oracleDailyQuerySchema,
  oracleReadStateRequestSchema,
  oracleBulkReadStateRequestSchema,
  taRequestSchema,
} from './validation';

// Types from types.ts (domain types)
export * from './types';

// KV
export { kv, kvKeys, kvTTL, getKVStore, getStoreType } from './kv';

// Rate Limiting
export { checkRateLimit, getRateLimitRemaining } from './rate-limit';
