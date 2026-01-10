/**
 * Holders Provider
 * Fetches holder count data
 */

import { getEnv } from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';

export interface HoldersData {
  holdersCount: number;
}

const MORALIS_BASE = 'https://solana-gateway.moralis.io';

export async function fetchHoldersData(
  address: string,
  timeoutMs = 2000
): Promise<HoldersData> {
  const env = getEnv();
  
  if (!env.MORALIS_API_KEY) {
    return { holdersCount: 0 };
  }
  
  const url = `${MORALIS_BASE}/token/mainnet/${address}/metadata`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-API-Key': env.MORALIS_API_KEY
      }
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) {
      logger.warn('Moralis holders fetch failed', { address, status: res.status });
      return { holdersCount: 0 };
    }
    
    const data = await res.json() as any;
    
    // Note: Moralis may not directly provide holder count in metadata
    // This is a placeholder - adjust based on actual API response
    return {
      holdersCount: data.holders ?? 0,
    };
  } catch (err) {
    logger.warn('Holders fetch failed', { address, error: String(err) });
    return { holdersCount: 0 };
  }
}

