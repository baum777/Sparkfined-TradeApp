/**
 * In-Memory KV Store
 * Fallback for development/testing when Vercel KV is unavailable
 * WARNING: Not suitable for production - data lost on cold start
 */

import type { KVStore } from './types';

interface MemoryEntry {
  value: unknown;
  expiresAt: number | null;
}

// Global memory store (persists across function invocations in same instance)
const memoryStore = new Map<string, MemoryEntry>();

function isExpired(entry: MemoryEntry): boolean {
  if (entry.expiresAt === null) return false;
  return Date.now() > entry.expiresAt;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt !== null && now > entry.expiresAt) {
      memoryStore.delete(key);
    }
  }
}

// Run cleanup periodically (lazy, on access)
let lastCleanup = Date.now();
function maybeCleanup(): void {
  const now = Date.now();
  // Cleanup every 60 seconds
  if (now - lastCleanup > 60000) {
    cleanupExpired();
    lastCleanup = now;
  }
}

export const memoryKVStore: KVStore = {
  async get<T>(key: string): Promise<T | null> {
    maybeCleanup();
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value as T;
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    memoryStore.set(key, { value, expiresAt });
  },

  async delete(key: string): Promise<boolean> {
    return memoryStore.delete(key);
  },

  async getByPrefix<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    maybeCleanup();
    const results: Array<{ key: string; value: T }> = [];
    
    for (const [key, entry] of memoryStore.entries()) {
      if (key.startsWith(prefix) && !isExpired(entry)) {
        results.push({ key, value: entry.value as T });
      }
    }
    
    return results;
  },

  async exists(key: string): Promise<boolean> {
    maybeCleanup();
    const entry = memoryStore.get(key);
    if (!entry) return false;
    if (isExpired(entry)) {
      memoryStore.delete(key);
      return false;
    }
    return true;
  },

  async incr(key: string, amount: number = 1, ttlSeconds?: number): Promise<number> {
    maybeCleanup();
    const entry = memoryStore.get(key);
    let value = 0;
    
    if (entry && !isExpired(entry)) {
      value = (entry.value as number) || 0;
    }
    
    value += amount;
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    memoryStore.set(key, { value, expiresAt });
    
    return value;
  },

  async rpush(key: string, ...values: string[]): Promise<number> {
    maybeCleanup();
    const entry = memoryStore.get(key);
    let list: string[] = [];
    
    if (entry && !isExpired(entry)) {
      if (Array.isArray(entry.value)) {
        list = entry.value as string[];
      } else {
        // Key exists but not a list - Vercel KV would throw, here we reset or throw
        throw new Error('Key holds non-list value');
      }
    }
    
    list.push(...values);
    // Lists don't expire by default unless set? Vercel KV behavior.
    // We keep expiry if set, or null.
    memoryStore.set(key, { value: list, expiresAt: entry?.expiresAt || null });
    
    return list.length;
  },

  async lpop(key: string): Promise<string | null> {
    maybeCleanup();
    const entry = memoryStore.get(key);
    
    if (!entry || isExpired(entry)) {
      if (entry) memoryStore.delete(key);
      return null;
    }
    
    if (!Array.isArray(entry.value)) {
      throw new Error('Key holds non-list value');
    }
    
    const list = entry.value as string[];
    if (list.length === 0) return null;
    
    const item = list.shift();
    // Update store
    memoryStore.set(key, { value: list, expiresAt: entry.expiresAt });
    
    return item || null;
  },
};


// Export for testing
export function clearMemoryStore(): void {
  memoryStore.clear();
}

export function getMemoryStoreSize(): number {
  return memoryStore.size;
}
