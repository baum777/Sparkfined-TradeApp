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

interface CreateReconcileResult {
  clientId: string;
  serverId: string;
  entry: JournalEntryV1;
}

interface JournalQueueStore {
  // State
  queue: JournalQueueItem[];
  isSyncing: boolean;
  lastError: string | null;
  lastSyncAt: number | null;
  
  // P0.3: Track reconciled CREATE entries
  reconciledEntries: CreateReconcileResult[];
  
  // Actions
  loadQueue: () => Promise<void>;
  enqueue: (
    operation: JournalQueueOperation,
    entryId: string,
    payload?: JournalCreateRequest,
    idempotencyKey?: string
  ) => Promise<JournalQueueItem>;
  dequeue: (id: string) => Promise<void>;
  processQueue: () => Promise<JournalEntryV1[]>;
  getQueueItem: (entryId: string) => JournalQueueItem | undefined;
  getSyncState: () => SyncState;
  clearError: () => void;
  getReconciledEntries: () => CreateReconcileResult[];
  clearReconciledEntries: () => void;
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
  reconciledEntries: [],

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

    // P0.2: Trigger processing via the periodic runner, not setTimeout
    // The runner will pick it up on next tick
    return item;
  },

  dequeue: async (id: string) => {
    await dbService.removeJournalQueueItem(id);
    set(state => ({ queue: state.queue.filter(item => item.id !== id) }));
  },

  processQueue: async () => {
    const { queue, isSyncing } = get();
    
    if (isSyncing || isOffline() || queue.length === 0) {
      return [];
    }

    set({ isSyncing: true, lastError: null });
    const processedEntries: JournalEntryV1[] = [];
    const reconciled: CreateReconcileResult[] = [];
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
          const result = await processQueueItem(item);
          if (result) {
            processedEntries.push(result);
            
            // P0.3: Track CREATE reconciliation
            if (item.operation === 'CREATE') {
              reconciled.push({
                clientId: item.entryId,
                serverId: result.id,
                entry: result,
              });
            }
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

      // P0.3: Store reconciled entries for hook consumption
      if (reconciled.length > 0) {
        set(state => ({
          reconciledEntries: [...state.reconciledEntries, ...reconciled],
        }));
      }

      set({ lastSyncAt: Date.now() });
    } finally {
      set({ isSyncing: false });
    }

    return processedEntries;
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

  getReconciledEntries: () => {
    return get().reconciledEntries;
  },

  clearReconciledEntries: () => {
    set({ reconciledEntries: [] });
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

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export function startJournalQueueSync(): void {
  if (syncIntervalId) return;

  // Load queue on start
  useJournalQueueStore.getState().loadQueue();

  // Periodic sync - runs every SYNC_INTERVAL
  // processQueue internally checks nextAttemptAt to avoid busy-loop
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
}

export function stopJournalQueueSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  window.removeEventListener('online', handleOnline);
}

function handleOnline(): void {
  console.log('[JournalQueue] Back online, processing queue...');
  useJournalQueueStore.getState().processQueue();
}
