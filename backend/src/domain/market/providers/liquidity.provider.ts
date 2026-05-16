/**
 * Liquidity Provider
 * Fetches liquidity data
 */

import { getEnv } from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';
import { dexTokenResponseSchema } from './schemas.js';

export interface LiquidityData {
  liquidityUsd: number;
}

const DEXPAPRIKA_BASE = 'https://api.dexpaprika.com';

export async function fetchLiquidityData(
  symbolOrAddress: string,
  timeoutMs = 2000
): Promise<LiquidityData> {
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
      return { liquidityUsd: 0 };
    }
    
    const parsed = dexTokenResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn('Liquidity provider response validation failed', { symbolOrAddress });
      return { liquidityUsd: 0 };
    }
    const data = parsed.data;
    
    return {
      liquidityUsd: data.summary?.liquidity_usd ?? 0,
    };
  } catch (err) {
    logger.warn('Liquidity fetch failed', { symbolOrAddress, error: String(err) });
    return { liquidityUsd: 0 };
  }
}
