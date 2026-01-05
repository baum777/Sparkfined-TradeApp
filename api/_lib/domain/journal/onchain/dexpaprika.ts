import { fetchJsonWithTimeout, OnchainFetchError } from './http';

export interface DexPaprikaTokenResponse {
  symbol: string;
  name: string;
  dex_id?: string; // e.g. raydium
  added_at?: string; // ISO
  summary?: {
    price_usd?: number;
    liquidity_usd?: number;
    fdv?: number; // Market cap proxy
    '24h'?: {
      volume_usd?: number;
      price_change_percent?: number;
    };
  };
}

export interface DexPaprikaResult {
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  marketCap: number;
  ageMinutes: number;
  dexId?: string;
}

export class DexPaprikaAdapter {
  constructor(
    private readonly baseUrl: string = 'https://api.dexpaprika.com',
    private readonly apiKey?: string
  ) {}

  async fetchTokenData(
    address: string,
    timeoutMs: number
  ): Promise<DexPaprikaResult> {
    const url = `${this.baseUrl}/networks/solana/tokens/${address}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // This will throw OnchainFetchError on failure
    const data = await fetchJsonWithTimeout<DexPaprikaTokenResponse>(url, {
      headers,
      timeoutMs,
    });

    const now = Date.now();
    let ageMinutes = 0;
    if (data.added_at) {
      const added = new Date(data.added_at).getTime();
      ageMinutes = Math.max(0, Math.floor((now - added) / 60000));
    }

    return {
      priceUsd: data.summary?.price_usd ?? 0,
      liquidityUsd: data.summary?.liquidity_usd ?? 0,
      volume24h: data.summary?.['24h']?.volume_usd ?? 0,
      marketCap: data.summary?.fdv ?? 0,
      ageMinutes,
      dexId: data.dex_id,
    };
  }
}

