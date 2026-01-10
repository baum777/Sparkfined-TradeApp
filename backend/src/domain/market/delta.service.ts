/**
 * Market Delta Service
 * Computes post-trade delta snapshots (+15m, +1h, +4h)
 * Only for tier >= pro
 */

import type { AtTradeMarketSnapshot } from './snapshot.service.js';
import * as priceProvider from './providers/price.provider.js';
import * as volumeProvider from './providers/volume.provider.js';

export type DeltaWindow = '+15m' | '+1h' | '+4h';

export interface DeltaSnapshot {
  window: DeltaWindow;
  capturedAt: string; // ISO timestamp
  priceDeltaUsd: number; // Change from at-trade price
  priceDeltaPercent: number;
  volumeDelta24hUsd: number; // Change in 24h volume
}

/**
 * Compute delta snapshot for a specific window
 * Compares current market state to at-trade snapshot
 */
export async function computeDeltaSnapshot(
  symbolOrAddress: string,
  atTradeSnapshot: AtTradeMarketSnapshot,
  window: DeltaWindow,
  capturedAt: string
): Promise<DeltaSnapshot | null> {
  if (!atTradeSnapshot.priceUsd || atTradeSnapshot.priceUsd === 0) {
    // Cannot compute delta without at-trade price
    return null;
  }
  
  const [currentPrice, currentVolume] = await Promise.all([
    priceProvider.fetchPriceData(symbolOrAddress),
    volumeProvider.fetchVolumeData(symbolOrAddress),
  ]);
  
  const priceDeltaUsd = currentPrice.priceUsd - atTradeSnapshot.priceUsd;
  const priceDeltaPercent = (priceDeltaUsd / atTradeSnapshot.priceUsd) * 100;
  
  const volumeDelta24hUsd = currentVolume.volume24hUsd - (atTradeSnapshot.volume24hUsd ?? 0);
  
  return {
    window,
    capturedAt,
    priceDeltaUsd,
    priceDeltaPercent: Math.round(priceDeltaPercent * 100) / 100,
    volumeDelta24hUsd,
  };
}

/**
 * Compute all delta snapshots for an entry
 * Returns snapshots for +15m, +1h, +4h windows
 */
export async function computeAllDeltaSnapshots(
  symbolOrAddress: string,
  atTradeSnapshot: AtTradeMarketSnapshot,
  tradeTimestamp: string
): Promise<Record<DeltaWindow, DeltaSnapshot | null>> {
  const now = new Date();
  const tradeTime = new Date(tradeTimestamp);
  
  const windows: DeltaWindow[] = ['+15m', '+1h', '+4h'];
  const results: Record<DeltaWindow, DeltaSnapshot | null> = {
    '+15m': null,
    '+1h': null,
    '+4h': null,
  };
  
  for (const window of windows) {
    const minutes = window === '+15m' ? 15 : window === '+1h' ? 60 : 240;
    const targetTime = new Date(tradeTime.getTime() + minutes * 60 * 1000);
    
    // Only compute if enough time has passed
    if (now >= targetTime) {
      const snapshot = await computeDeltaSnapshot(
        symbolOrAddress,
        atTradeSnapshot,
        window,
        targetTime.toISOString()
      );
      results[window] = snapshot;
    }
  }
  
  return results;
}

