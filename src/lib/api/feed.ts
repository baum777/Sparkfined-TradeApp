import { apiClient } from "@/services/api/client";
import type { FeedCard, UnifiedSignalsResponse, FeedFilter, FeedSort } from "@/types/feed";

const CACHE_PREFIX = "cache:feed:";

function mapPulseImpact(snapshot: any): FeedCard["impact"] {
  const sev = typeof snapshot?.severity === "string" ? snapshot.severity.toUpperCase() : "";
  if (sev === "CRITICAL") return "critical";
  if (sev === "HIGH") return "high";
  if (sev === "MEDIUM") return "medium";
  if (sev === "LOW") return "low";

  const score = typeof snapshot?.score === "number" ? snapshot.score : 0;
  const abs = Math.abs(score);
  if (abs >= 80) return "critical";
  if (abs >= 60) return "high";
  if (abs >= 35) return "medium";
  return "low";
}

function mapPulseCard(assetId: string, pulsePayload: any): FeedCard[] {
  const snapshot = pulsePayload?.snapshot ?? null;
  if (!snapshot) return [];

  const ts = typeof snapshot.ts === "number" ? snapshot.ts : Date.now();
  const ageSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));

  const freshness: FeedCard["freshness"] = {
    status: ageSec < 5 * 60 ? "fresh" : ageSec < 30 * 60 ? "soft_stale" : "hard_stale",
    ageSec,
  };

  const titleBase =
    pulsePayload?.assetResolved?.symbol ||
    (typeof pulsePayload?.assetResolved?.address === "string"
      ? pulsePayload.assetResolved.address.slice(0, 6)
      : assetId);

  return [
    {
      id: `pulse:${titleBase}:${ts}`,
      kind: "pulse",
      scope: "market",
      title: `Pulse: ${titleBase}`,
      why: snapshot.one_liner || snapshot.sentiment_term || "Pulse snapshot",
      impact: mapPulseImpact(snapshot),
      asOf: new Date(ts).toISOString(),
      freshness,
      confidence: typeof snapshot.confidence === "number" ? snapshot.confidence : 0.5,
      assetId,
      facts: [
        { label: "Score", value: typeof snapshot.score === "number" ? String(snapshot.score) : "—" },
        { label: "Label", value: snapshot.label ? String(snapshot.label) : "—" },
        { label: "CTA", value: snapshot.cta ? String(snapshot.cta) : "—" },
      ],
    },
  ];
}

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
    const payload = await apiClient.get<any>(`/feed/pulse?asset=${encodeURIComponent(assetId)}`);
    const data = mapPulseCard(assetId, payload);
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
  assetId: string,
  filter?: FeedFilter,
  sort?: FeedSort
): Promise<UnifiedSignalsResponse> {
  const asset = assetId?.trim();
  if (!asset) {
    throw new Error("Missing required asset for unified signals");
  }

  const params = new URLSearchParams();
  params.set("asset", asset);
  if (filter && filter !== "all") params.set("filter", filter);
  if (sort && sort !== "impact") params.set("sort", sort);

  const cacheKey = `${CACHE_PREFIX}signals:unified:${params.toString()}`;

  const data = await apiClient.get<UnifiedSignalsResponse>(`/signals/unified?${params.toString()}`);
  setCache(cacheKey, data);
  return data;
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

export function getCachedUnifiedSignals(
  assetId: string,
  filter?: FeedFilter,
  sort?: FeedSort
): UnifiedSignalsResponse | null {
  const asset = assetId?.trim();
  if (!asset) return null;

  const params = new URLSearchParams();
  params.set("asset", asset);
  if (filter && filter !== "all") params.set("filter", filter);
  if (sort && sort !== "impact") params.set("sort", sort);

  return getCache<UnifiedSignalsResponse>(`${CACHE_PREFIX}signals:unified:${params.toString()}`);
}
