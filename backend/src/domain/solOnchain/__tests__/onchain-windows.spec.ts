import { describe, it, expect } from 'vitest';
import { getOnchainWindowsForTimeframe } from '../types.js';

describe('solOnchain windows mapping (FROZEN)', () => {
  it('maps micro TFs to 5m/1h', () => {
    expect(getOnchainWindowsForTimeframe('15s')).toEqual({ short: '5m', baseline: '1h' });
    expect(getOnchainWindowsForTimeframe('30s')).toEqual({ short: '5m', baseline: '1h' });
    expect(getOnchainWindowsForTimeframe('1m')).toEqual({ short: '5m', baseline: '1h' });
  });

  it('maps intraday TFs to 1h/24h', () => {
    expect(getOnchainWindowsForTimeframe('5m')).toEqual({ short: '1h', baseline: '24h' });
    expect(getOnchainWindowsForTimeframe('15m')).toEqual({ short: '1h', baseline: '24h' });
    expect(getOnchainWindowsForTimeframe('30m')).toEqual({ short: '1h', baseline: '24h' });
  });

  it('maps swing TFs to 24h/7d', () => {
    expect(getOnchainWindowsForTimeframe('1h')).toEqual({ short: '24h', baseline: '7d' });
    expect(getOnchainWindowsForTimeframe('4h')).toEqual({ short: '24h', baseline: '7d' });
  });
});

