import type { Token, Tab, PresetId, Decision, Reason } from './types';
import { filterSpec } from './spec';

type PresetRequirements = {
  liq_sol_min?: number;
  top1_pct_max?: number;
  top10_pct_max?: number;
  deployer_pct_max?: number;
  tx_per_min_5m_min?: number;
  sells_5m_min?: number;
  holder_count_min?: number;
  lp_policy?: {
    accept_if?: ReadonlyArray<(token: Token) => boolean>;
  };
};

/**
 * Wende Preset-Regeln an
 * Merge-Strategie: fixed bleibt aktiv; preset ergänzt/verschärft
 * Bei Konflikten: strenger gewinnt
 */
export function applyPreset(
  token: Token,
  tab: Tab,
  presetId: PresetId,
  currentDecision: Decision
): Decision {
  const preset = filterSpec.presets[presetId];

  // Prüfe ob Preset für diesen Tab gilt
  if (!preset.apply_to.includes(tab)) {
    return currentDecision;
  }

  const reasons: Reason[] = [...currentDecision.reasons];

  // Hard Reject Rules aus Preset
  if ('hard_reject' in preset && preset.hard_reject) {
    for (const rule of preset.hard_reject) {
      if (rule.if(token)) {
        return {
          action: 'reject',
          reasons: [rule.reason, ...reasons],
          score: currentDecision.score,
        };
      }
    }
  }

  // Downrank Rules aus Preset (vor Requirements, damit sie nicht durch Requirements überschrieben werden)
  let hasDownrankReason = false;
  const downrankRules =
    'downrank' in preset
      ? preset.downrank
      : 'ranking' in preset
        ? preset.ranking?.downrank
        : undefined;
  if (downrankRules && currentDecision.action === 'allow') {
    for (const rule of downrankRules) {
      if (rule.if(token)) {
        reasons.push(rule.reason);
        currentDecision = {
          action: 'downrank',
          reasons,
          score: currentDecision.score,
        };
        hasDownrankReason = true;
      }
    }
  }

  // Requirements aus Preset (verschärfen fixed thresholds)
  // Wenn bereits eine Downrank-Regel angewendet wurde, sollten Requirements nicht mehr rejected werden
  if ('requirements' in preset && preset.requirements) {
    const req = preset.requirements as PresetRequirements;

    // Liquidity
    if (req.liq_sol_min != null) {
      const fixedLiq = getFixedLiquidityMin(tab);
      const minLiq = Math.max(req.liq_sol_min, fixedLiq ?? 0);
      if ((token.liquidity.liq_sol ?? 0) < minLiq) {
        reasons.push({
          code: 'preset_liquidity_insufficient',
          message: `Liquidität zu niedrig (min: ${minLiq} SOL)`,
        });
        return {
          action: 'reject',
          reasons,
          score: currentDecision.score,
        };
      }
    }

    // Concentration
    if (req.top1_pct_max != null) {
      const fixedTop1 = getFixedTop1Max(tab);
      const maxTop1 = fixedTop1 != null ? Math.min(req.top1_pct_max, fixedTop1) : req.top1_pct_max;
      if (token.holders.top1_pct > maxTop1) {
        reasons.push({
          code: 'preset_top1_concentration_high',
          message: `Top 1% Konzentration zu hoch (max: ${maxTop1}%)`,
        });
        return {
          action: 'reject',
          reasons,
          score: currentDecision.score,
        };
      }
    }

    if (req.top10_pct_max != null) {
      const fixedTop10 = getFixedTop10Max(tab);
      const maxTop10 = fixedTop10 != null ? Math.min(req.top10_pct_max, fixedTop10) : req.top10_pct_max;
      if (token.holders.top10_pct > maxTop10) {
        reasons.push({
          code: 'preset_top10_concentration_high',
          message: `Top 10% Konzentration zu hoch (max: ${maxTop10}%)`,
        });
        return {
          action: 'reject',
          reasons,
          score: currentDecision.score,
        };
      }
    }

    // Deployer
    if (req.deployer_pct_max != null && token.holders.deployer_pct != null) {
      const fixedDeployer = getFixedDeployerMax(tab);
      const maxDeployer = fixedDeployer != null ? Math.min(req.deployer_pct_max, fixedDeployer) : req.deployer_pct_max;
      if (token.holders.deployer_pct > maxDeployer) {
        reasons.push({
          code: 'preset_deployer_concentration_high',
          message: `Deployer-Konzentration zu hoch (max: ${maxDeployer}%)`,
        });
        return {
          action: 'reject',
          reasons,
          score: currentDecision.score,
        };
      }
    }

    // Activity Floors
    if (req.tx_per_min_5m_min != null) {
      if (token.trading.tx_per_min_5m < req.tx_per_min_5m_min) {
        reasons.push({
          code: 'preset_tx_per_min_low',
          message: `TX/Min zu niedrig (min: ${req.tx_per_min_5m_min})`,
        });
        return {
          action: 'reject',
          reasons,
          score: currentDecision.score,
        };
      }
    }

    if (req.sells_5m_min != null) {
      if (token.trading.sells_5m < req.sells_5m_min) {
        // Wenn bereits eine Downrank-Regel angewendet wurde (z.B. one_sided_flow),
        // dann nicht rejected, sondern downranked
        if (hasDownrankReason) {
          reasons.push({
            code: 'preset_sells_low',
            message: `Sells zu niedrig (min: ${req.sells_5m_min})`,
          });
          return {
            action: 'downrank',
            reasons,
            score: currentDecision.score,
          };
        } else {
          reasons.push({
            code: 'preset_sells_low',
            message: `Sells zu niedrig (min: ${req.sells_5m_min})`,
          });
          return {
            action: 'reject',
            reasons,
            score: currentDecision.score,
          };
        }
      }
    }

    if (req.holder_count_min != null) {
      if (token.holders.holder_count < req.holder_count_min) {
        reasons.push({
          code: 'preset_holder_count_low',
          message: `Holder-Anzahl zu niedrig (min: ${req.holder_count_min})`,
        });
        return {
          action: 'reject',
          reasons,
          score: currentDecision.score,
        };
      }
    }

    // LP Policy
    if (req.lp_policy?.accept_if) {
      const lpAccepted = req.lp_policy.accept_if.some((check) => check(token));
      if (!lpAccepted) {
        // Prüfe ob LP-Daten überhaupt vorhanden sind
        const hasLpData =
          token.liquidity.lp_burned !== null ||
          token.liquidity.lp_locked_pct !== null ||
          token.liquidity.lp_lock_days !== null;

        // Wenn LP-Daten fehlen, sollte es durch fallback behandelt werden (nicht hier rejected)
        if (!hasLpData) {
          // Weiter mit currentDecision (wird später durch fallback behandelt)
        } else {
          // LP-Daten vorhanden, aber Policy nicht erfüllt -> reject
          reasons.push({
            code: 'preset_lp_policy_not_met',
            message: 'LP-Policy nicht erfüllt',
          });
          return {
            action: 'reject',
            reasons,
            score: currentDecision.score,
          };
        }
      }
    }
  }

  return {
    ...currentDecision,
    reasons,
  };
}

/**
 * Helper: Hole fixed thresholds aus spec
 */
function getFixedLiquidityMin(tab: Tab): number | null {
  if (tab === 'not_bonded') {
    return filterSpec.tabs.not_bonded.fixed.min_liquidity.liq_sol_min;
  }
  if (tab === 'bonded') {
    return filterSpec.tabs.bonded.fixed.min_liquidity.liq_sol_min;
  }
  if (tab === 'ranked') {
    return filterSpec.tabs.ranked.fixed.safety_floors.min_liquidity_liq_sol;
  }
  return null;
}

function getFixedTop1Max(tab: Tab): number | null {
  if (tab === 'not_bonded') {
    return filterSpec.tabs.not_bonded.fixed.concentration_caps.top1_pct_max;
  }
  if (tab === 'bonded') {
    return filterSpec.tabs.bonded.fixed.concentration_caps.top1_pct_max;
  }
  if (tab === 'ranked') {
    return filterSpec.tabs.ranked.fixed.safety_floors.top1_pct_max;
  }
  return null;
}

function getFixedTop10Max(tab: Tab): number | null {
  if (tab === 'not_bonded') {
    return filterSpec.tabs.not_bonded.fixed.concentration_caps.top10_pct_max;
  }
  if (tab === 'bonded') {
    return filterSpec.tabs.bonded.fixed.concentration_caps.top10_pct_max;
  }
  if (tab === 'ranked') {
    return filterSpec.tabs.ranked.fixed.safety_floors.top10_pct_max;
  }
  return null;
}

function getFixedDeployerMax(tab: Tab): number | null {
  if (tab === 'not_bonded') {
    return filterSpec.tabs.not_bonded.fixed.concentration_caps.deployer_pct_max;
  }
  if (tab === 'bonded') {
    return filterSpec.tabs.bonded.fixed.concentration_caps.deployer_pct_max;
  }
  return null;
}

