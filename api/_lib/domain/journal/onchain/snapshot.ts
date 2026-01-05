import { getEnv } from '../../../env';
import { DexPaprikaAdapter, type DexPaprikaResult } from './dexpaprika';
import { MoralisAdapter, type MoralisResult } from './moralis';
import type { 
  OnchainContextV1, 
  OnchainContextMetaV1, 
  OnchainContextErrorV1, 
  OnchainSnapshotResult,
  OnchainContextErrorCode
} from './types';
import { OnchainFetchError } from './http';

interface SnapshotOptions {
  symbolOrAddress?: string;
  requestId: string;
  now?: string; // ISO, defaults to new Date().toISOString()
}

export async function buildOnchainContextSnapshot(
  options: SnapshotOptions
): Promise<OnchainSnapshotResult> {
  const env = getEnv();
  const now = options.now || new Date().toISOString();
  
  // Base result structure (all zeros)
  const context: OnchainContextV1 = {
    capturedAt: now,
    priceUsd: 0,
    liquidityUsd: 0,
    volume24h: 0,
    marketCap: 0,
    ageMinutes: 0,
    holders: 0,
    transfers24h: 0,
  };
  
  const meta: OnchainContextMetaV1 = {
    capturedAt: now,
    errors: [],
  };

  // 1. Check input
  if (!options.symbolOrAddress) {
    meta.errors.push({
      provider: 'internal',
      code: 'MISSING_MARKET_KEY',
      message: 'No symbol or address provided',
      at: now,
      requestId: options.requestId,
    });
    return { context, meta };
  }

  // 2. Setup adapters & config
  // Use env vars or defaults (Plan says defaults: 1200ms provider, 2000ms budget)
  // We'll hardcode defaults here if env vars are missing, or assume getEnv provides them (we need to update env schema later)
  // Casting as any for now since we haven't updated env schema yet
  const envAny = env as any;
  const PROVIDER_TIMEOUT = parseInt(envAny.ONCHAIN_CONTEXT_PROVIDER_TIMEOUT_MS || '1200', 10);
  // Total budget is implicitly handled by parallel execution with timeouts.
  // Ideally we substract elapsed time, but with Promise.all and fixed timeouts it's easier.
  
  const dexAdapter = new DexPaprikaAdapter(
    envAny.DEXPAPRIKA_BASE_URL, // optional default in Adapter
    env.DEXPAPRIKA_API_KEY
  );
  
  const moralisAdapter = new MoralisAdapter(
    envAny.MORALIS_BASE_URL, // optional default in Adapter
    env.MORALIS_API_KEY
  );

  // 3. Execute in parallel
  const dexPromise = dexAdapter.fetchTokenData(options.symbolOrAddress, PROVIDER_TIMEOUT);
  const moralisPromise = moralisAdapter.fetchTokenData(options.symbolOrAddress, PROVIDER_TIMEOUT);

  const [dexResult, moralisResult] = await Promise.allSettled([
    dexPromise,
    moralisPromise,
  ]);

  // 4. Merge Results

  // DexPaprika
  if (dexResult.status === 'fulfilled') {
    const data = dexResult.value;
    context.priceUsd = data.priceUsd;
    context.liquidityUsd = data.liquidityUsd;
    context.volume24h = data.volume24h;
    context.marketCap = data.marketCap;
    context.ageMinutes = data.ageMinutes;
    if (data.dexId) {
      context.dexId = data.dexId;
    }
  } else {
    const err = dexResult.reason;
    const errorInfo = mapErrorToContextError('dexpaprika', err, options.requestId, now);
    meta.errors.push(errorInfo);
  }

  // Moralis
  if (moralisResult.status === 'fulfilled') {
    const data = moralisResult.value;
    context.holders = data.holders;
    context.transfers24h = data.transfers24h;
  } else {
    const err = moralisResult.reason;
    const errorInfo = mapErrorToContextError('moralis', err, options.requestId, now);
    meta.errors.push(errorInfo);
  }

  return { context, meta };
}

function mapErrorToContextError(
  provider: 'dexpaprika' | 'moralis',
  err: unknown,
  requestId: string,
  now: string
): OnchainContextErrorV1 {
  let code: OnchainContextErrorCode = 'UNKNOWN_ERROR';
  let message = 'Unknown error';
  let httpStatus: number | undefined;

  if (err instanceof OnchainFetchError) {
    code = err.code;
    message = err.message;
    httpStatus = err.status;
  } else if (err instanceof Error) {
    message = err.message;
    // Try to guess code from message if generic Error
    if (message.includes('timeout')) code = 'TIMEOUT';
    else if (message.includes('key')) code = 'MISSING_API_KEY';
  }

  return {
    provider,
    code,
    message,
    at: now,
    requestId,
    httpStatus,
  };
}

