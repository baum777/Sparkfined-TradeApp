/**
 * Journal Repository (SQLite Implementation)
 * MULTITENANT: All operations require userId - no global state
 * All queries MUST include WHERE user_id = ?
 */

import { createHash, randomUUID } from 'crypto';
import { getDatabase } from '../../db/sqlite.js';
import { kvGet, kvSet } from '../../db/kv.js';
import { conflict, validationError, ErrorCodes } from '../../http/error.js';
import type {
  JournalRepo,
  JournalEntryRow,
  JournalCreateRequest,
  JournalEntryV1,
  JournalStatusV1,
} from './types.js';
import {
  assertUserId,
  extractDayKey,
} from './types.js';
import { matchPendingBuyCandidateId, type AutoArchiveReason } from './autoArchive.js';

// ─────────────────────────────────────────────────────────────
// ROW MAPPING
// ─────────────────────────────────────────────────────────────

function rowToEntryV1(
  row: JournalEntryRow,
  confirmedAt?: string,
  archived?: { archivedAt?: string; reason?: string }
): JournalEntryV1 {
  const status = row.status as JournalStatusV1;
  const entry: JournalEntryV1 = {
    id: row.id,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summary: row.summary,
    timestamp: row.timestamp,
  };

  if (status === 'confirmed') {
    entry.confirmedAt = confirmedAt || row.updated_at;
  }

  if (status === 'archived') {
    entry.archivedAt = archived?.archivedAt || row.updated_at;
    const r = archived?.reason;
    if (r === 'matched_sell' || r === 'user_action' || r === 'policy') {
      entry.autoArchiveReason = r;
    }
  }

  if (row.capture_key) {
    entry.capture = {
      source: row.capture_source || 'unknown',
      txSignature: row.tx_signature || undefined,
      wallet: row.wallet || undefined,
      actionType: row.action_type || undefined,
      assetMint: row.asset_mint || undefined,
      amount: typeof row.amount === 'number' ? row.amount : undefined,
      priceHint: typeof row.price_hint === 'number' ? row.price_hint : undefined,
      captureKey: row.capture_key,
      linkedEntryId: row.linked_entry_id || undefined,
    };
  }

  return entry;
}

function stableCreateBody(request: JournalCreateRequest): string {
  // Ensure stable key order for hashing.
  // Note: symbolOrAddress is accepted but not persisted in SQLite v2 currently.
  return JSON.stringify({
    summary: request.summary,
    timestamp: request.timestamp ?? null,
    symbolOrAddress: request.symbolOrAddress ?? null,
  });
}

function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

type JournalCreateIdempotencyRecord = {
  requestHash: string;
  entry: JournalEntryV1;
  createdAt: string;
};

// ─────────────────────────────────────────────────────────────
// SQLITE REPOSITORY IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export class JournalRepoSQLite implements JournalRepo {
  async getEvent(userId: string, id: string): Promise<JournalEntryV1 | null> {
    assertUserId(userId);
    const db = getDatabase();
    
    const row = db.prepare(`
      SELECT
        id, user_id, side, status, timestamp, summary, day_key, created_at, updated_at,
        capture_source, capture_key, tx_signature, wallet, action_type, asset_mint, amount, price_hint, linked_entry_id
      FROM journal_entries_v2
      WHERE user_id = ? AND id = ?
    `).get(userId, id) as JournalEntryRow | undefined;
    
    if (!row) return null;
    
    const confirmedAt = db.prepare(`
      SELECT confirmed_at
      FROM journal_confirmations_v2
      WHERE entry_id = ? AND user_id = ?
    `).get(id, userId) as { confirmed_at: string } | undefined;

    const archivedAt = db.prepare(`
      SELECT archived_at, reason
      FROM journal_archives_v2
      WHERE entry_id = ? AND user_id = ?
    `).get(id, userId) as { archived_at: string; reason: string } | undefined;

    return rowToEntryV1(row, confirmedAt?.confirmed_at, archivedAt ? { archivedAt: archivedAt.archived_at, reason: archivedAt.reason } : undefined);
  }

  async putEvent(userId: string, event: JournalEntryV1): Promise<void> {
    assertUserId(userId);
    const db = getDatabase();

    // P0 FIX: Avoid INSERT OR REPLACE (it can NULL additive columns not present in the statement).
    // Use ON CONFLICT DO UPDATE and preserve capture_* / link fields when excluded values are NULL.
    // This prevents silent data loss introduced by migration 0005_journal_capture_fields.sql.

    const now = new Date().toISOString();
    const timestamp = event.timestamp || now;
    const dayKey = extractDayKey(timestamp);
    const capture = event.capture;

    db.prepare(
      `
        INSERT INTO journal_entries_v2 (
          id,
          user_id,
          side,
          status,
          timestamp,
          summary,
          day_key,
          created_at,
          updated_at,
          capture_source,
          capture_key,
          tx_signature,
          wallet,
          action_type,
          asset_mint,
          amount,
          price_hint,
          linked_entry_id
        ) VALUES (
          @id,
          @user_id,
          @side,
          @status,
          @timestamp,
          @summary,
          @day_key,
          @created_at,
          @updated_at,
          @capture_source,
          @capture_key,
          @tx_signature,
          @wallet,
          @action_type,
          @asset_mint,
          @amount,
          @price_hint,
          @linked_entry_id
        )
        ON CONFLICT(user_id, id) DO UPDATE SET
          side = excluded.side,
          status = excluded.status,
          timestamp = excluded.timestamp,
          summary = excluded.summary,
          day_key = excluded.day_key,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,

          -- Preserve existing capture metadata if caller doesn't provide it on update.
          capture_source = COALESCE(excluded.capture_source, journal_entries_v2.capture_source),
          capture_key = COALESCE(excluded.capture_key, journal_entries_v2.capture_key),
          tx_signature = COALESCE(excluded.tx_signature, journal_entries_v2.tx_signature),
          wallet = COALESCE(excluded.wallet, journal_entries_v2.wallet),
          action_type = COALESCE(excluded.action_type, journal_entries_v2.action_type),
          asset_mint = COALESCE(excluded.asset_mint, journal_entries_v2.asset_mint),
          amount = COALESCE(excluded.amount, journal_entries_v2.amount),
          price_hint = COALESCE(excluded.price_hint, journal_entries_v2.price_hint),

          -- Link fields: preserve unless explicitly updated (NULL will keep old)
          linked_entry_id = COALESCE(excluded.linked_entry_id, journal_entries_v2.linked_entry_id)
      `
    ).run({
      id: event.id,
      user_id: userId,
      // Legacy column; Journal v1 has no trading fields. We store a placeholder.
      side: 'BUY',
      status: event.status,
      timestamp,
      summary: event.summary || '',
      day_key: dayKey,
      created_at: event.createdAt,
      updated_at: event.updatedAt,

      // capture fields (all optional; keep NULL if absent so COALESCE preserves old)
      capture_source: capture?.source ?? null,
      capture_key: capture?.captureKey ?? null,
      tx_signature: capture?.txSignature ?? null,
      wallet: capture?.wallet ?? null,
      action_type: capture?.actionType ?? null,
      asset_mint: capture?.assetMint ?? null,
      amount: typeof capture?.amount === 'number' ? capture.amount : null,
      price_hint: typeof capture?.priceHint === 'number' ? capture.priceHint : null,
      linked_entry_id: capture?.linkedEntryId ?? null,
    });
    
    // Transition timestamps live in legacy tables; we only store timestamps (no user-provided notes/reasons).
    if (event.confirmedAt && event.status === 'confirmed') {
      db.prepare(`
        INSERT OR REPLACE INTO journal_confirmations_v2
        (entry_id, user_id, mood, note, tags_json, confirmed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(event.id, userId, '', '', '[]', event.confirmedAt);
    }

    if (event.archivedAt && event.status === 'archived') {
      db.prepare(`
        INSERT OR REPLACE INTO journal_archives_v2
        (entry_id, user_id, reason, archived_at)
        VALUES (?, ?, ?, ?)
      `).run(event.id, userId, '', event.archivedAt);
    }

    if (event.status !== 'archived') {
      db.prepare(`DELETE FROM journal_archives_v2 WHERE entry_id = ? AND user_id = ?`).run(event.id, userId);
    }
  }

  async deleteEvent(userId: string, id: string): Promise<boolean> {
    assertUserId(userId);
    const db = getDatabase();
    
    const result = db.prepare(`
      DELETE FROM journal_entries_v2 WHERE user_id = ? AND id = ?
    `).run(userId, id);
    
    if (result.changes > 0) {
      // Cascade delete related data
      db.prepare(`DELETE FROM journal_confirmations_v2 WHERE entry_id = ? AND user_id = ?`).run(id, userId);
      db.prepare(`DELETE FROM journal_archives_v2 WHERE entry_id = ? AND user_id = ?`).run(id, userId);
      return true;
    }
    
    return false;
  }

  async listDayIds(userId: string, dayKey: string): Promise<string[]> {
    assertUserId(userId);
    const db = getDatabase();
    
    const rows = db.prepare(`
      SELECT id FROM journal_entries_v2 
      WHERE user_id = ? AND day_key = ?
      ORDER BY created_at ASC
    `).all(userId, dayKey) as { id: string }[];
    
    return rows.map(r => r.id);
  }

  async setDayIds(userId: string, _dayKey: string, _ids: string[]): Promise<void> {
    assertUserId(userId);
    // In SQLite, day_key is stored on the entry itself
    // This is a no-op since the index is implicit via the day_key column
    // The order is determined by created_at ASC in listDayIds
  }

  async listStatusIds(userId: string, status: JournalStatusV1): Promise<string[]> {
    assertUserId(userId);
    const db = getDatabase();
    
    const rows = db.prepare(`
      SELECT id FROM journal_entries_v2 
      WHERE user_id = ? AND status = ?
      ORDER BY created_at ASC
    `).all(userId, status) as { id: string }[];
    
    return rows.map(r => r.id);
  }

  async setStatusIds(userId: string, _status: JournalStatusV1, _ids: string[]): Promise<void> {
    assertUserId(userId);
    // In SQLite, status is stored on the entry itself
    // This is a no-op since the index is implicit via the status column
  }

  async getUpdatedAt(userId: string): Promise<string | null> {
    assertUserId(userId);
    const db = getDatabase();
    
    const row = db.prepare(`
      SELECT MAX(updated_at) as max_updated FROM journal_entries_v2 
      WHERE user_id = ?
    `).get(userId) as { max_updated: string | null } | undefined;
    
    return row?.max_updated || null;
  }

  async setUpdatedAt(userId: string, _iso: string): Promise<void> {
    assertUserId(userId);
    // In SQLite, updatedAt is implicit via the updated_at column on entries
    // This is tracked automatically via putEvent
  }
}

// Singleton instance for convenience
export const journalRepoSQLite = new JournalRepoSQLite();

// ─────────────────────────────────────────────────────────────
// LEGACY FUNCTION SIGNATURES (updated for userId)
// All require userId as FIRST parameter
// ─────────────────────────────────────────────────────────────

export function journalCreate(
  userId: string,
  request: JournalCreateRequest,
  idempotencyKey?: string
): JournalEntryV1 {
  assertUserId(userId);
  const db = getDatabase();
  const now = new Date().toISOString();
  
  if (!idempotencyKey || idempotencyKey.trim() === '') {
    // Route layer also enforces this, but keep the function safe for direct calls in tests.
    throw validationError('Idempotency-Key header is required', {
      'Idempotency-Key': ['Required'],
    });
  }

  const idempotencyStoreKey = `kv:v1:idempotency:journal:create:${userId}:${idempotencyKey}`;
  const requestHash = hashString(stableCreateBody(request));
  const existing = kvGet<JournalCreateIdempotencyRecord>(idempotencyStoreKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw conflict('Idempotency-Key reuse with different request body', ErrorCodes.IDEMPOTENCY_KEY_CONFLICT);
    }
    return existing.entry;
  }

  const id = `entry-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const timestamp = request.timestamp || now;
  const dayKey = extractDayKey(timestamp);
  
  db.prepare(`
    INSERT INTO journal_entries_v2 (id, user_id, side, status, timestamp, summary, day_key, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
  `).run(id, userId, 'BUY', timestamp, request.summary, dayKey, now, now);
  
  const entry: JournalEntryV1 = {
    id,
    status: 'pending',
    timestamp,
    summary: request.summary,
    createdAt: now,
    updatedAt: now,
  };

  // Store idempotency record (24h TTL).
  kvSet<JournalCreateIdempotencyRecord>(
    idempotencyStoreKey,
    { requestHash, entry, createdAt: now },
    24 * 60 * 60
  );

  return entry;
}

export function journalGetById(userId: string, id: string): JournalEntryV1 | null {
  assertUserId(userId);
  const db = getDatabase();
  
  const row = db.prepare(`
    SELECT
      id, user_id, side, status, timestamp, summary, day_key, created_at, updated_at,
      capture_source, capture_key, tx_signature, wallet, action_type, asset_mint, amount, price_hint, linked_entry_id
    FROM journal_entries_v2
    WHERE user_id = ? AND id = ?
  `).get(userId, id) as JournalEntryRow | undefined;
  
  if (!row) {
    return null;
  }
  
  const confirmedAt = db.prepare(`
    SELECT confirmed_at
    FROM journal_confirmations_v2
    WHERE entry_id = ? AND user_id = ?
  `).get(id, userId) as { confirmed_at: string } | undefined;

  const archivedAt = db.prepare(`
    SELECT archived_at, reason
    FROM journal_archives_v2
    WHERE entry_id = ? AND user_id = ?
  `).get(id, userId) as { archived_at: string; reason: string } | undefined;

  return rowToEntryV1(row, confirmedAt?.confirmed_at, archivedAt ? { archivedAt: archivedAt.archived_at, reason: archivedAt.reason } : undefined);
}

export function journalList(
  userId: string,
  status?: JournalStatusV1,
  limit = 50,
  cursor?: string
): { items: JournalEntryV1[]; nextCursor?: string } {
  assertUserId(userId);
  const db = getDatabase();
  
  let query = `
    SELECT
      id, user_id, side, status, timestamp, summary, day_key, created_at, updated_at,
      capture_source, capture_key, tx_signature, wallet, action_type, asset_mint, amount, price_hint, linked_entry_id
    FROM journal_entries_v2
    WHERE user_id = ?
  `;
  
  const params: (string | number)[] = [userId];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (cursor) {
    query += ' AND timestamp < ?';
    params.push(cursor);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit + 1); // Fetch one extra to detect next page
  
  const rows = db.prepare(query).all(...params) as JournalEntryRow[];
  
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(row => {
    const id = row.id;
    const confirmedAt = db.prepare(`
      SELECT confirmed_at
      FROM journal_confirmations_v2
      WHERE entry_id = ? AND user_id = ?
    `).get(id, userId) as { confirmed_at: string } | undefined;

    const archivedAt = db.prepare(`
      SELECT archived_at, reason
      FROM journal_archives_v2
      WHERE entry_id = ? AND user_id = ?
    `).get(id, userId) as { archived_at: string; reason: string } | undefined;

    return rowToEntryV1(row, confirmedAt?.confirmed_at, archivedAt ? { archivedAt: archivedAt.archived_at, reason: archivedAt.reason } : undefined);
  });
  
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.timestamp : undefined,
  };
}

export function journalConfirm(
  userId: string,
  id: string
): JournalEntryV1 | null {
  assertUserId(userId);
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const entry = journalGetById(userId, id);
  if (!entry) {
    return null;
  }
  
  // Idempotent: if already confirmed, just return
  if (entry.status === 'confirmed') {
    return entry;
  }
  
  // Update entry status first
  db.prepare(`
    UPDATE journal_entries_v2
    SET status = 'confirmed', updated_at = ?
    WHERE user_id = ? AND id = ?
  `).run(now, userId, id);
  
  // Store only the transition timestamp (no user-provided note/tags).
  db.prepare(`
    INSERT OR REPLACE INTO journal_confirmations_v2 (entry_id, user_id, mood, note, tags_json, confirmed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, '', '', '[]', now);
  
  return {
    ...entry,
    status: 'confirmed',
    updatedAt: now,
    confirmedAt: now,
  };
}

export function journalArchive(userId: string, id: string): JournalEntryV1 | null {
  assertUserId(userId);
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const entry = journalGetById(userId, id);
  if (!entry) {
    return null;
  }
  
  // Idempotent: if already archived, just return
  if (entry.status === 'archived') {
    return entry;
  }
  
  db.transaction(() => {
    db.prepare(`
      UPDATE journal_entries_v2
      SET status = 'archived', updated_at = ?
      WHERE user_id = ? AND id = ?
    `).run(now, userId, id);
    
    db.prepare(`
      INSERT OR REPLACE INTO journal_archives_v2 (entry_id, user_id, reason, archived_at)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, '', now);
  })();
  
  return {
    ...entry,
    status: 'archived',
    updatedAt: now,
    confirmedAt: undefined,
    archivedAt: now,
  };
}

export function journalSystemArchive(params: {
  userId: string;
  id: string;
  reason: AutoArchiveReason;
  linkedEntryId?: string;
}): JournalEntryV1 | null {
  assertUserId(params.userId);
  const db = getDatabase();
  const now = new Date().toISOString();

  const entry = journalGetById(params.userId, params.id);
  if (!entry) return null;

  // System rule: only archive pending entries (idempotent if already archived).
  if (entry.status === 'archived') return entry;
  if (entry.status !== 'pending') return entry;

  db.transaction(() => {
    db.prepare(
      `
        UPDATE journal_entries_v2
        SET status = 'archived',
            linked_entry_id = COALESCE(?, linked_entry_id),
            updated_at = ?
        WHERE user_id = ? AND id = ?
      `
    ).run(params.linkedEntryId ?? null, now, params.userId, params.id);

    db.prepare(
      `
        INSERT OR REPLACE INTO journal_archives_v2 (entry_id, user_id, reason, archived_at)
        VALUES (?, ?, ?, ?)
      `
    ).run(params.id, params.userId, params.reason, now);
  })();

  return journalGetById(params.userId, params.id);
}

export type JournalCaptureIngest = {
  source: string;
  captureKey: string;
  txSignature?: string;
  wallet?: string;
  actionType: 'buy' | 'sell' | 'swap';
  assetMint: string;
  amount?: number;
  priceHint?: number;
  timestampISO?: string;
};

export function journalIngestCapture(userId: string, capture: JournalCaptureIngest): JournalEntryV1 {
  assertUserId(userId);
  const db = getDatabase();

  if (!capture.captureKey || capture.captureKey.trim() === '') {
    throw validationError('captureKey is required', { captureKey: ['Required'] });
  }
  if (!capture.assetMint || capture.assetMint.trim() === '') {
    throw validationError('assetMint is required', { assetMint: ['Required'] });
  }

  // Idempotency by (user_id, capture_key)
  const existing = db
    .prepare(`SELECT id FROM journal_entries_v2 WHERE user_id = ? AND capture_key = ?`)
    .get(userId, capture.captureKey) as { id: string } | undefined;
  if (existing?.id) {
    const e = journalGetById(userId, existing.id);
    if (e) return e;
  }

  const now = new Date().toISOString();
  const timestamp = capture.timestampISO || now;
  const dayKey = extractDayKey(timestamp);
  const id = `cap-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const side = capture.actionType === 'sell' ? 'SELL' : 'BUY';
  const summary = `Onchain ${capture.actionType.toUpperCase()} capture`;

  try {
    db.prepare(
      `
        INSERT INTO journal_entries_v2 (
          id, user_id, side, status, timestamp, summary, day_key, created_at, updated_at,
          capture_source, capture_key, tx_signature, wallet, action_type, asset_mint, amount, price_hint, linked_entry_id
        )
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      userId,
      side,
      timestamp,
      summary,
      dayKey,
      now,
      now,
      capture.source,
      capture.captureKey,
      capture.txSignature ?? null,
      capture.wallet ?? null,
      capture.actionType,
      capture.assetMint,
      typeof capture.amount === 'number' ? capture.amount : null,
      typeof capture.priceHint === 'number' ? capture.priceHint : null,
      null
    );
  } catch (err) {
    // If UNIQUE (user_id, capture_key) races, fetch and return.
    const again = db
      .prepare(`SELECT id FROM journal_entries_v2 WHERE user_id = ? AND capture_key = ?`)
      .get(userId, capture.captureKey) as { id: string } | undefined;
    if (again?.id) {
      const e = journalGetById(userId, again.id);
      if (e) return e;
    }
    throw err;
  }

  const created = journalGetById(userId, id);
  if (!created) {
    throw new Error('Failed to ingest capture (unexpected missing row)');
  }

  // Hook: auto-archive pending BUY when a SELL capture arrives.
  if (capture.actionType === 'sell') {
    const candidateId = matchPendingBuyCandidateId({
      userId,
      assetMint: capture.assetMint,
      sellTimestampISO: timestamp,
    });
    if (candidateId) {
      journalSystemArchive({
        userId,
        id: candidateId,
        reason: 'matched_sell',
        linkedEntryId: created.id,
      });
    }
  }

  return journalGetById(userId, id) ?? created;
}

export function journalRestore(userId: string, id: string): JournalEntryV1 | null {
  assertUserId(userId);
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const entry = journalGetById(userId, id);
  if (!entry) {
    return null;
  }
  
  // Idempotent: if already pending, just return
  if (entry.status === 'pending') {
    return entry;
  }
  
  db.prepare(`
    UPDATE journal_entries_v2
    SET status = 'pending', updated_at = ?
    WHERE user_id = ? AND id = ?
  `).run(now, userId, id);
  
  // Remove archive record if exists
  db.prepare(`DELETE FROM journal_archives_v2 WHERE entry_id = ? AND user_id = ?`).run(id, userId);
  
  return {
    ...entry,
    status: 'pending',
    updatedAt: now,
    archivedAt: undefined,
    confirmedAt: undefined,
  };
}

export function journalDelete(userId: string, id: string): boolean {
  assertUserId(userId);
  const db = getDatabase();
  
  const result = db.prepare(`
    DELETE FROM journal_entries_v2 WHERE user_id = ? AND id = ?
  `).run(userId, id);
  
  if (result.changes > 0) {
    // Cascade delete
    db.prepare(`DELETE FROM journal_confirmations_v2 WHERE entry_id = ? AND user_id = ?`).run(id, userId);
    db.prepare(`DELETE FROM journal_archives_v2 WHERE entry_id = ? AND user_id = ?`).run(id, userId);
    return true;
  }
  
  return false;
}
