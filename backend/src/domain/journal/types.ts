/**
 * Journal Domain Types & Repository Interface
 * MULTITENANT: All operations require userId - no global state
 * 
 * SQLite Schema (userId-scoped):
 * - All queries MUST include WHERE userId = ?
 * - No global queries, no fallback userId
 */

// ─────────────────────────────────────────────────────────────
// API CONTRACT: JournalEntryV1 (Diary/Reflection semantics)
// ─────────────────────────────────────────────────────────────

export type JournalStatusV1 = 'pending' | 'confirmed' | 'archived';

/**
 * Frozen v1 contract returned to the frontend.
 * - No trading fields
 * - `confirmedAt` only when status === "confirmed"
 * - `archivedAt` only when status === "archived"
 */
export interface JournalEntryV1 {
  id: string;
  status: JournalStatusV1;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  confirmedAt?: string; // ISO 8601
  archivedAt?: string; // ISO 8601
  // Optional diary fields (non-trading)
  summary?: string;
  timestamp?: string;
  symbolOrAddress?: string;
  /**
   * Optional capture metadata (backward compatible).
   * Facts-only: populated from ingest; do not mix narrative here.
   */
  capture?: {
    source: string;
    txSignature?: string;
    wallet?: string;
    actionType?: string;
    assetMint?: string;
    amount?: number;
    priceHint?: number;
    captureKey: string;
    linkedEntryId?: string;
  };
  /**
   * Optional system/user reason for the archived state.
   * Populated only when status === 'archived' and a reason is known.
   */
  autoArchiveReason?: 'matched_sell' | 'user_action' | 'policy';
}

// ─────────────────────────────────────────────────────────────
// LEGACY DB ROW TYPES (SQLite schema compatibility)
// ─────────────────────────────────────────────────────────────

export interface JournalEntryRow {
  id: string;
  user_id: string; // Added for multitenancy
  side: string;
  status: string;
  timestamp: string;
  summary: string;
  day_key: string; // Added for indexing
  created_at: string;
  updated_at: string;
  capture_source?: string | null;
  capture_key?: string | null;
  tx_signature?: string | null;
  wallet?: string | null;
  action_type?: string | null;
  asset_mint?: string | null;
  amount?: number | null;
  price_hint?: number | null;
  linked_entry_id?: string | null;
}

export interface JournalConfirmationRow {
  confirmed_at: string;
}

export interface JournalArchiveRow {
  archived_at: string;
}

// ─────────────────────────────────────────────────────────────
// REQUEST/RESPONSE TYPES
// ─────────────────────────────────────────────────────────────

export interface JournalCreateRequest {
  summary: string;
  timestamp?: string; // defaults to now
  symbolOrAddress?: string; // accepted by contract, not currently persisted in SQLite v2
}

export interface JournalListResponse {
  items: JournalEntryV1[];
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
  getEvent(userId: string, id: string): Promise<JournalEntryV1 | null>;

  /**
   * Store/update an event
   * Event.userId MUST match the userId parameter
   * @param userId - REQUIRED, no fallback
   * @param event - event to store
   */
  putEvent(userId: string, event: JournalEntryV1): Promise<void>;

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
   * @param status - pending | confirmed | archived
   */
  listStatusIds(userId: string, status: JournalStatusV1): Promise<string[]>;

  /**
   * Set the event IDs for a specific status
   * @param userId - REQUIRED, no fallback
   * @param status - pending | confirmed | archived
   * @param ids - list of event IDs
   */
  setStatusIds(userId: string, status: JournalStatusV1, ids: string[]): Promise<void>;

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
