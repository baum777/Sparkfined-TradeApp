/**
 * Oracle Extension Service (FROZEN SPEC)
 * Extends Oracle responses with ContextPack evidence summary and patterns
 */

import type { ContextPack } from './types.js';
import type {
  OracleContextExtension,
  OraclePattern,
  OraclePatternCode,
  OracleBiasFlag,
  EvidenceLevel,
  NoiseLevel,
} from './types.js';

/**
 * Build Oracle context extension from ContextPack
 * Per FROZEN SPEC section 4
 */
export function buildOracleContextExtension(
  contextPack: ContextPack | null
): OracleContextExtension | undefined {
  if (!contextPack) {
    return undefined;
  }
  
  const contextEvidenceSummary = computeContextEvidenceSummary(contextPack);
  const patterns = computeOraclePatterns(contextPack);
  const biasFlags = computeBiasFlags(contextPack);
  
  // Only return if there's meaningful data
  if (!contextEvidenceSummary && (!patterns || patterns.length === 0) && (!biasFlags || biasFlags.length === 0)) {
    return undefined;
  }
  
  return {
    contextEvidenceSummary,
    patterns: patterns && patterns.length > 0 ? patterns : undefined,
    biasFlags: biasFlags && biasFlags.length > 0 ? biasFlags : undefined,
  };
}

/**
 * Compute context evidence summary per FROZEN SPEC section 4
 */
function computeContextEvidenceSummary(
  contextPack: ContextPack
): OracleContextExtension['contextEvidenceSummary'] {
  const used: Array<'market' | 'deltas' | 'narrative'> = [];
  const notes: string[] = [];
  
  if (contextPack.market) {
    used.push('market');
  }
  
  if (contextPack.deltas) {
    used.push('deltas');
  }
  
  if (contextPack.narrative) {
    used.push('narrative');
    
    // Add caveats for narrative
    if (contextPack.narrative.flags.lowEvidence) {
      notes.push('Narrative mostly hype/no proof links');
    }
    if (contextPack.narrative.flags.highNoise) {
      notes.push('Narrative shows high noise levels');
    }
    if (contextPack.narrative.quality.evidenceLevel === 'low') {
      notes.push('Narrative evidence level is low');
    }
  }
  
  return {
    evidenceLevel: contextPack.reliability.evidenceLevel,
    noiseLevel: contextPack.reliability.noiseLevel,
    used,
    notes,
  };
}

/**
 * Compute Oracle patterns per FROZEN SPEC section 4
 * Examples: FOMO_ENTRY, FALLING_KNIFE, STEADY_ACCUMULATION, LATE_BREAKOUT, LIQUIDITY_EXIT_RISK
 */
function computeOraclePatterns(contextPack: ContextPack): OraclePattern[] {
  const patterns: OraclePattern[] = [];
  
  // Pro+ tier required for patterns
  if (contextPack.tier !== 'pro' && contextPack.tier !== 'high') {
    return patterns;
  }
  
  const rsi14 = contextPack.market?.indicators?.rsi14;
  const trendState = contextPack.market?.indicators?.trendState;
  const volume24hUsd = contextPack.market?.volume24hUsd;
  const narrative = contextPack.narrative;
  const deltas = contextPack.deltas;
  
  // FOMO_ENTRY pattern (pro+)
  // Requires: rsi14 >= 70 at-trade AND (volume24hUsd high OR narrative bullish) AND narrative evidenceLevel != low
  if (rsi14 !== undefined && rsi14 >= 70) {
    const hasHighVolume = volume24hUsd !== undefined && volume24hUsd > 1000000; // Threshold TBD
    const isBullishNarrative = narrative && narrative.sentiment.label === 'bullish';
    const narrativeUsable = narrative && 
                             narrative.quality.evidenceLevel !== 'low' && 
                             !narrative.flags.highNoise;
    
    if (hasHighVolume || (isBullishNarrative && narrativeUsable)) {
      const evidence: Array<{ ref: string; detail: string }> = [
        { ref: 'market.indicators.rsi14', detail: `RSI14: ${rsi14.toFixed(1)}` },
      ];
      
      if (hasHighVolume) {
        evidence.push({ ref: 'market.volume24hUsd', detail: `24h volume: $${volume24hUsd?.toLocaleString()}` });
      }
      
      if (isBullishNarrative && narrativeUsable) {
        evidence.push({ ref: 'narrative.sentiment.label', detail: `Narrative: ${narrative.sentiment.label}` });
      }
      
      patterns.push({
        code: 'FOMO_ENTRY',
        confidence: computePatternConfidence(rsi14, narrativeUsable),
        evidence,
      });
    }
  }
  
  // FALLING_KNIFE pattern (pro+)
  // Requires: rsi14 <= 30 at-trade AND delta window shows priceDeltaPct <= -10 within +1h
  if (rsi14 !== undefined && rsi14 <= 30 && deltas) {
    const negativeWindow = deltas.windows.find(
      w => w.label === '+1h' && w.priceDeltaPct !== undefined && w.priceDeltaPct <= -10
    );
    
    if (negativeWindow) {
      patterns.push({
        code: 'FALLING_KNIFE',
        confidence: computePatternConfidence(rsi14, false),
        evidence: [
          { ref: 'market.indicators.rsi14', detail: `RSI14: ${rsi14.toFixed(1)}` },
          { ref: 'deltas.windows.+1h', detail: `Price delta: ${negativeWindow.priceDeltaPct?.toFixed(1)}%` },
        ],
      });
    }
  }
  
  // STEADY_ACCUMULATION pattern
  // Requires: neutral trend, steady volume, positive but small deltas
  if (trendState === 'neutral' && deltas) {
    const hasSteadyPositiveDeltas = deltas.windows.every(
      w => w.priceDeltaPct !== undefined && w.priceDeltaPct > 0 && w.priceDeltaPct < 5
    );
    
    if (hasSteadyPositiveDeltas) {
      patterns.push({
        code: 'STEADY_ACCUMULATION',
        confidence: 0.6,
        evidence: [
          { ref: 'market.indicators.trendState', detail: 'Trend: neutral' },
          { ref: 'deltas.windows', detail: 'Steady positive price deltas' },
        ],
      });
    }
  }
  
  // LATE_BREAKOUT pattern
  // Requires: high volume spike, positive deltas, narrative bullish
  if (volume24hUsd !== undefined && volume24hUsd > 2000000 && deltas && narrative) {
    const hasPositiveDeltas = deltas.windows.some(w => w.priceDeltaPct !== undefined && w.priceDeltaPct > 10);
    const isBullish = narrative.sentiment.label === 'bullish';
    
    if (hasPositiveDeltas && isBullish) {
      patterns.push({
        code: 'LATE_BREAKOUT',
        confidence: 0.7,
        evidence: [
          { ref: 'market.volume24hUsd', detail: `High volume: $${volume24hUsd.toLocaleString()}` },
          { ref: 'deltas.windows', detail: 'Positive price deltas' },
          { ref: 'narrative.sentiment.label', detail: `Narrative: ${narrative.sentiment.label}` },
        ],
      });
    }
  }
  
  // LIQUIDITY_EXIT_RISK pattern
  // Requires: liquidityDeltaPct <= -20 within +1h/+4h (pro/high)
  if (deltas) {
    const liquidityDropWindow = deltas.windows.find(
      w => w.liquidityDeltaPct !== undefined && w.liquidityDeltaPct <= -20
    );
    
    if (liquidityDropWindow) {
      patterns.push({
        code: 'LIQUIDITY_EXIT_RISK',
        confidence: 0.8,
        evidence: [
          { ref: 'deltas.windows', detail: `Liquidity drop: ${liquidityDropWindow.liquidityDeltaPct?.toFixed(1)}% within ${liquidityDropWindow.label}` },
        ],
      });
    }
  }
  
  return patterns;
}

/**
 * Compute bias flags per FROZEN SPEC section 4
 */
function computeBiasFlags(contextPack: ContextPack): OracleBiasFlag[] {
  const flags: OracleBiasFlag[] = [];
  
  // Narrative arbitration: if narrative has low evidence or high noise, flag it
  if (contextPack.narrative) {
    if (contextPack.narrative.flags.lowEvidence) {
      flags.push({
        code: 'LOW_EVIDENCE_NARRATIVE',
        severity: 'medium',
        evidence: ['narrative.flags.lowEvidence'],
      });
    }
    
    if (contextPack.narrative.flags.highNoise) {
      flags.push({
        code: 'HIGH_NOISE_NARRATIVE',
        severity: 'high',
        evidence: ['narrative.flags.highNoise'],
      });
    }
    
    // If narrative is used but shouldn't be (low evidence + high noise)
    if (contextPack.narrative.flags.lowEvidence && contextPack.narrative.flags.highNoise) {
      flags.push({
        code: 'NARRATIVE_NOT_RELIABLE',
        severity: 'high',
        evidence: ['narrative.flags.lowEvidence', 'narrative.flags.highNoise'],
      });
    }
  }
  
  return flags;
}

/**
 * Compute pattern confidence based on indicators and narrative quality
 */
function computePatternConfidence(rsi14: number, narrativeUsable: boolean): number {
  let confidence = 0.6; // Base
  
  // Higher RSI extremes increase confidence
  if (rsi14 >= 80 || rsi14 <= 20) {
    confidence += 0.1;
  }
  
  // Narrative adds confidence if usable
  if (narrativeUsable) {
    confidence += 0.1;
  }
  
  return Math.min(0.95, confidence);
}


