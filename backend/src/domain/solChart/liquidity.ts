import type { InputCandle, LiquiditySweep, SRLevel } from './types.js';
import { clamp01, sigmoid } from './math.js';

export function detectLiquiditySweeps(input: {
  candles: InputCandle[];
  atr: number;
  supports: SRLevel[];
  resistances: SRLevel[];
  reclaimBars: number;
  breakAtrFrac: number;
  volumeZWindow: number;
}): LiquiditySweep[] {
  const { candles, atr, supports, resistances, reclaimBars, breakAtrFrac, volumeZWindow } = input;
  if (candles.length === 0) return [];
  if (atr <= 0) return [];

  const threshold = atr * breakAtrFrac;
  const vols = candles.map(c => c.volume);

  function volumeZAt(idx: number): number {
    const start = Math.max(0, idx - volumeZWindow + 1);
    const slice = vols.slice(start, idx + 1);
    if (slice.length <= 1) return 0;
    let sum = 0;
    for (const v of slice) sum += v;
    const m = sum / slice.length;
    let s2 = 0;
    for (const v of slice) {
      const d = v - m;
      s2 += d * d;
    }
    const sd = Math.sqrt(s2 / (slice.length - 1));
    return sd === 0 ? 0 : (vols[idx]! - m) / sd;
  }

  // Consider only the most relevant nearby levels to reduce duplicates deterministically.
  const levelCandidates: Array<{ level: number; side: 'above' | 'below' }> = [];
  for (const r of resistances.slice(0, 8)) levelCandidates.push({ level: r.price, side: 'above' });
  for (const s of supports.slice(0, 8)) levelCandidates.push({ level: s.price, side: 'below' });

  const sweeps: LiquiditySweep[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    for (const lvl of levelCandidates) {
      if (lvl.side === 'above') {
        if (c.high <= lvl.level + threshold) continue;
        // reclaim == close back below level within reclaimBars
        let reclaim = -1;
        for (let j = 0; j <= reclaimBars; j++) {
          const idx = i + j;
          if (idx >= candles.length) break;
          if (candles[idx]!.close < lvl.level) {
            reclaim = j;
            break;
          }
        }
        if (reclaim < 0) continue;

        const vz = volumeZAt(i);
        const speed = 1 - reclaim / Math.max(1, reclaimBars);
        const conf = clamp01(0.6 * sigmoid((vz - 1) / 2) + 0.4 * speed);
        sweeps.push({ ts: c.ts, level: lvl.level, side: 'above', reclaimWithinBars: reclaim, confidence: conf });
      } else {
        if (c.low >= lvl.level - threshold) continue;
        let reclaim = -1;
        for (let j = 0; j <= reclaimBars; j++) {
          const idx = i + j;
          if (idx >= candles.length) break;
          if (candles[idx]!.close > lvl.level) {
            reclaim = j;
            break;
          }
        }
        if (reclaim < 0) continue;
        const vz = volumeZAt(i);
        const speed = 1 - reclaim / Math.max(1, reclaimBars);
        const conf = clamp01(0.6 * sigmoid((vz - 1) / 2) + 0.4 * speed);
        sweeps.push({ ts: c.ts, level: lvl.level, side: 'below', reclaimWithinBars: reclaim, confidence: conf });
      }
    }
  }

  // De-dup: keep best confidence per (ts, level, side).
  const key = (s: LiquiditySweep): string => `${s.ts}:${s.level}:${s.side}`;
  const best = new Map<string, LiquiditySweep>();
  for (const s of sweeps) {
    const k = key(s);
    const existing = best.get(k);
    if (!existing || s.confidence > existing.confidence) best.set(k, s);
  }

  return [...best.values()].sort((a, b) => (b.confidence - a.confidence) || (a.ts - b.ts));
}

