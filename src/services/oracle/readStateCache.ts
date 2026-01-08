import type { StorageLike } from './readStateQueue';

const STORAGE_KEY = 'sparkfined_oracle_read_cache_v1';

function safeParseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

export function loadOracleReadCache(storage: StorageLike): Record<string, boolean> {
  const raw = safeParseJson(storage.getItem(STORAGE_KEY));
  if (!isRecord(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export function saveOracleReadCache(storage: StorageLike, cache: Record<string, boolean>): void {
  const keys = Object.keys(cache);
  if (!keys.length) {
    storage.removeItem(STORAGE_KEY);
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function updateOracleReadCache(storage: StorageLike, updates: Record<string, boolean>): void {
  const cache = loadOracleReadCache(storage);
  for (const [id, isRead] of Object.entries(updates)) {
    cache[id] = isRead;
  }
  saveOracleReadCache(storage, cache);
}

