/**
 * Journal API Types
 * Source of Truth: docs/backend/API_SPEC.md + docs/backend/CONTRACTS.md
 */

// ─────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────

export type JournalEntryStatus = "pending" | "confirmed" | "archived";
export type JournalEntrySide = "BUY" | "SELL";

export interface OnchainContextV1 {
  capturedAt: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  marketCap: number;
  ageMinutes: number;
  holders: number;
  transfers24h: number;
  dexId?: string;
}

export type OnchainContextProvider = "dexpaprika" | "moralis" | "internal";
export type OnchainContextErrorCode =
  | "MISSING_MARKET_KEY"
  | "MISSING_API_KEY"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "MISSING_FIELD"
  | "APPROXIMATE_COUNT"
  | "UNKNOWN_ERROR";

export interface OnchainContextErrorV1 {
  provider: OnchainContextProvider;
  code: OnchainContextErrorCode;
  message: string;
  at: string;
  requestId: string;
  httpStatus?: number;
}

export interface OnchainContextMetaV1 {
  capturedAt: string;
  errors: OnchainContextErrorV1[];
}

/**
 * JournalEntryV1 - API boundary type
 */
export interface JournalEntryV1 {
  id: string;
  side: JournalEntrySide;
  status: JournalEntryStatus;
  timestamp: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  archivedAt?: string;
  onchainContext?: OnchainContextV1;
  onchainContextMeta?: OnchainContextMetaV1;
}

// ─────────────────────────────────────────────────────────────
// Request/Response Types
// ─────────────────────────────────────────────────────────────

export interface JournalCreateRequest {
  side: JournalEntrySide;
  summary: string;
  timestamp?: string;
  symbolOrAddress?: string;
}

// P0.1: confirm and archive have NO request body per CONTRACTS.md
// Removed JournalConfirmPayload and JournalArchiveRequest

export interface JournalListResponse {
  items: JournalEntryV1[];
  nextCursor?: string;
}

// ─────────────────────────────────────────────────────────────
// Queue Types (for offline mutations)
// ─────────────────────────────────────────────────────────────

export type JournalQueueOperation = 
  | "CREATE"
  | "CONFIRM"
  | "ARCHIVE"
  | "RESTORE"
  | "DELETE";

export interface JournalQueueItem {
  id: string;
  operation: JournalQueueOperation;
  /** For CREATE: this is the local clientId (local-*). For others: this is the server entryId */
  entryId: string;
  /** Required for CREATE - stable idempotency key */
  idempotencyKey?: string;
  /** Payload only for CREATE */
  payload?: JournalCreateRequest;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  lastAttemptAt?: number;
  /** P0.2: Next attempt timestamp for per-item backoff */
  nextAttemptAt?: number;
}

// ─────────────────────────────────────────────────────────────
// Local Entry (extends API entry with queue metadata)
// ─────────────────────────────────────────────────────────────

export interface JournalEntryLocal extends JournalEntryV1 {
  /** True if this entry is queued and not yet synced */
  _isQueued?: boolean;
  /** Queue item ID if pending sync */
  _queueId?: string;
  /** True if last sync attempt failed */
  _syncError?: boolean;
  /** P0.3: Local client ID for CREATE entries (before server assigns real ID) */
  _clientId?: string;
}

// ─────────────────────────────────────────────────────────────
// Sync State
// ─────────────────────────────────────────────────────────────

export type SyncState = {
  queueCount: number;
  isSyncing: boolean;
  lastError: string | null;
  lastSyncAt: number | null;
};
