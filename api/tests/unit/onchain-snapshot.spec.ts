import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildOnchainContextSnapshot } from '../../_lib/domain/journal/onchain/snapshot';
import { DexPaprikaAdapter } from '../../_lib/domain/journal/onchain/dexpaprika';
import { MoralisAdapter } from '../../_lib/domain/journal/onchain/moralis';
import { OnchainFetchError } from '../../_lib/domain/journal/onchain/http';

// Mock adapters
vi.mock('../../_lib/domain/journal/onchain/dexpaprika');
vi.mock('../../_lib/domain/journal/onchain/moralis');

describe('Onchain Snapshot Builder', () => {
  const requestId = 'req-123';
  const symbolOrAddress = 'So11111111111111111111111111111111111111112';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return zeros with MISSING_MARKET_KEY if symbolOrAddress is missing', async () => {
    const { context, meta } = await buildOnchainContextSnapshot({
      requestId,
      symbolOrAddress: undefined,
    });

    expect(context.priceUsd).toBe(0);
    expect(meta.errors).toHaveLength(1);
    expect(meta.errors[0].code).toBe('MISSING_MARKET_KEY');
  });

  it('should merge results when both providers succeed', async () => {
    // Setup Mocks
    vi.mocked(DexPaprikaAdapter.prototype.fetchTokenData).mockResolvedValue({
      priceUsd: 123.45,
      liquidityUsd: 1000,
      volume24h: 500,
      marketCap: 1000000,
      ageMinutes: 60,
      dexId: 'raydium',
    });

    vi.mocked(MoralisAdapter.prototype.fetchTokenData).mockResolvedValue({
      holders: 50,
      transfers24h: 10,
    });

    const { context, meta } = await buildOnchainContextSnapshot({
      requestId,
      symbolOrAddress,
    });

    expect(context.priceUsd).toBe(123.45);
    expect(context.holders).toBe(50);
    expect(meta.errors).toHaveLength(0);
  });

  it('should return partial result if Moralis fails', async () => {
    vi.mocked(DexPaprikaAdapter.prototype.fetchTokenData).mockResolvedValue({
      priceUsd: 100,
      liquidityUsd: 0,
      volume24h: 0,
      marketCap: 0,
      ageMinutes: 0,
    });

    vi.mocked(MoralisAdapter.prototype.fetchTokenData).mockRejectedValue(
      new OnchainFetchError('Timeout', 'TIMEOUT')
    );

    const { context, meta } = await buildOnchainContextSnapshot({
      requestId,
      symbolOrAddress,
    });

    expect(context.priceUsd).toBe(100);
    expect(context.holders).toBe(0); // Zeroed out
    expect(meta.errors).toHaveLength(1);
    expect(meta.errors[0].provider).toBe('moralis');
    expect(meta.errors[0].code).toBe('TIMEOUT');
  });

  it('should return all zeros if both fail', async () => {
    vi.mocked(DexPaprikaAdapter.prototype.fetchTokenData).mockRejectedValue(
      new Error('Network error')
    );
    vi.mocked(MoralisAdapter.prototype.fetchTokenData).mockRejectedValue(
      new OnchainFetchError('API Key missing', 'MISSING_API_KEY')
    );

    const { context, meta } = await buildOnchainContextSnapshot({
      requestId,
      symbolOrAddress,
    });

    expect(context.priceUsd).toBe(0);
    expect(context.holders).toBe(0);
    expect(meta.errors).toHaveLength(2);
    expect(meta.errors.find(e => e.provider === 'dexpaprika')?.code).toBe('UNKNOWN_ERROR');
    expect(meta.errors.find(e => e.provider === 'moralis')?.code).toBe('MISSING_API_KEY');
  });
});

