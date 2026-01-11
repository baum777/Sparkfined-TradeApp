/**
 * Market Delta Service
 * Computes post-trade delta snapshots (+15m, +1h, +4h)
 * Only for tier >= pro
 * Per BACKEND MAP section 1: computeDeltaSnapshots({ mint, entryTimeISO, tier })
 */

import type { AtTradeMarketSnapshot } from './snapshot.service.js';
import type { ResolvedTier } from '../../config/tiers.js';
import { canIncludeDeltas } from '../contextPack/gates.js';
import * as priceProvider from './providers/price.provider.js';
import * as volumeProvider from './providers/volume.provider.js';
import { buildAtTradeSnapshot } from './snapshot.service.js';
import type { DeltaSnapshots } from '../contextPack/types.js';

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

/**
 * Compute DeltaSnapshots for ContextPack
 * Per BACKEND MAP section 1: computeDeltaSnapshots({ mint, entryTimeISO, tier })
 * Defense in depth: gates.ts is checked in build.ts, but we also gate here
 */
export async function computeDeltaSnapshots(params: {
  mint: string;
  entryTimeISO: string;
  tier: ResolvedTier;
}): Promise<DeltaSnapshots | null> {
  const { mint, entryTimeISO, tier } = params;
  
  // Defense in depth: check gates
  if (!canIncludeDeltas(tier)) {
    return null;
  }
  
  // Get at-trade snapshot for comparison
  const atTradeSnapshot = await buildAtTradeSnapshot(tier, mint, entryTimeISO);
  
  if (!atTradeSnapshot.priceUsd || atTradeSnapshot.priceUsd === 0) {
    return null;
  }
  
  // Compute deltas for fixed windows
  const anchorTime = new Date(entryTimeISO);
  const now = new Date();
  
  const windowConfigs: Array<{ label: '+15m' | '+1h' | '+4h'; minutes: number }> = [
    { label: '+15m', minutes: 15 },
    { label: '+1h', minutes: 60 },
    { label: '+4h', minutes: 240 },
  ];
  
  const deltaWindows: DeltaSnapshots['windows'] = [];
  
  for (const config of windowConfigs) {
    const targetTime = new Date(anchorTime.getTime() + config.minutes * 60 * 1000);
    
    // Only compute if enough time has passed
    if (now >= targetTime) {
      const delta = await computeDeltaSnapshot(
        mint,
        atTradeSnapshot,
        config.label,
        targetTime.toISOString()
      );
      
      if (delta) {
        // Get current market state for the window
        const currentSnapshot = await buildAtTradeSnapshot(tier, mint, targetTime.toISOString());
        
        deltaWindows.push({
          label: config.label,
          asOfISO: targetTime.toISOString(),
          priceUsd: currentSnapshot.priceUsd,
          priceDeltaPct: delta.priceDeltaPercent,
          volume24hDeltaPct: currentSnapshot.volume24hUsd && atTradeSnapshot.volume24hUsd
            ? ((currentSnapshot.volume24hUsd - atTradeSnapshot.volume24hUsd) / atTradeSnapshot.volume24hUsd) * 100
            : undefined,
          holdersDelta: currentSnapshot.holdersCount && atTradeSnapshot.holdersCount
            ? currentSnapshot.holdersCount - atTradeSnapshot.holdersCount
            : undefined,
          rsi14: currentSnapshot.rsi14 ?? undefined,
          marketCapUsd: currentSnapshot.marketCapUsd,
        });
      }
    }
  }
  
  if (deltaWindows.length === 0) {
    return null;
  }
  
  return {
    windows: deltaWindows,
    note: 'after-trade context only',
  };
}

