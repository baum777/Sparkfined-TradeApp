import type { PivotPoint, SRLevel } from './types.js';
import { clamp01, mean, roundToStep } from './math.js';

export function clusterSupportResistance(input: {
  pivots: PivotPoint[];
  lastPrice: number;
  atr: number;
  priceStep: number;
}): { supports: SRLevel[]; resistances: SRLevel[] } {
  const { pivots, lastPrice, atr, priceStep } = input;
  if (pivots.length === 0) return { supports: [], resistances: [] };

  const minBinSize = Math.max(lastPrice * 0.0005, 1e-9);
  const binSize = Math.max(atr * 0.5, minBinSize);

  type Cluster = { prices: number[]; idxs: number[]; touches: number };
  const clusters = new Map<number, Cluster>();

  for (const p of pivots) {
    const bin = Math.floor(p.price / binSize);
    const c = clusters.get(bin) ?? { prices: [], idxs: [], touches: 0 };
    c.prices.push(p.price);
    c.idxs.push(p.idx);
    c.touches += 1;
    clusters.set(bin, c);
  }

  const maxTouches = Math.max(...[...clusters.values()].map(c => c.touches), 1);
  const maxIdx = Math.max(...pivots.map(p => p.idx), 1);

  const levels: SRLevel[] = [];
  for (const c of clusters.values()) {
    const price = mean(c.prices);
    const touchesNorm = c.touches / maxTouches;
    const mostRecentIdx = Math.max(...c.idxs);
    const recencyNorm = clamp01(mostRecentIdx / maxIdx);
    const clusterScore = clamp01(0.7 * touchesNorm + 0.3 * recencyNorm);
    levels.push({
      price: roundToStep(price, priceStep),
      touches: c.touches,
      clusterScore,
    });
  }

  const supports = levels
    .filter(l => l.price < lastPrice)
    .sort((a, b) => (b.clusterScore - a.clusterScore) || (Math.abs(a.price - lastPrice) - Math.abs(b.price - lastPrice)));
  const resistances = levels
    .filter(l => l.price > lastPrice)
    .sort((a, b) => (b.clusterScore - a.clusterScore) || (Math.abs(a.price - lastPrice) - Math.abs(b.price - lastPrice)));

  return { supports, resistances };
}

