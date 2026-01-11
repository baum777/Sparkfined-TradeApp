import type { ContextPack } from '../../contracts/contextPack.js';

export type PulseOverlayCode =
  | 'FOMO_RISK'
  | 'FALLING_KNIFE_RISK'
  | 'LOW_EVIDENCE_NARRATIVE'
  | 'HIGH_NOISE_NARRATIVE'
  | 'OVERBOUGHT'
  | 'OVERSOLD'
  | 'LOW_LIQUIDITY';

export type PulseOverlay = {
  code: PulseOverlayCode;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  evidence: string[];
};

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function buildPulseContextFromContextPack(pack: ContextPack): {
  confidence: number;
  overlays: PulseOverlay[];
  narrativeTag?: { label: string; reliability: 'low' | 'medium' | 'high' };
  asOfISO: string;
} {
  const overlays: PulseOverlay[] = [];

  const rsi = pack.market?.indicators?.rsi14;
  if (typeof rsi === 'number') {
    if (rsi >= 70) {
      overlays.push({
        code: 'OVERBOUGHT',
        severity: 'medium',
        reason: 'RSI14 indicates overbought conditions.',
        evidence: ['market.indicators.rsi14'],
      });
    }
    if (rsi <= 30) {
      overlays.push({
        code: 'OVERSOLD',
        severity: 'medium',
        reason: 'RSI14 indicates oversold conditions.',
        evidence: ['market.indicators.rsi14'],
      });
    }
  }

  if (pack.narrative?.flags.highNoise) {
    overlays.push({
      code: 'HIGH_NOISE_NARRATIVE',
      severity: 'medium',
      reason: 'Narrative signal appears high-noise / hype-skewed.',
      evidence: ['narrative.flags.highNoise'],
    });
  }
  if (pack.narrative?.flags.lowEvidence) {
    overlays.push({
      code: 'LOW_EVIDENCE_NARRATIVE',
      severity: 'medium',
      reason: 'Narrative has low evidence quality; treat as context only.',
      evidence: ['narrative.flags.lowEvidence', 'narrative.quality.evidenceLevel'],
    });
  }

  const delta1h = pack.deltas?.windows?.find((w) => w.label === '+1h');
  if (
    overlays.some((o) => o.code === 'OVERSOLD') &&
    delta1h &&
    typeof delta1h.priceDeltaPct === 'number' &&
    delta1h.priceDeltaPct <= -10
  ) {
    overlays.push({
      code: 'FALLING_KNIFE_RISK',
      severity: 'high',
      reason: 'Oversold at entry and price continued dropping sharply within +1h (after-trade).',
      evidence: ['market.indicators.rsi14', 'deltas.windows[label=+1h].priceDeltaPct'],
    });
  }

  const narrativeBullish = pack.narrative?.sentiment.label === 'bullish';
  const hasOverbought = overlays.some((o) => o.code === 'OVERBOUGHT');
  const highNoise = !!pack.narrative?.flags.highNoise;
  if (hasOverbought && narrativeBullish && highNoise) {
    overlays.push({
      code: 'FOMO_RISK',
      severity: 'high',
      reason: 'Overbought + bullish narrative + high noise: elevated FOMO risk.',
      evidence: ['market.indicators.rsi14', 'narrative.sentiment.label', 'narrative.flags.highNoise'],
    });
  }

  // Confidence policy (deterministic)
  let confidence = 0.6;
  if (pack.reliability.evidenceLevel === 'high') confidence += 0.1;
  if (pack.reliability.noiseLevel === 'high') confidence -= 0.1;
  if (pack.narrative?.flags.lowEvidence) confidence -= 0.1;
  confidence = clamp01(confidence);

  const narrativeTag =
    pack.narrative
      ? {
          label: pack.narrative.sentiment.label,
          reliability: pack.narrative.quality.evidenceLevel,
        }
      : undefined;

  const asOfISO = pack.market?.asOfISO ?? pack.generatedAtISO;

  return { confidence, overlays, ...(narrativeTag ? { narrativeTag } : {}), asOfISO };
}

