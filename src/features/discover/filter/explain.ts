import type { Reason } from './types';
import { filterSpec } from './spec';

/**
 * Trimme Reasons auf max. 2 Chips für UI
 */
export function trimReasonsForUI(reasons: Reason[]): Reason[] {
  const limit = filterSpec.ui.explainability.reason_chip_limit;
  if (reasons.length <= limit) {
    return reasons;
  }

  // Priorisiere: Reject-Reasons zuerst, dann Downrank-Reasons
  const sorted = [...reasons].sort((a, b) => {
    // Hard reject reasons haben höchste Priorität
    const aPriority = getReasonPriority(a.code);
    const bPriority = getReasonPriority(b.code);
    return bPriority - aPriority;
  });

  return sorted.slice(0, limit);
}

/**
 * Priorität für Reason Codes
 * Höhere Zahl = höhere Priorität
 */
function getReasonPriority(code: string): number {
  // Hard reject reasons
  if (
    code.includes('authority') ||
    code.includes('jupiter_shield_critical') ||
    code.includes('bundle_score_high') ||
    code.includes('identical_buy_cluster_high') ||
    code.includes('same_funder_cluster_high')
  ) {
    return 100;
  }

  // Safety floors
  if (
    code.includes('liquidity') ||
    code.includes('concentration') ||
    code.includes('lp_')
  ) {
    return 80;
  }

  // Manipulation scores
  if (
    code.includes('bundle') ||
    code.includes('wash_trade') ||
    code.includes('cluster')
  ) {
    return 60;
  }

  // Social / Oracle
  if (code.includes('social') || code.includes('oracle')) {
    return 40;
  }

  // Missing data
  if (code.includes('missing')) {
    return 20;
  }

  return 10;
}

