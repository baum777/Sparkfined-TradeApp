import type { InputCandle, PatternCandidate, PatternCheck, PivotPoint, SolTimeframe } from './types.js';
import { clamp01, linearRegression, roundToStep, safeDiv } from './math.js';

function timeRatioOk(d1: number, d2: number, min: number, max: number): boolean {
  if (d1 <= 0 || d2 <= 0) return false;
  const r = d1 / d2;
  return r >= min && r <= max;
}

function check(name: string, score: number, passThreshold = 0.5): PatternCheck {
  const s = clamp01(score);
  return { name, score: s, pass: s >= passThreshold };
}

function findCandleIndexByTs(candles: InputCandle[], ts: number): number | null {
  // candles are expected ascending ts; do a deterministic linear scan (small N).
  for (let i = 0; i < candles.length; i++) if (candles[i]!.ts === ts) return i;
  return null;
}

function volumeAtPivot(candles: InputCandle[], p: PivotPoint): number | null {
  const idx = findCandleIndexByTs(candles, p.ts);
  if (idx === null) return null;
  return candles[idx]!.volume;
}

function tolerancePct(atrPct: number, baseTolPct: number): number {
  return Math.max(atrPct * 1.5, baseTolPct);
}

function pctDiff(a: number, b: number): number {
  if (a === 0) return 0;
  return Math.abs(a - b) / Math.abs(a);
}

function lineValueAt(input: { slope: number; intercept: number; x: number }): number {
  return input.intercept + input.slope * input.x;
}

export function detectPatternCandidates(input: {
  timeframe: SolTimeframe;
  pivots: PivotPoint[];
  candles: InputCandle[];
  lastPrice: number;
  atrPct: number;
  baseTolPct: number;
  timeMin: number;
  timeMax: number;
  dblMinDepthPctLowTF: number;
  dblMinDepthPctHighTF: number;
  rounding: { priceStep: number; pctStep: number; scoreStep: number };
}): PatternCandidate[] {
  const {
    timeframe,
    pivots,
    candles,
    lastPrice,
    atrPct,
    baseTolPct,
    timeMin,
    timeMax,
    dblMinDepthPctLowTF,
    dblMinDepthPctHighTF,
    rounding,
  } = input;

  const tol = tolerancePct(atrPct, baseTolPct);
  const piv = pivots.slice(Math.max(0, pivots.length - 12));
  if (piv.length < 5) return [];

  const candidates: PatternCandidate[] = [];

  const isLowTF = timeframe === '15s' || timeframe === '30s' || timeframe === '1m' || timeframe === '5m';
  const dblMinDepth = isLowTF ? dblMinDepthPctLowTF : dblMinDepthPctHighTF;

  // --- HNS / IHNS (consecutive 6 pivots)
  for (let i = 0; i + 5 < piv.length; i++) {
    const a = piv[i]!;
    const b = piv[i + 1]!;
    const c = piv[i + 2]!;
    const d = piv[i + 3]!;
    const e = piv[i + 4]!;
    const f = piv[i + 5]!;

    // HNS: L H L H L H
    if (a.type === 'L' && b.type === 'H' && c.type === 'L' && d.type === 'H' && e.type === 'L' && f.type === 'H') {
      const dt1 = d.ts - b.ts;
      const dt2 = f.ts - d.ts;
      const timeOk = timeRatioOk(dt1, dt2, timeMin, timeMax);

      const headDominancePct = safeDiv(d.price - Math.max(b.price, f.price), Math.max(b.price, f.price));
      const shoulderDiffPct = pctDiff(b.price, f.price);
      const necklineSlopePct = safeDiv(e.price - c.price, c.price);

      const volLS = volumeAtPivot(candles, b);
      const volHead = volumeAtPivot(candles, d);
      const volScore = volLS !== null && volHead !== null ? clamp01(1 - safeDiv(volHead - volLS, volLS) / 0.5) : 0.5;

      const checks: PatternCheck[] = [];
      checks.push(check('time_symmetry', timeOk ? 1 : 0, 1));
      checks.push(check('head_dominance', clamp01(headDominancePct / (tol * 2)), 0.5));
      checks.push(check('shoulder_symmetry', clamp01(1 - shoulderDiffPct / tol), 0.5));
      checks.push(check('neckline_sanity', clamp01(1 - Math.abs(necklineSlopePct) / (tol * 3)), 0.5));
      checks.push(check('volume_shape', volScore, 0.5));

      // Optional: price vs neckline (breakdown)
      const x1 = c.ts;
      const x2 = e.ts;
      const lr = linearRegression([x1, x2], [c.price, e.price]);
      if (lr) {
        const neckNow = lineValueAt({ slope: lr.slope, intercept: lr.intercept, x: candles[candles.length - 1]!.ts });
        const below = lastPrice < neckNow;
        checks.push(check('price_vs_neckline', below ? 1 : 0.4, 0.5));
      }

      const headScore = checks.find(x => x.name === 'head_dominance')!.score;
      const shoulderScore = checks.find(x => x.name === 'shoulder_symmetry')!.score;
      const neckScore = checks.find(x => x.name === 'neckline_sanity')!.score;
      const volS = checks.find(x => x.name === 'volume_shape')!.score;

      const raw = clamp01(headScore * 0.35 + shoulderScore * 0.25 + neckScore * 0.2 + volS * 0.2);

      // Conservative inclusion: require time symmetry + head dominance + shoulder symmetry.
      const timePass = checks.find(x => x.name === 'time_symmetry')!.pass;
      const mainPass = timePass && checks.find(x => x.name === 'head_dominance')!.pass && checks.find(x => x.name === 'shoulder_symmetry')!.pass;

      if (mainPass && raw >= 0.55) {
        candidates.push({
          type: 'HNS',
          tf: timeframe,
          points: [
            { label: 'LB', ts: a.ts, price: roundToStep(a.price, rounding.priceStep) },
            { label: 'LS', ts: b.ts, price: roundToStep(b.price, rounding.priceStep) },
            { label: 'T1', ts: c.ts, price: roundToStep(c.price, rounding.priceStep) },
            { label: 'H', ts: d.ts, price: roundToStep(d.price, rounding.priceStep) },
            { label: 'T2', ts: e.ts, price: roundToStep(e.price, rounding.priceStep) },
            { label: 'RS', ts: f.ts, price: roundToStep(f.price, rounding.priceStep) },
          ],
          checks: checks.map(ch => ({ ...ch, score: roundToStep(ch.score, rounding.scoreStep) })),
          rawConfidence: roundToStep(raw, rounding.scoreStep),
        });
      }
    }

    // IHNS: H L H L H L
    if (a.type === 'H' && b.type === 'L' && c.type === 'H' && d.type === 'L' && e.type === 'H' && f.type === 'L') {
      const dt1 = d.ts - b.ts;
      const dt2 = f.ts - d.ts;
      const timeOk = timeRatioOk(dt1, dt2, timeMin, timeMax);

      const headDominancePct = safeDiv(Math.min(b.price, f.price) - d.price, Math.min(b.price, f.price));
      const shoulderDiffPct = pctDiff(b.price, f.price);
      const necklineSlopePct = safeDiv(e.price - c.price, c.price);

      const volLS = volumeAtPivot(candles, b);
      const volHead = volumeAtPivot(candles, d);
      const volScore = volLS !== null && volHead !== null ? clamp01(1 - safeDiv(volHead - volLS, volLS) / 0.5) : 0.5;

      const checks: PatternCheck[] = [];
      checks.push(check('time_symmetry', timeOk ? 1 : 0, 1));
      checks.push(check('head_dominance', clamp01(headDominancePct / (tol * 2)), 0.5));
      checks.push(check('shoulder_symmetry', clamp01(1 - shoulderDiffPct / tol), 0.5));
      checks.push(check('neckline_sanity', clamp01(1 - Math.abs(necklineSlopePct) / (tol * 3)), 0.5));
      checks.push(check('volume_shape', volScore, 0.5));

      const lr = linearRegression([c.ts, e.ts], [c.price, e.price]);
      if (lr) {
        const neckNow = lineValueAt({ slope: lr.slope, intercept: lr.intercept, x: candles[candles.length - 1]!.ts });
        const above = lastPrice > neckNow;
        checks.push(check('price_vs_neckline', above ? 1 : 0.4, 0.5));
      }

      const headScore = checks.find(x => x.name === 'head_dominance')!.score;
      const shoulderScore = checks.find(x => x.name === 'shoulder_symmetry')!.score;
      const neckScore = checks.find(x => x.name === 'neckline_sanity')!.score;
      const volS = checks.find(x => x.name === 'volume_shape')!.score;
      const raw = clamp01(headScore * 0.35 + shoulderScore * 0.25 + neckScore * 0.2 + volS * 0.2);

      const timePass = checks.find(x => x.name === 'time_symmetry')!.pass;
      const mainPass = timePass && checks.find(x => x.name === 'head_dominance')!.pass && checks.find(x => x.name === 'shoulder_symmetry')!.pass;
      if (mainPass && raw >= 0.55) {
        candidates.push({
          type: 'IHNS',
          tf: timeframe,
          points: [
            { label: 'LB', ts: a.ts, price: roundToStep(a.price, rounding.priceStep) },
            { label: 'LS', ts: b.ts, price: roundToStep(b.price, rounding.priceStep) },
            { label: 'P1', ts: c.ts, price: roundToStep(c.price, rounding.priceStep) },
            { label: 'H', ts: d.ts, price: roundToStep(d.price, rounding.priceStep) },
            { label: 'P2', ts: e.ts, price: roundToStep(e.price, rounding.priceStep) },
            { label: 'RS', ts: f.ts, price: roundToStep(f.price, rounding.priceStep) },
          ],
          checks: checks.map(ch => ({ ...ch, score: roundToStep(ch.score, rounding.scoreStep) })),
          rawConfidence: roundToStep(raw, rounding.scoreStep),
        });
      }
    }
  }

  // --- Double Top/Bottom (3 pivots windows)
  for (let i = 0; i + 2 < piv.length; i++) {
    const p1 = piv[i]!;
    const p2 = piv[i + 1]!;
    const p3 = piv[i + 2]!;

    if (p1.type === 'H' && p2.type === 'L' && p3.type === 'H') {
      const peakDiff = pctDiff(p1.price, p3.price);
      const pullbackDepth = safeDiv(p1.price - p2.price, p1.price);
      const timeOk = timeRatioOk(p2.ts - p1.ts, p3.ts - p2.ts, timeMin, timeMax);
      const confirm = lastPrice < p2.price ? 1 : 0.3;

      const checks: PatternCheck[] = [
        check('time_symmetry', timeOk ? 1 : 0, 1),
        check('peak_symmetry', clamp01(1 - peakDiff / tol), 0.5),
        check('pullback_depth', clamp01((pullbackDepth - dblMinDepth) / (dblMinDepth * 2)), 0.5),
        check('confirmation', confirm, 0.5),
      ];
      const raw = clamp01(
        checks.find(x => x.name === 'peak_symmetry')!.score * 0.45 +
          checks.find(x => x.name === 'pullback_depth')!.score * 0.35 +
          checks.find(x => x.name === 'confirmation')!.score * 0.2
      );
      const mainPass = checks[0]!.pass && checks[1]!.pass && checks[2]!.pass;
      if (mainPass && raw >= 0.55) {
        candidates.push({
          type: 'DBL_TOP',
          tf: timeframe,
          points: [
            { label: 'P1', ts: p1.ts, price: roundToStep(p1.price, rounding.priceStep) },
            { label: 'PB', ts: p2.ts, price: roundToStep(p2.price, rounding.priceStep) },
            { label: 'P2', ts: p3.ts, price: roundToStep(p3.price, rounding.priceStep) },
          ],
          checks: checks.map(ch => ({ ...ch, score: roundToStep(ch.score, rounding.scoreStep) })),
          rawConfidence: roundToStep(raw, rounding.scoreStep),
        });
      }
    }

    if (p1.type === 'L' && p2.type === 'H' && p3.type === 'L') {
      const troughDiff = pctDiff(p1.price, p3.price);
      const pullbackDepth = safeDiv(p2.price - p1.price, p2.price);
      const timeOk = timeRatioOk(p2.ts - p1.ts, p3.ts - p2.ts, timeMin, timeMax);
      const confirm = lastPrice > p2.price ? 1 : 0.3;

      const checks: PatternCheck[] = [
        check('time_symmetry', timeOk ? 1 : 0, 1),
        check('trough_symmetry', clamp01(1 - troughDiff / tol), 0.5),
        check('pullback_depth', clamp01((pullbackDepth - dblMinDepth) / (dblMinDepth * 2)), 0.5),
        check('confirmation', confirm, 0.5),
      ];
      const raw = clamp01(
        checks.find(x => x.name === 'trough_symmetry')!.score * 0.45 +
          checks.find(x => x.name === 'pullback_depth')!.score * 0.35 +
          checks.find(x => x.name === 'confirmation')!.score * 0.2
      );
      const mainPass = checks[0]!.pass && checks[1]!.pass && checks[2]!.pass;
      if (mainPass && raw >= 0.55) {
        candidates.push({
          type: 'DBL_BOT',
          tf: timeframe,
          points: [
            { label: 'P1', ts: p1.ts, price: roundToStep(p1.price, rounding.priceStep) },
            { label: 'PB', ts: p2.ts, price: roundToStep(p2.price, rounding.priceStep) },
            { label: 'P2', ts: p3.ts, price: roundToStep(p3.price, rounding.priceStep) },
          ],
          checks: checks.map(ch => ({ ...ch, score: roundToStep(ch.score, rounding.scoreStep) })),
          rawConfidence: roundToStep(raw, rounding.scoreStep),
        });
      }
    }
  }

  // --- Triangle / Wedge (last 6..10 pivots)
  {
    const n = Math.min(10, Math.max(6, piv.length));
    const w = piv.slice(piv.length - n);
    const highs = w.filter(p => p.type === 'H');
    const lows = w.filter(p => p.type === 'L');
    if (highs.length >= 2 && lows.length >= 2) {
      const xsH = highs.map(p => p.ts);
      const ysH = highs.map(p => p.price);
      const xsL = lows.map(p => p.ts);
      const ysL = lows.map(p => p.price);
      const up = linearRegression(xsH, ysH);
      const lo = linearRegression(xsL, ysL);
      if (up && lo) {
        const t0 = w[0]!.ts;
        const t1 = w[w.length - 1]!.ts;
        const dist0 = lineValueAt({ slope: up.slope, intercept: up.intercept, x: t0 }) - lineValueAt({ slope: lo.slope, intercept: lo.intercept, x: t0 });
        const dist1 = lineValueAt({ slope: up.slope, intercept: up.intercept, x: t1 }) - lineValueAt({ slope: lo.slope, intercept: lo.intercept, x: t1 });

        const converge = dist0 > 0 && dist1 > 0 ? clamp01(1 - dist1 / dist0) : 0;
        const convergingPass = dist0 > 0 && dist1 > 0 && dist1 < dist0 * 0.8;

        const upperSlope = up.slope;
        const lowerSlope = lo.slope;

        const sameSign = Math.sign(upperSlope) === Math.sign(lowerSlope);
        const oppositeSign = Math.sign(upperSlope) !== Math.sign(lowerSlope);

        const triangleShapeScore = oppositeSign ? 1 : clamp01(1 - Math.abs(upperSlope + lowerSlope) / (Math.abs(upperSlope) + Math.abs(lowerSlope) + 1e-9));
        const wedgeShapeScore = sameSign ? 1 : 0.2;

        const touchTol = tol;
        const touchesUpper = highs.filter(p => {
          const y = lineValueAt({ slope: up.slope, intercept: up.intercept, x: p.ts });
          return safeDiv(Math.abs(p.price - y), y) <= touchTol;
        }).length;
        const touchesLower = lows.filter(p => {
          const y = lineValueAt({ slope: lo.slope, intercept: lo.intercept, x: p.ts });
          return safeDiv(Math.abs(p.price - y), y) <= touchTol;
        }).length;

        const touchScore = clamp01(Math.min(touchesUpper, 4) / 4) * 0.5 + clamp01(Math.min(touchesLower, 4) / 4) * 0.5;
        const touchesPass = touchesUpper >= 2 && touchesLower >= 2;

        const checksBase: PatternCheck[] = [
          check('converging', convergingPass ? 1 : 0, 1),
          check('touches', touchScore, 0.5),
        ];

        const triangleChecks = [
          ...checksBase,
          check('shape', triangleShapeScore, 0.5),
          check('convergence_strength', converge, 0.5),
        ];
        const triangleRaw = clamp01(
          triangleChecks.find(x => x.name === 'convergence_strength')!.score * 0.45 +
            triangleChecks.find(x => x.name === 'touches')!.score * 0.35 +
            triangleChecks.find(x => x.name === 'shape')!.score * 0.2
        );
        if (triangleChecks[0]!.pass && touchesPass && triangleRaw >= 0.55) {
          candidates.push({
            type: 'TRIANGLE',
            tf: timeframe,
            points: [
              { label: 'U0', ts: highs[0]!.ts, price: roundToStep(highs[0]!.price, rounding.priceStep) },
              { label: 'U1', ts: highs[highs.length - 1]!.ts, price: roundToStep(highs[highs.length - 1]!.price, rounding.priceStep) },
              { label: 'L0', ts: lows[0]!.ts, price: roundToStep(lows[0]!.price, rounding.priceStep) },
              { label: 'L1', ts: lows[lows.length - 1]!.ts, price: roundToStep(lows[lows.length - 1]!.price, rounding.priceStep) },
            ],
            checks: triangleChecks.map(ch => ({ ...ch, score: roundToStep(ch.score, rounding.scoreStep) })),
            rawConfidence: roundToStep(triangleRaw, rounding.scoreStep),
          });
        }

        const wedgeChecks = [
          ...checksBase,
          check('shape', wedgeShapeScore, 0.5),
          check('convergence_strength', converge, 0.5),
        ];
        const wedgeRaw = clamp01(
          wedgeChecks.find(x => x.name === 'convergence_strength')!.score * 0.45 +
            wedgeChecks.find(x => x.name === 'touches')!.score * 0.35 +
            wedgeChecks.find(x => x.name === 'shape')!.score * 0.2
        );
        if (wedgeChecks[0]!.pass && touchesPass && wedgeRaw >= 0.55) {
          candidates.push({
            type: 'WEDGE',
            tf: timeframe,
            points: [
              { label: 'U0', ts: highs[0]!.ts, price: roundToStep(highs[0]!.price, rounding.priceStep) },
              { label: 'U1', ts: highs[highs.length - 1]!.ts, price: roundToStep(highs[highs.length - 1]!.price, rounding.priceStep) },
              { label: 'L0', ts: lows[0]!.ts, price: roundToStep(lows[0]!.price, rounding.priceStep) },
              { label: 'L1', ts: lows[lows.length - 1]!.ts, price: roundToStep(lows[lows.length - 1]!.price, rounding.priceStep) },
            ],
            checks: wedgeChecks.map(ch => ({ ...ch, score: roundToStep(ch.score, rounding.scoreStep) })),
            rawConfidence: roundToStep(wedgeRaw, rounding.scoreStep),
          });
        }
      }
    }
  }

  // --- Wolfe Wave (5 alternating pivots)
  for (let i = 0; i + 4 < piv.length; i++) {
    const p1 = piv[i]!;
    const p2 = piv[i + 1]!;
    const p3 = piv[i + 2]!;
    const p4 = piv[i + 3]!;
    const p5 = piv[i + 4]!;

    const alternating =
      p1.type !== p2.type && p2.type !== p3.type && p3.type !== p4.type && p4.type !== p5.type;
    if (!alternating) continue;

    const bearish = p1.type === 'H' && p2.type === 'L' && p3.type === 'H' && p4.type === 'L' && p5.type === 'H';
    const bullish = p1.type === 'L' && p2.type === 'H' && p3.type === 'L' && p4.type === 'H' && p5.type === 'L';
    if (!bearish && !bullish) continue;

    const lr13 = linearRegression([p1.ts, p3.ts], [p1.price, p3.price]);
    if (!lr13) continue;
    const lineAt4 = lineValueAt({ slope: lr13.slope, intercept: lr13.intercept, x: p4.ts });
    const lineAt5 = lineValueAt({ slope: lr13.slope, intercept: lr13.intercept, x: p5.ts });

    const p3Beyond = bearish ? p3.price > p1.price : p3.price < p1.price;
    const p4Inside = safeDiv(Math.abs(p4.price - lineAt4), lineAt4) <= tol * 2;
    const falseBreak = bearish ? p5.price > lineAt5 * (1 + tol * 0.5) : p5.price < lineAt5 * (1 - tol * 0.5);

    const checks: PatternCheck[] = [
      check('alternating', 1, 1),
      check('p3_beyond_p1', p3Beyond ? 1 : 0, 1),
      check('p4_channel', p4Inside ? 1 : 0, 1),
      check('p5_false_break', falseBreak ? 1 : 0, 1),
    ];

    const raw = clamp01((p3Beyond ? 0.45 : 0) + (p4Inside ? 0.25 : 0) + (falseBreak ? 0.3 : 0));

    // Conservative: require alternating + p3Beyond + falseBreak.
    if (checks[1]!.pass && checks[3]!.pass && raw >= 0.55) {
      candidates.push({
        type: 'WOLFE',
        tf: timeframe,
        points: [
          { label: '1', ts: p1.ts, price: roundToStep(p1.price, rounding.priceStep) },
          { label: '2', ts: p2.ts, price: roundToStep(p2.price, rounding.priceStep) },
          { label: '3', ts: p3.ts, price: roundToStep(p3.price, rounding.priceStep) },
          { label: '4', ts: p4.ts, price: roundToStep(p4.price, rounding.priceStep) },
          { label: '5', ts: p5.ts, price: roundToStep(p5.price, rounding.priceStep) },
        ],
        checks: checks.map(ch => ({ ...ch, score: roundToStep(ch.score, rounding.scoreStep) })),
        rawConfidence: roundToStep(raw, rounding.scoreStep),
      });
    }
  }

  // Deterministic ordering
  return candidates.sort((a, b) => (b.rawConfidence - a.rawConfidence) || (a.type.localeCompare(b.type)));
}

