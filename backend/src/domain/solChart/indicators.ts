import { mean } from './math.js';

export function rsi(close: number[], window = 14): number | null {
  if (close.length < window + 1) return null;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = close.length - window; i < close.length; i++) {
    const prev = close[i - 1]!;
    const cur = close[i]!;
    const d = cur - prev;
    if (d >= 0) gains.push(d);
    else losses.push(-d);
  }
  const avgGain = mean(gains);
  const avgLoss = mean(losses);
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

