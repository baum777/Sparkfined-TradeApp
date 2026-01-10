/**
 * Teaser Insight Module
 * Free tier - facts only, no market data
 */

import type { InsightContext, InsightSnapshot } from '../types.js';

export const teaserModule = {
  name: 'teaser',
  requiredTier: 'free' as const,
  requiredData: ['entry.facts'],
  
  async generate(context: InsightContext): Promise<InsightSnapshot> {
    const { entry } = context;
    
    // Free tier: only facts, no patterns, no cross-trade reasoning, no narrative
    const bullets: string[] = [];
    
    // Basic analysis from entry facts only
    if (entry.summary) {
      const summaryLength = entry.summary.length;
      if (summaryLength < 20) {
        bullets.push('Consider adding more detail to your notes for better review later');
      } else {
        bullets.push('Entry has sufficient detail for review');
      }
    }
    
    if (entry.status === 'pending') {
      bullets.push('Entry is pending confirmation - review and confirm when ready');
    }
    
    if (entry.status === 'confirmed') {
      bullets.push('Entry confirmed - ready for reflection');
    }
    
    // Ensure max 3 bullets
    return {
      module: 'teaser',
      bullets: bullets.slice(0, 3),
    };
  },
};

