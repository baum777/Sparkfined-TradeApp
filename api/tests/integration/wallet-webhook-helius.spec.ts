import { describe, it, expect, beforeEach, vi } from 'vitest';
import webhookHandler from '../../wallet/webhook/helius';
import { createMockRequest, createMockResponse } from '../helpers/vercelMock';
import { clearMemoryStore } from '../../_lib/kv/memory-store';
import { setTradingWallet } from '../../_lib/domain/profile/repo';
import { journalList } from '../../_lib/domain/journal/repo';

// Mock Env to enable auto capture
vi.mock('../../_lib/env', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/env')>('../../_lib/env');
  return {
    ...actual,
    getEnv: () => ({
      ...actual.getEnv(),
      AUTO_CAPTURE_ENABLED: true,
      AUTO_CAPTURE_INTELLIGENCE_ENABLED: true,
      HELIUS_WEBHOOK_SECRET: 'test-secret',
    }),
  };
});

const TEST_USER = 'ingest-user';
const WALLET = 'So11111111111111111111111111111111111111112';

describe('Webhook Ingestion Integration', () => {
  beforeEach(async () => {
    clearMemoryStore();
    // Setup User Profile
    await setTradingWallet(TEST_USER, WALLET);
  });

  it('ingests trade and creates journal entry', async () => {
    const payload = [{
      signature: 'sig-integration-test',
      timestamp: 1700000000,
      type: 'SWAP',
      tokenTransfers: [],
      nativeTransfers: [],
      events: {
        swap: {
          tokenInputs: [{ mint: 'SOL', rawTokenAmount: { tokenAmount: '1000' } }],
          tokenOutputs: [{ mint: 'BONK', rawTokenAmount: { tokenAmount: '50000' } }]
        }
      },
      accountData: [{ account: WALLET, nativeBalanceChange: 0 }]
    }];

    const req = createMockRequest({
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: payload,
    });
    const res = createMockResponse();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as any).mock.calls[0][0];
    expect(body.data.processed).toBe(1);

    // Verify Journal Entry
    const { items } = await journalList(TEST_USER, 'PENDING');
    expect(items).toHaveLength(1);
    expect(items[0].summary).toContain('BUY BONK');
    expect(items[0].status).toBe('PENDING');
  });

  it('rejects invalid secret with 401', async () => {
    const req = createMockRequest({
      method: 'POST',
      headers: { 'x-webhook-secret': 'wrong' },
      body: [],
    });
    const res = createMockResponse();

    await webhookHandler(req, res);
    
    // Check if status called with 401
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

