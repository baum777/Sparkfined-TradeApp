/**
 * Review Insight Module
 * Standard tier - at-trade market snapshot, patterns, rule suggestions
 */

import type { InsightContext, InsightSnapshot } from '../types.js';

export const reviewModule = {
  name: 'review',
  requiredTier: 'standard' as const,
  requiredData: ['atTrade.marketSnapshot'],
  
  async generate(context: InsightContext): Promise<InsightSnapshot> {
    const { entry, atTradeSnapshot } = context;
    
    const patterns: string[] = [];
    const ruleSuggestions: string[] = [];
    let checklistNudge: string | undefined;
    
    // Analyze with market snapshot
    if (atTradeSnapshot) {
      // Pattern detection based on market state
      if (atTradeSnapshot.volume24hUsd && atTradeSnapshot.volume24hUsd > 1000000) {
        patterns.push('High volume entry - significant market activity');
      }
      
      if (atTradeSnapshot.priceUsd && atTradeSnapshot.marketCapUsd) {
        const mcapToPriceRatio = atTradeSnapshot.marketCapUsd / atTradeSnapshot.priceUsd;
        if (mcapToPriceRatio > 1000000) {
          patterns.push('Large market cap relative to price');
        }
      }
      
      // Rule suggestions
      if (atTradeSnapshot.holdersCount && atTradeSnapshot.holdersCount > 1000) {
        ruleSuggestions.push('Consider tracking holder growth over time');
      }
      
      // Checklist nudge
      if (entry.status === 'pending') {
        checklistNudge = 'Review market conditions before confirming entry';
      }
    }
    
    // Single-entry only, no bias flags
    return {
      module: 'review',
      bullets: [],
      patterns: patterns.slice(0, 2), // Max 2 patterns
      ruleSuggestions: ruleSuggestions.slice(0, 2), // Max 2 suggestions
      checklistNudge,
    };
  },
};

