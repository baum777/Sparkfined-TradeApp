/**
 * Trend Indicator
 * Determines trend state from price movement
 */

export type TrendState = 'bullish' | 'bearish' | 'neutral' | 'unknown';

export interface TrendData {
  trendState: TrendState;
}

/**
 * Determine trend state from price history
 * Simple implementation: compare recent prices to older prices
 */
export function calculateTrend(prices: number[]): TrendData {
  if (prices.length < 2) {
    return { trendState: 'unknown' };
  }
  
  // Compare last 5 prices to previous 5 prices
  const recent = prices.slice(-5);
  const previous = prices.slice(-10, -5);
  
  if (recent.length === 0 || previous.length === 0) {
    return { trendState: 'unknown' };
  }
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
  
  const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;
  
  if (changePercent > 2) {
    return { trendState: 'bullish' };
  } else if (changePercent < -2) {
    return { trendState: 'bearish' };
  } else {
    return { trendState: 'neutral' };
  }
}

/**
 * Get trend state for a token
 * This is a stub - in production, fetch historical price data
 */
export async function getTrendState(symbolOrAddress: string): Promise<TrendData> {
  void symbolOrAddress;
  // TODO: Fetch historical price data and calculate trend
  // For now, return unknown
  return { trendState: 'unknown' };
}

