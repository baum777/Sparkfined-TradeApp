import type { ChartFeaturePack, InputCandle, SolTimeframe } from './types.js';
import type { BuildParams } from './params.js';
import { DEFAULT_BUILD_PARAMS, LOW_TFS } from './params.js';
import { stableStringify, sha256Hex } from './hash.js';
import { atr, bollingerWidth, clamp01, roundToStep, safeDiv, zScoreLast } from './math.js';
import { rsi } from './indicators.js';
import { detectZigZagPivots, scorePivotStrength } from './pivots.js';
import { classifyMarketRegime, computeAtrPctExpansion, computeMaSlopePct, computeStructureCounts } from './regime.js';
import { clusterSupportResistance } from './sr.js';
import { detectLiquiditySweeps } from './liquidity.js';
import { detectPatternCandidates } from './patterns.js';

function computeReturn(closeByTs: Array<{ ts: number; close: number }>, endTs: number, lookbackMs: number): number | undefined {
  const target = endTs - lookbackMs;
  for (let i = closeByTs.length - 1; i >= 0; i--) {
    const p = closeByTs[i]!;
    if (p.ts <= target) {
      if (p.close === 0) return undefined;
      return (closeByTs[closeByTs.length - 1]!.close - p.close) / p.close;
    }
  }
  return undefined;
}

export function computeCandlesHash(candles: InputCandle[]): string {
  const payload = candles.map(c => [c.ts, c.open, c.high, c.low, c.close, c.volume]);
  return sha256Hex(JSON.stringify(payload));
}

export function computeParamsHash(input: { timeframe: SolTimeframe; params: BuildParams }): string {
  const { timeframe, params } = input;
  const payload = {
    timeframe,
    pivot: params.pivot[timeframe],
    volumeZWindow: params.volumeZWindow,
    atrWindow: params.atrWindow,
    bbWindow: params.bbWindow,
    bbStdev: params.bbStdev,
    structurePivotLookback: params.structurePivotLookback,
    patternPivotLookback: params.patternPivotLookback,
    sweep: params.sweep,
    pattern: params.pattern,
    rounding: params.rounding,
  };
  return sha256Hex(stableStringify(payload as any));
}

export function buildChartFeaturePack(input: {
  mint: string;
  timeframe: SolTimeframe;
  candles: InputCandle[];
  symbol?: string;
  params?: Partial<BuildParams>;
}): ChartFeaturePack {
  const { mint, timeframe, candles, symbol } = input;

  const params: BuildParams = {
    ...DEFAULT_BUILD_PARAMS,
    ...(input.params ?? {}),
    pivot: { ...DEFAULT_BUILD_PARAMS.pivot, ...(input.params?.pivot ?? {}) } as BuildParams['pivot'],
    candleLimit: { ...DEFAULT_BUILD_PARAMS.candleLimit, ...(input.params?.candleLimit ?? {}) } as BuildParams['candleLimit'],
    sweep: { ...DEFAULT_BUILD_PARAMS.sweep, ...(input.params?.sweep ?? {}) },
    pattern: { ...DEFAULT_BUILD_PARAMS.pattern, ...(input.params?.pattern ?? {}) },
    rounding: { ...DEFAULT_BUILD_PARAMS.rounding, ...(input.params?.rounding ?? {}) },
  };

  if (candles.length === 0) {
    return {
      asset: { mint, symbol },
      timeframe,
      window: { candles: 0, startTs: 0, endTs: 0 },
      ohlcvSummary: {
        lastPrice: 0,
        volume: { mean: 0, stdev: 0, last: 0, zScore: 0 },
        volatility: { atr: 0, atrPct: 0, bbWidth: 0, bbWidthPct: 0 },
      },
      marketRegime: {
        regime: 'range',
        strength: 0,
        structure: { hhCount: 0, hlCount: 0, lhCount: 0, llCount: 0, lastSwing: 'HL' },
      },
      pivots: { method: 'zigzag', points: [] },
      srLevels: { supports: [], resistances: [] },
      liquidityEvents: LOW_TFS.includes(timeframe) ? { sweeps: [] } : undefined,
      indicatorSnapshot: undefined,
      patternCandidates: [],
    };
  }

  // Ensure deterministic ordering by timestamp (do not mutate input).
  const sorted = [...candles].sort((a, b) => a.ts - b.ts);

  const startTs = sorted[0]!.ts;
  const endTs = sorted[sorted.length - 1]!.ts;
  const lastPriceRaw = sorted[sorted.length - 1]!.close;
  const lastPrice = roundToStep(lastPriceRaw, params.rounding.priceStep);

  const close = sorted.map(c => c.close);
  const high = sorted.map(c => c.high);
  const low = sorted.map(c => c.low);
  const volume = sorted.map(c => c.volume);

  const volZ = zScoreLast(volume, params.volumeZWindow);
  const atrVal = atr(high, low, close, params.atrWindow) ?? 0;
  const bb = bollingerWidth(close, params.bbWindow, params.bbStdev);
  const bbWidth = bb?.width ?? 0;
  const bbWidthPct = bb?.mid ? safeDiv(bbWidth, bb.mid) : 0;

  const atrPct = safeDiv(atrVal, lastPriceRaw);

  const closeByTs = sorted.map(c => ({ ts: c.ts, close: c.close }));
  const r15m = computeReturn(closeByTs, endTs, 900_000);
  const r1h = computeReturn(closeByTs, endTs, 3_600_000);
  const r4h = computeReturn(closeByTs, endTs, 14_400_000);

  const zig = detectZigZagPivots(sorted, params.pivot[timeframe]);
  const pivotsScored = scorePivotStrength({
    pivots: zig,
    candles: sorted,
    minSwingPct: params.pivot[timeframe].minSwingPct,
    volumeZWindow: params.volumeZWindow,
  });

  const structure = computeStructureCounts(pivotsScored, params.structurePivotLookback);
  const maSlopePct = computeMaSlopePct(close, 50, 10);
  const { atrPctNow, atrPctPrev } = computeAtrPctExpansion({ close, high, low, atrWindow: params.atrWindow });
  const regime = classifyMarketRegime({ structure, maSlopePct, atrPctNow, atrPctPrev });

  const sr = clusterSupportResistance({
    pivots: pivotsScored,
    lastPrice: lastPriceRaw,
    atr: atrVal,
    priceStep: params.rounding.priceStep,
  });

  const liquidityEvents = params.sweep.enabledTfs.includes(timeframe)
    ? {
        sweeps: detectLiquiditySweeps({
          candles: sorted,
          atr: atrVal,
          supports: sr.supports,
          resistances: sr.resistances,
          reclaimBars: params.sweep.reclaimBars,
          breakAtrFrac: params.sweep.breakAtrFrac,
          volumeZWindow: params.volumeZWindow,
        }).map(s => ({
          ...s,
          level: roundToStep(s.level, params.rounding.priceStep),
          confidence: roundToStep(s.confidence, params.rounding.scoreStep),
        })),
      }
    : undefined;

  const rsiVal = rsi(close, 14);
  const indicatorSnapshot = rsiVal === null ? undefined : { rsi: { value: roundToStep(rsiVal, params.rounding.pctStep), divergence: 'none' as const } };

  const patternCandidates = detectPatternCandidates({
    timeframe,
    pivots: pivotsScored.slice(Math.max(0, pivotsScored.length - params.patternPivotLookback)),
    candles: sorted,
    lastPrice: lastPriceRaw,
    atrPct,
    baseTolPct: params.pattern.baseTolPct,
    timeMin: params.pattern.timeSymmetryMin,
    timeMax: params.pattern.timeSymmetryMax,
    dblMinDepthPctLowTF: params.pattern.dblMinDepthPctLowTF,
    dblMinDepthPctHighTF: params.pattern.dblMinDepthPctHighTF,
    rounding: params.rounding,
  });

  return {
    asset: { mint, symbol },
    timeframe,
    window: { candles: sorted.length, startTs, endTs },
    ohlcvSummary: {
      lastPrice,
      returns: {
        r_15m: r15m === undefined ? undefined : roundToStep(r15m, params.rounding.pctStep),
        r_1h: r1h === undefined ? undefined : roundToStep(r1h, params.rounding.pctStep),
        r_4h: r4h === undefined ? undefined : roundToStep(r4h, params.rounding.pctStep),
      },
      volume: {
        mean: roundToStep(volZ.mean, params.rounding.priceStep),
        stdev: roundToStep(volZ.stdev, params.rounding.priceStep),
        last: roundToStep(volume[volume.length - 1] ?? 0, params.rounding.priceStep),
        zScore: roundToStep(volZ.z, params.rounding.scoreStep),
      },
      volatility: {
        atr: roundToStep(atrVal, params.rounding.priceStep),
        atrPct: roundToStep(atrPct, params.rounding.pctStep),
        bbWidth: roundToStep(bbWidth, params.rounding.priceStep),
        bbWidthPct: roundToStep(bbWidthPct, params.rounding.pctStep),
      },
    },
    marketRegime: {
      regime: regime.regime,
      strength: roundToStep(clamp01(regime.strength), params.rounding.scoreStep),
      structure,
    },
    pivots: {
      method: 'zigzag',
      points: pivotsScored.map(p => ({
        ts: p.ts,
        price: roundToStep(p.price, params.rounding.priceStep),
        type: p.type,
        strength: p.strength!,
      })),
    },
    srLevels: {
      supports: sr.supports.map(l => ({
        price: roundToStep(l.price, params.rounding.priceStep),
        touches: l.touches,
        clusterScore: roundToStep(clamp01(l.clusterScore), params.rounding.scoreStep),
      })),
      resistances: sr.resistances.map(l => ({
        price: roundToStep(l.price, params.rounding.priceStep),
        touches: l.touches,
        clusterScore: roundToStep(clamp01(l.clusterScore), params.rounding.scoreStep),
      })),
    },
    liquidityEvents,
    indicatorSnapshot,
    patternCandidates,
  };
}

export function buildChartFeaturePackWithCacheMeta(input: {
  mint: string;
  timeframe: SolTimeframe;
  candles: InputCandle[];
  symbol?: string;
  endTs?: number;
  limit?: number;
  params?: Partial<BuildParams>;
}): { pack: ChartFeaturePack; cacheKey: string; candlesHash: string; paramsHash: string; featurePackHash: string } {
  const pack = buildChartFeaturePack({
    mint: input.mint,
    timeframe: input.timeframe,
    candles: input.candles,
    symbol: input.symbol,
    params: input.params,
  });

  const paramsMerged: BuildParams = {
    ...DEFAULT_BUILD_PARAMS,
    ...(input.params ?? {}),
    pivot: { ...DEFAULT_BUILD_PARAMS.pivot, ...(input.params?.pivot ?? {}) } as BuildParams['pivot'],
    candleLimit: { ...DEFAULT_BUILD_PARAMS.candleLimit, ...(input.params?.candleLimit ?? {}) } as BuildParams['candleLimit'],
    sweep: { ...DEFAULT_BUILD_PARAMS.sweep, ...(input.params?.sweep ?? {}) },
    pattern: { ...DEFAULT_BUILD_PARAMS.pattern, ...(input.params?.pattern ?? {}) },
    rounding: { ...DEFAULT_BUILD_PARAMS.rounding, ...(input.params?.rounding ?? {}) },
  };

  const endTs = input.endTs ?? pack.window.endTs;
  const limit = input.limit ?? pack.window.candles;

  const candlesHash = computeCandlesHash(input.candles.slice(Math.max(0, input.candles.length - limit)));
  const paramsHash = computeParamsHash({ timeframe: input.timeframe, params: paramsMerged });
  const cacheKey = `chartfp:${input.mint}:${input.timeframe}:${endTs}:${limit}:${paramsHash}:${candlesHash}`;

  const featurePackHash = sha256Hex(stableStringify(pack as any));
  return { pack, cacheKey, candlesHash, paramsHash, featurePackHash };
}

