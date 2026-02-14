/**
 * Market Snapshot Service
 * Builds at-trade market snapshots with tier-gated data capture
 * Per BACKEND MAP section 1: market.snapshot.service.ts must also hard-gate fields (defense in depth)
 */

import { tierGte } from '../../config/tiers.js';
import { canIncludeMarket, canIncludeIndicators, canIncludeOrderPressure } from '../contextPack/gates.js';
import * as priceProvider from './providers/price.provider.js';
import * as volumeProvider from './providers/volume.provider.js';
import * as holdersProvider from './providers/holders.provider.js';
import * as liquidityProvider from './providers/liquidity.provider.js';
import * as rsiIndicator from './indicators/rsi.js';
import * as trendIndicator from './indicators/trend.js';
import type { MarketSnapshotAtTime, ResolvedTier } from '../contextPack/types.js';

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

/**
 * Build MarketSnapshotAtTime for ContextPack
 * Per BACKEND MAP section 1: buildMarketSnapshot({ mint, asOfISO, tier })
 * Defense in depth: gates.ts is checked in build.ts, but we also gate here
 */
export async function buildMarketSnapshot(params: {
  mint: string;
  asOfISO: string;
  tier: ResolvedTier;
}): Promise<MarketSnapshotAtTime | null> {
  const { mint, asOfISO, tier } = params;
  
  // Defense in depth: check gates
  if (!canIncludeMarket(tier)) {
    return null;
  }
  
  // Use existing buildAtTradeSnapshot
  const snapshot = await buildAtTradeSnapshot(tier, mint, asOfISO);
  
  const market: MarketSnapshotAtTime = {
    asOfISO,
  };
  
  // Standard tier: basic market data
  if (canIncludeMarket(tier)) {
    market.priceUsd = snapshot.priceUsd;
    market.marketCapUsd = snapshot.marketCapUsd;
    market.volume24hUsd = snapshot.volume24hUsd;
    market.holdersCount = snapshot.holdersCount;
    
    // Try to get liquidity if available
    try {
      const liquidityData = await liquidityProvider.fetchLiquidityData(mint);
      market.liquidityUsd = liquidityData.liquidityUsd;
    } catch {
      // Ignore if liquidity fetch fails
    }
  }
  
  // Pro tier: indicators
  if (canIncludeIndicators(tier)) {
    market.indicators = {
      rsi14: snapshot.rsi14 ?? undefined,
      trendState: mapTrendState(snapshot.trendState),
    };
  }
  
  // High tier: order pressure
  if (canIncludeOrderPressure(tier)) {
    const orderPressure = await buildOrderPressureData(mint);
    if (orderPressure.buySellImbalance !== undefined || 
        orderPressure.largeTxCount !== undefined ||
        orderPressure.avgTradeSizeDelta !== undefined) {
      market.orderPressure = {
        buySellImbalance: orderPressure.buySellImbalance,
        largeTxCount: orderPressure.largeTxCount,
        avgTradeSizeDelta: orderPressure.avgTradeSizeDelta,
      };
    }
  }
  
  return market;
}

/**
 * Map trend state to ContextPack format
 */
function mapTrendState(
  state?: 'bullish' | 'bearish' | 'neutral' | 'unknown'
): 'overbought' | 'neutral' | 'oversold' | undefined {
  if (!state) return undefined;
  if (state === 'bullish') return 'overbought';
  if (state === 'bearish') return 'oversold';
  if (state === 'neutral') return 'neutral';
  return undefined;
}

