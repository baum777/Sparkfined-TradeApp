import type { PivotPoint } from './types.js';
import { clamp01, mean, safeDiv } from './math.js';

export interface MarketStructureCounts {
  hhCount: number;
  hlCount: number;
  lhCount: number;
  llCount: number;
  lastSwing: 'HH' | 'HL' | 'LH' | 'LL';
}

function classifyLastSwing(pivots: PivotPoint[]): 'HH' | 'HL' | 'LH' | 'LL' {
  const last = pivots[pivots.length - 1];
  if (!last) return 'HL';
  if (last.type === 'H') {
    const prevHigh = [...pivots].reverse().slice(1).find(p => p.type === 'H');
    if (!prevHigh) return 'HH';
    return last.price >= prevHigh.price ? 'HH' : 'LH';
  }
  const prevLow = [...pivots].reverse().slice(1).find(p => p.type === 'L');
  if (!prevLow) return 'HL';
  return last.price >= prevLow.price ? 'HL' : 'LL';
}

export function computeStructureCounts(pivots: PivotPoint[], lookback: number): MarketStructureCounts {
  const slice = pivots.slice(Math.max(0, pivots.length - lookback));

  let hh = 0;
  let hl = 0;
  let lh = 0;
  let ll = 0;

  // Compare highs to previous highs; lows to previous lows.
  let prevHigh: PivotPoint | null = null;
  let prevLow: PivotPoint | null = null;
  for (const p of slice) {
    if (p.type === 'H') {
      if (prevHigh) {
        if (p.price >= prevHigh.price) hh++;
        else lh++;
      }
      prevHigh = p;
    } else {
      if (prevLow) {
        if (p.price >= prevLow.price) hl++;
        else ll++;
      }
      prevLow = p;
    }
  }

  const lastSwing = classifyLastSwing(slice.length ? slice : pivots);
  return { hhCount: hh, hlCount: hl, lhCount: lh, llCount: ll, lastSwing };
}

export function computeMaSlopePct(close: number[], maWindow = 50, slopeLookback = 10): number {
  if (close.length < maWindow + slopeLookback) return 0;
  const maAt = (endIdx: number): number => {
    const start = endIdx - maWindow + 1;
    let s = 0;
    for (let i = start; i <= endIdx; i++) s += close[i]!;
    return s / maWindow;
  };
  const end = close.length - 1;
  const now = maAt(end);
  const prev = maAt(end - slopeLookback);
  return prev === 0 ? 0 : (now - prev) / prev;
}

export function computeAtrPctExpansion(input: { close: number[]; high: number[]; low: number[]; atrWindow: number }): {
  atrPctNow: number;
  atrPctPrev: number;
} {
  const { close, high, low, atrWindow } = input;
  if (close.length < atrWindow * 3) return { atrPctNow: 0, atrPctPrev: 0 };

  const tr: number[] = [];
  for (let i = 1; i < close.length; i++) {
    const t = Math.max(
      high[i]! - low[i]!,
      Math.abs(high[i]! - close[i - 1]!),
      Math.abs(low[i]! - close[i - 1]!)
    );
    tr.push(t);
  }

  const atrSlice = (endTrIdx: number): number => {
    const start = Math.max(0, endTrIdx - atrWindow + 1);
    return mean(tr.slice(start, endTrIdx + 1));
  };

  const trEnd = tr.length - 1;
  const nowAtr = atrSlice(trEnd);
  const prevAtr = atrSlice(Math.max(0, trEnd - atrWindow));

  const lastPrice = close[close.length - 1] ?? 0;
  const atrPctNow = safeDiv(nowAtr, lastPrice);
  const atrPctPrev = safeDiv(prevAtr, lastPrice);
  return { atrPctNow, atrPctPrev };
}

export function classifyMarketRegime(input: {
  structure: MarketStructureCounts;
  maSlopePct: number;
  atrPctNow: number;
  atrPctPrev: number;
}): { regime: 'trend_up' | 'trend_down' | 'range' | 'transition'; strength: number } {
  const { structure, maSlopePct, atrPctNow, atrPctPrev } = input;

  const upCount = structure.hhCount + structure.hlCount;
  const downCount = structure.lhCount + structure.llCount;
  const total = upCount + downCount;
  const dominance = total === 0 ? 0 : Math.max(upCount, downCount) / total;

  const slopeSign = maSlopePct;
  const slopeStrength = clamp01(Math.abs(slopeSign) / Math.max(atrPctNow * 0.5, 1e-6));
  const strength = clamp01(0.6 * dominance + 0.4 * slopeStrength);

  const volExpanding = atrPctPrev > 0 && atrPctNow > atrPctPrev * 1.25;

  const mixed = dominance < 0.66;
  const upDominant = upCount > downCount;
  const downDominant = downCount > upCount;

  if (upDominant && slopeSign > 0) return { regime: 'trend_up', strength };
  if (downDominant && slopeSign < 0) return { regime: 'trend_down', strength };
  if (mixed && volExpanding) return { regime: 'transition', strength };
  return { regime: 'range', strength };
}

