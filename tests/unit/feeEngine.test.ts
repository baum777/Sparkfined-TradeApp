import { describe, it, expect } from 'vitest';
import { resolveFeeBps, computeFeeAmountBaseUnits, parseUiAmountToBaseUnits } from '../../shared/trading/fee/feeEngine';

describe('Fee Engine', () => {
  it('Fee tier mapping', () => {
    expect(resolveFeeBps('free')).toBe(65);
    expect(resolveFeeBps('soft')).toBe(55);
    expect(resolveFeeBps('hardI')).toBe(40);
    expect(resolveFeeBps('hardII')).toBe(30);
    expect(resolveFeeBps('genesis')).toBe(20);
  });

  it('Fee calculation rounding (integers)', () => {
    // 100 base units, 50 bps (0.5%) -> 0.5 -> 0
    expect(computeFeeAmountBaseUnits(100n, 50)).toBe(0n);
    
    // 200 base units, 50 bps -> 1
    expect(computeFeeAmountBaseUnits(200n, 50)).toBe(1n);

    // 1000 base units, 50 bps -> 5
    expect(computeFeeAmountBaseUnits(1000n, 50)).toBe(5n);
  });

  it('Parse UI amount', () => {
    expect(parseUiAmountToBaseUnits('1.0', 6)).toBe(1000000n);
    expect(parseUiAmountToBaseUnits('0.5', 6)).toBe(500000n);
    expect(parseUiAmountToBaseUnits('0.123456789', 6)).toBe(123456n); // Truncates beyond decimals
  });
});

