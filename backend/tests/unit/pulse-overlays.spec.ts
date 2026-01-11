/**
 * Pulse Overlays Tests
 * Per BACKEND MAP section 4: Tests for deterministic overlay generation
 */

import { describe, it, expect } from 'vitest';
import { buildPulseContextExtension } from '../../src/domain/contextPack/pulseExtension.js';
import type { ContextPack } from '../../src/domain/contextPack/types.js';

describe('Pulse Overlays', () => {
  describe('OVERBOUGHT overlay', () => {
    it('generates overlay when rsi14 >= 70', () => {
      const contextPack: ContextPack = {
        id: 'test',
        userId: 'user-1',
        asset: { mint: 'test-mint' },
        anchor: { mode: 'now_centered', anchorTimeISO: new Date().toISOString() },
        tier: 'pro',
        generatedAtISO: new Date().toISOString(),
        freshnessSec: 300,
        market: {
          asOfISO: new Date().toISOString(),
          indicators: {
            rsi14: 75,
            trendState: 'overbought',
          },
        },
        reliability: {
          evidenceLevel: 'medium',
          noiseLevel: 'low',
          dataCompleteness: 1,
        },
      };

      const extension = buildPulseContextExtension(contextPack);
      expect(extension).toBeDefined();
      expect(extension?.overlays.some(o => o.code === 'OVERBOUGHT')).toBe(true);
    });
  });

  describe('OVERSOLD overlay', () => {
    it('generates overlay when rsi14 <= 30', () => {
      const contextPack: ContextPack = {
        id: 'test',
        userId: 'user-1',
        asset: { mint: 'test-mint' },
        anchor: { mode: 'now_centered', anchorTimeISO: new Date().toISOString() },
        tier: 'pro',
        generatedAtISO: new Date().toISOString(),
        freshnessSec: 300,
        market: {
          asOfISO: new Date().toISOString(),
          indicators: {
            rsi14: 25,
            trendState: 'oversold',
          },
        },
        reliability: {
          evidenceLevel: 'medium',
          noiseLevel: 'low',
          dataCompleteness: 1,
        },
      };

      const extension = buildPulseContextExtension(contextPack);
      expect(extension).toBeDefined();
      expect(extension?.overlays.some(o => o.code === 'OVERSOLD')).toBe(true);
    });
  });

  describe('FOMO_RISK overlay', () => {
    it('generates overlay when OVERBOUGHT + bullish narrative + high noise', () => {
      const contextPack: ContextPack = {
        id: 'test',
        userId: 'user-1',
        asset: { mint: 'test-mint' },
        anchor: { mode: 'now_centered', anchorTimeISO: new Date().toISOString() },
        tier: 'pro',
        generatedAtISO: new Date().toISOString(),
        freshnessSec: 300,
        market: {
          asOfISO: new Date().toISOString(),
          indicators: {
            rsi14: 75,
            trendState: 'overbought',
          },
        },
        narrative: {
          cacheKey: 'test',
          mode: 'latest_only',
          windows: { preHours: 6, postHours: 6 },
          counts: { strictPre: 0, strictPost: 0, symbolPre: 0, symbolPost: 0, latest: 0 },
          quality: { evidenceLevel: 'low', passedThresholdCount: 0 },
          flags: { lowEvidence: false, highNoise: true },
          sources: { topAuthors: [], usedPresetQuants: [], usedUserQuants: [] },
          headline: 'Test',
          summaryBullets: [],
          sentiment: { label: 'bullish', confidence: 0.8 },
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

      const extension = buildPulseContextExtension(contextPack);
      expect(extension).toBeDefined();
      expect(extension?.overlays.some(o => o.code === 'FOMO_RISK')).toBe(true);
    });
  });

  describe('Confidence calculation', () => {
    it('base confidence is 0.6', () => {
      const contextPack: ContextPack = {
        id: 'test',
        userId: 'user-1',
        asset: { mint: 'test-mint' },
        anchor: { mode: 'now_centered', anchorTimeISO: new Date().toISOString() },
        tier: 'standard',
        generatedAtISO: new Date().toISOString(),
        freshnessSec: 300,
        reliability: {
          evidenceLevel: 'low',
          noiseLevel: 'low',
          dataCompleteness: 1,
        },
      };

      const extension = buildPulseContextExtension(contextPack);
      expect(extension?.confidence).toBe(0.6);
    });

    it('high evidence level increases confidence', () => {
      const contextPack: ContextPack = {
        id: 'test',
        userId: 'user-1',
        asset: { mint: 'test-mint' },
        anchor: { mode: 'now_centered', anchorTimeISO: new Date().toISOString() },
        tier: 'pro',
        generatedAtISO: new Date().toISOString(),
        freshnessSec: 300,
        reliability: {
          evidenceLevel: 'high',
          noiseLevel: 'low',
          dataCompleteness: 2,
        },
      };

      const extension = buildPulseContextExtension(contextPack);
      expect(extension?.confidence).toBeGreaterThan(0.6);
    });
  });
});

