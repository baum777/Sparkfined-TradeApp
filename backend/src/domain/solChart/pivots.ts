import type { InputCandle, PivotPoint, PivotType } from './types.js';
import type { PivotParams } from './params.js';
import { clamp01 } from './math.js';

function pctMove(from: number, to: number): number {
  if (from === 0) return 0;
  return Math.abs(to - from) / Math.abs(from);
}

/**
 * Deterministic ZigZag-like pivot detection.
 *
 * - Uses candle highs for H pivots, lows for L pivots.
 * - Enforces `minSwingPct` and `minBarsBetweenPivots`.
 * - Returns pivots in chronological order.
 */
export function detectZigZagPivots(candles: InputCandle[], params: PivotParams): PivotPoint[] {
  if (candles.length < 3) return [];

  const { minSwingPct, minBarsBetweenPivots } = params;

  type Trend = 'up' | 'down' | null;
  let trend: Trend = null;

  let extremeHighIdx = 0;
  let extremeHigh = candles[0]!.high;
  let extremeLowIdx = 0;
  let extremeLow = candles[0]!.low;

  const pivots: PivotPoint[] = [];

  function canAdd(idx: number): boolean {
    if (pivots.length === 0) return true;
    return idx - pivots[pivots.length - 1]!.idx >= minBarsBetweenPivots;
  }

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;

    // Update running extremes
    if (c.high >= extremeHigh) {
      extremeHigh = c.high;
      extremeHighIdx = i;
    }
    if (c.low <= extremeLow) {
      extremeLow = c.low;
      extremeLowIdx = i;
    }

    if (trend === null) {
      // Determine initial direction after a meaningful swing from an extreme.
      const upFromLow = (c.high - extremeLow) / (extremeLow === 0 ? 1 : extremeLow);
      const downFromHigh = (extremeHigh - c.low) / (extremeHigh === 0 ? 1 : extremeHigh);

      if (upFromLow >= minSwingPct && canAdd(extremeLowIdx)) {
        pivots.push({ ts: candles[extremeLowIdx]!.ts, price: candles[extremeLowIdx]!.low, type: 'L', idx: extremeLowIdx });
        trend = 'up';
        // reset high tracking from current candle
        extremeHighIdx = i;
        extremeHigh = c.high;
      } else if (downFromHigh >= minSwingPct && canAdd(extremeHighIdx)) {
        pivots.push({ ts: candles[extremeHighIdx]!.ts, price: candles[extremeHighIdx]!.high, type: 'H', idx: extremeHighIdx });
        trend = 'down';
        // reset low tracking from current candle
        extremeLowIdx = i;
        extremeLow = c.low;
      }
      continue;
    }

    if (trend === 'up') {
      // If we retrace enough from the high extreme -> mark high pivot.
      const retrace = (extremeHigh - c.low) / (extremeHigh === 0 ? 1 : extremeHigh);
      if (retrace >= minSwingPct && canAdd(extremeHighIdx)) {
        pivots.push({ ts: candles[extremeHighIdx]!.ts, price: candles[extremeHighIdx]!.high, type: 'H', idx: extremeHighIdx });
        trend = 'down';
        // reset low extreme from current candle
        extremeLowIdx = i;
        extremeLow = c.low;
      }
    } else {
      // trend === 'down'
      const bounce = (c.high - extremeLow) / (extremeLow === 0 ? 1 : extremeLow);
      if (bounce >= minSwingPct && canAdd(extremeLowIdx)) {
        pivots.push({ ts: candles[extremeLowIdx]!.ts, price: candles[extremeLowIdx]!.low, type: 'L', idx: extremeLowIdx });
        trend = 'up';
        // reset high extreme from current candle
        extremeHighIdx = i;
        extremeHigh = c.high;
      }
    }
  }

  // Finalize with last extreme if it forms a plausible final pivot.
  if (pivots.length > 0) {
    const last = pivots[pivots.length - 1]!;
    const endIdx = candles.length - 1;
    if (trend === 'up') {
      // last pivot should be a low; add final high extreme if meaningful.
      const candidate: PivotPoint = {
        ts: candles[extremeHighIdx]!.ts,
        price: candles[extremeHighIdx]!.high,
        type: 'H',
        idx: extremeHighIdx,
      };
      if (candidate.idx !== last.idx && candidate.idx - last.idx >= minBarsBetweenPivots) {
        if (pctMove(last.price, candidate.price) >= minSwingPct * 0.5) pivots.push(candidate);
      } else if (endIdx !== last.idx && endIdx - last.idx >= minBarsBetweenPivots) {
        const endCandidate: PivotPoint = { ts: candles[endIdx]!.ts, price: candles[endIdx]!.high, type: 'H', idx: endIdx };
        if (pctMove(last.price, endCandidate.price) >= minSwingPct * 0.5) pivots.push(endCandidate);
      }
    } else if (trend === 'down') {
      const candidate: PivotPoint = {
        ts: candles[extremeLowIdx]!.ts,
        price: candles[extremeLowIdx]!.low,
        type: 'L',
        idx: extremeLowIdx,
      };
      if (candidate.idx !== last.idx && candidate.idx - last.idx >= minBarsBetweenPivots) {
        if (pctMove(last.price, candidate.price) >= minSwingPct * 0.5) pivots.push(candidate);
      } else if (endIdx !== last.idx && endIdx - last.idx >= minBarsBetweenPivots) {
        const endCandidate: PivotPoint = { ts: candles[endIdx]!.ts, price: candles[endIdx]!.low, type: 'L', idx: endIdx };
        if (pctMove(last.price, endCandidate.price) >= minSwingPct * 0.5) pivots.push(endCandidate);
      }
    }
  }

  // Remove accidental duplicates (same idx/type) deterministically.
  const out: PivotPoint[] = [];
  for (const p of pivots) {
    const prev = out[out.length - 1];
    if (!prev || prev.idx !== p.idx || prev.type !== p.type) out.push(p);
  }
  return out;
}

export function scorePivotStrength(input: {
  pivots: PivotPoint[];
  candles: InputCandle[];
  minSwingPct: number;
  volumeZWindow: number;
}): Array<PivotPoint & { strength: 1 | 2 | 3 | 4 | 5 }> {
  const { pivots, candles, minSwingPct, volumeZWindow } = input;
  if (pivots.length === 0) return [];

  const volumes = candles.map(c => c.volume);

  function volumeZAt(idx: number): number {
    const start = Math.max(0, idx - volumeZWindow + 1);
    const slice = volumes.slice(start, idx + 1);
    if (slice.length === 0) return 0;
    let s = 0;
    for (const v of slice) s += v;
    const m = s / slice.length;
    if (slice.length <= 1) return 0;
    let s2 = 0;
    for (const v of slice) {
      const d = v - m;
      s2 += d * d;
    }
    const sd = Math.sqrt(s2 / (slice.length - 1));
    return sd === 0 ? 0 : (volumes[idx]! - m) / sd;
  }

  const scored: Array<PivotPoint & { strength: 1 | 2 | 3 | 4 | 5 }> = [];
  for (let i = 0; i < pivots.length; i++) {
    const p = pivots[i]!;
    const prev = pivots[i - 1] ?? null;
    const next = pivots[i + 1] ?? null;

    const move = prev ? pctMove(prev.price, p.price) : 0;
    const isolationBars = next ? next.idx - p.idx : Math.max(1, candles.length - 1 - p.idx);
    const vz = volumeZAt(p.idx);

    const moveScore = clamp01(move / (minSwingPct * 2));
    const isoScore = clamp01(isolationBars / 20);
    const volScore = clamp01((vz + 1) / 4); // z=-1..3 => 0..1

    const s = clamp01(moveScore * 0.5 + isoScore * 0.3 + volScore * 0.2);
    const strength = (1 + Math.floor(s * 4)) as 1 | 2 | 3 | 4 | 5;
    scored.push({ ...p, strength });
  }

  return scored;
}

export function pivotTypeSequence(pivots: PivotPoint[]): PivotType[] {
  return pivots.map(p => p.type);
}

