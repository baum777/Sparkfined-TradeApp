import type { SolTimeframe } from './types.js';

export interface PivotParams {
  minSwingPct: number; // decimal, e.g. 0.005 = 0.5%
  minBarsBetweenPivots: number;
}

export interface BuildParams {
  pivot: Record<SolTimeframe, PivotParams>;
  candleLimit: Record<SolTimeframe, number>;
  volumeZWindow: number;
  atrWindow: number;
  bbWindow: number;
  bbStdev: number;
  structurePivotLookback: number; // K
  patternPivotLookback: number; // M
  sweep: { enabledTfs: SolTimeframe[]; reclaimBars: number; breakAtrFrac: number };
  pattern: {
    baseTolPct: number; // decimal
    timeSymmetryMin: number;
    timeSymmetryMax: number;
    dblMinDepthPctLowTF: number; // decimal
    dblMinDepthPctHighTF: number; // decimal
  };
  rounding: {
    priceStep: number;
    pctStep: number;
    scoreStep: number;
  };
}

export const DEFAULT_BUILD_PARAMS: BuildParams = {
  pivot: {
    '15s': { minSwingPct: 0.0035, minBarsBetweenPivots: 5 },
    '30s': { minSwingPct: 0.0035, minBarsBetweenPivots: 5 },
    '1m': { minSwingPct: 0.005, minBarsBetweenPivots: 6 },
    '5m': { minSwingPct: 0.008, minBarsBetweenPivots: 6 },
    '15m': { minSwingPct: 0.012, minBarsBetweenPivots: 5 },
    '30m': { minSwingPct: 0.016, minBarsBetweenPivots: 5 },
    '1h': { minSwingPct: 0.022, minBarsBetweenPivots: 4 },
    '4h': { minSwingPct: 0.035, minBarsBetweenPivots: 3 },
  },
  candleLimit: {
    '15s': 600,
    '30s': 600,
    '1m': 600,
    '5m': 500,
    '15m': 400,
    '30m': 300,
    '1h': 300,
    '4h': 240,
  },
  volumeZWindow: 50,
  atrWindow: 14,
  bbWindow: 20,
  bbStdev: 2,
  structurePivotLookback: 6,
  patternPivotLookback: 12,
  sweep: {
    enabledTfs: ['15s', '30s', '1m', '5m'],
    reclaimBars: 3,
    breakAtrFrac: 0.15,
  },
  pattern: {
    baseTolPct: 0.008, // 0.8%
    timeSymmetryMin: 0.5,
    timeSymmetryMax: 2.0,
    dblMinDepthPctLowTF: 0.008, // 0.8%
    dblMinDepthPctHighTF: 0.02, // 2%
  },
  rounding: {
    priceStep: 1e-8,
    pctStep: 1e-6,
    scoreStep: 1e-4,
  },
};

export const LOW_TFS: SolTimeframe[] = ['15s', '30s', '1m', '5m'];

