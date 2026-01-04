/**
 * Journal Domain Types & Repository Interface
 * MULTITENANT: All operations require userId - no global state
 * 
 * Key Schema (KV):
 * - sf:v1:journal:{userId}:entry:{id}
 * - sf:v1:journal:{userId}:day:{YYYY-MM-DD}:ids
 * - sf:v1:journal:{userId}:status:PENDING:ids
 * - sf:v1:journal:{userId}:status:ARCHIVED:ids
 * - sf:v1:journal:{userId}:index:updatedAt
 */

// ─────────────────────────────────────────────────────────────
// STATUS ENUM (uppercase for KV key consistency)
// ─────────────────────────────────────────────────────────────

export type JournalStatus = 'PENDING' | 'CONFIRMED' | 'ARCHIVED';

// Mapping from legacy lowercase to new uppercase
export function normalizeStatus(status: string): JournalStatus {
  const upper = status.toUpperCase();
  if (upper === 'PENDING' || upper === 'CONFIRMED' || upper === 'ARCHIVED') {
    return upper;
  }
  throw new Error(`Invalid journal status: ${status}`);
}

// ─────────────────────────────────────────────────────────────
// JOURNAL EVENT TYPE
// ─────────────────────────────────────────────────────────────

import type { OnchainContextV1, OnchainContextMetaV1 } from './onchain/types';

export type JournalEntrySide = 'BUY' | 'SELL';

export interface JournalEvent {
  id: string;
  userId: string; // REQUIRED - no fallback
  side: JournalEntrySide;
  status: JournalStatus;
  timestamp: string; // ISO 8601 - when the trade occurred
  summary: string;
  dayKey: string; // YYYY-MM-DD - derived from timestamp, stored for indexing
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  
  // Frozen Onchain Snapshot (P1.2)
  onchainContext?: OnchainContextV1;
  onchainContextMeta?: OnchainContextMetaV1;
  
  // Optional confirmation data
  confirmData?: {
    mood: string;
    note: string;
    tags: string[];
    confirmedAt: string;
  };
  
  // Optional archive data
  archiveData?: {
    reason: string;
    archivedAt: string;
  };
}

// ─────────────────────────────────────────────────────────────
// REQUEST/RESPONSE TYPES
// ─────────────────────────────────────────────────────────────

export interface JournalCreateRequest {
  side: JournalEntrySide;
  summary: string;
  timestamp?: string; // defaults to now
  symbolOrAddress?: string; // optional: Solana address (base58) for snapshot
}

export interface JournalConfirmPayload {
  mood: string;
  note: string;
  tags: string[];
}

export interface JournalArchivePayload {
  reason: string;
}

export interface JournalListResult {
  items: JournalEvent[];
  nextCursor?: string;
}

// ─────────────────────────────────────────────────────────────
// REPOSITORY INTERFACE (MANDATORY)
// All methods require userId as first parameter
// ─────────────────────────────────────────────────────────────

export interface JournalRepo {
  /**
   * Get a single event by id
   * @param userId - REQUIRED, no fallback
   * @param id - event id
   */
  getEvent(userId: string, id: string): Promise<JournalEvent | null>;

  /**
   * Store/update an event
   * Event.userId MUST match the userId parameter
   * @param userId - REQUIRED, no fallback
   * @param event - event to store
   */
  putEvent(userId: string, event: JournalEvent): Promise<void>;

  /**
   * Delete an event permanently
   * @param userId - REQUIRED, no fallback
   * @param id - event id
   */
  deleteEvent(userId: string, id: string): Promise<boolean>;

  /**
   * List all event IDs for a specific day
   * @param userId - REQUIRED, no fallback
   * @param dayKey - YYYY-MM-DD format
   */
  listDayIds(userId: string, dayKey: string): Promise<string[]>;

  /**
   * Set the event IDs for a specific day (ordered by createdAt asc)
   * @param userId - REQUIRED, no fallback
   * @param dayKey - YYYY-MM-DD format
   * @param ids - ordered list of event IDs
   */
  setDayIds(userId: string, dayKey: string, ids: string[]): Promise<void>;

  /**
   * List all event IDs with a specific status
   * @param userId - REQUIRED, no fallback
   * @param status - PENDING | CONFIRMED | ARCHIVED
   */
  listStatusIds(userId: string, status: JournalStatus): Promise<string[]>;

  /**
   * Set the event IDs for a specific status
   * @param userId - REQUIRED, no fallback
   * @param status - PENDING | CONFIRMED | ARCHIVED
   * @param ids - list of event IDs
   */
  setStatusIds(userId: string, status: JournalStatus, ids: string[]): Promise<void>;

  /**
   * Get the last update timestamp for this user's journal
   * Used for cache invalidation / sync
   * @param userId - REQUIRED, no fallback
   */
  getUpdatedAt(userId: string): Promise<string | null>;

  /**
   * Set the last update timestamp for this user's journal
   * @param userId - REQUIRED, no fallback
   * @param iso - ISO 8601 timestamp
   */
  setUpdatedAt(userId: string, iso: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// HELPER: Extract dayKey from timestamp
// ─────────────────────────────────────────────────────────────

export function extractDayKey(timestamp: string): string {
  // ISO 8601: "2026-01-02T10:30:00.000Z" -> "2026-01-02"
  return timestamp.slice(0, 10);
}

// ─────────────────────────────────────────────────────────────
// VALIDATION: Ensure userId is never empty
// ─────────────────────────────────────────────────────────────

export function assertUserId(userId: string | undefined | null): asserts userId is string {
  if (!userId || userId.trim() === '') {
    throw new Error('userId is required for all journal operations - no global fallback allowed');
  }
}

