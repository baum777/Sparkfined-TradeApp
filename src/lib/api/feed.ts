import { apiClient } from "@/services/api/client";
import type { FeedCard, UnifiedSignalsResponse, FeedFilter, FeedSort } from "@/types/feed";

const CACHE_PREFIX = "cache:feed:";

// Storage wrapper for offline persistence
function getCache<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

// BACKEND HOOK
export async function fetchOracleFeed(assetId: string): Promise<FeedCard[]> {
  const cacheKey = `${CACHE_PREFIX}oracle:${assetId}`;
  
  try {
    const data = await apiClient.get<FeedCard[]>(`/feed/oracle?asset=${encodeURIComponent(assetId)}`);
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    // Try returning cached data on error
    const cached = getCache<FeedCard[]>(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

// BACKEND HOOK
export async function fetchPulseFeed(assetId: string): Promise<FeedCard[]> {
  const cacheKey = `${CACHE_PREFIX}pulse:${assetId}`;
  
  try {
    const data = await apiClient.get<FeedCard[]>(`/feed/pulse?asset=${encodeURIComponent(assetId)}`);
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    const cached = getCache<FeedCard[]>(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

// BACKEND HOOK
export async function fetchDailyBias(): Promise<FeedCard | null> {
  const cacheKey = `${CACHE_PREFIX}dailyBias`;
  
  try {
    // Support both { card: FeedCard } and direct FeedCard response
    const payload = await apiClient.get<FeedCard | { card: FeedCard; asOf: string }>(`/market/daily-bias`);
    const data = 'card' in payload ? payload.card : payload;
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    const cached = getCache<FeedCard>(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

// BACKEND HOOK
export async function fetchUnifiedSignals(
  filter: FeedFilter = "all",
  sort: FeedSort = "impact"
): Promise<UnifiedSignalsResponse> {
  const cacheKey = `${CACHE_PREFIX}signals:unified:${filter}:${sort}`;
  
  try {
    const data = await apiClient.get<UnifiedSignalsResponse>(
      `/signals/unified?filter=${filter}&sort=${sort}`
    );
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    const cached = getCache<UnifiedSignalsResponse>(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

// Get cached data for stale-while-revalidate pattern
export function getCachedOracleFeed(assetId: string): FeedCard[] | null {
  return getCache<FeedCard[]>(`${CACHE_PREFIX}oracle:${assetId}`);
}

export function getCachedPulseFeed(assetId: string): FeedCard[] | null {
  return getCache<FeedCard[]>(`${CACHE_PREFIX}pulse:${assetId}`);
}

export function getCachedDailyBias(): FeedCard | null {
  return getCache<FeedCard>(`${CACHE_PREFIX}dailyBias`);
}

export function getCachedUnifiedSignals(filter: FeedFilter, sort: FeedSort): UnifiedSignalsResponse | null {
  return getCache<UnifiedSignalsResponse>(`${CACHE_PREFIX}signals:unified:${filter}:${sort}`);
}
