import { sha256Hex } from '../../routes/reasoning/hash.js';
import type { ResolvedTier } from '../../config/tiers.js';
import { tierGte } from '../../config/tiers.js';
import type { AtTradeMarketSnapshot } from '../market/snapshot.service.js';
import type { DeltaSnapshot } from '../market/delta.service.js';
import type { GrokSentimentSnapshot } from '../grokPulse/types.js';
import type { UserSettings } from '../settings/settings.types.js';
import type {
  ContextPack,
  ContextAnchorMode,
  DeltaSnapshots,
  EvidenceLevel,
  MarketSnapshotAtTime,
  NoiseLevel,
  JournalNarrativeSnapshot,
} from '../../contracts/contextPack.js';

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function roundIsoTo5Min(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const bucketMs = 5 * 60 * 1000;
  const rounded = Math.floor(t / bucketMs) * bucketMs;
  return new Date(rounded).toISOString();
}

function secondsSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 1000));
}

function rsiToTrendState(rsi?: number | null): MarketSnapshotAtTime['indicators'] extends infer I
  ? I extends { trendState?: infer T }
    ? T
    : never
  : never {
  if (rsi === null || rsi === undefined) return undefined as any;
  if (rsi >= 70) return 'overbought' as any;
  if (rsi <= 30) return 'oversold' as any;
  return 'neutral' as any;
}

function deriveNarrativeFromPulseSnapshot(input: {
  cacheKey: string;
  anchorMode: ContextAnchorMode;
  pulse: GrokSentimentSnapshot;
}): JournalNarrativeSnapshot {
  const { cacheKey, anchorMode, pulse } = input;

  const evidenceLevel: EvidenceLevel =
    pulse.low_confidence || pulse.confidence < 0.5 ? 'low' : pulse.confidence >= 0.75 ? 'high' : 'medium';

  const highNoise = pulse.confidence < 0.45 || (pulse.low_confidence && (pulse.label === 'MOON' || pulse.label === 'RUG'));
  const lowEvidence = evidenceLevel === 'low';

  const sentimentLabel: JournalNarrativeSnapshot['sentiment']['label'] =
    pulse.label === 'BEAR' || pulse.label === 'STRONG_BEAR' || pulse.label === 'RUG' || pulse.label === 'DEAD'
      ? 'bearish'
      : pulse.label === 'NEUTRAL' || pulse.label === 'UNKNOWN'
        ? 'neutral'
        : 'bullish';

  const headline = `Pulse Snapshot: ${pulse.label} (${pulse.score})`;

  const bulletsRaw = [
    pulse.one_liner,
    pulse.top_snippet,
    pulse.reason ? `Reason: ${pulse.reason}` : null,
    `CTA: ${pulse.cta}`,
    'Snapshot-only context; not factual proof.',
    'Treat narrative as context, not justification.',
  ].filter((b): b is string => typeof b === 'string' && b.trim().length > 0);

  const summaryBullets = bulletsRaw.slice(0, 6);
  while (summaryBullets.length < 5) summaryBullets.push('No additional narrative evidence provided.');

  const themes: string[] = [];
  if (pulse.sentiment_term) themes.push(pulse.sentiment_term);
  themes.push(sentimentLabel === 'bullish' ? 'momentum' : sentimentLabel === 'bearish' ? 'drawdown' : 'uncertainty');
  if (themes.length < 2) themes.push('context');

  const risks: string[] = [];
  if (pulse.label === 'RUG') risks.push('Rug risk');
  if (pulse.label === 'DEAD') risks.push('Low activity / dead token risk');
  if (pulse.low_confidence) risks.push('Low confidence narrative');
  if (highNoise) risks.push('High noise / hype risk');

  const mode: JournalNarrativeSnapshot['mode'] =
    anchorMode === 'launch_centered' ? 'launch_centered' : anchorMode === 'latest_only' ? 'latest_only' : 'trade_centered';

  return {
    cacheKey,
    mode,
    windows: { preHours: 6, postHours: 6 },
    counts: { strictPre: 0, strictPost: 0, symbolPre: 0, symbolPost: 0, latest: 1 },
    quality: {
      evidenceLevel,
      passedThresholdCount: pulse.confidence >= 0.6 ? 1 : 0,
    },
    flags: { lowEvidence, highNoise },
    sources: { topAuthors: [], usedPresetQuants: [], usedUserQuants: [] },
    headline,
    summaryBullets,
    sentiment: { label: sentimentLabel, confidence: clamp01(pulse.confidence) },
    themes: themes.slice(0, 4),
    risks: risks.slice(0, 5),
    evidencePosts: [],
  };
}

function deriveReliability(input: {
  market?: MarketSnapshotAtTime;
  deltas?: DeltaSnapshots;
  narrative?: JournalNarrativeSnapshot;
}): { evidenceLevel: EvidenceLevel; noiseLevel: NoiseLevel; dataCompleteness: 0 | 1 | 2 | 3 } {
  const hasMarket = !!input.market;
  const hasDeltas = !!input.deltas;
  const hasNarrative = !!input.narrative;

  const dataCompleteness: 0 | 1 | 2 | 3 = hasNarrative ? 3 : hasDeltas ? 2 : hasMarket ? 1 : 0;

  const evidenceLevel: EvidenceLevel = input.narrative?.quality.evidenceLevel ?? (hasMarket ? 'medium' : 'low');
  const noiseLevel: NoiseLevel = input.narrative?.flags.highNoise ? 'high' : 'low';

  return { evidenceLevel, noiseLevel, dataCompleteness };
}

export function buildContextPackCacheKey(input: {
  userId: string;
  mint: string;
  anchorMode: ContextAnchorMode;
  anchorTimeISO: string;
  tier: Exclude<ResolvedTier, null>;
  includeGrok: boolean;
  deltasEnabled: boolean;
  // Future-proof placeholders (contract mentions them; backend can fill later)
  presetQuantsVersion?: string;
  userQuantsHash?: string;
}): string {
  const anchorRounded = roundIsoTo5Min(input.anchorTimeISO);
  const narrativePart = input.includeGrok
    ? `${input.userQuantsHash ?? 'noUserQuants'}:${input.presetQuantsVersion ?? 'preset:v1'}`
    : 'noNarrative';
  const deltasPart = input.deltasEnabled ? 'deltas' : 'noDeltas';

  return sha256Hex([input.userId, input.mint, input.anchorMode, anchorRounded, input.tier, narrativePart, deltasPart].join('|'));
}

export function buildContextPackForJournalEntry(input: {
  userId: string;
  tier: Exclude<ResolvedTier, null>;
  settings: UserSettings;
  asset: { mint: string; symbol?: string; name?: string };
  anchor: { mode: ContextAnchorMode; anchorTimeISO: string };
  generatedAtISO: string;
  atTradeSnapshot?: AtTradeMarketSnapshot;
  orderPressure?: { buySellImbalance?: number; largeTxCount?: number; avgTradeSizeDelta?: number };
  deltaSnapshots?: Record<string, DeltaSnapshot | null>;
  includeGrok: boolean;
  pulseNarrativeSnapshot?: GrokSentimentSnapshot | null;
}): ContextPack {
  const { userId, tier, settings, asset, anchor, generatedAtISO } = input;

  const deltasEnabled = tierGte(tier, 'pro');
  const includeNarrative = tierGte(tier, 'pro') && settings.ai.grokEnabled === true && input.includeGrok === true;

  const market: MarketSnapshotAtTime | undefined = tierGte(tier, 'standard') && input.atTradeSnapshot
    ? {
        asOfISO: input.atTradeSnapshot.capturedAt,
        priceUsd: input.atTradeSnapshot.priceUsd,
        marketCapUsd: input.atTradeSnapshot.marketCapUsd,
        volume24hUsd: input.atTradeSnapshot.volume24hUsd,
        holdersCount: input.atTradeSnapshot.holdersCount,
        indicators: tierGte(tier, 'pro')
          ? {
              rsi14: input.atTradeSnapshot.rsi14 ?? undefined,
              trendState: rsiToTrendState(input.atTradeSnapshot.rsi14 ?? undefined),
            }
          : undefined,
        orderPressure:
          tier === 'high' && input.orderPressure
            ? {
                buySellImbalance: input.orderPressure.buySellImbalance,
                largeTxCount: input.orderPressure.largeTxCount,
                avgTradeSizeDelta: input.orderPressure.avgTradeSizeDelta,
              }
            : undefined,
      }
    : undefined;

  const deltas: DeltaSnapshots | undefined =
    deltasEnabled && input.deltaSnapshots
      ? {
          windows: (['+15m', '+1h', '+4h'] as const)
            .map((label) => {
              const d = input.deltaSnapshots?.[label];
              if (!d) return null;
              const volume24hDeltaPct =
                input.atTradeSnapshot?.volume24hUsd && input.atTradeSnapshot.volume24hUsd !== 0
                  ? (d.volumeDelta24hUsd / input.atTradeSnapshot.volume24hUsd) * 100
                  : undefined;
              return {
                label,
                asOfISO: d.capturedAt,
                priceDeltaPct: d.priceDeltaPercent,
                volume24hDeltaPct: volume24hDeltaPct !== undefined ? Math.round(volume24hDeltaPct * 100) / 100 : undefined,
              };
            })
            .filter((x): x is NonNullable<typeof x> => !!x),
          note: 'after-trade context only',
        }
      : undefined;

  const cacheKey = buildContextPackCacheKey({
    userId,
    mint: asset.mint,
    anchorMode: anchor.mode,
    anchorTimeISO: anchor.anchorTimeISO,
    tier,
    includeGrok: includeNarrative,
    deltasEnabled,
  });

  const narrative: JournalNarrativeSnapshot | undefined =
    includeNarrative && input.pulseNarrativeSnapshot
      ? deriveNarrativeFromPulseSnapshot({ cacheKey, anchorMode: anchor.mode, pulse: input.pulseNarrativeSnapshot })
      : undefined;

  const reliability = deriveReliability({ market, deltas, narrative });

  const id = sha256Hex(['contextPack:v1', cacheKey].join('|'));
  const freshnessSec = secondsSince(generatedAtISO);

  return {
    id,
    userId,
    asset,
    anchor,
    tier,
    generatedAtISO,
    freshnessSec,
    ...(market ? { market } : {}),
    ...(deltas ? { deltas } : {}),
    ...(narrative ? { narrative } : {}),
    reliability,
  };
}

