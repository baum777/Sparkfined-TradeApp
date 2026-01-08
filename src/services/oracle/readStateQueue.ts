import type { OfflineQueueRetryPolicy } from '../sync/queuePolicy';
import { applyRetryPolicyToFailure, getDefaultOfflineQueuePolicy } from '../sync/queuePolicy';
import type { OracleDailyFeed } from './types';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type OracleReadStateQueueStatus = 'pending' | 'failed';

/**
 * Offline pending queue item for oracle read-state.
 *
 * Design choice (per spec): monotonic merge for catch-up => we only queue "mark read".
 * Unread toggles are supported online (write-through) but are not reconciled offline.
 */
export type OracleReadStateQueueItem = {
  id: string;
  isRead: true;
  createdAt: number;
  retryCount: number;
  status: OracleReadStateQueueStatus;
  lastError?: string;
  lastAttemptAt?: number;
  nextAttemptAt?: number;
};

const STORAGE_KEY = 'sparkfined_oracle_read_pending_v1';

function nowMs(now?: number): number {
  return typeof now === 'number' ? now : Date.now();
}

function safeParseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function isQueueItem(v: unknown): v is OracleReadStateQueueItem {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.isRead === true &&
    typeof v.createdAt === 'number' &&
    typeof v.retryCount === 'number' &&
    (v.status === 'pending' || v.status === 'failed')
  );
}

export function loadOracleReadStateQueue(storage: StorageLike): OracleReadStateQueueItem[] {
  const raw = safeParseJson(storage.getItem(STORAGE_KEY));
  if (!Array.isArray(raw)) return [];
  return raw.filter(isQueueItem);
}

export function saveOracleReadStateQueue(storage: StorageLike, items: OracleReadStateQueueItem[]): void {
  if (!items.length) {
    storage.removeItem(STORAGE_KEY);
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getOverlayReadIds(items: OracleReadStateQueueItem[]): Set<string> {
  // Overlay only "pending" items; failed items are not applied (avoids badge drift after reconnect).
  const s = new Set<string>();
  for (const item of items) {
    if (item.status === 'pending' && item.isRead) s.add(item.id);
  }
  return s;
}

export function enqueueOracleMarkRead(storage: StorageLike, id: string, now?: number): void {
  const t = nowMs(now);
  const items = loadOracleReadStateQueue(storage);
  const existing = items.find((x) => x.id === id);
  if (existing) {
    // Keep monotonic semantics: ensure it's pending "read".
    existing.isRead = true;
    existing.status = 'pending';
    existing.createdAt = Math.min(existing.createdAt, t);
    saveOracleReadStateQueue(storage, items);
    return;
  }
  items.push({
    id,
    isRead: true,
    createdAt: t,
    retryCount: 0,
    status: 'pending',
  });
  saveOracleReadStateQueue(storage, items);
}

export function clearOraclePendingIds(storage: StorageLike, ids: string[]): void {
  if (!ids.length) return;
  const set = new Set(ids);
  const items = loadOracleReadStateQueue(storage).filter((x) => !set.has(x.id));
  saveOracleReadStateQueue(storage, items);
}

export function mergeOracleFeedWithOverlay(feed: OracleDailyFeed, overlayReadIds: Set<string>): OracleDailyFeed {
  return {
    pinned: {
      ...feed.pinned,
      isRead: feed.pinned.isRead || overlayReadIds.has(feed.pinned.id),
    },
    insights: feed.insights.map((i) => ({
      ...i,
      isRead: i.isRead || overlayReadIds.has(i.id),
    })),
  };
}

export type OracleReadStateBulkApi = (input: { ids: string[]; isRead: boolean }) => Promise<unknown>;

/**
 * Attempt to sync pending "mark read" items via bulk endpoint.
 *
 * - Uses strict retry policy (429/5xx/network are retryable; 400/401/403/404/409 permanent).
 * - Clears items only after successful sync.
 */
export async function syncOracleReadStateQueue(params: {
  storage: StorageLike;
  isOnline: boolean;
  bulkApi: OracleReadStateBulkApi;
  now?: number;
  policy?: OfflineQueueRetryPolicy;
  random?: () => number;
}): Promise<{ attempted: number; synced: number; remaining: number }> {
  if (!params.isOnline) {
    const remaining = loadOracleReadStateQueue(params.storage).length;
    return { attempted: 0, synced: 0, remaining };
  }

  const policy = params.policy ?? getDefaultOfflineQueuePolicy();
  const now = nowMs(params.now);
  const items = loadOracleReadStateQueue(params.storage);

  const due = items.filter(
    (x) =>
      x.status === 'pending' &&
      (x.nextAttemptAt === undefined || x.nextAttemptAt <= now)
  );

  if (!due.length) {
    return { attempted: 0, synced: 0, remaining: items.length };
  }

  const ids = Array.from(new Set(due.map((x) => x.id)));

  try {
    await params.bulkApi({ ids, isRead: true });
    clearOraclePendingIds(params.storage, ids);
    const remaining = loadOracleReadStateQueue(params.storage).length;
    return { attempted: ids.length, synced: ids.length, remaining };
  } catch (error) {
    const updated = items.map((item) => {
      if (item.status !== 'pending') return item;
      if (!ids.includes(item.id)) return item;

      const fields = applyRetryPolicyToFailure({
        item,
        error,
        now,
        policy,
        random: params.random,
      });

      // If it permanently fails (or hits max retries), it becomes "failed" and is not overlaid anymore.
      return {
        ...item,
        ...fields,
      };
    });

    saveOracleReadStateQueue(params.storage, updated);
    const remaining = loadOracleReadStateQueue(params.storage).length;
    return { attempted: ids.length, synced: 0, remaining };
  }
}

