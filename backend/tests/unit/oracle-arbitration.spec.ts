/**
 * Oracle Arbitration Tests
 * Per BACKEND MAP section 4: Tests for narrative evidence arbitration
 */

import { describe, it, expect } from 'vitest';
import { buildOracleContextExtension } from '../../src/domain/contextPack/oracleExtension.js';
import type { ContextPack } from '../../src/domain/contextPack/types.js';

describe('Oracle Arbitration', () => {
  describe('narrative lowEvidence => not used as evidence', () => {
    it('lowEvidence narrative is flagged but not used in patterns', () => {
      const contextPack: ContextPack = {
        id: 'test',
        userId: 'user-1',
        asset: { mint: 'test-mint' },
        anchor: { mode: 'trade_centered', anchorTimeISO: new Date().toISOString() },
        tier: 'pro',
        generatedAtISO: new Date().toISOString(),
        freshnessSec: 86400,
        market: {
          asOfISO: new Date().toISOString(),
          indicators: {
            rsi14: 75,
            trendState: 'overbought',
          },
        },
        narrative: {
          cacheKey: 'test',
          mode: 'trade_centered',
          windows: { preHours: 6, postHours: 6 },
          counts: { strictPre: 0, strictPost: 0, symbolPre: 0, symbolPost: 0, latest: 0 },
          quality: { evidenceLevel: 'low', passedThresholdCount: 0 },
          flags: { lowEvidence: true, highNoise: false },
          sources: { topAuthors: [], usedPresetQuants: [], usedUserQuants: [] },
          headline: 'Test',
          summaryBullets: [],
          sentiment: { label: 'bullish', confidence: 0.5 },
          themes: [],
          risks: [],
          evidencePosts: [],
        },
        reliability: {
          evidenceLevel: 'low',
          noiseLevel: 'low',
          dataCompleteness: 3,
        },
      };

      const extension = buildOracleContextExtension(contextPack);
      expect(extension).toBeDefined();
      
      // Should have bias flag for low evidence
      expect(extension?.biasFlags?.some(f => f.code === 'LOW_EVIDENCE_NARRATIVE')).toBe(true);
      
      // FOMO_ENTRY pattern should not use narrative if evidenceLevel is low
      const fomoPattern = extension?.patterns?.find(p => p.code === 'FOMO_ENTRY');
      if (fomoPattern) {
        // Should not reference narrative in evidence
        const hasNarrativeEvidence = fomoPattern.evidence.some(e => e.ref.includes('narrative'));
        expect(hasNarrativeEvidence).toBe(false);
      }
    });
  });

  describe('narrative highNoise => flagged', () => {
    it('highNoise narrative is flagged', () => {
      const contextPack: ContextPack = {
        id: 'test',
        userId: 'user-1',
        asset: { mint: 'test-mint' },
        anchor: { mode: 'trade_centered', anchorTimeISO: new Date().toISOString() },
        tier: 'pro',
        generatedAtISO: new Date().toISOString(),
        freshnessSec: 86400,
        narrative: {
          cacheKey: 'test',
          mode: 'trade_centered',
          windows: { preHours: 6, postHours: 6 },
          counts: { strictPre: 0, strictPost: 0, symbolPre: 0, symbolPost: 0, latest: 0 },
          quality: { evidenceLevel: 'medium', passedThresholdCount: 0 },
          flags: { lowEvidence: false, highNoise: true },
          sources: { topAuthors: [], usedPresetQuants: [], usedUserQuants: [] },
          headline: 'Test',
          summaryBullets: [],
          sentiment: { label: 'neutral', confidence: 0.5 },
          themes: [],
          risks: [],
          evidencePosts: [],
        },
        reliability: {
          evidenceLevel: 'medium',
          noiseLevel: 'high',
          dataCompleteness: 3,
        },
      };

      const extension = buildOracleContextExtension(contextPack);
      expect(extension).toBeDefined();
      expect(extension?.biasFlags?.some(f => f.code === 'HIGH_NOISE_NARRATIVE')).toBe(true);
    });
  });

  describe('contextEvidenceSummary notes', () => {
    it('includes caveats for low evidence narrative', () => {
      const contextPack: ContextPack = {
        id: 'test',
        userId: 'user-1',
        asset: { mint: 'test-mint' },
        anchor: { mode: 'trade_centered', anchorTimeISO: new Date().toISOString() },
        tier: 'pro',
        generatedAtISO: new Date().toISOString(),
        freshnessSec: 86400,
        narrative: {
          cacheKey: 'test',
          mode: 'trade_centered',
          windows: { preHours: 6, postHours: 6 },
          counts: { strictPre: 0, strictPost: 0, symbolPre: 0, symbolPost: 0, latest: 0 },
          quality: { evidenceLevel: 'low', passedThresholdCount: 0 },
          flags: { lowEvidence: true, highNoise: false },
          sources: { topAuthors: [], usedPresetQuants: [], usedUserQuants: [] },
          headline: 'Test',
          summaryBullets: [],
          sentiment: { label: 'neutral', confidence: 0.5 },
          themes: [],
          risks: [],
          evidencePosts: [],
        },
        reliability: {
          evidenceLevel: 'low',
          noiseLevel: 'low',
          dataCompleteness: 3,
        },
      };

      const extension = buildOracleContextExtension(contextPack);
      expect(extension?.contextEvidenceSummary?.notes).toContain('Narrative mostly hype/no proof links');
    });
  });
});

