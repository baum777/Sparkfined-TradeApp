import type { GrokSentimentSnapshot, PulseGlobalToken } from './types.js';

export function calculateFallbackSentiment(
  token: PulseGlobalToken, 
  previousSnapshot: GrokSentimentSnapshot | null
): GrokSentimentSnapshot {
  let score = previousSnapshot ? previousSnapshot.score * 0.9 : 0; // Decay old score
  
  // Heuristics
  const age = token.ageMinutes || 0;
  const vol = token.volume24h || 0;
  const mcap = token.marketCap || 0;

  // 1. Dead Project Risk
  if (vol < 10000 && age > 1440) { // <10k vol after 24h
    score -= 20;
  }

  // 2. High Cap Momentum
  if (mcap > 10_000_000 && vol > 1_000_000) { // >10M cap, >1M vol
    score += 10;
  }

  // Clamp -100..100
  score = Math.max(-100, Math.min(100, score));

  return {
    score,
    label: score > 0 ? 'BULL' : 'BEAR', // Simple heuristic label
    confidence: 0.6,
    low_confidence: true,
    cta: 'WATCH',
    one_liner: 'Calculated via fallback heuristics due to quota/error.',
    top_snippet: 'N/A',
    ts: Date.now(),
    delta: previousSnapshot ? score - previousSnapshot.score : 0,
    source: 'fallback',
    reason: 'Grok API unavailable or quota exceeded'
  };
}



