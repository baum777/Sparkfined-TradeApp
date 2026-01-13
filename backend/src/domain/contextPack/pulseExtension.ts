/**
 * Pulse Extension Service (FROZEN SPEC)
 * Extends Pulse responses with ContextPack overlays and confidence modulation
 */

import type { ContextPack } from './types.js';
import type {
  PulseContextExtension,
  PulseOverlay,
  PulseOverlayCode,
  OverlaySeverity,
} from './types.js';

/**
 * Build Pulse context extension from ContextPack
 * Per FROZEN SPEC section 3
 */
export function buildPulseContextExtension(
  contextPack: ContextPack | null
): PulseContextExtension | undefined {
  if (!contextPack) {
    return undefined;
  }
  
  const overlays = computePulseOverlays(contextPack);
  const confidence = computePulseConfidence(contextPack);
  const narrativeTag = computeNarrativeTag(contextPack);
  
  return {
    confidence,
    overlays,
    narrativeTag,
    asOfISO: contextPack.generatedAtISO,
  };
}

/**
 * Compute Pulse overlays per FROZEN SPEC section 3
 */
function computePulseOverlays(contextPack: ContextPack): PulseOverlay[] {
  const overlays: PulseOverlay[] = [];
  
  // Pro+ tier required for indicators
  if (contextPack.tier === 'pro' || contextPack.tier === 'high') {
    const rsi14 = contextPack.market?.indicators?.rsi14;
    const trendState = contextPack.market?.indicators?.trendState;
    
    // OVERBOUGHT overlay (pro+)
    if (rsi14 !== undefined && rsi14 >= 70) {
      overlays.push({
        code: 'OVERBOUGHT',
        severity: rsi14 >= 80 ? 'high' : 'medium',
        reason: `RSI14 is ${rsi14.toFixed(1)}, indicating overbought conditions`,
        evidence: ['market.indicators.rsi14'],
      });
    }
    
    // OVERSOLD overlay (pro+)
    if (rsi14 !== undefined && rsi14 <= 30) {
      overlays.push({
        code: 'OVERSOLD',
        severity: rsi14 <= 20 ? 'high' : 'medium',
        reason: `RSI14 is ${rsi14.toFixed(1)}, indicating oversold conditions`,
        evidence: ['market.indicators.rsi14'],
      });
    }
  }
  
  // Narrative overlays (pro/high + narrative)
  if (contextPack.narrative) {
    // HIGH_NOISE_NARRATIVE overlay
    if (contextPack.narrative.flags.highNoise) {
      overlays.push({
        code: 'HIGH_NOISE_NARRATIVE',
        severity: 'medium',
        reason: 'Narrative analysis shows high noise levels in social signals',
        evidence: ['narrative.flags.highNoise'],
      });
    }
    
    // LOW_EVIDENCE_NARRATIVE overlay
    if (contextPack.narrative.flags.lowEvidence) {
      overlays.push({
        code: 'LOW_EVIDENCE_NARRATIVE',
        severity: 'low',
        reason: 'Narrative analysis shows low evidence quality',
        evidence: ['narrative.flags.lowEvidence'],
      });
    }
  }
  
  // Combined overlays (pro+)
  if (contextPack.tier === 'pro' || contextPack.tier === 'high') {
    const rsi14 = contextPack.market?.indicators?.rsi14;
    const narrative = contextPack.narrative;
    
    // FOMO_RISK: OVERBOUGHT + bullish narrative + high noise
    if (rsi14 !== undefined && rsi14 >= 70 && narrative) {
      const isBullish = narrative.sentiment.label === 'bullish';
      const hasHighNoise = narrative.flags.highNoise;
      
      if (isBullish && hasHighNoise) {
        overlays.push({
          code: 'FOMO_RISK',
          severity: 'high',
          reason: 'Overbought conditions combined with bullish but noisy narrative suggests FOMO risk',
          evidence: ['market.indicators.rsi14', 'narrative.sentiment.label', 'narrative.flags.highNoise'],
        });
      }
    }
    
    // FALLING_KNIFE_RISK: OVERSOLD + negative deltas
    if (rsi14 !== undefined && rsi14 <= 30 && contextPack.deltas) {
      const hasNegativeDelta = contextPack.deltas.windows.some(
        w => w.priceDeltaPct !== undefined && w.priceDeltaPct <= -10
      );
      
      if (hasNegativeDelta) {
        const negativeWindow = contextPack.deltas.windows.find(
          w => w.priceDeltaPct !== undefined && w.priceDeltaPct <= -10
        );
        
        overlays.push({
          code: 'FALLING_KNIFE_RISK',
          severity: 'high',
          reason: `Oversold conditions with ${negativeWindow?.priceDeltaPct?.toFixed(1)}% price drop within ${negativeWindow?.label} suggests falling knife risk`,
          evidence: ['market.indicators.rsi14', 'deltas.windows'],
        });
      }
    }
  }
  
  // LOW_LIQUIDITY overlay (if liquidity data available)
  if (contextPack.market?.liquidityUsd !== undefined && contextPack.market.liquidityUsd < 10000) {
    overlays.push({
      code: 'LOW_LIQUIDITY',
      severity: 'medium',
      reason: `Low liquidity ($${contextPack.market.liquidityUsd.toLocaleString()}) may cause slippage`,
      evidence: ['market.liquidityUsd'],
    });
  }
  
  return overlays;
}

/**
 * Compute Pulse confidence per FROZEN SPEC section 3
 * Base = 0.6
 * +0.1 if evidenceLevel high
 * -0.1 if noiseLevel high
 * -0.1 if lowEvidence
 * Clamp 0..1
 */
function computePulseConfidence(contextPack: ContextPack): number {
  let confidence = 0.6; // Base
  
  // +0.1 if evidenceLevel high
  if (contextPack.reliability.evidenceLevel === 'high') {
    confidence += 0.1;
  }
  
  // -0.1 if noiseLevel high
  if (contextPack.reliability.noiseLevel === 'high') {
    confidence -= 0.1;
  }
  
  // -0.1 if lowEvidence (from narrative)
  if (contextPack.narrative?.flags.lowEvidence) {
    confidence -= 0.1;
  }
  
  // Clamp to 0..1
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Compute narrative tag if narrative is available
 */
function computeNarrativeTag(
  contextPack: ContextPack
): { label: string; reliability: 'low' | 'medium' | 'high' } | undefined {
  if (!contextPack.narrative) {
    return undefined;
  }
  
  const sentiment = contextPack.narrative.sentiment.label;
  const evidenceLevel = contextPack.narrative.quality.evidenceLevel;
  
  // Map sentiment to label
  let label = sentiment;
  if (sentiment === 'bullish') {
    label = 'Bullish narrative';
  } else if (sentiment === 'bearish') {
    label = 'Bearish narrative';
  } else if (sentiment === 'neutral') {
    label = 'Neutral narrative';
  } else if (sentiment === 'mixed') {
    label = 'Mixed narrative';
  }
  
  // Map evidence level to reliability
  const reliability: 'low' | 'medium' | 'high' =
    evidenceLevel === 'high' ? 'high' :
    evidenceLevel === 'medium' ? 'medium' : 'low';
  
  return { label, reliability };
}


