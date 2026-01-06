import type { PulseGlobalToken } from './types.js';

export function buildGrokContext(token: PulseGlobalToken): string {
  const parts = [
    `Token Analysis for ${token.symbol} (${token.address}) on Solana`,
    `Data Sources: DexPaprika (Price/Vol), Moralis (Metadata)`
  ];

  if (token.marketCap) {
    parts.push(`Market Cap (FDV): $${token.marketCap.toLocaleString()}`);
  }
  if (token.volume24h) {
    parts.push(`24h Volume: $${token.volume24h.toLocaleString()}`);
  }
  if (token.ageMinutes) {
    const hours = (token.ageMinutes / 60).toFixed(1);
    parts.push(`Age: ~${hours} hours`);
  }

  parts.push('');
  parts.push('Output: JSON-only with fields: score (-100..100), label (MOON|STRONG_BULL|BULL|NEUTRAL|BEAR|STRONG_BEAR|RUG), confidence (0..1), cta (word), one_liner, top_snippet');

  return parts.join('\n');
}




