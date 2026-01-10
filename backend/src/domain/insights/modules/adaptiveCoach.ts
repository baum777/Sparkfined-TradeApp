/**
 * Adaptive Coach Insight Module
 * High tier - everything from playbook + order pressure, drills, adaptive rules
 */

import type { InsightContext, InsightSnapshot } from '../types.js';
import { playbookModule } from './playbook.js';

export const adaptiveCoachModule = {
  name: 'adaptiveCoach',
  requiredTier: 'high' as const,
  requiredData: [
    'atTrade.marketSnapshot',
    'deltaSnapshots',
    'confirmedEntries(history)',
    'orderPressure',
  ],
  
  async generate(context: InsightContext): Promise<InsightSnapshot> {
    // Start with playbook insights
    const playbookInsight = await playbookModule.generate(context);
    
    const drills: string[] = [];
    const adaptiveRules: string[] = [];
    const scenarioWarnings: string[] = [];
    
    // Order pressure analysis
    if (context.orderPressure) {
      const { buySellImbalance, largeTxCount } = context.orderPressure;
      
      if (buySellImbalance !== undefined) {
        if (buySellImbalance > 0.2) {
          scenarioWarnings.push('Strong buy pressure detected - monitor for reversal');
          drills.push('Practice identifying pressure exhaustion signals');
        } else if (buySellImbalance < -0.2) {
          scenarioWarnings.push('Strong sell pressure - consider defensive positioning');
        }
      }
      
      if (largeTxCount !== undefined && largeTxCount > 10) {
        adaptiveRules.push('High large transaction count - increase position size awareness');
      }
    }
    
    // Adaptive rules based on delta performance
    if (context.deltaSnapshots) {
      const delta1h = context.deltaSnapshots['+1h'];
      if (delta1h && delta1h.priceDeltaPercent > 10) {
        drills.push('Review entry timing - strong early performance suggests good entry');
        adaptiveRules.push('Consider similar entry patterns for future trades');
      } else if (delta1h && delta1h.priceDeltaPercent < -10) {
        drills.push('Practice identifying better entry points');
        adaptiveRules.push('Review entry criteria - may need tighter filters');
      }
    }
    
    // No auto-actions, no alerts without user opt-in
    return {
      ...playbookInsight,
      module: 'adaptiveCoach',
      drills,
      adaptiveRules,
      scenarioWarnings,
    };
  },
};

