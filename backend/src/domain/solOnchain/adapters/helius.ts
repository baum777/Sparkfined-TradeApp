import type {
  ActivityBlockResult,
  FlowsBlockResult,
  HoldersBlockResult,
  LiquidityBlockResult,
  RiskFlagsBlockResult,
  SolanaOnchainProvider,
} from '../provider.js';
import { computeProviderFingerprint } from '../provider.js';
import type { OnchainWindows } from '../types.js';
import { nullMetric, nullMetricZ } from '../types.js';
import { stableSha256Hex } from '../hash.js';
import { getEnv } from '../../../config/env.js';
import { fetchJson, FetchJsonError } from '../../../lib/http/fetchJson.js';
import { withRetry } from '../../../lib/http/retry.js';
import { getRequestId } from '../../../http/requestId.js';
import type {
  HeliusGetAssetResult,
  HeliusGetTokenLargestAccountsResult,
  HeliusGetTokenSupplyResult,
  HeliusGetTransactionsForAddressResult,
  JsonRpcRequest,
  JsonRpcResponse,
} from './helius.types.js';

function windowIdToMs(id: OnchainWindows['short'] | OnchainWindows['baseline']): number {
  switch (id) {
    case '5m':
      return 5 * 60_000;
    case '1h':
      return 60 * 60_000;
    case '24h':
      return 24 * 60 * 60_000;
    case '7d':
      return 7 * 24 * 60 * 60_000;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function toMsFromBlockTime(blockTime: number): number {
  // Solana blockTime is usually seconds; treat large values as already-ms.
  return blockTime < 1_000_000_000_000 ? blockTime * 1000 : blockTime;
}

function parseBigIntAmount(amount: unknown): bigint | null {
  if (typeof amount === 'string' && /^[0-9]+$/.test(amount)) return BigInt(amount);
  if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && Number.isInteger(amount)) return BigInt(amount);
  return null;
}

function ratioBigInt(numer: bigint, denom: bigint, decimals = 6): number | null {
  if (denom === 0n) return null;
  const scale = 10n ** BigInt(decimals);
  const scaled = (numer * scale) / denom;
  return Number(scaled) / Number(scale);
}

type RpcClientOpts = {
  rpcUrl: string;
  timeoutMs: number;
};

class HeliusRpcClient {
  private readonly rpcUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: RpcClientOpts) {
    this.rpcUrl = opts.rpcUrl;
    this.timeoutMs = opts.timeoutMs;
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    const body: JsonRpcRequest = { jsonrpc: '2.0', id: '1', method, params };
    const reqId = getRequestId();
    const internalReq = stableSha256Hex({ tag: 'helius', method, params: params as any, reqId: String(reqId) }).slice(0, 16);

    return await withRetry(
      async () => {
        const res = await fetchJson<JsonRpcResponse<T>>(this.rpcUrl, {
          method: 'POST',
          timeoutMs: this.timeoutMs,
          headers: {
            'x-request-id': reqId,
            'x-internal-request-id': `solonchain-helius-${internalReq}`,
          },
          body,
        });

        if (!res.ok) {
          throw new FetchJsonError('Helius RPC HTTP error', { status: res.status, bodyText: res.text, responseHeaders: res.headers });
        }

        const json = res.json as any;
        if (json?.error) {
          // JSON-RPC error (often 200). Treat as non-OK and allow retry if status is retryable.
          throw new FetchJsonError('Helius RPC JSON-RPC error', {
            status: res.status,
            bodyText: res.text,
            responseHeaders: res.headers,
          });
        }

        return (json?.result ?? null) as T;
      },
      { maxRetries: 2, baseDelayMs: 250, maxDelayMs: 2000 },
      {
        getRetryAfterHint: (err: unknown) => {
          const h = (err as any)?.responseHeaders as Headers | undefined;
          return h ? { retryAfterHeader: h.get('retry-after') } : null;
        },
      }
    );
  }
}

function resolveHeliusConfig(): { rpcUrl: string; dasRpcUrl: string; timeoutMs: number } {
  const env = getEnv();

  const apiKey = env.HELIUS_API_KEY; // required by env schema
  const defaultRpc = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  const rpcUrl = env.HELIUS_RPC_URL ?? defaultRpc;
  const dasRpcUrl = env.HELIUS_DAS_RPC_URL ?? rpcUrl;

  const timeoutMs =
    typeof env.HELIUS_TIMEOUT_MS === 'number' && Number.isFinite(env.HELIUS_TIMEOUT_MS) && env.HELIUS_TIMEOUT_MS > 0
      ? env.HELIUS_TIMEOUT_MS
      : env.LLM_TIMEOUT_MS;

  return { rpcUrl, dasRpcUrl, timeoutMs };
}

async function computeTop10ConcentrationPct(input: {
  mint: string;
  rpc: HeliusRpcClient;
  das: HeliusRpcClient;
}): Promise<{ pct: number | null; notes: string[]; totalSupplyAmount?: bigint | null }> {
  const notes: string[] = [];

  // 1) Supply (prefer getTokenSupply)
  let supplyAmount: bigint | null = null;
  let supplyDecimals: number | null = null;

  try {
    const supply = await input.rpc.call<HeliusGetTokenSupplyResult>('getTokenSupply', [input.mint]);
    const v = (supply as any)?.value;
    supplyAmount = parseBigIntAmount(v?.amount) ?? null;
    supplyDecimals = typeof v?.decimals === 'number' ? v.decimals : null;
    if (supplyAmount == null) {
      // Sometimes only uiAmountString exists; we avoid float math and fall back to DAS.
      throw new Error('getTokenSupply missing amount');
    }
  } catch {
    // 2) Fallback: DAS getAsset token_info supply/decimals
    try {
      const asset = await input.das.call<HeliusGetAssetResult>('getAsset', { id: input.mint });
      const ti = (asset as any)?.token_info;
      supplyDecimals = typeof ti?.decimals === 'number' ? ti.decimals : null;
      supplyAmount = parseBigIntAmount(ti?.supply) ?? null;
      if (supplyAmount == null) throw new Error('getAsset token_info missing supply');
      notes.push('holders:supply_from_das_getAsset');
    } catch {
      return { pct: null, notes: [...notes, 'holders:supply_unavailable'] };
    }
  }

  // 3) Largest accounts (top 10)
  let top10: bigint | null = null;
  try {
    const largest = await input.rpc.call<HeliusGetTokenLargestAccountsResult>('getTokenLargestAccounts', [input.mint]);
    const arr = (largest as any)?.value;
    if (!Array.isArray(arr)) throw new Error('missing value array');
    const first10 = arr.slice(0, 10);
    let sum = 0n;
    for (const row of first10) {
      const a = parseBigIntAmount((row as any)?.amount);
      if (a == null) throw new Error('largestAccounts missing amount');
      sum += a;
    }
    top10 = sum;
  } catch {
    return { pct: null, notes: [...notes, 'holders:largest_accounts_unavailable'], totalSupplyAmount: supplyAmount };
  }

  const pct = supplyAmount != null && top10 != null ? ratioBigInt(top10, supplyAmount, 6) : null;
  if (pct == null) {
    notes.push('holders:concentration_uncomputable');
  }
  return { pct, notes, totalSupplyAmount: supplyAmount };
}

export class HeliusAdapter implements SolanaOnchainProvider {
  tag = 'helius';
  version = '1.0.0';

  capabilities() {
    return {
      activity: true,
      holders: true,
      flows: false,
      liquidity: false,
      riskFlags: true,
    };
  }

  fingerprint(): string {
    return computeProviderFingerprint({ tag: this.tag, version: this.version, capabilities: this.capabilities() });
  }

  private clients() {
    const cfg = resolveHeliusConfig();
    return {
      rpc: new HeliusRpcClient({ rpcUrl: cfg.rpcUrl, timeoutMs: cfg.timeoutMs }),
      das: new HeliusRpcClient({ rpcUrl: cfg.dasRpcUrl, timeoutMs: cfg.timeoutMs }),
    };
  }

  async getRiskFlags(input: { mint: string; asOfTs: number }): Promise<RiskFlagsBlockResult> {
    void input.asOfTs;
    const { rpc, das } = this.clients();
    try {
      const asset = await das.call<HeliusGetAssetResult>('getAsset', { id: input.mint });
      const tokenInfo = (asset as any)?.token_info;
      if (!tokenInfo) {
        return { available: false, data: {}, notes: ['riskFlags:getAsset_missing_token_info'] };
      }

      const mintAuth = tokenInfo?.mint_authority;
      const freezeAuth = tokenInfo?.freeze_authority;

      // Best-effort: derive largeHolderDominance from top10 concentration.
      let concentrationTop10Pct: number | null = null;
      try {
        const conc = await computeTop10ConcentrationPct({ mint: input.mint, rpc, das });
        concentrationTop10Pct = conc.pct;
      } catch {
        concentrationTop10Pct = null;
      }

      const largeHolderDominance =
        concentrationTop10Pct == null
          ? { value: null, why: 'top10 concentration unavailable (v1)' }
          : concentrationTop10Pct > 0.6
            ? { value: true, why: `top10 concentration ${concentrationTop10Pct.toFixed(6)} > 0.60` }
            : { value: false, why: `top10 concentration ${concentrationTop10Pct.toFixed(6)} <= 0.60` };

      return {
        available: true,
        data: {
          mintAuthorityActive: {
            value: isNonEmptyString(mintAuth),
            why: `mint_authority=${isNonEmptyString(mintAuth) ? mintAuth : 'null'}`,
          },
          freezeAuthorityActive: {
            value: isNonEmptyString(freezeAuth),
            why: `freeze_authority=${isNonEmptyString(freezeAuth) ? freezeAuth : 'null'}`,
          },
          suddenSupplyChange: { value: null, why: 'not implemented in v1 (needs historical supply series)' },
          largeHolderDominance,
        },
      };
    } catch (err) {
      const status = (err as any)?.status;
      const note = typeof status === 'number' ? `riskFlags:getAsset_failed_status_${status}` : 'riskFlags:getAsset_failed';
      return { available: false, data: {}, notes: [note] };
    }
  }

  async getHolders(input: { mint: string; windows: OnchainWindows; asOfTs: number }): Promise<HoldersBlockResult> {
    void input.windows;
    void input.asOfTs;
    const { rpc, das } = this.clients();

    try {
      const { pct, notes } = await computeTop10ConcentrationPct({ mint: input.mint, rpc, das });

      return {
        available: true,
        data: {
          holders: { current: null },
          holdersDeltaPct: nullMetric(),
          concentrationTop10Pct: pct,
        },
        notes: ['holders:holder_count_not_computed_v1', ...notes],
      };
    } catch (err) {
      const status = (err as any)?.status;
      const note = typeof status === 'number' ? `holders:upstream_failed_status_${status}` : 'holders:upstream_failed';
      return {
        available: false,
        data: {
          holders: { current: null },
          holdersDeltaPct: nullMetric(),
          concentrationTop10Pct: null,
        },
        notes: [note, 'holders:holder_count_not_computed_v1'],
      };
    }
  }

  async getActivity(input: { mint: string; windows: OnchainWindows; asOfTs: number }): Promise<ActivityBlockResult> {
    const { rpc } = this.clients();

    const baselineCutoff = input.asOfTs - windowIdToMs(input.windows.baseline);
    const shortCutoff = input.asOfTs - windowIdToMs(input.windows.short);

    const maxPages = 10;
    const limit = 100;

    let paginationToken: string | null | undefined = undefined;
    let pages = 0;
    let baselineCount = 0;
    let shortCount = 0;

    try {
      while (pages < maxPages) {
        pages++;

        const config: Record<string, unknown> = {
          transactionDetails: 'signatures',
          limit,
          sortOrder: 'desc',
        };
        if (paginationToken) config.paginationToken = paginationToken;

        const result = await rpc.call<HeliusGetTransactionsForAddressResult>('getTransactionsForAddress', [input.mint, config]);

        const txs = (result as any)?.transactions;
        if (!Array.isArray(txs) || txs.length === 0) break;

        let oldestMsInPage: number | null = null;
        for (const row of txs) {
          const bt = (row as any)?.blockTime;
          if (typeof bt !== 'number' || !Number.isFinite(bt)) continue;
          const btMs = toMsFromBlockTime(bt);
          oldestMsInPage = oldestMsInPage == null ? btMs : Math.min(oldestMsInPage, btMs);

          if (btMs >= baselineCutoff) baselineCount++;
          if (btMs >= shortCutoff) shortCount++;
        }

        paginationToken = (result as any)?.paginationToken ?? null;

        // Stop if we've already crossed the baseline cutoff.
        if (oldestMsInPage != null && oldestMsInPage < baselineCutoff) break;
        if (!paginationToken) break;
      }

      return {
        available: true,
        data: {
          txCount: { short: shortCount, baseline: baselineCount, zScore: null },
          uniqueWallets: nullMetricZ(),
        },
        notes: ['activity:uniqueWallets_unavailable_v1_signatures_only'],
      };
    } catch (err) {
      const status = (err as any)?.status;
      const note = typeof status === 'number' ? `activity:upstream_failed_status_${status}` : 'activity:upstream_failed';
      return {
        available: false,
        data: { txCount: nullMetricZ(), uniqueWallets: nullMetricZ() },
        notes: [note, 'activity:uniqueWallets_unavailable_v1_signatures_only'],
      };
    }
  }

  async getFlows(): Promise<FlowsBlockResult> {
    return {
      available: false,
      data: { netInflowProxy: nullMetricZ() },
      notes: ['flows:not_implemented_v1_planned_enhanced_transactions'],
    };
  }

  async getLiquidity(): Promise<LiquidityBlockResult> {
    return {
      available: false,
      data: {},
      notes: ['liquidity:not_implemented_v1_planned_enhanced_transactions'],
    };
  }
}

