/**
 * Journal Sync Queue Store
 * 
 * Zustand store for managing journal offline queue state.
 * Persists to IndexedDB and processes queue when online.
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
  JournalConfirmPayload,
  JournalArchiveRequest,
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
  
  // Actions
  loadQueue: () => Promise<void>;
  enqueue: (
    operation: JournalQueueOperation,
    entryId: string,
    payload?: JournalCreateRequest | JournalConfirmPayload | JournalArchiveRequest,
    idempotencyKey?: string
  ) => Promise<JournalQueueItem>;
  dequeue: (id: string) => Promise<void>;
  processQueue: () => Promise<JournalEntryV1[]>;
  getQueueItem: (entryId: string) => JournalQueueItem | undefined;
  getSyncState: () => SyncState;
  clearError: () => void;
}

function generateQueueId(): string {
  return `jq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateIdempotencyKey(): string {
  return `idem-${crypto.randomUUID()}`;
}

export const useJournalQueueStore = create<JournalQueueStore>((set, get) => ({
  queue: [],
  isSyncing: false,
  lastError: null,
  lastSyncAt: null,

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
      payload,
      idempotencyKey: operation === 'CREATE' 
        ? (idempotencyKey || generateIdempotencyKey()) 
        : undefined,
      createdAt: Date.now(),
      retryCount: 0,
    };

    await dbService.addJournalQueueItem(item);
    set(state => ({ queue: [...state.queue, item] }));

    // Try immediate sync if online
    if (!isOffline()) {
      // Fire and forget - don't await to avoid blocking UI
      setTimeout(() => get().processQueue(), 100);
    }

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

    try {
      // Sort by creation time to preserve order
      const sorted = [...queue].sort((a, b) => a.createdAt - b.createdAt);

      for (const item of sorted) {
        try {
          const result = await processQueueItem(item);
          if (result) {
            processedEntries.push(result);
          }
          
          // Success - remove from queue
          await get().dequeue(item.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Check if retryable
          if (isNetworkError(error) && item.retryCount < MAX_RETRIES) {
            // Update retry count
            const updatedItem: JournalQueueItem = {
              ...item,
              retryCount: item.retryCount + 1,
              lastError: errorMessage,
              lastAttemptAt: Date.now(),
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
              lastAttemptAt: Date.now(),
            };
            await dbService.updateJournalQueueItem(updatedItem);
            set(state => ({
              queue: state.queue.map(q => q.id === item.id ? updatedItem : q),
              lastError: errorMessage,
            }));
          }
        }
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
}));

// ─────────────────────────────────────────────────────────────
// Queue Item Processor
// ─────────────────────────────────────────────────────────────

async function processQueueItem(item: JournalQueueItem): Promise<JournalEntryV1 | null> {
  switch (item.operation) {
    case 'CREATE': {
      if (!item.payload || !item.idempotencyKey) {
        throw new Error('CREATE requires payload and idempotencyKey');
      }
      return await createJournalEntry(
        item.payload as JournalCreateRequest,
        item.idempotencyKey
      );
    }
    
    case 'CONFIRM': {
      return await confirmJournalEntry(
        item.entryId,
        (item.payload as JournalConfirmPayload) || { mood: '', note: '', tags: [] }
      );
    }
    
    case 'ARCHIVE': {
      return await archiveJournalEntry(
        item.entryId,
        (item.payload as JournalArchiveRequest) || { reason: '' }
      );
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
// ─────────────────────────────────────────────────────────────

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export function startJournalQueueSync(): void {
  if (syncIntervalId) return;

  // Load queue on start
  useJournalQueueStore.getState().loadQueue();

  // Periodic sync
  syncIntervalId = setInterval(() => {
    if (!isOffline()) {
      useJournalQueueStore.getState().processQueue();
    }
  }, SYNC_INTERVAL);

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
