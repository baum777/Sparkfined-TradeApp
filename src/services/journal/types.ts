/**
 * Journal API Types
 * Source of Truth: `src/types/journal.ts` (canonical Journal v1 domain model)
 */

// ─────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────

import type { JournalEntryV1 as CanonicalJournalEntryV1, JournalStatusV1 } from "@/types/journal";

export type JournalEntryStatus = JournalStatusV1;

// Canonical JournalEntryV1 is defined in `src/types/journal.ts`.
export type JournalEntryV1 = CanonicalJournalEntryV1;

// ─────────────────────────────────────────────────────────────
// Request/Response Types
// ─────────────────────────────────────────────────────────────

export interface JournalCreateRequest {
  summary: string;
  timestamp?: string;
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
