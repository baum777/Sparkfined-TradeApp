/**
 * Volume Provider
 * Fetches 24h volume data
 */

import { getEnv } from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';

export interface VolumeData {
  volume24hUsd: number;
}

const DEXPAPRIKA_BASE = 'https://api.dexpaprika.com';

export async function fetchVolumeData(
  symbolOrAddress: string,
  timeoutMs = 2000
): Promise<VolumeData> {
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
      return { volume24hUsd: 0 };
    }
    
    const data = await res.json() as any;
    
    return {
      volume24hUsd: data.summary?.['24h']?.volume_usd ?? 0,
    };
  } catch (err) {
    logger.warn('Volume fetch failed', { symbolOrAddress, error: String(err) });
    return { volume24hUsd: 0 };
  }
}

