/**
 * Token registry (Jupiter tokens API)
 * Isolated provider for backend trading routes.
 */

import { getEnv } from '../../config/env.js';
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
  const { JUPITER_BASE_URL } = getEnv();
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
    const raw = t as Record<string, unknown>;
    const address = raw.address;
    const symbol = raw.symbol;
    const decimals = raw.decimals;
    if (typeof address !== 'string' || typeof symbol !== 'string' || typeof decimals !== 'number') continue;
    map.set(address, {
      address,
      symbol,
      decimals,
      name: typeof raw.name === 'string' ? raw.name : undefined,
      logoURI: typeof raw.logoURI === 'string' ? raw.logoURI : undefined,
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
