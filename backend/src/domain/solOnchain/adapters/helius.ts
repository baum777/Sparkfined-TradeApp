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
  HeliusEnhancedTransaction,
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

function meanAndStdev(values: number[]): { mean: number; stdev: number } | null {
  if (values.length < 2) return null;
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;
  let s2 = 0;
  for (const v of values) {
    const d = v - mean;
    s2 += d * d;
  }
  const stdev = Math.sqrt(s2 / (values.length - 1));
  return { mean, stdev };
}

function zScore(value: number, baselineSamples: number[]): number | null {
  const ms = meanAndStdev(baselineSamples);
  if (!ms) return null;
  if (ms.stdev === 0) return null;
  return (value - ms.mean) / ms.stdev;
}

function pickBinCount(windowMs: number): number {
  // Deterministic binning for z-score estimation.
  // Keep at least 6 bins to avoid noisy z-scores; cap at 24 for cost.
  const approxHours = windowMs / 3_600_000;
  const bins = Math.round(approxHours);
  return Math.min(24, Math.max(6, bins));
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

function resolveHeliusApiKey(): string {
  return getEnv().HELIUS_API_KEY;
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

async function fetchEnhancedTransactionsByAddress(input: {
  address: string;
  apiKey: string;
  timeoutMs: number;
  before?: string;
  limit: number;
}): Promise<HeliusEnhancedTransaction[]> {
  const reqId = getRequestId();
  const internalReq = stableSha256Hex({
    tag: 'helius',
    kind: 'enhancedTx',
    address: input.address,
    before: input.before ?? null,
    limit: input.limit,
    reqId: String(reqId),
  } as any).slice(0, 16);

  const base = 'https://api.helius.xyz/v0';
  const qs = new URLSearchParams();
  qs.set('api-key', input.apiKey);
  qs.set('limit', String(input.limit));
  if (input.before) qs.set('before', input.before);
  const url = `${base}/addresses/${input.address}/transactions?${qs.toString()}`;

  return await withRetry(
    async () => {
      const res = await fetchJson<HeliusEnhancedTransaction[]>(url, {
        method: 'GET',
        timeoutMs: input.timeoutMs,
        headers: {
          'x-request-id': reqId,
          'x-internal-request-id': `solonchain-helius-enhanced-${internalReq}`,
        },
      });

      if (!res.ok) {
        throw new FetchJsonError('Helius enhanced transactions HTTP error', { status: res.status, bodyText: res.text, responseHeaders: res.headers });
      }

      const json = res.json as any;
      if (!Array.isArray(json)) {
        throw new FetchJsonError('Helius enhanced transactions invalid JSON shape', { status: res.status, bodyText: res.text, responseHeaders: res.headers });
      }
      return json as HeliusEnhancedTransaction[];
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

async function collectEnhancedTransactionsInRange(input: {
  address: string;
  asOfTs: number;
  baselineWindowMs: number;
  timeoutMs: number;
  maxPages: number;
  pageLimit: number;
}): Promise<{ txs: HeliusEnhancedTransaction[]; notes: string[] }> {
  const notes: string[] = [];
  const apiKey = resolveHeliusApiKey();
  const cutoffMs = input.asOfTs - input.baselineWindowMs;

  let before: string | undefined = undefined;
  const out: HeliusEnhancedTransaction[] = [];

  for (let page = 0; page < input.maxPages; page++) {
    const pageTxs = await fetchEnhancedTransactionsByAddress({
      address: input.address,
      apiKey,
      timeoutMs: input.timeoutMs,
      before,
      limit: input.pageLimit,
    });

    if (pageTxs.length === 0) break;
    out.push(...pageTxs);

    // Pagination: use the last signature as cursor (Helius enhanced tx "before" cursor).
    const last = pageTxs[pageTxs.length - 1];
    before = last?.signature;

    // Stop early once we crossed the baseline cutoff.
    let oldestMs: number | null = null;
    for (const tx of pageTxs) {
      const ts = (tx as any)?.timestamp;
      if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
      const ms = toMsFromBlockTime(ts);
      oldestMs = oldestMs == null ? ms : Math.min(oldestMs, ms);
    }
    if (oldestMs != null && oldestMs < cutoffMs) break;
  }

  // Deterministic: do not depend on upstream ordering quirks; sort by timestamp desc then signature.
  out.sort((a, b) => {
    const ta = typeof (a as any).timestamp === 'number' ? (a as any).timestamp : 0;
    const tb = typeof (b as any).timestamp === 'number' ? (b as any).timestamp : 0;
    if (tb !== ta) return tb - ta;
    return String((a as any).signature ?? '').localeCompare(String((b as any).signature ?? ''));
  });

  if (out.length === 0) notes.push('enhancedTx:no_transactions');
  return { txs: out, notes };
}

export class HeliusAdapter implements SolanaOnchainProvider {
  tag = 'helius';
  version = '2.0.0';

  capabilities() {
    return {
      activity: true,
      holders: true,
      flows: true,
      liquidity: true,
      riskFlags: true,
    };
  }

  fingerprint(): string {
    // Explicitly include flows mapping version for cache key clarity.
    return `${computeProviderFingerprint({ tag: this.tag, version: this.version, capabilities: this.capabilities() })}:flows:v2`;
  }

  private clients() {
    const cfg = resolveHeliusConfig();
    return {
      rpc: new HeliusRpcClient({ rpcUrl: cfg.rpcUrl, timeoutMs: cfg.timeoutMs }),
      das: new HeliusRpcClient({ rpcUrl: cfg.dasRpcUrl, timeoutMs: cfg.timeoutMs }),
      timeoutMs: cfg.timeoutMs,
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

  async getFlows(input: { mint: string; windows: OnchainWindows; asOfTs: number }): Promise<FlowsBlockResult> {
    const { rpc, timeoutMs } = this.clients();
    const shortMs = windowIdToMs(input.windows.short);
    const baselineMs = windowIdToMs(input.windows.baseline);
    const shortCutoff = input.asOfTs - shortMs;
    const baselineCutoff = input.asOfTs - baselineMs;

    const maxPages = 6;
    const pageLimit = 100;

    try {
      // Fetch enhanced tx only once for baseline coverage; then compute both windows deterministically.
      const { txs, notes: txNotes } = await collectEnhancedTransactionsInRange({
        address: input.mint,
        asOfTs: input.asOfTs,
        baselineWindowMs: baselineMs,
        timeoutMs,
        maxPages,
        pageLimit,
      });

      // Supply best-effort (needed for large transfer threshold).
      let supplyUi: number | null = null;
      try {
        const supply = await rpc.call<HeliusGetTokenSupplyResult>('getTokenSupply', [input.mint]);
        const ui = (supply as any)?.value?.uiAmountString;
        if (typeof ui === 'string') {
          const n = Number(ui);
          supplyUi = Number.isFinite(n) ? n : null;
        }
      } catch {
        supplyUi = null;
      }

      type Agg = { inflow: number; outflow: number; totalTransferAbs: number; largeCount: number };
      const mkAgg = (): Agg => ({ inflow: 0, outflow: 0, totalTransferAbs: 0, largeCount: 0 });

      const baselineAgg = mkAgg();
      const shortAgg = mkAgg();

      const baselineAmounts: number[] = [];

      // Bin-based samples for zScore (rates).
      const bins = pickBinCount(baselineMs);
      const binSizeMs = Math.max(1, Math.floor(baselineMs / bins));
      const binAgg: Agg[] = Array.from({ length: bins }, () => mkAgg());

      const addTransfer = (agg: Agg, amount: number, dir: 'in' | 'out' | 'ignored') => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        if (dir === 'in') agg.inflow += amount;
        else if (dir === 'out') agg.outflow += amount;
        agg.totalTransferAbs += Math.abs(amount);
      };

      for (const tx of txs) {
        const ts = (tx as any)?.timestamp;
        if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
        const txMs = toMsFromBlockTime(ts);
        if (txMs < baselineCutoff || txMs > input.asOfTs) continue;

        const transfers = (tx as any)?.tokenTransfers;
        if (!Array.isArray(transfers)) continue;

        const binIdx = Math.min(bins - 1, Math.max(0, Math.floor((txMs - baselineCutoff) / binSizeMs)));

        for (const tr of transfers) {
          const mint = (tr as any)?.mint;
          if (mint !== input.mint) continue;
          const amount = (tr as any)?.tokenAmount;
          if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) continue;
          baselineAmounts.push(amount);

          const hasFrom = isNonEmptyString((tr as any)?.fromUserAccount);
          const hasTo = isNonEmptyString((tr as any)?.toUserAccount);
          // Deterministic direction heuristic (best-effort):
          // - Count inflow when tokenAmount is received by a user account from a non-user entity (from missing).
          // - Count outflow when tokenAmount is sent from a user account to a non-user entity (to missing).
          // - Ignore ambiguous (both present or both missing) to avoid double counting.
          const dir: 'in' | 'out' | 'ignored' = hasTo && !hasFrom ? 'in' : hasFrom && !hasTo ? 'out' : 'ignored';

          addTransfer(baselineAgg, amount, dir);
          addTransfer(binAgg[binIdx]!, amount, dir);
          if (txMs >= shortCutoff) addTransfer(shortAgg, amount, dir);
        }
      }

      // Large transfer threshold: max(0.5% supply, 95p baseline amount).
      let p95: number | null = null;
      if (baselineAmounts.length >= 20) {
        const sorted = [...baselineAmounts].sort((a, b) => a - b);
        const idx = Math.floor(0.95 * (sorted.length - 1));
        p95 = sorted[idx] ?? null;
      }
      const supplyThresh = supplyUi != null ? supplyUi * 0.005 : null;
      const largeThresh =
        supplyThresh != null && p95 != null
          ? Math.max(supplyThresh, p95)
          : supplyThresh != null
            ? supplyThresh
            : p95 != null
              ? p95
              : null;

      if (largeThresh != null) {
        const countLarge = (tx: any, cutoffMs: number): number => {
          const ts = tx?.timestamp;
          if (typeof ts !== 'number' || !Number.isFinite(ts)) return 0;
          const txMs = toMsFromBlockTime(ts);
          if (txMs < baselineCutoff || txMs > input.asOfTs) return 0;
          if (txMs < cutoffMs) return 0;
          const transfers = tx?.tokenTransfers;
          if (!Array.isArray(transfers)) return 0;
          let c = 0;
          for (const tr of transfers) {
            if (tr?.mint !== input.mint) continue;
            const amount = tr?.tokenAmount;
            if (typeof amount !== 'number' || !Number.isFinite(amount)) continue;
            if (amount > largeThresh) c++;
          }
          return c;
        };

        let shortLarge = 0;
        let baselineLarge = 0;
        const binLarge: number[] = Array.from({ length: bins }, () => 0);

        for (const tx of txs as any[]) {
          const ts = tx?.timestamp;
          if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
          const txMs = toMsFromBlockTime(ts);
          if (txMs < baselineCutoff || txMs > input.asOfTs) continue;
          baselineLarge += countLarge(tx, baselineCutoff);
          if (txMs >= shortCutoff) shortLarge += countLarge(tx, shortCutoff);
          const binIdx = Math.min(bins - 1, Math.max(0, Math.floor((txMs - baselineCutoff) / binSizeMs)));
          binLarge[binIdx]! += countLarge(tx, baselineCutoff);
        }

        baselineAgg.largeCount = baselineLarge;
        shortAgg.largeCount = shortLarge;
        for (let i = 0; i < bins; i++) binAgg[i]!.largeCount = binLarge[i]!;
      }

      const netShort = shortAgg.inflow - shortAgg.outflow;
      const netBaseline = baselineAgg.inflow - baselineAgg.outflow;

      const shortRate = netShort / Math.max(1, shortMs);
      const baselineRateSamples = binAgg.map(b => (b.inflow - b.outflow) / Math.max(1, binSizeMs));
      const netZ = baselineRateSamples.length >= 6 ? zScore(shortRate, baselineRateSamples) : null;

      const largeShortRate = shortAgg.largeCount / Math.max(1, shortMs);
      const largeBaselineRateSamples = binAgg.map(b => b.largeCount / Math.max(1, binSizeMs));
      const largeZ = largeBaselineRateSamples.length >= 6 ? zScore(largeShortRate, largeBaselineRateSamples) : null;

      return {
        available: true,
        data: {
          netInflowProxy: { short: netShort, baseline: netBaseline, zScore: netZ },
          largeTransfersProxy: {
            short: shortAgg.largeCount,
            baseline: baselineAgg.largeCount,
            zScore: largeZ,
          },
        },
        notes: [
          'flows:proxy_from_enhanced_tokenTransfers_user_side_only',
          ...(largeThresh == null ? ['flows:largeTransfers_threshold_unavailable'] : [`flows:largeTransfers_threshold=${largeThresh}`]),
          ...txNotes,
        ],
      };
    } catch (err) {
      const status = (err as any)?.status;
      const note = typeof status === 'number' ? `flows:upstream_failed_status_${status}` : 'flows:upstream_failed';
      return {
        available: false,
        data: { netInflowProxy: nullMetricZ(), largeTransfersProxy: { short: null, baseline: null, zScore: null } },
        notes: [note],
      };
    }
  }

  async getLiquidity(input: { mint: string; windows: OnchainWindows; asOfTs: number }): Promise<LiquidityBlockResult> {
    // Best-effort proxy derived from enhanced tokenTransfers:
    // compare transfer volume rate in short vs baseline.
    const { timeoutMs } = this.clients();
    const shortMs = windowIdToMs(input.windows.short);
    const baselineMs = windowIdToMs(input.windows.baseline);
    const shortCutoff = input.asOfTs - shortMs;
    const baselineCutoff = input.asOfTs - baselineMs;

    const maxPages = 6;
    const pageLimit = 100;

    try {
      const { txs, notes: txNotes } = await collectEnhancedTransactionsInRange({
        address: input.mint,
        asOfTs: input.asOfTs,
        baselineWindowMs: baselineMs,
        timeoutMs,
        maxPages,
        pageLimit,
      });

      let volShort = 0;
      let volBaseline = 0;

      for (const tx of txs as any[]) {
        const ts = tx?.timestamp;
        if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
        const txMs = toMsFromBlockTime(ts);
        if (txMs < baselineCutoff || txMs > input.asOfTs) continue;
        const transfers = tx?.tokenTransfers;
        if (!Array.isArray(transfers)) continue;
        for (const tr of transfers) {
          if (tr?.mint !== input.mint) continue;
          const amount = tr?.tokenAmount;
          if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) continue;
          const hasFrom = isNonEmptyString(tr?.fromUserAccount);
          const hasTo = isNonEmptyString(tr?.toUserAccount);
          const directional = (hasTo && !hasFrom) || (hasFrom && !hasTo);
          if (!directional) continue;
          volBaseline += Math.abs(amount);
          if (txMs >= shortCutoff) volShort += Math.abs(amount);
        }
      }

      const rateShort = volShort / Math.max(1, shortMs);
      const rateBase = volBaseline / Math.max(1, baselineMs);
      const deltaPct = rateBase > 0 ? (rateShort - rateBase) / rateBase : null;

      return {
        available: deltaPct != null,
        data: {
          liquidityDeltaPct: { short: deltaPct, baseline: null },
        },
        notes: [
          'liquidity:proxy_from_enhanced_token_transfer_volume_rate',
          ...(deltaPct == null ? ['liquidity:baseline_rate_zero_or_unavailable'] : []),
          ...txNotes,
        ],
      };
    } catch (err) {
      const status = (err as any)?.status;
      const note = typeof status === 'number' ? `liquidity:upstream_failed_status_${status}` : 'liquidity:upstream_failed';
      return { available: false, data: {}, notes: [note] };
    }
  }
}

