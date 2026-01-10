/**
 * Journal Sync Queue Store
 * 
 * Zustand store for managing journal offline queue state.
 * Persists to IndexedDB and processes queue when online.
 * 
 * P0.2: Per-item backoff with nextAttemptAt
 * Reconciliation: remove local-* entries → refetch (no serverId dependency)
 */

import { create } from 'zustand';
import { dbService } from '@/services/db/db';
import {
  createJournalEntry,
  confirmJournalEntry,
  archiveJournalEntry,
  restoreJournalEntry,
  deleteJournalEntry,
  isOffline,
} from './api';
import {
  applyRetryPolicyToFailure,
  getDefaultOfflineQueuePolicy,
} from '@/services/sync/queuePolicy';
import type {
  JournalQueueItem,
  JournalQueueOperation,
  JournalCreateRequest,
  JournalEntryV1,
  SyncState,
} from './types';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SYNC_INTERVAL = 30000; // 30s periodic sync
const JOURNAL_QUEUE_POLICY = getDefaultOfflineQueuePolicy();

// ─────────────────────────────────────────────────────────────
// Store State
// ─────────────────────────────────────────────────────────────

interface JournalQueueStore {
  // State
  queue: JournalQueueItem[];
  isSyncing: boolean;
  lastError: string | null;
  lastSyncAt: number | null;
  
  // Track clientIds of CREATE items that completed sync (for reconciliation via refetch)
  completedCreateClientIds: string[];
  
  // Actions
  loadQueue: () => Promise<void>;
  enqueue: (
    operation: JournalQueueOperation,
    entryId: string,
    payload?: JournalCreateRequest,
    idempotencyKey?: string
  ) => Promise<JournalQueueItem>;
  dequeue: (id: string) => Promise<void>;
  processQueue: (opts?: { forceNow?: boolean }) => Promise<{ syncedCount: number; needsRefetch: boolean }>;
  getQueueItem: (entryId: string) => JournalQueueItem | undefined;
  getSyncState: () => SyncState;
  clearError: () => void;
  getCompletedCreateClientIds: () => string[];
  clearCompletedCreateClientIds: () => void;
}

function generateQueueId(): string {
  return `jq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateIdempotencyKey(): string {
  return `idem-${crypto.randomUUID()}`;
}

function computeGlobalLastError(queue: JournalQueueItem[]): string | null {
  const failed = queue.find(q => q.status === 'failed' && q.lastError);
  return failed?.lastError ?? null;
}

export const useJournalQueueStore = create<JournalQueueStore>((set, get) => ({
  queue: [],
  isSyncing: false,
  lastError: null,
  lastSyncAt: null,
  completedCreateClientIds: [],

  loadQueue: async () => {
    try {
      const items = await dbService.getJournalQueue();
      set({ queue: items, lastError: computeGlobalLastError(items) });
    } catch (err) {
      console.error('[JournalQueue] Failed to load queue:', err);
    }
  },

  enqueue: async (operation, entryId, payload, idempotencyKey) => {
    const item: JournalQueueItem = {
      id: generateQueueId(),
      operation,
      entryId,
      payload: operation === 'CREATE' ? payload : undefined,
      idempotencyKey: operation === 'CREATE' 
        ? (idempotencyKey || generateIdempotencyKey()) 
        : undefined,
      createdAt: Date.now(),
      retryCount: 0,
      nextAttemptAt: Date.now(), // Ready to process immediately
      status: 'pending',
    };

    await dbService.addJournalQueueItem(item);
    set(state => {
      const next = [...state.queue, item];
      return { queue: next, lastError: computeGlobalLastError(next) };
    });

    return item;
  },

  dequeue: async (id: string) => {
    await dbService.removeJournalQueueItem(id);
    set(state => {
      const next = state.queue.filter(item => item.id !== id);
      return { queue: next, lastError: computeGlobalLastError(next) };
    });
  },

  processQueue: async (opts) => {
    const { queue, isSyncing } = get();
    const forceNow = !!opts?.forceNow;
    
    if (isSyncing || isOffline() || queue.length === 0) {
      return { syncedCount: 0, needsRefetch: false };
    }

    set({ isSyncing: true });
    let syncedCount = 0;
    const completedClientIds: string[] = [];
    const now = Date.now();

    try {
      // Sort by creation time to preserve order
      const sorted = [...queue].sort((a, b) => a.createdAt - b.createdAt);

      for (const item of sorted) {
        // Failed items do not auto-retry unless manually forced.
        if (item.status === 'failed' && !forceNow) {
          continue;
        }

        // P0.2: Skip items that are not ready for retry yet
        if (!forceNow && item.nextAttemptAt && item.nextAttemptAt > now) {
          continue;
        }

        try {
          await processQueueItem(item);
          syncedCount++;
          
          // Track completed CREATE clientIds for reconciliation
          if (item.operation === 'CREATE') {
            completedClientIds.push(item.entryId);
          }
          
          // Success - remove from queue
          await get().dequeue(item.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Apply strict retry policy (429/5xx/network retryable; 4xx permanent; maxRetries terminal)
          const updatedFields = applyRetryPolicyToFailure({
            item,
            error,
            now,
            policy: JOURNAL_QUEUE_POLICY,
          });
          const updatedItem: JournalQueueItem = {
            ...item,
            ...updatedFields,
            // Ensure we always persist the visible error message
            lastError: updatedFields.lastError ?? errorMessage,
          };

          await dbService.updateJournalQueueItem(updatedItem);
          set(state => {
            const nextQueue = state.queue.map(q => q.id === item.id ? updatedItem : q);
            return {
              queue: nextQueue,
              lastError: computeGlobalLastError(nextQueue),
            };
          });
        }
      }

      // Store completed CREATE clientIds for reconciliation via refetch
      if (completedClientIds.length > 0) {
        set(state => ({
          completedCreateClientIds: [...state.completedCreateClientIds, ...completedClientIds],
        }));
      }

      set({ lastSyncAt: Date.now() });
    } finally {
      set({ isSyncing: false });
    }

    return { syncedCount, needsRefetch: completedClientIds.length > 0 };
  },

  getQueueItem: (entryId: string) => {
    return get().queue.find(item => item.entryId === entryId);
  },

  getSyncState: () => {
    const { queue, isSyncing, lastError, lastSyncAt } = get();
    return {
      queueCount: queue.length,
      isSyncing,
      lastError,
      lastSyncAt,
    };
  },

  clearError: () => {
    set({ lastError: null });
  },

  getCompletedCreateClientIds: () => {
    return get().completedCreateClientIds;
  },

  clearCompletedCreateClientIds: () => {
    set({ completedCreateClientIds: [] });
  },
}));

// ─────────────────────────────────────────────────────────────
// Queue Item Processor
// P0.1: confirm/archive send NO body
// ─────────────────────────────────────────────────────────────

async function processQueueItem(item: JournalQueueItem): Promise<JournalEntryV1 | null> {
  switch (item.operation) {
    case 'CREATE': {
      if (!item.payload || !item.idempotencyKey) {
        throw new Error('CREATE requires payload and idempotencyKey');
      }
      return await createJournalEntry(
        item.payload,
        item.idempotencyKey
      );
    }
    
    case 'CONFIRM': {
      // P0.1: NO payload
      return await confirmJournalEntry(item.entryId);
    }
    
    case 'ARCHIVE': {
      // P0.1: NO payload
      return await archiveJournalEntry(item.entryId);
    }
    
    case 'RESTORE': {
      return await restoreJournalEntry(item.entryId);
    }
    
    case 'DELETE': {
      await deleteJournalEntry(item.entryId);
      return null;
    }
    
    default:
      throw new Error(`Unknown operation: ${item.operation}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Sync Runner (periodic + online listener)
// P0.2: Single periodic runner, no busy-loop
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Sync Runner (single root location)
// Module-level guard ensures exactly one runner
// ─────────────────────────────────────────────────────────────

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let runnerStarted = false;

export function startJournalQueueSync(): void {
  // Module-level guard: only start once
  if (runnerStarted) {
    console.log('[JournalQueue] Runner already started, skipping');
    return;
  }
  runnerStarted = true;

  // Load queue on start
  useJournalQueueStore.getState().loadQueue();

  // Periodic sync - runs every SYNC_INTERVAL
  syncIntervalId = setInterval(() => {
    if (!isOffline()) {
      useJournalQueueStore.getState().processQueue();
    }
  }, SYNC_INTERVAL);

  // Also process immediately on start if online
  if (!isOffline()) {
    useJournalQueueStore.getState().processQueue();
  }

  // Online listener
  window.addEventListener('online', handleOnline);
  
  console.log('[JournalQueue] Sync runner started at root');
}

export function stopJournalQueueSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  window.removeEventListener('online', handleOnline);
  runnerStarted = false;
}

function handleOnline(): void {
  console.log('[JournalQueue] Back online, processing queue...');
  useJournalQueueStore.getState().processQueue();
}
