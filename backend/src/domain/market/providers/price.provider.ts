/**
 * Price Provider
 * Fetches current price data for tokens
 */

import { getEnv } from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';

export interface PriceData {
  priceUsd: number;
  marketCapUsd: number;
}

const DEXPAPRIKA_BASE = 'https://api.dexpaprika.com';

export async function fetchPriceData(
  symbolOrAddress: string,
  timeoutMs = 2000
): Promise<PriceData> {
  const env = getEnv();
  const url = `${DEXPAPRIKA_BASE}/networks/solana/tokens/${symbolOrAddress}`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: env.DEXPAPRIKA_API_KEY ? {
        'Authorization': `Bearer ${env.DEXPAPRIKA_API_KEY}`
      } : {}
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) {
      if (res.status === 429) {
        logger.warn('DexPaprika rate limited', { symbolOrAddress });
      }
      return { priceUsd: 0, marketCapUsd: 0 };
    }
    
    const data = await res.json() as any;
    
    return {
      priceUsd: data.summary?.price_usd ?? 0,
      marketCapUsd: data.summary?.fdv ?? 0, // FDV as market cap proxy
    };
  } catch (err) {
    logger.warn('Price fetch failed', { symbolOrAddress, error: String(err) });
    return { priceUsd: 0, marketCapUsd: 0 };
  }
}

