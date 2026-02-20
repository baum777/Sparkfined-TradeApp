/**
 * Token Registry for Trading (Jupiter tokens API)
 * Canonical backend port of api/_lib/trading/tokenRegistry
 */

import { getConfig } from '../../config/config.js';
import { internalError } from '../../http/error.js';

export interface JupiterTokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  logoURI?: string;
}

let cachedTokens: Map<string, JupiterTokenInfo> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

async function fetchJupiterTokens(): Promise<Map<string, JupiterTokenInfo>> {
  const { JUPITER_BASE_URL } = getConfig().env;
  const url = `${JUPITER_BASE_URL.replace(/\/$/, '')}/tokens`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    throw internalError(`Failed to fetch Jupiter tokens: HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) {
    throw internalError('Invalid Jupiter tokens response');
  }

  const map = new Map<string, JupiterTokenInfo>();
  for (const t of json) {
    if (!t || typeof t !== 'object') continue;
    const address = (t as Record<string, unknown>).address;
    const symbol = (t as Record<string, unknown>).symbol;
    const decimals = (t as Record<string, unknown>).decimals;
    if (typeof address !== 'string' || typeof symbol !== 'string' || typeof decimals !== 'number') continue;
    map.set(address, {
      address,
      symbol,
      decimals,
      name: (t as Record<string, unknown>).name as string | undefined,
      logoURI: (t as Record<string, unknown>).logoURI as string | undefined,
    });
  }
  return map;
}

export async function getTokenInfo(mint: string): Promise<JupiterTokenInfo> {
  const now = Date.now();
  if (cachedTokens && now - cachedAt < CACHE_TTL_MS) {
    const hit = cachedTokens.get(mint);
    if (hit) return hit;
  }

  cachedTokens = await fetchJupiterTokens();
  cachedAt = now;

  const token = cachedTokens.get(mint);
  if (!token) {
    throw internalError(`Token not supported by Jupiter: ${mint}`);
  }
  return token;
}
