import { describe, it, expect } from 'vitest';
import { analyzeTrade } from '../../_lib/domain/walletIngest/tradeIntelligence';
import type { HeliusEnhancedTx } from '../../_lib/domain/walletIngest/helius';

const WALLET = 'WalletAddress11111111111111111111111111111';
const MINTS = {
  wSOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

describe('Trade Intelligence Heuristics', () => {
  
  it('identifies BUY correctly (Quote -> Base)', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'sig1',
      timestamp: 1000,
      type: 'SWAP',
      events: {
        swap: {
          tokenInputs: [{ mint: MINTS.USDC, rawTokenAmount: { tokenAmount: '100' } }],
          tokenOutputs: [{ mint: MINTS.BONK, rawTokenAmount: { tokenAmount: '5000' } }]
        }
      }
    } as any;

    const analysis = analyzeTrade(tx, WALLET);
    
    expect(analysis.side).toBe('BUY');
    expect(analysis.symbolOrAddress).toBe(MINTS.BONK);
    expect(analysis.summary).toContain('BUY');
    expect(analysis.meta.classification.reasonCodes).toContain('QUOTE_IN_BASE_OUT');
    expect(analysis.meta.classification.sideConfidence).toBeGreaterThan(0.9);
  });

  it('identifies SELL correctly (Base -> Quote)', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'sig2',
      timestamp: 1000,
      type: 'SWAP',
      events: {
        swap: {
          tokenInputs: [{ mint: MINTS.BONK, rawTokenAmount: { tokenAmount: '5000' } }],
          tokenOutputs: [{ mint: MINTS.USDC, rawTokenAmount: { tokenAmount: '100' } }]
        }
      }
    } as any;

    const analysis = analyzeTrade(tx, WALLET);
    
    expect(analysis.side).toBe('SELL');
    expect(analysis.symbolOrAddress).toBe(MINTS.BONK);
    expect(analysis.summary).toContain('SELL');
    expect(analysis.meta.classification.reasonCodes).toContain('BASE_IN_QUOTE_OUT');
  });

  it('handles Native SOL as Quote (Input)', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'sig3',
      timestamp: 1000,
      type: 'SWAP',
      events: {
        swap: {
          nativeInput: { amount: '1000000000' }, // SOL in
          tokenOutputs: [{ mint: MINTS.BONK, rawTokenAmount: { tokenAmount: '500' } }]
        }
      }
    } as any;

    const analysis = analyzeTrade(tx, WALLET);
    
    expect(analysis.side).toBe('BUY');
    expect(analysis.symbolOrAddress).toBe(MINTS.BONK);
    expect(analysis.meta.classification.reasonCodes).toContain('QUOTE_IN_BASE_OUT');
  });

  it('handles Native SOL as Quote (Output)', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'sig4',
      timestamp: 1000,
      type: 'SWAP',
      events: {
        swap: {
          tokenInputs: [{ mint: MINTS.BONK, rawTokenAmount: { tokenAmount: '500' } }],
          nativeOutput: { amount: '1000000000' } // SOL out
        }
      }
    } as any;

    const analysis = analyzeTrade(tx, WALLET);
    
    expect(analysis.side).toBe('SELL');
    expect(analysis.symbolOrAddress).toBe(MINTS.BONK);
    expect(analysis.meta.classification.reasonCodes).toContain('BASE_IN_QUOTE_OUT');
  });

  it('defaults to BUY with low confidence if no quote matched (Base -> Base)', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'sig5',
      timestamp: 1000,
      type: 'SWAP',
      events: {
        swap: {
          tokenInputs: [{ mint: 'TOKEN_A', rawTokenAmount: { tokenAmount: '10' } }],
          tokenOutputs: [{ mint: 'TOKEN_B', rawTokenAmount: { tokenAmount: '20' } }]
        }
      }
    } as any;

    const analysis = analyzeTrade(tx, WALLET);
    
    expect(analysis.side).toBe('BUY');
    expect(analysis.symbolOrAddress).toBe('TOKEN_B');
    expect(analysis.meta.classification.sideConfidence).toBeLessThan(0.5);
    expect(analysis.meta.classification.reasonCodes).toContain('NO_QUOTE_MATCH');
  });

  it('identifies Transfer IN', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'sig6',
      timestamp: 1000,
      type: 'TRANSFER',
      tokenTransfers: [
        { mint: MINTS.BONK, tokenAmount: 100, toUserAccount: WALLET, fromUserAccount: 'Other' }
      ]
    } as any;

    const analysis = analyzeTrade(tx, WALLET);
    
    expect(analysis.meta.capture.type).toBe('transfer');
    expect(analysis.side).toBe('BUY'); // Receiving
    expect(analysis.symbolOrAddress).toBe(MINTS.BONK);
    expect(analysis.summary).toContain('TRANSFER');
    expect(analysis.summary).toContain('(IN)');
    expect(analysis.meta.classification.reasonCodes).toContain('TRANSFER_IN');
  });

  it('identifies Transfer OUT', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'sig7',
      timestamp: 1000,
      type: 'TRANSFER',
      tokenTransfers: [
        { mint: MINTS.BONK, tokenAmount: 100, fromUserAccount: WALLET, toUserAccount: 'Other' }
      ]
    } as any;

    const analysis = analyzeTrade(tx, WALLET);
    
    expect(analysis.side).toBe('SELL'); // Sending
    expect(analysis.summary).toContain('(OUT)');
    expect(analysis.meta.classification.reasonCodes).toContain('TRANSFER_OUT');
  });

  it('handles unknown/ambiguous payload safely', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'sig8',
      timestamp: 1000,
      type: 'UNKNOWN',
      // No transfers, no swap events
    } as any;

    const analysis = analyzeTrade(tx, WALLET);
    
    expect(analysis.side).toBe('BUY'); // Default
    expect(analysis.meta.classification.sideConfidence).toBe(0);
    expect(analysis.summary).toContain('Auto-captured');
    expect(analysis.meta.classification.reasonCodes).toContain('DECODE_MISSING');
  });
});

