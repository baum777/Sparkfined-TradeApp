import type { Token, Decision, Reason } from './types';
import { filterSpec } from './spec';

/**
 * Fallback Rules für Missing Data
 */
export function applyFallbacks(
  token: Token,
  tab: 'not_bonded' | 'bonded' | 'ranked',
  currentDecision: Decision
): Decision {
  const reasons: Reason[] = [...currentDecision.reasons];

  // Missing LP Data
  if (
    (tab === 'bonded' || tab === 'ranked') &&
    token.liquidity.lp_burned === null &&
    token.liquidity.lp_locked_pct === null
  ) {
    const fallbackAction = filterSpec.fallbacks.if_missing_lp_data[tab];
    if (fallbackAction === 'downrank' && currentDecision.action === 'allow') {
      reasons.push({
        code: 'missing_lp_data',
        message: 'LP-Daten fehlen',
      });
      return {
        action: 'downrank',
        reasons,
        score: currentDecision.score,
      };
    }
  }

  // Missing Social Data (ranked only)
  if (
    tab === 'ranked' &&
    token.social.x_mentions_15m === null &&
    token.social.x_velocity_15m === null &&
    token.social.x_account_quality_score === null
  ) {
    const fallbackAction = filterSpec.fallbacks.if_missing_social_data.ranked;
    if (fallbackAction === 'do_not_penalize') {
      // Keine Penalty, einfach weiter
      return currentDecision;
    }
  }

  // Missing Bundle Scores (not_bonded only)
  if (
    tab === 'not_bonded' &&
    token.manipulation.bundle_score === null &&
    token.manipulation.identical_buy_cluster_score === null &&
    token.manipulation.same_funder_cluster_score === null
  ) {
    const fallbackAction = filterSpec.fallbacks.if_missing_bundle_scores.not_bonded;
    if (fallbackAction === 'downrank_if_concentration_high') {
      const isConcentrationHigh =
        token.holders.top1_pct > 8 || token.holders.top10_pct > 35;
      if (isConcentrationHigh && currentDecision.action === 'allow') {
        reasons.push({
          code: 'missing_bundle_scores_high_concentration',
          message: 'Bundler-Scores fehlen bei hoher Konzentration',
        });
        return {
          action: 'downrank',
          reasons,
          score: currentDecision.score,
        };
      }
    }
  }

  return {
    ...currentDecision,
    reasons,
  };
}

