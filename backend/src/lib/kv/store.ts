import { createClient, VercelKV } from '@vercel/kv';
import { getEnv } from '../../config/env.js';

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  incr(key: string, value?: number, ttlSeconds?: number): Promise<number>;
  exists(key: string): Promise<boolean>;
  ping?(): Promise<string>; // Optional health check
}

class MemoryStore implements KVStore {
  private store = new Map<string, { value: any; expiresAt: number | null }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async incr(key: string, value: number = 1, ttlSeconds?: number): Promise<number> {
    const entry = await this.get<number>(key);
    const newValue = (entry || 0) + value;
    await this.set(key, newValue, ttlSeconds);
    return newValue;
  }

  async exists(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}

class VercelKVStore implements KVStore {
  private client: VercelKV;

  constructor(url: string, token: string) {
    this.client = createClient({
      url,
      token,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key: string): Promise<boolean> {
    const count = await this.client.del(key);
    return count > 0;
  }

  async incr(key: string, value: number = 1, ttlSeconds?: number): Promise<number> {
    const result = await this.client.incrby(key, value);
    if (ttlSeconds && result === value) {
      await this.client.expire(key, ttlSeconds);
    }
    return result;
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}

// Railway Redis client (using ioredis or redis package)
class RedisStore implements KVStore {
  private client: any; // Redis client instance
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;

    // Dynamic import to avoid hard dependency
    const { createClient } = await import('redis');
    this.client = createClient({ url: this.url });
    await this.client.connect();
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    const value = await client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<boolean> {
    const client = await this.getClient();
    const count = await client.del(key);
    return count > 0;
  }

  async incr(key: string, value: number = 1, ttlSeconds?: number): Promise<number> {
    const client = await this.getClient();
    const result = await client.incrBy(key, value);
    if (ttlSeconds && result === value) {
      await client.expire(key, ttlSeconds);
    }
    return result;
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.getClient();
    const count = await client.exists(key);
    return count > 0;
  }

  async ping(): Promise<string> {
    const client = await this.getClient();
    return client.ping();
  }
}

let kvInstance: KVStore | null = null;

export function getKV(): KVStore {
  if (kvInstance) return kvInstance;

  const env = getEnv();

  // Priority 1: Railway Redis (REDIS_URL)
  if (env.REDIS_URL) {
    try {
      kvInstance = new RedisStore(env.REDIS_URL);
      return kvInstance;
    } catch (error) {
      console.warn('Redis initialization failed, falling back to Vercel KV or Memory', error);
    }
  }

  // Priority 2: Vercel KV (legacy)
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    kvInstance = new VercelKVStore(env.KV_REST_API_URL, env.KV_REST_API_TOKEN);
  } else {
    // Fallback: In-memory (development, no persistence)
    kvInstance = new MemoryStore();
  }

  return kvInstance;
}

// Export for health checks
export async function pingKV(): Promise<boolean> {
  try {
    const kv = getKV();
    if (kv.ping) {
      await kv.ping();
    }
    return true;
  } catch {
    return false;
  }
}
