import { getPulseSnapshot } from './kv.js';
import type { GrokSentimentSnapshot } from './types.js';
import type { PulseAssetResolved } from './assetResolver.js';

export interface PulseFeedSnapshotResponse {
  assetResolved: PulseAssetResolved;
  snapshot: GrokSentimentSnapshot | null;
  history: unknown[]; // stub for now (Theme Group 6: HISTORY later)
  updatedAt: string;
}

export async function getPulseFeedSnapshot(resolved: PulseAssetResolved): Promise<PulseFeedSnapshotResponse> {
  const snapshot = await getPulseSnapshot(resolved.address);
  return {
    assetResolved: resolved,
    snapshot: snapshot ?? null,
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

