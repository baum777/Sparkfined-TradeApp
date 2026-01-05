/**
 * Journal Sync Queue Store
 * 
 * Zustand store for managing journal offline queue state.
 * Persists to IndexedDB and processes queue when online.
 * 
 * P0.2: Per-item backoff with nextAttemptAt
 * P0.3: clientId/serverId reconciliation for CREATE
 */

import { create } from 'zustand';
import { dbService } from '@/services/db/db';
import {
  createJournalEntry,
  confirmJournalEntry,
  archiveJournalEntry,
  restoreJournalEntry,
  deleteJournalEntry,
  isNetworkError,
  isOffline,
} from './api';
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

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
const SYNC_INTERVAL = 30000; // 30s periodic sync

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
  processQueue: () => Promise<{ syncedCount: number; needsRefetch: boolean }>;
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

// P0.2: Calculate next attempt time based on retry count
function calculateNextAttemptAt(retryCount: number): number {
  const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
  return Date.now() + delay;
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
      set({ queue: items });
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
    };

    await dbService.addJournalQueueItem(item);
    set(state => ({ queue: [...state.queue, item] }));

    return item;
  },

  dequeue: async (id: string) => {
    await dbService.removeJournalQueueItem(id);
    set(state => ({ queue: state.queue.filter(item => item.id !== id) }));
  },

  processQueue: async () => {
    const { queue, isSyncing } = get();
    
    if (isSyncing || isOffline() || queue.length === 0) {
      return { syncedCount: 0, needsRefetch: false };
    }

    set({ isSyncing: true, lastError: null });
    let syncedCount = 0;
    const completedClientIds: string[] = [];
    const now = Date.now();

    try {
      // Sort by creation time to preserve order
      const sorted = [...queue].sort((a, b) => a.createdAt - b.createdAt);

      for (const item of sorted) {
        // P0.2: Skip items that are not ready for retry yet
        if (item.nextAttemptAt && item.nextAttemptAt > now) {
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
          
          // Check if retryable
          if (isNetworkError(error) && item.retryCount < MAX_RETRIES) {
            // P0.2: Update with nextAttemptAt for backoff
            const newRetryCount = item.retryCount + 1;
            const updatedItem: JournalQueueItem = {
              ...item,
              retryCount: newRetryCount,
              lastError: errorMessage,
              lastAttemptAt: now,
              nextAttemptAt: calculateNextAttemptAt(newRetryCount),
            };
            await dbService.updateJournalQueueItem(updatedItem);
            set(state => ({
              queue: state.queue.map(q => q.id === item.id ? updatedItem : q),
              lastError: errorMessage,
            }));
          } else {
            // Non-retryable or max retries - keep in queue with error
            const updatedItem: JournalQueueItem = {
              ...item,
              lastError: errorMessage,
              lastAttemptAt: now,
              // Set far future nextAttemptAt to stop auto-retry
              nextAttemptAt: now + 86400000, // 24 hours
            };
            await dbService.updateJournalQueueItem(updatedItem);
            set(state => ({
              queue: state.queue.map(q => q.id === item.id ? updatedItem : q),
              lastError: errorMessage,
            }));
          }
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
