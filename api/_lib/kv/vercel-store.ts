/**
 * Vercel KV Store Implementation
 * Uses @vercel/kv for Redis-backed storage
 */

import type { KVStore } from './types';
import { getEnv } from '../env';
import { logger } from '../logger';

// Lazy-loaded Vercel KV client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let kvClient: any = null;

async function getKVClient() {
  if (kvClient) return kvClient;

  const env = getEnv();
  
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    throw new Error('Vercel KV not configured');
  }

  // Dynamic import to avoid loading in environments without the package
  try {
    const { kv } = await import('@vercel/kv');
    kvClient = kv;
    return kvClient;
  } catch (error) {
    logger.error('Failed to load @vercel/kv', { error: String(error) });
    throw new Error('Vercel KV package not available');
  }
}

export const vercelKVStore: KVStore = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getKVClient();
      const value = await client.get(key) as T | null;
      return value;
    } catch (error) {
      logger.error('KV get failed', { key, error: String(error) });
      return null;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const client = await getKVClient();
      if (ttlSeconds) {
        await client.set(key, value, { ex: ttlSeconds });
      } else {
        await client.set(key, value);
      }
    } catch (error) {
      logger.error('KV set failed', { key, error: String(error) });
      throw error;
    }
  },

  async delete(key: string): Promise<boolean> {
    try {
      const client = await getKVClient();
      const result = await client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('KV delete failed', { key, error: String(error) });
      return false;
    }
  },

  async getByPrefix<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    try {
      const client = await getKVClient();
      const keys = await client.keys(`${prefix}*`) as string[];
      const results: Array<{ key: string; value: T }> = [];
      
      for (const key of keys) {
        const value = await client.get(key) as T | null;
        if (value !== null) {
          results.push({ key, value });
        }
      }
      
      return results;
    } catch (error) {
      logger.error('KV getByPrefix failed', { prefix, error: String(error) });
      return [];
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const client = await getKVClient();
      const result = await client.exists(key) as number;
      return result > 0;
    } catch (error) {
      logger.error('KV exists failed', { key, error: String(error) });
      return false;
    }
  },

  async incr(key: string, amount: number = 1, ttlSeconds?: number): Promise<number> {
    try {
      const client = await getKVClient();
      // Use incrby for arbitrary amount, which is safe for 1 as well
      const value = await client.incrby(key, amount) as number;
      
      // If ttl provided and this is arguably a new key (value == amount), set expire
      if (ttlSeconds && value === amount) {
        await client.expire(key, ttlSeconds);
      }
      return value;
    } catch (error) {
      logger.error('KV incr failed', { key, error: String(error) });
      throw error;
    }
  },

  async rpush(key: string, ...values: string[]): Promise<number> {
    try {
      const client = await getKVClient();
      return await client.rpush(key, ...values) as number;
    } catch (error) {
      logger.error('KV rpush failed', { key, error: String(error) });
      throw error;
    }
  },

  async lpop(key: string): Promise<string | null> {
    try {
      const client = await getKVClient();
      return await client.lpop(key) as string | null;
    } catch (error) {
      logger.error('KV lpop failed', { key, error: String(error) });
      return null;
    }
  },
};

