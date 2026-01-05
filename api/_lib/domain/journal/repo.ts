/**
 * Journal Repository (KV Implementation)
 * MULTITENANT: All operations require userId - no global state
 * 
 * Key Schema:
 * - sf:v1:journal:{userId}:entry:{id}
 * - sf:v1:journal:{userId}:day:{YYYY-MM-DD}:ids
 * - sf:v1:journal:{userId}:status:PENDING:ids
 * - sf:v1:journal:{userId}:status:ARCHIVED:ids
 * - sf:v1:journal:{userId}:index:updatedAt
 */

import { randomUUID } from 'crypto';
import { kv, kvKeys, kvTTL } from '../../kv';
import type {
  JournalRepo,
  JournalEvent,
  JournalStatus,
  JournalCreateRequest,
  JournalConfirmPayload,
} from './types';
import {
  assertUserId,
  extractDayKey,
  normalizeStatus,
} from './types';
import { sha256Hex } from '../../reasoning/hash';
import { stableStringify } from '../../reasoning/stableJson';

// ─────────────────────────────────────────────────────────────
// KV REPOSITORY IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export class JournalRepoKV implements JournalRepo {
  async getEvent(userId: string, id: string): Promise<JournalEvent | null> {
    assertUserId(userId);
    return kv.get<JournalEvent>(kvKeys.journalEntry(userId, id));
  }

  async putEvent(userId: string, event: JournalEvent): Promise<void> {
    assertUserId(userId);
    if (event.userId !== userId) {
      throw new Error(`Event userId mismatch: expected ${userId}, got ${event.userId}`);
    }
    await kv.set(kvKeys.journalEntry(userId, event.id), event);
  }

  async deleteEvent(userId: string, id: string): Promise<boolean> {
    assertUserId(userId);
    const exists = await kv.exists(kvKeys.journalEntry(userId, id));
    if (!exists) return false;
    await kv.delete(kvKeys.journalEntry(userId, id));
    return true;
  }

  async listDayIds(userId: string, dayKey: string): Promise<string[]> {
    assertUserId(userId);
    const ids = await kv.get<string[]>(kvKeys.journalDayIds(userId, dayKey));
    return ids || [];
  }

  async setDayIds(userId: string, dayKey: string, ids: string[]): Promise<void> {
    assertUserId(userId);
    await kv.set(kvKeys.journalDayIds(userId, dayKey), ids);
  }

  async listStatusIds(userId: string, status: JournalStatus): Promise<string[]> {
    assertUserId(userId);
    const ids = await kv.get<string[]>(kvKeys.journalStatusIds(userId, status));
    return ids || [];
  }

  async setStatusIds(userId: string, status: JournalStatus, ids: string[]): Promise<void> {
    assertUserId(userId);
    await kv.set(kvKeys.journalStatusIds(userId, status), ids);
  }

  async getUpdatedAt(userId: string): Promise<string | null> {
    assertUserId(userId);
    return kv.get<string>(kvKeys.journalUpdatedAt(userId));
  }

  async setUpdatedAt(userId: string, iso: string): Promise<void> {
    assertUserId(userId);
    await kv.set(kvKeys.journalUpdatedAt(userId), iso);
  }
}

// Singleton instance for convenience
export const journalRepoKV = new JournalRepoKV();

// ─────────────────────────────────────────────────────────────
// LEGACY FUNCTION SIGNATURES (updated for userId)
// These wrap the repo for backward compatibility during migration
// All require userId as FIRST parameter
// ─────────────────────────────────────────────────────────────

export async function journalCreateWithMeta(
  userId: string,
  request: JournalCreateRequest,
  idempotencyKey?: string
): Promise<{ event: JournalEvent; isReplay: boolean }> {
  assertUserId(userId);
  
  // Check idempotency mapping first
  if (idempotencyKey) {
    const idemKey = kvKeys.idempotency(userId, `journal:create:${idempotencyKey}`);
    const cached = await kv.get<{ id: string; hash: string }>(idemKey);

    if (cached) {
      const currentHash = sha256Hex(stableStringify(request as unknown as import('../../reasoning/types').JsonObject));
      if (cached.hash !== currentHash) {
        throw new Error('Idempotency conflict: key reused with different payload');
      }

      const existing = await journalRepoKV.getEvent(userId, cached.id);
      if (existing) {
        return { event: existing, isReplay: true };
      }
      // If mapped entry is gone, we proceed to create a new one (safer behavior)
    }
  }
  
  const now = new Date().toISOString();
  // Always generate a new ID, do not use idempotencyKey as ID
  const id = `entry-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const timestamp = request.timestamp || now;
  const dayKey = extractDayKey(timestamp);
  
  const event: JournalEvent = {
    id,
    userId,
    side: request.side,
    status: 'PENDING',
    timestamp,
    summary: request.summary,
    dayKey,
    createdAt: now,
    updatedAt: now,
  };
  
  await journalRepoKV.putEvent(userId, event);
  
  // Save idempotency mapping
  if (idempotencyKey) {
    const idemKey = kvKeys.idempotency(userId, `journal:create:${idempotencyKey}`);
    const hash = sha256Hex(stableStringify(request as unknown as import('../../reasoning/types').JsonObject));
    await kv.set(idemKey, { id, hash }, kvTTL.idempotency);
  }
  
  // Add to pending index
  const pendingIds = await journalRepoKV.listStatusIds(userId, 'PENDING');
  if (!pendingIds.includes(id)) {
    await journalRepoKV.setStatusIds(userId, 'PENDING', [...pendingIds, id]);
  }
  
  // Update timestamp
  await journalRepoKV.setUpdatedAt(userId, now);
  
  return { event, isReplay: false };
}

export async function journalCreate(
  userId: string,
  request: JournalCreateRequest,
  idempotencyKey?: string
): Promise<JournalEvent> {
  const { event } = await journalCreateWithMeta(userId, request, idempotencyKey);
  return event;
}

export async function journalGetById(
  userId: string,
  id: string
): Promise<JournalEvent | null> {
  assertUserId(userId);
  return journalRepoKV.getEvent(userId, id);
}

export async function journalList(
  userId: string,
  status?: string,
  limit = 50,
  cursor?: string
): Promise<{ items: JournalEvent[]; nextCursor?: string }> {
  assertUserId(userId);
  
  // Get IDs based on status filter
  let allIds: string[] = [];
  
  if (status) {
    const normalizedStatus = normalizeStatus(status);
    allIds = await journalRepoKV.listStatusIds(userId, normalizedStatus);
  } else {
    // No status filter: get all statuses
    const pending = await journalRepoKV.listStatusIds(userId, 'PENDING');
    const confirmed = await journalRepoKV.listStatusIds(userId, 'CONFIRMED');
    const archived = await journalRepoKV.listStatusIds(userId, 'ARCHIVED');
    allIds = [...pending, ...confirmed, ...archived];
  }
  
  // Fetch all events
  const events: JournalEvent[] = [];
  for (const id of allIds) {
    const event = await journalRepoKV.getEvent(userId, id);
    if (event) {
      events.push(event);
    }
  }
  
  // Sort by timestamp descending
  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  
  // Apply cursor (timestamp-based pagination)
  let filtered = events;
  if (cursor) {
    const cursorIndex = filtered.findIndex(e => e.timestamp === cursor);
    if (cursorIndex !== -1) {
      filtered = filtered.slice(cursorIndex + 1);
    }
  }
  
  // Apply limit
  const hasMore = filtered.length > limit;
  const items = filtered.slice(0, limit);
  
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.timestamp : undefined,
  };
}

export async function journalConfirm(
  userId: string,
  id: string,
  payload: JournalConfirmPayload
): Promise<JournalEvent | null> {
  assertUserId(userId);
  
  const event = await journalRepoKV.getEvent(userId, id);
  if (!event) return null;
  
  // Idempotent: if already confirmed, just return
  if (event.status === 'CONFIRMED') {
    return event;
  }
  
  const now = new Date().toISOString();
  
  event.status = 'CONFIRMED';
  event.updatedAt = now;
  event.confirmData = {
    mood: payload.mood,
    note: payload.note,
    tags: payload.tags,
    confirmedAt: now,
  };
  
  await journalRepoKV.putEvent(userId, event);
  
  // Remove from pending index
  const pendingIds = await journalRepoKV.listStatusIds(userId, 'PENDING');
  await journalRepoKV.setStatusIds(userId, 'PENDING', pendingIds.filter(x => x !== id));
  
  // Add to confirmed index
  const confirmedIds = await journalRepoKV.listStatusIds(userId, 'CONFIRMED');
  if (!confirmedIds.includes(id)) {
    await journalRepoKV.setStatusIds(userId, 'CONFIRMED', [...confirmedIds, id]);
  }
  
  // Add to day index if not present
  const dayIds = await journalRepoKV.listDayIds(userId, event.dayKey);
  if (!dayIds.includes(id)) {
    // Fetch all day events to sort by createdAt
    const allDayEvents: JournalEvent[] = [];
    for (const eid of dayIds) {
      const e = await journalRepoKV.getEvent(userId, eid);
      if (e) allDayEvents.push(e);
    }
    allDayEvents.push(event);
    allDayEvents.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    await journalRepoKV.setDayIds(userId, event.dayKey, allDayEvents.map(e => e.id));
  }
  
  // Update timestamp
  await journalRepoKV.setUpdatedAt(userId, now);
  
  return event;
}

export async function journalArchive(
  userId: string,
  id: string,
  reason: string
): Promise<JournalEvent | null> {
  assertUserId(userId);
  
  const event = await journalRepoKV.getEvent(userId, id);
  if (!event) return null;
  
  // Idempotent: if already archived, just return
  if (event.status === 'ARCHIVED') {
    return event;
  }
  
  const now = new Date().toISOString();
  const previousStatus = event.status;
  
  event.status = 'ARCHIVED';
  event.updatedAt = now;
  event.archiveData = {
    reason,
    archivedAt: now,
  };
  
  await journalRepoKV.putEvent(userId, event);
  
  // Remove from previous status index
  if (previousStatus === 'PENDING') {
    const pendingIds = await journalRepoKV.listStatusIds(userId, 'PENDING');
    await journalRepoKV.setStatusIds(userId, 'PENDING', pendingIds.filter(x => x !== id));
  } else if (previousStatus === 'CONFIRMED') {
    const confirmedIds = await journalRepoKV.listStatusIds(userId, 'CONFIRMED');
    await journalRepoKV.setStatusIds(userId, 'CONFIRMED', confirmedIds.filter(x => x !== id));
  }
  
  // Add to archived index
  const archivedIds = await journalRepoKV.listStatusIds(userId, 'ARCHIVED');
  if (!archivedIds.includes(id)) {
    await journalRepoKV.setStatusIds(userId, 'ARCHIVED', [...archivedIds, id]);
  }
  
  // Update timestamp
  await journalRepoKV.setUpdatedAt(userId, now);
  
  return event;
}

export async function journalRestore(
  userId: string,
  id: string
): Promise<JournalEvent | null> {
  assertUserId(userId);
  
  const event = await journalRepoKV.getEvent(userId, id);
  if (!event) return null;
  
  // Idempotent: if already pending, just return
  if (event.status === 'PENDING') {
    return event;
  }
  
  const now = new Date().toISOString();
  const previousStatus = event.status;
  
  event.status = 'PENDING';
  event.updatedAt = now;
  delete event.archiveData;
  
  await journalRepoKV.putEvent(userId, event);
  
  // Remove from previous status index
  if (previousStatus === 'ARCHIVED') {
    const archivedIds = await journalRepoKV.listStatusIds(userId, 'ARCHIVED');
    await journalRepoKV.setStatusIds(userId, 'ARCHIVED', archivedIds.filter(x => x !== id));
  } else if (previousStatus === 'CONFIRMED') {
    const confirmedIds = await journalRepoKV.listStatusIds(userId, 'CONFIRMED');
    await journalRepoKV.setStatusIds(userId, 'CONFIRMED', confirmedIds.filter(x => x !== id));
  }
  
  // Add to pending index
  const pendingIds = await journalRepoKV.listStatusIds(userId, 'PENDING');
  if (!pendingIds.includes(id)) {
    await journalRepoKV.setStatusIds(userId, 'PENDING', [...pendingIds, id]);
  }
  
  // Update timestamp
  await journalRepoKV.setUpdatedAt(userId, now);
  
  return event;
}

export async function journalDelete(
  userId: string,
  id: string
): Promise<boolean> {
  assertUserId(userId);
  
  const event = await journalRepoKV.getEvent(userId, id);
  if (!event) return false;
  
  // Remove from all indices
  const pendingIds = await journalRepoKV.listStatusIds(userId, 'PENDING');
  if (pendingIds.includes(id)) {
    await journalRepoKV.setStatusIds(userId, 'PENDING', pendingIds.filter(x => x !== id));
  }
  
  const confirmedIds = await journalRepoKV.listStatusIds(userId, 'CONFIRMED');
  if (confirmedIds.includes(id)) {
    await journalRepoKV.setStatusIds(userId, 'CONFIRMED', confirmedIds.filter(x => x !== id));
  }
  
  const archivedIds = await journalRepoKV.listStatusIds(userId, 'ARCHIVED');
  if (archivedIds.includes(id)) {
    await journalRepoKV.setStatusIds(userId, 'ARCHIVED', archivedIds.filter(x => x !== id));
  }
  
  // Remove from day index
  const dayIds = await journalRepoKV.listDayIds(userId, event.dayKey);
  if (dayIds.includes(id)) {
    await journalRepoKV.setDayIds(userId, event.dayKey, dayIds.filter(x => x !== id));
  }
  
  // Delete the event
  await journalRepoKV.deleteEvent(userId, id);
  
  // Update timestamp
  await journalRepoKV.setUpdatedAt(userId, new Date().toISOString());
  
  return true;
}
