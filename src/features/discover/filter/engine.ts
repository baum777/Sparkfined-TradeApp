import type { Token, Tab, PresetId, Decision, Reason } from './types';
import { filterSpec } from './spec';
import { applyPreset } from './presets';
import { applyFallbacks } from './fallbacks';
import { computeRankScore } from './scoring';
import { trimReasonsForUI } from './explain';

/**
 * Haupt-Filter-Engine
 * Evaluates a token and returns a decision (allow/downrank/reject) with reasons
 */
export function evaluateToken(input: {
  token: Token;
  tab: Tab;
  preset?: PresetId;
  now?: Date;
}): Decision {
  const { token, tab, preset, now = new Date() } = input;

  // 1. Lade fixed rules des Tabs
  const fixedRules = filterSpec.tabs[tab]?.fixed;
  if (!fixedRules) {
    return {
      action: 'reject',
      reasons: [{ code: 'invalid_tab', message: 'Ungültiger Tab' }],
    };
  }

  // 2. Wende hard_reject Regeln an
  const hardRejectResult = applyHardRejectRules(token, fixedRules);
  if (hardRejectResult) {
    return hardRejectResult;
  }

  // 3. Wende requirements an (min liquidity, caps, activity floors)
  let decision: Decision = { action: 'allow', reasons: [] };

  // Requirements für not_bonded
  if (tab === 'not_bonded') {
    decision = applyNotBondedRequirements(token, fixedRules, decision);
  }

  // Requirements für bonded
  if (tab === 'bonded') {
    decision = applyBondedRequirements(token, fixedRules, decision);
  }

  // Requirements für ranked
  if (tab === 'ranked') {
    decision = applyRankedRequirements(token, fixedRules, decision);
  }

  // Wenn bereits rejected, return early
  if (decision.action === 'reject') {
    return {
      ...decision,
      reasons: trimReasonsForUI(decision.reasons),
    };
  }

  // 4. Wende preset an (Default pro tab aus ui.mapping, oder override)
  const presetId = preset || filterSpec.ui.overlay_tabs[tab].default_preset;
  if (presetId) {
    decision = applyPreset(token, tab, presetId, decision);
  }

  // Wenn nach preset rejected, return early
  if (decision.action === 'reject') {
    return {
      ...decision,
      reasons: trimReasonsForUI(decision.reasons),
    };
  }

  // 5. Wende fallback rules an
  decision = applyFallbacks(token, tab, decision);

  // 6. Wenn ranked: berechne score
  if (tab === 'ranked' && decision.action !== 'reject') {
    const score = computeRankScore(token, presetId);
    decision.score = score;

    // Apply downrank multipliers (wenn score zu niedrig)
    const minScore = 30; // Minimum score für ranked
    if (score < minScore && decision.action === 'allow') {
      decision.action = 'downrank';
      decision.reasons.push({
        code: 'score_too_low',
        message: `Ranking-Score zu niedrig (${score.toFixed(1)})`,
      });
    }
  }

  // 7. Trimme reasons auf max 2 chips
  return {
    ...decision,
    reasons: trimReasonsForUI(decision.reasons),
  };
}

/**
 * Hard Reject Rules
 */
function applyHardRejectRules(
  token: Token,
  fixedRules: any
): Decision | null {
  if (!fixedRules.hard_reject) {
    return null;
  }

  for (const rule of fixedRules.hard_reject) {
    if (rule.if(token)) {
      return {
        action: 'reject',
        reasons: [rule.reason],
      };
    }
  }

  return null;
}

/**
 * Requirements für not_bonded Tab
 */
function applyNotBondedRequirements(
  token: Token,
  fixedRules: any,
  currentDecision: Decision
): Decision {
  const reasons: Reason[] = [...currentDecision.reasons];

  // Launchpad Filter (wenn required)
  if (fixedRules.require_launchpad_filter) {
    const allowedLaunchpads = ['pumpfun', 'moonshot'];
    if (!allowedLaunchpads.includes(token.launchpad)) {
      reasons.push({
        code: 'launchpad_not_allowed',
        message: `Launchpad nicht erlaubt: ${token.launchpad}`,
      });
      return {
        action: 'reject',
        reasons,
      };
    }
  }

  // Min Liquidity
  const minLiq = fixedRules.min_liquidity?.liq_sol_min;
  if (minLiq != null && (token.liquidity.liq_sol ?? 0) < minLiq) {
    reasons.push({
      code: 'liquidity_insufficient',
      message: `Liquidität zu niedrig (min: ${minLiq} SOL)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  // Concentration Caps
  const top1Max = fixedRules.concentration_caps?.top1_pct_max;
  if (top1Max != null && token.holders.top1_pct > top1Max) {
    reasons.push({
      code: 'top1_concentration_high',
      message: `Top 1% Konzentration zu hoch (max: ${top1Max}%)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const top10Max = fixedRules.concentration_caps?.top10_pct_max;
  if (top10Max != null && token.holders.top10_pct > top10Max) {
    reasons.push({
      code: 'top10_concentration_high',
      message: `Top 10% Konzentration zu hoch (max: ${top10Max}%)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const deployerMax = fixedRules.concentration_caps?.deployer_pct_max;
  if (deployerMax != null && token.holders.deployer_pct != null && token.holders.deployer_pct > deployerMax) {
    reasons.push({
      code: 'deployer_concentration_high',
      message: `Deployer-Konzentration zu hoch (max: ${deployerMax}%)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  // Organic Activity Floors
  const txPerMinMin = fixedRules.organic_activity_floors?.tx_per_min_5m_min;
  if (txPerMinMin != null && token.trading.tx_per_min_5m < txPerMinMin) {
    reasons.push({
      code: 'tx_per_min_low',
      message: `TX/Min zu niedrig (min: ${txPerMinMin})`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const sellsMin = fixedRules.organic_activity_floors?.buys_sells_min_sells_5m;
  if (sellsMin != null && token.trading.sells_5m < sellsMin) {
    reasons.push({
      code: 'sells_low',
      message: `Sells zu niedrig (min: ${sellsMin})`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  // Anti-Bundler Defaults
  const bundleMax = fixedRules.anti_bundler_defaults?.bundle_score_max;
  if (bundleMax != null && token.manipulation.bundle_score != null && token.manipulation.bundle_score > bundleMax) {
    reasons.push({
      code: 'bundle_score_high',
      message: `Bundler-Score zu hoch (max: ${bundleMax})`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const identicalBuyMax = fixedRules.anti_bundler_defaults?.identical_buy_cluster_score_max;
  if (identicalBuyMax != null && token.manipulation.identical_buy_cluster_score != null && token.manipulation.identical_buy_cluster_score > identicalBuyMax) {
    reasons.push({
      code: 'identical_buy_cluster_high',
      message: `Identical Buy Cluster zu hoch (max: ${identicalBuyMax})`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const sameFunderMax = fixedRules.anti_bundler_defaults?.same_funder_cluster_score_max;
  if (sameFunderMax != null && token.manipulation.same_funder_cluster_score != null && token.manipulation.same_funder_cluster_score > sameFunderMax) {
    reasons.push({
      code: 'same_funder_cluster_high',
      message: `Same Funder Cluster zu hoch (max: ${sameFunderMax})`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const washTradeMax = fixedRules.anti_bundler_defaults?.wash_trade_score_max;
  if (washTradeMax != null && token.manipulation.wash_trade_score != null && token.manipulation.wash_trade_score > washTradeMax) {
    reasons.push({
      code: 'wash_trade_score_high',
      message: `Wash-Trade-Score zu hoch (max: ${washTradeMax})`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  return currentDecision;
}

/**
 * Requirements für bonded Tab
 */
function applyBondedRequirements(
  token: Token,
  fixedRules: any,
  currentDecision: Decision
): Decision {
  const reasons: Reason[] = [...currentDecision.reasons];

  // Min Liquidity
  const minLiq = fixedRules.min_liquidity?.liq_sol_min;
  if (minLiq != null && (token.liquidity.liq_sol ?? 0) < minLiq) {
    reasons.push({
      code: 'liquidity_insufficient',
      message: `Liquidität zu niedrig (min: ${minLiq} SOL)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  // LP Policy
  const lpPolicy = fixedRules.lp_policy;
  if (lpPolicy?.require_lp_proof) {
    const lpAccepted = lpPolicy.accept_if?.some((check: (token: Token) => boolean) => check(token));
    if (!lpAccepted) {
      // Prüfe ob LP-Daten überhaupt vorhanden sind
      const hasLpData =
        token.liquidity.lp_burned !== null ||
        token.liquidity.lp_locked_pct !== null ||
        token.liquidity.lp_lock_days !== null;

      if (hasLpData && lpPolicy.reject_if_missing_data) {
        // LP-Daten vorhanden, aber Policy nicht erfüllt -> reject
        reasons.push({
          code: 'lp_policy_not_met',
          message: 'LP-Policy nicht erfüllt',
        });
        return {
          action: 'reject',
          reasons,
        };
      } else if (!hasLpData && !lpPolicy.reject_if_missing_data) {
        // LP-Daten fehlen und reject_if_missing_data = false -> downrank (wird später durch fallback behandelt)
        // Hier nicht downrank, sondern allow, damit fallback es behandeln kann
        return currentDecision;
      } else if (hasLpData && !lpPolicy.reject_if_missing_data) {
        // LP-Daten vorhanden, aber Policy nicht erfüllt und reject_if_missing_data = false -> downrank
        reasons.push({
          code: 'lp_data_missing',
          message: 'LP-Policy nicht erfüllt',
        });
        return {
          action: 'downrank',
          reasons,
        };
      }
    }
  }

  // Concentration Caps
  const top1Max = fixedRules.concentration_caps?.top1_pct_max;
  if (top1Max != null && token.holders.top1_pct > top1Max) {
    reasons.push({
      code: 'top1_concentration_high',
      message: `Top 1% Konzentration zu hoch (max: ${top1Max}%)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const top10Max = fixedRules.concentration_caps?.top10_pct_max;
  if (top10Max != null && token.holders.top10_pct > top10Max) {
    reasons.push({
      code: 'top10_concentration_high',
      message: `Top 10% Konzentration zu hoch (max: ${top10Max}%)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const deployerMax = fixedRules.concentration_caps?.deployer_pct_max;
  if (deployerMax != null && token.holders.deployer_pct != null && token.holders.deployer_pct > deployerMax) {
    reasons.push({
      code: 'deployer_concentration_high',
      message: `Deployer-Konzentration zu hoch (max: ${deployerMax}%)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  // Anti-Manipulation Defaults
  const bundleMax = fixedRules.anti_manipulation_defaults?.bundle_score_max;
  if (bundleMax != null && token.manipulation.bundle_score != null && token.manipulation.bundle_score > bundleMax) {
    reasons.push({
      code: 'bundle_score_high',
      message: `Bundler-Score zu hoch (max: ${bundleMax})`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  const washTradeMax = fixedRules.anti_manipulation_defaults?.wash_trade_score_max;
  if (washTradeMax != null && token.manipulation.wash_trade_score != null && token.manipulation.wash_trade_score > washTradeMax) {
    reasons.push({
      code: 'wash_trade_score_high',
      message: `Wash-Trade-Score zu hoch (max: ${washTradeMax})`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  return currentDecision;
}

/**
 * Requirements für ranked Tab
 */
function applyRankedRequirements(
  token: Token,
  fixedRules: any,
  currentDecision: Decision
): Decision {
  const reasons: Reason[] = [...currentDecision.reasons];
  const safetyFloors = fixedRules.safety_floors;

  // Safety Floors
  if (safetyFloors?.mint_authority_revoked_required && !token.authorities.mint_authority_revoked) {
    reasons.push({
      code: 'mint_authority_present',
      message: 'Mint Authority aktiv',
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  if (safetyFloors?.freeze_authority_revoked_required && !token.authorities.freeze_authority_revoked) {
    reasons.push({
      code: 'freeze_authority_present',
      message: 'Freeze Authority aktiv',
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  if (safetyFloors?.min_liquidity_liq_sol != null && (token.liquidity.liq_sol ?? 0) < safetyFloors.min_liquidity_liq_sol) {
    reasons.push({
      code: 'liquidity_insufficient',
      message: `Liquidität zu niedrig (min: ${safetyFloors.min_liquidity_liq_sol} SOL)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  if (safetyFloors?.top10_pct_max != null && token.holders.top10_pct > safetyFloors.top10_pct_max) {
    reasons.push({
      code: 'top10_concentration_high',
      message: `Top 10% Konzentration zu hoch (max: ${safetyFloors.top10_pct_max}%)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  if (safetyFloors?.top1_pct_max != null && token.holders.top1_pct > safetyFloors.top1_pct_max) {
    reasons.push({
      code: 'top1_concentration_high',
      message: `Top 1% Konzentration zu hoch (max: ${safetyFloors.top1_pct_max}%)`,
    });
    return {
      action: 'reject',
      reasons,
    };
  }

  // LP Required if Bonded
  if (safetyFloors?.lp_required_if_bonded && token.market.is_bonded) {
    const lpAccepted =
      token.liquidity.lp_burned === true ||
      ((token.liquidity.lp_locked_pct ?? 0) >= 80 && (token.liquidity.lp_lock_days ?? 0) >= 30);
    if (!lpAccepted) {
      reasons.push({
        code: 'lp_required_bonded',
        message: 'LP-Policy erforderlich für bonded Token',
      });
      return {
        action: 'reject',
        reasons,
      };
    }
  }

  // Ranking Requirements
  const rankingReqs = fixedRules.ranking_requirements;
  if (rankingReqs?.oracle_confidence_min != null) {
    const confidence = token.oracle.confidence ?? 0;
    if (confidence < rankingReqs.oracle_confidence_min) {
      reasons.push({
        code: 'oracle_confidence_low',
        message: `Oracle-Confidence zu niedrig (min: ${rankingReqs.oracle_confidence_min})`,
      });
      return {
        action: 'reject',
        reasons,
      };
    }
  }

  if (rankingReqs?.x_account_quality_min != null) {
    // Nur prüfen wenn x_account_quality_score vorhanden ist
    if (token.social.x_account_quality_score != null) {
      const quality = token.social.x_account_quality_score;
      if (quality < rankingReqs.x_account_quality_min) {
        reasons.push({
          code: 'x_account_quality_low',
          message: `X Account Quality zu niedrig (min: ${rankingReqs.x_account_quality_min})`,
        });
        return {
          action: 'reject',
          reasons,
        };
      }
    }
    // Wenn x_account_quality_score null ist, wird es durch fallback behandelt (do_not_penalize)
  }

  // Downrank Rules
  if (fixedRules.downrank_rules) {
    for (const rule of fixedRules.downrank_rules) {
      if (rule.if(token) && currentDecision.action === 'allow') {
        reasons.push(rule.reason);
        return {
          action: 'downrank',
          reasons,
        };
      }
    }
  }

  return currentDecision;
}

