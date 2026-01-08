/**
 * Grok Pulse API Client
 * Fetches sentiment snapshot, history, and last-run metadata
 */

import type {
  GrokSentimentSnapshot,
  PulseHistoryPoint,
  PulseMetaLastRun,
} from '../../../shared/contracts/grokPulse';
import { apiClient } from '@/services/api/client';

/**
 * Fetch sentiment snapshot for a token address
 */
export async function fetchGrokSnapshot(address: string): Promise<GrokSentimentSnapshot | null> {
  const payload = await apiClient.get<{ snapshot: GrokSentimentSnapshot }>(
    `/grok-pulse/snapshot/${encodeURIComponent(address)}`
  );
  return payload.snapshot;
}

/**
 * Fetch score history for sparkline visualization
 */
export async function fetchGrokHistory(address: string): Promise<PulseHistoryPoint[]> {
  const payload = await apiClient.get<{ history: PulseHistoryPoint[] }>(
    `/grok-pulse/history/${encodeURIComponent(address)}`
  );
  return payload.history;
}

/**
 * Fetch last run metadata
 */
export async function fetchGrokLastRun(): Promise<PulseMetaLastRun | null> {
  const payload = await apiClient.get<{ lastRun: PulseMetaLastRun | null }>(`/grok-pulse/meta/last-run`);
  return payload.lastRun;
}
