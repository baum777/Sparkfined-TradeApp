import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTerminalStore } from '../../src/lib/state/terminalStore';
import { quoteService } from '../../src/lib/trading/quote/quoteService';

// Mock dependencies
vi.mock('../../src/lib/trading/quote/quoteService', () => ({
  quoteService: {
    getQuote: vi.fn()
  }
}));

// Mock env to avoid issues
vi.mock('../../src/lib/env', () => ({
  isDev: () => false
}));

describe('Terminal Store', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      pair: { baseMint: 'base', quoteMint: 'quote' },
      side: 'buy',
      amount: { mode: 'quote', value: '1' },
      slippageBps: 50,
      priorityFee: { enabled: false },
      feeTier: { tier: 'free', feeBps: 0 },
      quote: { status: 'idle' },
      tx: { status: 'idle' }
    });
    vi.clearAllMocks();
  });

  it('fetchQuote handles race conditions (latest request wins)', async () => {
    const store = useTerminalStore.getState();
    
    // Setup slow response for first call
    const slowQuote: any = { feeBps: 10, expectedOut: { amountUi: '10' } };
    const fastQuote: any = { feeBps: 20, expectedOut: { amountUi: '20' } };
    
    (quoteService.getQuote as any)
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(slowQuote), 50)))
      .mockImplementationOnce(() => Promise.resolve(fastQuote));

    // Fire two requests
    const p1 = store.fetchQuote();
    const p2 = store.fetchQuote();

    await Promise.all([p1, p2]);

    // State should reflect the SECOND call (fastQuote) because it was initiated later
    // p1 (requestId 1) resolves slower
    // p2 (requestId 2) resolves faster (or slower, doesn't matter, id=2 is latest)
    
    // Actually, if p2 resolves FIRST, state updates to fastQuote.
    // Then p1 resolves. It checks requestId. 1 != 2. It returns data but does NOT update state.
    
    expect(useTerminalStore.getState().quote.data).toEqual(fastQuote);
  });

  it('handles error in fetchQuote gracefully', async () => {
    const store = useTerminalStore.getState();
    (quoteService.getQuote as any).mockRejectedValue(new Error('Network error'));

    await store.fetchQuote();

    expect(useTerminalStore.getState().quote.status).toBe('error');
    expect(useTerminalStore.getState().quote.error).toBe('Network error');
  });
});



