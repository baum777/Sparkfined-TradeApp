import type { Token } from './types';
import { filterSpec } from './spec';

/**
 * Berechne Ranking Score für ranked Tab
 * Output: 0..100
 */
export function computeRankScore(
  token: Token,
  presetId?: 'signal_fusion' | 'strict_safety_gate' | 'organic_momentum'
): number {
  // Verwende score_formula aus preset oder default
  const formula =
    presetId === 'signal_fusion'
      ? filterSpec.presets.signal_fusion.ranking?.score_formula
      : filterSpec.tabs.ranked.fixed.score_formula;

  if (!formula) {
    return 0;
  }

  const { weights, caps } = formula;

  // DEX Trend (0..100)
  const dexTrend = computeDexTrend(token);
  const dexTrendScore = Math.min(100, Math.max(0, dexTrend));

  // Volume Acceleration (0..100)
  const volumeAccel = computeVolumeAcceleration(token);
  const volumeAccelScore = Math.min(100, Math.max(0, volumeAccel));

  // Holder Growth (0..100)
  const holderGrowth = computeHolderGrowth(token);
  const holderGrowthScore = Math.min(100, Math.max(0, holderGrowth));

  // Oracle Sentiment (-1..+1, dann normalisiert zu 0..100)
  const oracleSentiment = token.oracle.sentiment ?? 0;
  const oracleSentimentAbs = Math.min(
    Math.abs(oracleSentiment),
    caps.oracle_sentiment_abs_max
  );
  const oracleSentimentScore = ((oracleSentimentAbs / caps.oracle_sentiment_abs_max) * 100 + 50) / 1.5; // Normalize to 0..100

  // Social Velocity (0..100)
  const socialVelocity = token.social.x_velocity_15m ?? 0;
  const socialVelocityCapped = Math.min(socialVelocity, caps.social_velocity_cap);
  const socialVelocityScore = (socialVelocityCapped / caps.social_velocity_cap) * 100;

  // Weighted Sum
  let score =
    dexTrendScore * weights.dex_trend +
    volumeAccelScore * weights.volume_accel +
    holderGrowthScore * weights.holder_growth +
    oracleSentimentScore * weights.oracle_sentiment +
    socialVelocityScore * weights.social_velocity;

  // Confidence Boost (wenn preset signal_fusion)
  if (presetId === 'signal_fusion' && filterSpec.presets.signal_fusion.ranking?.sentiment_confidence_boost) {
    const boost = filterSpec.presets.signal_fusion.ranking.sentiment_confidence_boost;
    if (boost.if(token)) {
      score *= boost.multiplier;
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * DEX Trend: Kombination aus Price Change und Volume
 */
function computeDexTrend(token: Token): number {
  const priceChange5m = token.trading.price_change_5m;
  const priceChange60m = token.trading.price_change_60m;
  const volume5m = token.trading.volume_usd_5m;
  const volume60m = token.trading.volume_usd_60m;

  // Price momentum (weighted: 5m 70%, 60m 30%)
  const priceMomentum = priceChange5m * 0.7 + priceChange60m * 0.3;

  // Volume trend
  const volumeTrend = volume60m > 0 ? volume5m / volume60m : 0;

  // Kombiniere (0..100)
  return Math.min(100, (priceMomentum * 50 + Math.min(volumeTrend * 50, 50)));
}

/**
 * Volume Acceleration: Wie schnell wächst das Volumen?
 */
function computeVolumeAcceleration(token: Token): number {
  const vol5m = token.trading.volume_usd_5m;
  const vol15m = token.trading.volume_usd_15m;
  const vol60m = token.trading.volume_usd_60m;

  if (vol60m === 0) {
    return vol5m > 0 ? 50 : 0;
  }

  // Acceleration rate
  const accel5m = vol5m / (vol60m / 12); // 5m vs 60m/12
  const accel15m = vol15m / (vol60m / 4); // 15m vs 60m/4

  // Kombiniere
  const accel = (accel5m * 0.6 + accel15m * 0.4);

  return Math.min(100, accel * 20); // Scale to 0..100
}

/**
 * Holder Growth: Wie verteilt sind die Holder?
 */
function computeHolderGrowth(token: Token): number {
  const holderCount = token.holders.holder_count;
  const top1Pct = token.holders.top1_pct;
  const top10Pct = token.holders.top10_pct;

  // Holder Count Score (0..50)
  const holderCountScore = Math.min(50, (holderCount / 500) * 50);

  // Distribution Score (0..50) - niedrigere Konzentration = besser
  const distributionScore = Math.max(0, 50 - (top1Pct * 2 + top10Pct * 0.5));

  return holderCountScore + distributionScore;
}

