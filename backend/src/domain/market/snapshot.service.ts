/**
 * Market Snapshot Service
 * Builds at-trade market snapshots with tier-gated data capture
 */

import type { ResolvedTier } from '../../config/tiers.js';
import { tierGte } from '../../config/tiers.js';
import * as priceProvider from './providers/price.provider.js';
import * as volumeProvider from './providers/volume.provider.js';
import * as holdersProvider from './providers/holders.provider.js';
import * as liquidityProvider from './providers/liquidity.provider.js';
import * as rsiIndicator from './indicators/rsi.js';
import * as trendIndicator from './indicators/trend.js';

export interface AtTradeMarketSnapshot {
  capturedAt: string; // ISO timestamp
  priceUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  holdersCount?: number;
  rsi14?: number | null;
  trendState?: 'bullish' | 'bearish' | 'neutral' | 'unknown';
}

export interface OrderPressureData {
  buySellImbalance?: number;
  largeTxCount?: number;
  avgTradeSizeDelta?: number;
}

/**
 * Build at-trade market snapshot based on tier
 * 
 * Tier >= standard: price, mcap, volume, holders
 * Tier >= pro: + RSI, trend state
 * Tier >= high: + order pressure (if enabled)
 */
export async function buildAtTradeSnapshot(
  tier: ResolvedTier,
  symbolOrAddress: string,
  capturedAt: string
): Promise<AtTradeMarketSnapshot> {
  const snapshot: AtTradeMarketSnapshot = {
    capturedAt,
  };
  
  // Tier >= standard: capture basic market data
  if (tierGte(tier, 'standard')) {
    const [priceData, volumeData, holdersData] = await Promise.all([
      priceProvider.fetchPriceData(symbolOrAddress),
      volumeProvider.fetchVolumeData(symbolOrAddress),
      holdersProvider.fetchHoldersData(symbolOrAddress),
    ]);
    
    snapshot.priceUsd = priceData.priceUsd;
    snapshot.marketCapUsd = priceData.marketCapUsd;
    snapshot.volume24hUsd = volumeData.volume24hUsd;
    snapshot.holdersCount = holdersData.holdersCount;
  }
  
  // Tier >= pro: capture indicators
  if (tierGte(tier, 'pro')) {
    const [rsiData, trendData] = await Promise.all([
      rsiIndicator.getRSI14(symbolOrAddress),
      trendIndicator.getTrendState(symbolOrAddress),
    ]);
    
    snapshot.rsi14 = rsiData.rsi14;
    snapshot.trendState = trendData.trendState;
  }
  
  // Tier < standard: DO NOT persist price/market data
  // Return empty snapshot (only capturedAt)
  
  return snapshot;
}

/**
 * Build order pressure data (high tier only)
 */
export async function buildOrderPressureData(
  symbolOrAddress: string
): Promise<OrderPressureData> {
  // TODO: Implement order pressure calculation
  // This requires analyzing recent transaction data
  // For now, return empty data
  return {};
}

