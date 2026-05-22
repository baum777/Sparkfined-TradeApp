import { createClient, type RedisClientType } from 'redis';
import { getEnv } from '../../config/env.js';

interface RateLimitCounterResult {
  count: number;
  resetAt: number;
}

export interface RateLimitCounterStore {
  incr(baseKey: string, windowMs: number): Promise<RateLimitCounterResult>;
  resetForTests?(): void;
}

type MemoryEntry = {
  count: number;
  resetAt: number;
};

class MemoryRateLimitCounterStore implements RateLimitCounterStore {
  private store = new Map<string, MemoryEntry>();

  async incr(baseKey: string, windowMs: number): Promise<RateLimitCounterResult> {
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const resetAt = (bucket + 1) * windowMs;
    const key = `${baseKey}:${bucket}`;

    const existing = this.store.get(key);
    if (!existing || existing.resetAt <= now) {
      const created = { count: 1, resetAt };
      this.store.set(key, created);
      return created;
    }

    existing.count += 1;
    return existing;
  }

  resetForTests(): void {
    this.store.clear();
  }
}

class RedisRateLimitCounterStore implements RateLimitCounterStore {
  private readonly client: RedisClientType;
  private connectPromise: Promise<void> | null = null;

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.isOpen) return;
    if (this.connectPromise) {
      await this.connectPromise;
      return;
    }

    this.connectPromise = this.client.connect().then(() => undefined);
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async incr(baseKey: string, windowMs: number): Promise<RateLimitCounterResult> {
    await this.ensureConnected();

    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const resetAt = (bucket + 1) * windowMs;
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const ttlSeconds = windowSeconds + 2;
    const key = `${baseKey}:${bucket}`;

    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }

    return { count, resetAt };
  }
}

let counterStore: RateLimitCounterStore | null = null;

function createCounterStore(): RateLimitCounterStore {
  const env = getEnv();
  const requested = env.RATE_LIMIT_STORE;

  if (requested === 'redis') {
    if (!env.REDIS_URL?.trim()) {
      throw new Error('REDIS_URL is required when RATE_LIMIT_STORE=redis');
    }
    return new RedisRateLimitCounterStore(env.REDIS_URL);
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('In-memory rate limiting is not allowed in production');
  }

  return new MemoryRateLimitCounterStore();
}

export function getRateLimitCounterStore(): RateLimitCounterStore {
  if (!counterStore) {
    counterStore = createCounterStore();
  }
  return counterStore;
}

export function resetRateLimitCounterStoreForTesting(): void {
  if (counterStore?.resetForTests) {
    counterStore.resetForTests();
  }
  counterStore = null;
}
