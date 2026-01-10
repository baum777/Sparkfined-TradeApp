/**
 * RSI Indicator
 * Calculates RSI-14 from price history
 * Note: This is a simplified implementation
 * In production, you'd need historical OHLC data
 */

export interface RSIData {
  rsi14: number | null;
}

/**
 * Calculate RSI-14
 * Requires at least 15 price points for RSI-14
 * Returns null if insufficient data
 */
export function calculateRSI14(prices: number[]): RSIData {
  if (prices.length < 15) {
    return { rsi14: null };
  }
  
  // Simple RSI calculation
  // In production, use proper OHLC data with proper period calculation
  const period = 14;
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains.push(change);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(change));
    }
  }
  
  // Calculate average gain and loss over period
  const recentGains = gains.slice(-period);
  const recentLosses = losses.slice(-period);
  
  const avgGain = recentGains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = recentLosses.reduce((a, b) => a + b, 0) / period;
  
  if (avgLoss === 0) {
    return { rsi14: 100 };
  }
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return { rsi14: Math.round(rsi * 100) / 100 };
}

/**
 * Calculate RSI from price data
 * This is a stub - in production, fetch historical OHLC data
 */
export async function getRSI14(symbolOrAddress: string): Promise<RSIData> {
  // TODO: Fetch historical price data and calculate RSI
  // For now, return null (insufficient data)
  return { rsi14: null };
}

