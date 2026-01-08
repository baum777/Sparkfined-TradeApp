import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Alert } from '@/components/alerts/types';
import type { ReasoningCacheRow } from '@/services/reasoning/cache';
import type { JournalEntryV1, JournalQueueItem } from '@/services/journal/types';

interface TradeAppDB extends DBSchema {
  alerts: {
    key: string;
    value: Alert;
    indexes: { 'by-status': string; 'by-created': string };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: 'ALERT' | 'JOURNAL';
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      payload: any;
      timestamp: number;
    };
  };
  reasoning: {
    key: string;
    value: ReasoningCacheRow;
    indexes: { 'by-type': string; 'by-updated': string };
  };
  // New stores for journal API integration
  journalCache: {
    key: string;
    value: JournalEntryV1;
    indexes: { 'by-status': string; 'by-updated': string };
  };
  journalQueue: {
    key: string;
    value: JournalQueueItem;
    indexes: { 'by-created': number };
  };
}

const DB_NAME = 'tradeapp-db';
const DB_VERSION = 3; // Bump version for new stores

let dbPromise: Promise<IDBPDatabase<TradeAppDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TradeAppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Alerts Store
        if (!db.objectStoreNames.contains('alerts')) {
          const store = db.createObjectStore('alerts', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-created', 'createdAt');
        }

        // Sync Queue (for offline actions - legacy)
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }

        // Reasoning Cache
        if (!db.objectStoreNames.contains('reasoning')) {
          const store = db.createObjectStore('reasoning', { keyPath: 'key' });
          store.createIndex('by-type', 'type');
          store.createIndex('by-updated', 'updatedAt');
        }

        // Journal Cache (API entries) - v3+
        if (!db.objectStoreNames.contains('journalCache')) {
          const store = db.createObjectStore('journalCache', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-updated', 'updatedAt');
        }

        // Journal Queue (offline mutations) - v3+
        if (!db.objectStoreNames.contains('journalQueue')) {
          const store = db.createObjectStore('journalQueue', { keyPath: 'id' });
          store.createIndex('by-created', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export const dbService = {
  async getAllAlerts(): Promise<Alert[]> {
    const db = await getDB();
    return db.getAll('alerts');
  },

  async saveAlert(alert: Alert): Promise<void> {
    const db = await getDB();
    await db.put('alerts', alert);
  },

  async deleteAlert(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('alerts', id);
  },

  // Sync Queue methods (legacy)
  async addToSyncQueue(item: any): Promise<void> {
    const db = await getDB();
    await db.put('syncQueue', item);
  },

  async getSyncQueue(): Promise<any[]> {
    const db = await getDB();
    return db.getAll('syncQueue');
  },

  async removeFromSyncQueue(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('syncQueue', id);
  },

  // ─────────────────────────────────────────────────────────────
  // Reasoning Cache methods
  // ─────────────────────────────────────────────────────────────

  async getReasoning(key: string): Promise<ReasoningCacheRow | null> {
    const db = await getDB();
    return (await db.get('reasoning', key)) ?? null;
  },

  async saveReasoning(row: ReasoningCacheRow): Promise<void> {
    const db = await getDB();
    await db.put('reasoning', row);
  },

  async deleteReasoning(key: string): Promise<void> {
    const db = await getDB();
    await db.delete('reasoning', key);
  },

  // ─────────────────────────────────────────────────────────────
  // Journal Cache (API entries)
  // ─────────────────────────────────────────────────────────────

  async getJournalCache(): Promise<JournalEntryV1[]> {
    const db = await getDB();
    return db.getAll('journalCache');
  },

  async getJournalCacheEntry(id: string): Promise<JournalEntryV1 | undefined> {
    const db = await getDB();
    return db.get('journalCache', id);
  },

  async saveJournalCacheEntry(entry: JournalEntryV1): Promise<void> {
    const db = await getDB();
    await db.put('journalCache', entry);
  },

  async saveJournalCacheBulk(entries: JournalEntryV1[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('journalCache', 'readwrite');
    await Promise.all([
      ...entries.map(entry => tx.store.put(entry)),
      tx.done,
    ]);
  },

  async deleteJournalCacheEntry(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('journalCache', id);
  },

  async clearJournalCache(): Promise<void> {
    const db = await getDB();
    await db.clear('journalCache');
  },

  // ─────────────────────────────────────────────────────────────
  // Journal Queue (offline mutations)
  // ─────────────────────────────────────────────────────────────

  async getJournalQueue(): Promise<JournalQueueItem[]> {
    const db = await getDB();
    return db.getAllFromIndex('journalQueue', 'by-created');
  },

  async addJournalQueueItem(item: JournalQueueItem): Promise<void> {
    const db = await getDB();
    await db.put('journalQueue', item);
  },

  async updateJournalQueueItem(item: JournalQueueItem): Promise<void> {
    const db = await getDB();
    await db.put('journalQueue', item);
  },

  async removeJournalQueueItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('journalQueue', id);
  },

  async clearJournalQueue(): Promise<void> {
    const db = await getDB();
    await db.clear('journalQueue');
  },
};

