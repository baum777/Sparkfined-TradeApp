/**
 * useJournalApi Hook
 * 
 * Replaces useJournalStub with real API integration.
 * Provides offline-first behavior with caching and queue support.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { dbService } from '@/services/db/db';
import { useJournalQueueStore, startJournalQueueSync } from './queueStore';
import {
  listJournalEntries,
  isNetworkError,
  isOffline,
} from './api';
import type {
  JournalEntryV1,
  JournalEntryLocal,
  JournalCreateRequest,
  JournalConfirmPayload,
  JournalArchiveRequest,
  SyncState,
} from './types';
import type { SyncStatus } from '@/components/journal/JournalSyncBadge';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ConfirmPayload {
  mood: string;
  note: string;
  tags: string[];
}

export interface UseJournalApiReturn {
  // Page state (matches useJournalStub interface)
  pageState: {
    state: 'loading' | 'ready' | 'error' | 'empty';
    isLoading: boolean;
    isReady: boolean;
    isError: boolean;
    isEmpty: boolean;
    setState: (state: 'loading' | 'ready' | 'error' | 'empty') => void;
  };
  
  // Data
  entries: JournalEntryLocal[];
  setEntries: React.Dispatch<React.SetStateAction<JournalEntryLocal[]>>;
  
  // Mutations
  createEntry: (side: 'BUY' | 'SELL', summary: string, symbolOrAddress?: string) => Promise<JournalEntryLocal>;
  confirmEntry: (id: string, payload: ConfirmPayload) => void;
  archiveEntry: (id: string, reason: string) => void;
  deleteEntry: (id: string) => void;
  restoreEntry: (id: string) => void;
  
  // Sync state
  syncState: SyncState;
  syncStatus: SyncStatus;
  queueCount: number;
  refetch: () => Promise<void>;
  retrySync: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Helper: Generate optimistic local ID
// ─────────────────────────────────────────────────────────────

function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useJournalApi(): UseJournalApiReturn {
  // State
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [entries, setEntries] = useState<JournalEntryLocal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  // Queue store
  const {
    queue,
    isSyncing,
    lastError,
    enqueue,
    processQueue,
    getSyncState,
    loadQueue,
  } = useJournalQueueStore();

  // ─────────────────────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      // Start queue sync
      startJournalQueueSync();
      
      // Load queue first
      await loadQueue();

      // Try to load from cache first
      try {
        const cached = await dbService.getJournalCache();
        if (cached.length > 0) {
          setEntries(mergeWithQueue(cached, queue));
          setState('ready');
        }
      } catch (err) {
        console.error('[useJournalApi] Failed to load cache:', err);
      }

      // Then fetch from API
      await fetchEntries();
    }

    init();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Fetch from API
  // ─────────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    if (isOffline()) {
      // Already loaded from cache, just ensure we're in ready state
      if (entries.length === 0) {
        const cached = await dbService.getJournalCache();
        if (cached.length > 0) {
          setEntries(mergeWithQueue(cached, queue));
          setState('ready');
        } else {
          setState('empty');
        }
      }
      return;
    }

    try {
      setState('loading');
      const data = await listJournalEntries();
      
      // Save to cache
      await dbService.saveJournalCacheBulk(data);
      
      // Merge with queue for optimistic entries
      setEntries(mergeWithQueue(data, queue));
      setState(data.length === 0 ? 'empty' : 'ready');
      setError(null);
    } catch (err) {
      console.error('[useJournalApi] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load entries');
      
      // Try cache on error
      try {
        const cached = await dbService.getJournalCache();
        if (cached.length > 0) {
          setEntries(mergeWithQueue(cached, queue));
          setState('ready');
        } else {
          setState('error');
        }
      } catch {
        setState('error');
      }
    }
  }, [queue]);

  // ─────────────────────────────────────────────────────────────
  // Merge API entries with queued optimistic entries
  // ─────────────────────────────────────────────────────────────

  function mergeWithQueue(
    apiEntries: JournalEntryV1[],
    queueItems: typeof queue
  ): JournalEntryLocal[] {
    const result: JournalEntryLocal[] = apiEntries.map(entry => {
      const queueItem = queueItems.find(q => q.entryId === entry.id);
      return {
        ...entry,
        _isQueued: !!queueItem,
        _queueId: queueItem?.id,
        _syncError: !!queueItem?.lastError,
      };
    });

    // Add CREATE queue items as optimistic entries
    for (const item of queueItems) {
      if (item.operation === 'CREATE') {
        const payload = item.payload as JournalCreateRequest;
        // Check if already in results (might have synced)
        if (!result.find(e => e.id === item.entryId)) {
          result.unshift({
            id: item.entryId,
            side: payload?.side || 'BUY',
            status: 'pending',
            summary: payload?.summary || '',
            timestamp: payload?.timestamp || new Date().toISOString(),
            createdAt: new Date(item.createdAt).toISOString(),
            updatedAt: new Date(item.createdAt).toISOString(),
            _isQueued: true,
            _queueId: item.id,
            _syncError: !!item.lastError,
          });
        }
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Update entries when queue changes
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setEntries(prev => {
      // Re-merge with current queue state
      const baseEntries = prev.filter(e => !e._isQueued || queue.some(q => q.entryId === e.id));
      return mergeWithQueue(
        baseEntries.filter(e => !e.id.startsWith('local-')) as JournalEntryV1[],
        queue
      );
    });
  }, [queue]);

  // ─────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────

  const createEntry = useCallback(async (
    side: 'BUY' | 'SELL',
    summary: string,
    symbolOrAddress?: string
  ): Promise<JournalEntryLocal> => {
    const localId = generateLocalId();
    const payload: JournalCreateRequest = {
      side,
      summary,
      timestamp: new Date().toISOString(),
      symbolOrAddress,
    };

    // Enqueue for sync
    const queueItem = await enqueue('CREATE', localId, payload);

    // Optimistic entry
    const optimisticEntry: JournalEntryLocal = {
      id: localId,
      side,
      status: 'pending',
      summary,
      timestamp: payload.timestamp!,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isQueued: true,
      _queueId: queueItem.id,
    };

    setEntries(prev => [optimisticEntry, ...prev]);
    return optimisticEntry;
  }, [enqueue]);

  const confirmEntry = useCallback((id: string, payload: ConfirmPayload) => {
    // Optimistic update
    setEntries(prev =>
      prev.map(entry =>
        entry.id === id
          ? {
              ...entry,
              status: 'confirmed' as const,
              confirmedAt: new Date().toISOString(),
              _isQueued: true,
            }
          : entry
      )
    );

    // Enqueue
    enqueue('CONFIRM', id, {
      mood: payload.mood,
      note: payload.note,
      tags: payload.tags,
    } as JournalConfirmPayload);
  }, [enqueue]);

  const archiveEntry = useCallback((id: string, reason: string) => {
    // Optimistic update
    setEntries(prev =>
      prev.map(entry =>
        entry.id === id
          ? {
              ...entry,
              status: 'archived' as const,
              archivedAt: new Date().toISOString(),
              _isQueued: true,
            }
          : entry
      )
    );

    // Enqueue
    enqueue('ARCHIVE', id, { reason } as JournalArchiveRequest);
  }, [enqueue]);

  const deleteEntry = useCallback((id: string) => {
    // Optimistic update
    setEntries(prev => prev.filter(entry => entry.id !== id));

    // If it's a local-only entry that hasn't synced, just remove from queue
    if (id.startsWith('local-')) {
      const queueItem = queue.find(q => q.entryId === id);
      if (queueItem) {
        useJournalQueueStore.getState().dequeue(queueItem.id);
        return;
      }
    }

    // Enqueue delete for synced entries
    enqueue('DELETE', id);
  }, [enqueue, queue]);

  const restoreEntry = useCallback((id: string) => {
    // Optimistic update
    setEntries(prev =>
      prev.map(entry =>
        entry.id === id
          ? {
              ...entry,
              status: 'pending' as const,
              archivedAt: undefined,
              _isQueued: true,
            }
          : entry
      )
    );

    // Enqueue
    enqueue('RESTORE', id);
  }, [enqueue]);

  // ─────────────────────────────────────────────────────────────
  // Sync helpers
  // ─────────────────────────────────────────────────────────────

  const retrySync = useCallback(async () => {
    const synced = await processQueue();
    if (synced.length > 0) {
      // Refetch to get updated entries
      await fetchEntries();
    }
  }, [processQueue, fetchEntries]);

  // ─────────────────────────────────────────────────────────────
  // Computed values
  // ─────────────────────────────────────────────────────────────

  const syncState = getSyncState();
  
  const syncStatus: SyncStatus = useMemo(() => {
    if (isOffline()) return 'offline';
    if (isSyncing) return 'syncing';
    if (lastError) return 'error';
    if (queue.length > 0) return 'queued';
    return 'synced';
  }, [isSyncing, lastError, queue.length]);

  const pageState = useMemo(() => ({
    state,
    isLoading: state === 'loading',
    isReady: state === 'ready',
    isError: state === 'error',
    isEmpty: state === 'empty',
    setState,
  }), [state]);

  return {
    pageState,
    entries,
    setEntries,
    createEntry,
    confirmEntry,
    archiveEntry,
    deleteEntry,
    restoreEntry,
    syncState,
    syncStatus,
    queueCount: queue.length,
    refetch: fetchEntries,
    retrySync,
  };
}
