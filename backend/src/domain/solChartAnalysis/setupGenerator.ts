import type { ChartFeaturePack } from '../solChart/types.js';
import type { AnalysisTier, SetupCard, SolChartTaskKind } from './contracts.js';

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function roundTo(n: number, decimals = 4): number {
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
}

function pickTopLevels(levels: Array<{ price: number; touches: number; clusterScore: number }>, n: number): number[] {
  return [...levels]
    .sort((a, b) => (b.clusterScore - a.clusterScore) || (b.touches - a.touches) || (a.price - b.price))
    .slice(0, n)
    .map(l => l.price);
}

function bestSupport(chart: ChartFeaturePack): { price: number; touches: number; clusterScore: number } | null {
  const s = [...(chart.srLevels.supports ?? [])].sort((a, b) => (b.clusterScore - a.clusterScore) || (b.touches - a.touches) || (a.price - b.price));
  return s[0] ?? null;
}

function bestResistance(chart: ChartFeaturePack): { price: number; touches: number; clusterScore: number } | null {
  const r = [...(chart.srLevels.resistances ?? [])].sort((a, b) => (b.clusterScore - a.clusterScore) || (b.touches - a.touches) || (a.price - b.price));
  return r[0] ?? null;
}

function calcStopLevel(entryLevel: number, atr: number | undefined, side: 'long' | 'short'): number {
  const a = typeof atr === 'number' && Number.isFinite(atr) && atr > 0 ? atr : Math.max(0.001, Math.abs(entryLevel) * 0.01);
  const stop = side === 'long' ? entryLevel - 1.5 * a : entryLevel + 1.5 * a;
  return roundTo(stop, 6);
}

function baseEvidence(chart: ChartFeaturePack): string[] {
  const e: string[] = [];
  e.push(`marketRegime.regime=${chart.marketRegime.regime}`);
  e.push(`marketRegime.strength=${roundTo(chart.marketRegime.strength, 3)}`);
  e.push(`ohlcvSummary.volume.zScore=${roundTo(chart.ohlcvSummary.volume.zScore, 3)}`);
  e.push(`ohlcvSummary.volatility.atrPct=${roundTo(chart.ohlcvSummary.volatility.atrPct, 3)}`);
  return e.slice(0, 6);
}

function mkCard(input: Omit<SetupCard, 'onchainGate'> & { onchainNotes?: string[] }): SetupCard {
  return {
    ...input,
    confidence: clamp01(roundTo(input.confidence, 4)),
    evidence: input.evidence.slice(0, 6),
    notes: input.notes.slice(0, 4),
    onchainGate: { pass: true, notes: (input.onchainNotes ?? []).slice(0, 8) },
  };
}

/**
 * Deterministic baseline setup generator from ChartFeaturePack.
 *
 * NOTE:
 * This is intentionally conservative and *not* meant to be a full trading engine.
 * It exists to produce stable SetupCard[] for downstream gating/sorting.
 */
export function generateSetupCardsFromChart(
  chart: ChartFeaturePack,
  input: { tier: AnalysisTier; taskKind: SolChartTaskKind }
): SetupCard[] {
  const last = chart.ohlcvSummary.lastPrice;
  const atr = chart.ohlcvSummary.volatility.atr;

  // Teaser: keep plan empty (free-tier contract usually renders S/R only).
  if (input.taskKind === 'chart_teaser_free') return [];

  const sup = bestSupport(chart);
  const res = bestResistance(chart);
  const supports = pickTopLevels(chart.srLevels.supports ?? [], 3);
  const resistances = pickTopLevels(chart.srLevels.resistances ?? [], 3);

  const evidence = baseEvidence(chart);
  const out: SetupCard[] = [];

  const regime = chart.marketRegime.regime;
  const strength = clamp01(chart.marketRegime.strength);

  if (regime === 'trend_up') {
    const entry = sup?.price ?? last;
    const stop = calcStopLevel(entry, atr, 'long');
    const targets = resistances.length ? resistances : res ? [res.price] : [roundTo(entry + 2 * (atr || 0), 6)];

    const conf =
      0.55 +
      0.25 * strength +
      (sup ? 0.1 * clamp01(sup.clusterScore) : 0) +
      (chart.ohlcvSummary.volume.zScore > 1 ? 0.05 : 0);

    out.push(
      mkCard({
        name: 'Pullback Long (Support)',
        bias: 'long',
        timeframe: chart.timeframe,
        entry: { type: 'limit', level: roundTo(entry, 6), rule: `Limit bid near support (${supports[0] ?? 'n/a'}) with reclaim confirmation.` },
        stop: { level: stop, rule: 'Stop below local support / below reclaim low.', invalidation: 'Close below support cluster; no reclaim.' },
        targets: targets.slice(0, 3).map((t, i) => ({ level: roundTo(t, 6), rationale: i === 0 ? 'Nearest resistance / prior supply' : 'Next resistance cluster' })),
        confidence: conf,
        evidence: [...evidence, `srLevels.supports[0]=${supports[0] ?? 'n/a'}`],
        notes: ['Prefer entries after reclaim; avoid chasing green candles.'],
      })
    );
  } else if (regime === 'trend_down') {
    const entry = res?.price ?? last;
    const stop = calcStopLevel(entry, atr, 'short');
    const targets = supports.length ? supports : sup ? [sup.price] : [roundTo(entry - 2 * (atr || 0), 6)];

    const conf =
      0.55 +
      0.25 * strength +
      (res ? 0.1 * clamp01(res.clusterScore) : 0) +
      (chart.ohlcvSummary.volume.zScore > 1 ? 0.05 : 0);

    out.push(
      mkCard({
        name: 'Pullback Short (Resistance)',
        bias: 'short',
        timeframe: chart.timeframe,
        entry: { type: 'limit', level: roundTo(entry, 6), rule: `Limit offer near resistance (${resistances[0] ?? 'n/a'}) with rejection.` },
        stop: { level: stop, rule: 'Stop above local resistance / above rejection high.', invalidation: 'Close above resistance cluster; acceptance.' },
        targets: targets.slice(0, 3).map((t, i) => ({ level: roundTo(t, 6), rationale: i === 0 ? 'Nearest support / prior demand' : 'Next support cluster' })),
        confidence: conf,
        evidence: [...evidence, `srLevels.resistances[0]=${resistances[0] ?? 'n/a'}`],
        notes: ['Prefer entries after clear rejection; avoid fading strong breakouts.'],
      })
    );
  } else {
    // range / transition: propose two-sided mean reversion if S/R exists.
    const mid = supports.length && resistances.length ? (supports[0]! + resistances[0]!) / 2 : last;
    if (supports.length) {
      const entry = supports[0];
      out.push(
        mkCard({
          name: 'Range Long (Support)',
          bias: 'long',
          timeframe: chart.timeframe,
          entry: { type: 'limit', level: roundTo(entry, 6), rule: 'Bid support with tight invalidation; target mid-range / resistance.' },
          stop: { level: calcStopLevel(entry, atr, 'long'), rule: 'Stop below range support.', invalidation: 'Acceptance below support.' },
          targets: (resistances.length ? resistances : [roundTo(last, 6)]).slice(0, 2).map((t, i) => ({ level: roundTo(t, 6), rationale: i === 0 ? 'Mean reversion' : 'Range high' })),
          confidence: 0.48 + 0.15 * strength + (last <= mid ? 0.05 : 0),
          evidence: [...evidence, `srLevels.supports[0]=${supports[0] ?? 'n/a'}`],
          notes: ['Cut quickly if range breaks; avoid adding to losers.'],
        })
      );
    }
    if (resistances.length && out.length < 3) {
      const entry = resistances[0];
      out.push(
        mkCard({
          name: 'Range Short (Resistance)',
          bias: 'short',
          timeframe: chart.timeframe,
          entry: { type: 'limit', level: roundTo(entry, 6), rule: 'Sell resistance with rejection; target mid-range / support.' },
          stop: { level: calcStopLevel(entry, atr, 'short'), rule: 'Stop above range resistance.', invalidation: 'Acceptance above resistance.' },
          targets: (supports.length ? supports : [roundTo(last, 6)]).slice(0, 2).map((t, i) => ({ level: roundTo(t, 6), rationale: i === 0 ? 'Mean reversion' : 'Range low' })),
          confidence: 0.48 + 0.15 * strength + (last >= mid ? 0.05 : 0),
          evidence: [...evidence, `srLevels.resistances[0]=${resistances[0] ?? 'n/a'}`],
          notes: ['Avoid shorting if breakout volume expands strongly.'],
        })
      );
    }
  }

  // Respect the spec: up to 3 setups.
  return out.slice(0, 3);
}

