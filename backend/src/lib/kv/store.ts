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

let kvInstance: KVStore | null = null;

export function getKV(): KVStore {
  if (kvInstance) return kvInstance;

  const env = getEnv();

  // Vercel KV (legacy) or Redis via Upstash REST API
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    kvInstance = new VercelKVStore(env.KV_REST_API_URL, env.KV_REST_API_TOKEN);
  } else if (env.REDIS_URL) {
    // REDIS_URL set but no KV_* - use in-memory fallback (redis package not in deps)
    // Add optional redis dependency for native Redis support
    kvInstance = new MemoryStore();
  } else {
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
