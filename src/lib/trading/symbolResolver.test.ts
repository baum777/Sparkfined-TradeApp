/**
 * Unit tests for symbolResolver
 * 
 * Run with: npm test symbolResolver
 */

import { describe, it, expect } from 'vitest';
import { resolveSymbolToMint, DEFAULT_QUOTE_MINT } from './symbolResolver';

describe('resolveSymbolToMint', () => {
  it('should resolve SOL to correct mint', () => {
    const result = resolveSymbolToMint('SOL');
    expect(result).toBe('So11111111111111111111111111111111111111112');
  });

  it('should resolve USDC to correct mint', () => {
    const result = resolveSymbolToMint('USDC');
    expect(result).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('should resolve USDT to correct mint', () => {
    const result = resolveSymbolToMint('USDT');
    expect(result).toBe('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
  });

  it('should resolve mSOL to correct mint', () => {
    const result = resolveSymbolToMint('mSOL');
    expect(result).toBe('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');
  });

  it('should resolve case-insensitive symbols', () => {
    expect(resolveSymbolToMint('sol')).toBe('So11111111111111111111111111111111111111112');
    expect(resolveSymbolToMint('Sol')).toBe('So11111111111111111111111111111111111111112');
    expect(resolveSymbolToMint('SOL')).toBe('So11111111111111111111111111111111111111112');
  });

  it('should handle whitespace', () => {
    expect(resolveSymbolToMint('  SOL  ')).toBe('So11111111111111111111111111111111111111112');
  });

  it('should return null for unknown symbols', () => {
    expect(resolveSymbolToMint('UNKNOWN')).toBe(null);
    expect(resolveSymbolToMint('XYZ')).toBe(null);
    expect(resolveSymbolToMint('')).toBe(null);
  });

  it('should return null for invalid input', () => {
    expect(resolveSymbolToMint(null as any)).toBe(null);
    expect(resolveSymbolToMint(undefined as any)).toBe(null);
    expect(resolveSymbolToMint(123 as any)).toBe(null);
  });

  it('should have correct DEFAULT_QUOTE_MINT', () => {
    expect(DEFAULT_QUOTE_MINT).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });
});

