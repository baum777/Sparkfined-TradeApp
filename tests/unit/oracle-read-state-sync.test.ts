import { describe, it, expect } from 'vitest';
import { ApiHttpError } from '../../src/services/api/client';
import type { OracleDailyFeed } from '../../src/services/oracle/types';
import {
  enqueueOracleMarkRead,
  getOverlayReadIds,
  loadOracleReadStateQueue,
  mergeOracleFeedWithOverlay,
  syncOracleReadStateQueue,
  type StorageLike,
} from '../../src/services/oracle/readStateQueue';

function makeMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function makeFeed(overrides?: Partial<OracleDailyFeed>): OracleDailyFeed {
  return {
    pinned: {
      id: 'today-takeaway',
      title: 'Pinned',
      summary: 'Pinned summary',
      isRead: false,
      createdAt: new Date(0).toISOString(),
      ...(overrides?.pinned ?? {}),
    },
    insights:
      overrides?.insights ??
      [
        {
          id: 'i1',
          title: 'One',
          summary: 'S1',
          theme: 'bullish',
          isRead: false,
          createdAt: new Date(0).toISOString(),
        },
        {
          id: 'i2',
          title: 'Two',
          summary: 'S2',
          theme: 'bearish',
          isRead: true,
          createdAt: new Date(0).toISOString(),
        },
      ],
  };
}

describe('oracle read-state queue + merge', () => {
  it('monotonic merge prefers read if either side says read', () => {
    const storage = makeMemoryStorage();
    enqueueOracleMarkRead(storage, 'i1', 1);
    enqueueOracleMarkRead(storage, 'today-takeaway', 1);

    const overlay = getOverlayReadIds(loadOracleReadStateQueue(storage));
    const merged = mergeOracleFeedWithOverlay(makeFeed(), overlay);

    expect(merged.insights.find((i) => i.id === 'i1')?.isRead).toBe(true); // pending read overrides unread
    expect(merged.insights.find((i) => i.id === 'i2')?.isRead).toBe(true); // server read stays read
    expect(merged.pinned.isRead).toBe(true); // pending read overrides unread
  });

  it('sync clears pending items after successful bulk catch-up', async () => {
    const storage = makeMemoryStorage();
    enqueueOracleMarkRead(storage, 'i1', 1);
    enqueueOracleMarkRead(storage, 'i2', 1);

    const bulkApi = async () => ({ ok: true });

    const result = await syncOracleReadStateQueue({
      storage,
      isOnline: true,
      bulkApi,
      now: 10,
    });

    expect(result.attempted).toBe(2);
    expect(result.synced).toBe(2);
    expect(loadOracleReadStateQueue(storage)).toHaveLength(0);
  });

  it('sync keeps items pending and schedules retry on retryable failure', async () => {
    const storage = makeMemoryStorage();
    enqueueOracleMarkRead(storage, 'i1', 1);

    const bulkApi = async () => {
      throw new ApiHttpError('server down', 503);
    };

    const result = await syncOracleReadStateQueue({
      storage,
      isOnline: true,
      bulkApi,
      now: 10_000,
      policy: { maxRetries: 5, baseDelayMs: 1000, maxJitterMs: 0 },
      random: () => 0,
    });

    expect(result.attempted).toBe(1);
    expect(result.synced).toBe(0);

    const [item] = loadOracleReadStateQueue(storage);
    expect(item.status).toBe('pending');
    expect(item.retryCount).toBe(1);
    expect(item.lastAttemptAt).toBe(10_000);
    expect(item.nextAttemptAt).toBe(11_000);
  });

  it('sync marks items failed immediately on permanent failure', async () => {
    const storage = makeMemoryStorage();
    enqueueOracleMarkRead(storage, 'i1', 1);

    const bulkApi = async () => {
      throw new ApiHttpError('unauthorized', 401);
    };

    await syncOracleReadStateQueue({
      storage,
      isOnline: true,
      bulkApi,
      now: 10_000,
      policy: { maxRetries: 5, baseDelayMs: 1000, maxJitterMs: 0 },
      random: () => 0,
    });

    const [item] = loadOracleReadStateQueue(storage);
    expect(item.status).toBe('failed');

    // Failed items are not overlaid (avoids badge drift after reconnect).
    const overlay = getOverlayReadIds([item]);
    expect(overlay.has('i1')).toBe(false);
  });
});

