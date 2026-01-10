/**
 * Insight Types
 * Types for AI insight modules
 */

import type { JournalEntryV1 } from '../journal/types.js';
import type { AtTradeMarketSnapshot } from '../market/snapshot.service.js';
import type { DeltaSnapshot } from '../market/delta.service.js';

export interface Evidence {
  entryId: string;
  field: string;
  value: unknown;
}

export interface InsightSnapshot {
  module: string;
  bullets: string[];
  patterns?: string[];
  ruleSuggestions?: string[];
  checklistNudge?: string;
  counterPatterns?: string[];
  biasFlags?: string[];
  ruleDiff?: string;
  drills?: string[];
  adaptiveRules?: string[];
  scenarioWarnings?: string[];
}

export interface InsightContext {
  entry: JournalEntryV1;
  atTradeSnapshot?: AtTradeMarketSnapshot;
  deltaSnapshots?: Record<string, DeltaSnapshot | null>;
  confirmedEntries?: JournalEntryV1[];
  orderPressure?: {
    buySellImbalance?: number;
    largeTxCount?: number;
    avgTradeSizeDelta?: number;
  };
}

export interface InsightModule {
  name: string;
  requiredTier: 'free' | 'standard' | 'pro' | 'high';
  requiredData: string[];
  generate(context: InsightContext): Promise<InsightSnapshot>;
}

