/**
 * Pulse Feed API Client (Theme Group 6)
 *
 * Canonical endpoint:
 * - GET /api/feed/pulse?asset=<ticker|address>
 *
 * NOTE: History is a stub for now; the response shape is future-proof.
 */

import type { GrokSentimentSnapshot, PulseHistoryPoint } from '../../../shared/contracts/grokPulse';
import { apiClient } from '@/services/api/client';

export interface PulseFeedResponse {
  assetResolved: {
    input: string;
    kind: 'ticker' | 'address';
    address: string;
    symbol?: string;
  };
  snapshot: GrokSentimentSnapshot | null;
  history: PulseHistoryPoint[];
  updatedAt: string;
}

export async function fetchPulseFeed(asset: string): Promise<PulseFeedResponse> {
  return apiClient.get<PulseFeedResponse>(`/feed/pulse?asset=${encodeURIComponent(asset)}`);
}

export async function fetchGrokSnapshot(asset: string): Promise<GrokSentimentSnapshot | null> {
  const payload = await fetchPulseFeed(asset);
  return payload.snapshot ?? null;
}

export async function fetchGrokHistory(asset: string): Promise<PulseHistoryPoint[]> {
  const payload = await fetchPulseFeed(asset);
  return payload.history ?? [];
}
