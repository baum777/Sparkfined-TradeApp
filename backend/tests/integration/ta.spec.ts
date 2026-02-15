import { describe, it, expect } from 'vitest';
import { generateTAReport } from '../../src/domain/ta/taGenerator';
import { taCacheGet, taCacheSet } from '../../src/domain/ta/cacheRepo';

describe('TA Integration', () => {
  describe('Report Generation', () => {
    it('should generate complete report', () => {
      const report = generateTAReport('BTC', '1h', false, new Date());
      
      // Verify structure
      expect(report.assumptions).toBeDefined();
      expect(report.trend).toBeDefined();
      expect(report.support).toBeDefined();
      expect(report.resistance).toBeDefined();
      expect(report.takeProfitLevels).toBeDefined();
      expect(report.stopLoss).toBeDefined();
      expect(report.reversalCriteria).toBeDefined();
    });
    
    it('should handle different markets', () => {
      const btc = generateTAReport('BTC', '1h', false, new Date());
      const eth = generateTAReport('ETH', '4h', false, new Date());
      const sol = generateTAReport('SOL', '15m', true, new Date());
      
      expect(btc.assumptions.market).toBe('BTC');
      expect(eth.assumptions.market).toBe('ETH');
      expect(sol.assumptions.market).toBe('SOL');
      expect(sol.assumptions.replay).toBe(true);
    });
  });
  
  describe('Caching', () => {
    it('should cache and retrieve reports', async () => {
      const market = 'BTC';
      const timeframe = '1h';
      const replay = false;
      const bucket = '2025-12-31';
      
      const report = generateTAReport(market, timeframe, replay, new Date('2025-12-31'));
      
      // Cache it
      await taCacheSet(market, timeframe, replay, bucket, report);
      
      // Retrieve it
      const cached = await taCacheGet(market, timeframe, replay, bucket);
      
      expect(cached).toEqual(report);
    });
    
    it('should return null for missing cache', async () => {
      const cached = await taCacheGet('MISSING', '1h', false, '2025-12-31');
      
      expect(cached).toBeNull();
    });
    
    it('should isolate cache by all parameters', async () => {
      const bucket = '2025-12-31';
      const report1 = generateTAReport('BTC', '1h', false, new Date('2025-12-31'));
      const report2 = generateTAReport('BTC', '4h', false, new Date('2025-12-31'));
      
      await taCacheSet('BTC', '1h', false, bucket, report1);
      await taCacheSet('BTC', '4h', false, bucket, report2);
      
      const cached1 = await taCacheGet('BTC', '1h', false, bucket);
      const cached2 = await taCacheGet('BTC', '4h', false, bucket);
      
      expect(cached1?.assumptions.timeframe).toBe('1h');
      expect(cached2?.assumptions.timeframe).toBe('4h');
    });
  });
});
