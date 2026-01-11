/**
 * ContextPack Gates Tests
 * Per BACKEND MAP section 4: Tests for tier gating
 */

import { describe, it, expect } from 'vitest';
import {
  canIncludeMarket,
  canIncludeDeltas,
  canIncludeNarrative,
  canIncludeIndicators,
  canIncludeOrderPressure,
} from '../../src/domain/contextPack/gates.js';
import type { UserSettings } from '../../src/domain/settings/settings.types.js';

describe('ContextPack Gates', () => {
  describe('canIncludeMarket', () => {
    it('free: no market', () => {
      expect(canIncludeMarket('free')).toBe(false);
    });

    it('standard: market only', () => {
      expect(canIncludeMarket('standard')).toBe(true);
    });

    it('pro: market allowed', () => {
      expect(canIncludeMarket('pro')).toBe(true);
    });

    it('high: market allowed', () => {
      expect(canIncludeMarket('high')).toBe(true);
    });

    it('null tier: no market', () => {
      expect(canIncludeMarket(null)).toBe(false);
    });
  });

  describe('canIncludeDeltas', () => {
    it('free: no deltas', () => {
      expect(canIncludeDeltas('free')).toBe(false);
    });

    it('standard: no deltas', () => {
      expect(canIncludeDeltas('standard')).toBe(false);
    });

    it('pro: deltas allowed', () => {
      expect(canIncludeDeltas('pro')).toBe(true);
    });

    it('high: deltas allowed', () => {
      expect(canIncludeDeltas('high')).toBe(true);
    });
  });

  describe('canIncludeNarrative', () => {
    const settingsEnabled: UserSettings = { ai: { grokEnabled: true } };
    const settingsDisabled: UserSettings = { ai: { grokEnabled: false } };

    it('free: no narrative', () => {
      expect(canIncludeNarrative('free', settingsEnabled, true)).toBe(false);
    });

    it('standard: no narrative', () => {
      expect(canIncludeNarrative('standard', settingsEnabled, true)).toBe(false);
    });

    it('pro + toggle on + flag: narrative allowed', () => {
      expect(canIncludeNarrative('pro', settingsEnabled, true)).toBe(true);
    });

    it('pro + toggle off: no narrative', () => {
      expect(canIncludeNarrative('pro', settingsDisabled, true)).toBe(false);
    });

    it('pro + toggle on + flag false: no narrative', () => {
      expect(canIncludeNarrative('pro', settingsEnabled, false)).toBe(false);
    });

    it('high + toggle on + flag: narrative allowed', () => {
      expect(canIncludeNarrative('high', settingsEnabled, true)).toBe(true);
    });
  });

  describe('canIncludeIndicators', () => {
    it('free: no indicators', () => {
      expect(canIncludeIndicators('free')).toBe(false);
    });

    it('standard: no indicators', () => {
      expect(canIncludeIndicators('standard')).toBe(false);
    });

    it('pro: indicators allowed', () => {
      expect(canIncludeIndicators('pro')).toBe(true);
    });

    it('high: indicators allowed', () => {
      expect(canIncludeIndicators('high')).toBe(true);
    });
  });

  describe('canIncludeOrderPressure', () => {
    it('free: no order pressure', () => {
      expect(canIncludeOrderPressure('free')).toBe(false);
    });

    it('standard: no order pressure', () => {
      expect(canIncludeOrderPressure('standard')).toBe(false);
    });

    it('pro: no order pressure', () => {
      expect(canIncludeOrderPressure('pro')).toBe(false);
    });

    it('high: order pressure allowed', () => {
      expect(canIncludeOrderPressure('high')).toBe(true);
    });
  });
});

