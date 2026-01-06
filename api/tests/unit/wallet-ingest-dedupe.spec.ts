import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ingestHeliusWebhook } from '../../_lib/domain/walletIngest/ingest';
import { kv } from '../../_lib/kv';
import { journalCreateWithMeta } from '../../_lib/domain/journal/repo';

// Mock KV and Journal Repo
vi.mock('../../_lib/kv');
vi.mock('../../_lib/domain/journal/repo');

// Mock Profile Repo (getUserIdByWallet)
vi.mock('../../_lib/domain/profile/repo', () => ({
  getUserIdByWallet: vi.fn().mockResolvedValue('user1'),
}));

const SAMPLE_TX = {
  signature: 'sig1',
  timestamp: 1234567890,
  type: 'SWAP',
  events: {
    swap: {
      nativeInput: { amount: '1000' },
      tokenOutputs: [{ mint: 'MINT1', rawTokenAmount: { tokenAmount: '2000' } }]
    }
  },
  accountData: [{ account: 'wallet1', nativeBalanceChange: 0 }]
} as any;

describe('Wallet Ingest Dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ingests new transaction', async () => {
    // Mock dedupe incr -> 1 (new)
    vi.mocked(kv.incr).mockResolvedValue(1);

    const result = await ingestHeliusWebhook([SAMPLE_TX]);

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(journalCreateWithMeta).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({ side: 'BUY', summary: expect.stringContaining('BUY MINT1') }),
      'trade:sig1'
    );
  });

  it('skips duplicate transaction', async () => {
    // Mock dedupe incr -> 2 (already seen)
    vi.mocked(kv.incr).mockResolvedValue(2);

    const result = await ingestHeliusWebhook([SAMPLE_TX]);

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1); // Skipped due to dedupe
    expect(journalCreateWithMeta).not.toHaveBeenCalled();
  });
});

