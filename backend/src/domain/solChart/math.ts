export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function roundToStep(x: number, step: number): number {
  if (!Number.isFinite(x)) return 0;
  if (step <= 0) return x;
  return Math.round(x / step) * step;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

export function stdev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  let s2 = 0;
  for (const v of values) {
    const d = v - m;
    s2 += d * d;
  }
  return Math.sqrt(s2 / (values.length - 1));
}

export function sma(values: number[], window: number): number | null {
  if (values.length < window || window <= 0) return null;
  let sum = 0;
  for (let i = values.length - window; i < values.length; i++) sum += values[i]!;
  return sum / window;
}

export function zScoreLast(values: number[], window: number): { mean: number; stdev: number; z: number } {
  if (values.length === 0) return { mean: 0, stdev: 0, z: 0 };
  const slice = values.slice(Math.max(0, values.length - window));
  const m = mean(slice);
  const sd = stdev(slice);
  const last = values[values.length - 1]!;
  const z = sd === 0 ? 0 : (last - m) / sd;
  return { mean: m, stdev: sd, z };
}

export function atr(high: number[], low: number[], close: number[], window: number): number | null {
  if (high.length !== low.length || high.length !== close.length) return null;
  if (high.length <= 1 || high.length < window + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < high.length; i++) {
    const tr = Math.max(
      high[i]! - low[i]!,
      Math.abs(high[i]! - close[i - 1]!),
      Math.abs(low[i]! - close[i - 1]!)
    );
    trs.push(tr);
  }
  const slice = trs.slice(Math.max(0, trs.length - window));
  return mean(slice);
}

export function bollingerWidth(close: number[], window: number, stdevMult: number): { width: number; mid: number } | null {
  if (close.length < window || window <= 1) return null;
  const slice = close.slice(close.length - window);
  const mid = mean(slice);
  const sd = stdev(slice);
  const upper = mid + stdevMult * sd;
  const lower = mid - stdevMult * sd;
  return { width: upper - lower, mid };
}

export function safeDiv(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return a / b;
}

export function sigmoid(x: number): number {
  if (!Number.isFinite(x)) return 0.5;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Ordinary least squares regression for y = a + b*x.
 * Returns slope b and intercept a.
 */
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const n = xs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

