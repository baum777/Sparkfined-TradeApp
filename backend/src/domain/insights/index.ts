/**
 * Insight Module Registry & Selector
 * Selects allowed insight modules by tier and orchestrates execution
 */

import type { ResolvedTier } from '../../config/tiers.js';
import { tierGte } from '../../config/tiers.js';
import type { InsightContext, InsightSnapshot } from './types.js';
import { teaserModule } from './modules/teaser.js';
import { reviewModule } from './modules/review.js';
import { playbookModule } from './modules/playbook.js';
import { adaptiveCoachModule } from './modules/adaptiveCoach.js';

export type InsightModuleName = 'teaser' | 'review' | 'playbook' | 'adaptiveCoach';

/**
 * Select allowed insight modules for a tier
 * Returns modules in priority order (highest tier first)
 */
export function selectModulesForTier(tier: ResolvedTier): InsightModuleName[] {
  const modules: InsightModuleName[] = [];
  
  // Always include free tier module
  modules.push('teaser');
  
  // Tier >= standard: review module
  if (tierGte(tier, 'standard')) {
    modules.push('review');
  }
  
  // Tier >= pro: playbook module
  if (tierGte(tier, 'pro')) {
    modules.push('playbook');
  }
  
  // Tier >= high: adaptive coach module
  if (tierGte(tier, 'high')) {
    modules.push('adaptiveCoach');
  }
  
  return modules;
}

/**
 * Generate insights for a context
 * Runs all allowed modules and returns combined results
 */
export async function generateInsights(
  tier: ResolvedTier,
  context: InsightContext
): Promise<InsightSnapshot[]> {
  const moduleNames = selectModulesForTier(tier);
  const results: InsightSnapshot[] = [];
  
  for (const moduleName of moduleNames) {
    let snapshot: InsightSnapshot;
    
    switch (moduleName) {
      case 'teaser':
        snapshot = await teaserModule.generate(context);
        break;
      case 'review':
        snapshot = await reviewModule.generate(context);
        break;
      case 'playbook':
        snapshot = await playbookModule.generate(context);
        break;
      case 'adaptiveCoach':
        snapshot = await adaptiveCoachModule.generate(context);
        break;
      default:
        continue;
    }
    
    results.push(snapshot);
  }
  
  return results;
}

/**
 * Get the highest tier module for a tier
 */
export function getHighestTierModule(tier: ResolvedTier): InsightModuleName {
  if (tierGte(tier, 'high')) return 'adaptiveCoach';
  if (tierGte(tier, 'pro')) return 'playbook';
  if (tierGte(tier, 'standard')) return 'review';
  return 'teaser';
}

