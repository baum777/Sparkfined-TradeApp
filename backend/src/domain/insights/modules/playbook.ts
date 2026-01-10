/**
 * Playbook Insight Module
 * Pro tier - delta snapshots, confirmed history, bias flags, cross-trade reasoning
 */

import type { InsightContext, InsightSnapshot } from '../types.js';

export const playbookModule = {
  name: 'playbook',
  requiredTier: 'pro' as const,
  requiredData: ['atTrade.marketSnapshot', 'deltaSnapshots', 'confirmedEntries(history)'],
  
  async generate(context: InsightContext): Promise<InsightSnapshot> {
    const { entry, atTradeSnapshot, deltaSnapshots, confirmedEntries = [] } = context;
    
    const patterns: string[] = [];
    const counterPatterns: string[] = [];
    const biasFlags: string[] = [];
    let ruleDiff: string | undefined;
    
    // Analyze with delta data (labeled as "after")
    if (deltaSnapshots) {
      const delta15m = deltaSnapshots['+15m'];
      if (delta15m && delta15m.priceDeltaPercent > 5) {
        patterns.push('Strong positive price movement in first 15 minutes');
      } else if (delta15m && delta15m.priceDeltaPercent < -5) {
        counterPatterns.push('Negative price movement in first 15 minutes');
      }
    }
    
    // Cross-trade reasoning (only confirmed entries as evidence)
    if (confirmedEntries.length > 0) {
      const recentConfirmed = confirmedEntries.slice(0, 5);
      
      // Detect bias patterns
      const similarEntries = recentConfirmed.filter(e => 
        e.capture?.assetMint === entry.capture?.assetMint
      );
      
      if (similarEntries.length > 3) {
        biasFlags.push('Repeated entries for same asset - potential bias');
      }
      
      // Rule diff vs past behavior
      const avgSummaryLength = recentConfirmed.reduce((sum, e) => 
        sum + (e.summary?.length ?? 0), 0
      ) / recentConfirmed.length;
      
      if (entry.summary && entry.summary.length < avgSummaryLength * 0.7) {
        ruleDiff = 'Shorter notes than usual - consider adding more detail';
      }
    }
    
    // Patterns from at-trade snapshot
    if (atTradeSnapshot) {
      if (atTradeSnapshot.rsi14 !== null && atTradeSnapshot.rsi14 !== undefined) {
        if (atTradeSnapshot.rsi14 > 70) {
          patterns.push('RSI indicates overbought conditions');
        } else if (atTradeSnapshot.rsi14 < 30) {
          patterns.push('RSI indicates oversold conditions');
        }
      }
      
      if (atTradeSnapshot.trendState === 'bullish') {
        patterns.push('Bullish trend detected at entry');
      } else if (atTradeSnapshot.trendState === 'bearish') {
        counterPatterns.push('Bearish trend at entry');
      }
    }
    
    return {
      module: 'playbook',
      bullets: [],
      patterns,
      counterPatterns,
      biasFlags,
      ruleDiff,
    };
  },
};

