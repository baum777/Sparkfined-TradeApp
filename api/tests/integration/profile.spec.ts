import { describe, it, expect, beforeEach, vi } from 'vitest';
import profileHandler from '../../profile/index';
import walletHandler from '../../profile/trading-wallet';
import { createMockRequest, createMockResponse } from '../helpers/vercelMock';
import { createValidToken } from '../helpers/jwt';
import { clearMemoryStore } from '../../_lib/kv/memory-store';
import * as heliusManager from '../../_lib/domain/walletIngest/heliusWebhookManager';

// Mock Helius Manager to avoid external calls
vi.mock('../../_lib/domain/walletIngest/heliusWebhookManager', () => ({
  updateHeliusWebhookSubscription: vi.fn().mockResolvedValue(undefined),
}));

const TEST_USER_ID = 'test-user-profile';
const AUTH_HEADER = { authorization: `Bearer ${createValidToken(TEST_USER_ID)}` };

describe('Profile API Integration', () => {
  beforeEach(() => {
    clearMemoryStore();
    vi.clearAllMocks();
  });

  it('PUT /api/profile/trading-wallet sets wallet', async () => {
    const req = createMockRequest({
      method: 'PUT',
      headers: { ...AUTH_HEADER },
      body: { walletAddress: 'So11111111111111111111111111111111111111112' },
    });
    const res = createMockResponse();

    await walletHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(heliusManager.updateHeliusWebhookSubscription).toHaveBeenCalledWith(
      TEST_USER_ID, 'add', 'So11111111111111111111111111111111111111112'
    );

    // Verify GET
    const getReq = createMockRequest({
      method: 'GET',
      headers: { ...AUTH_HEADER },
    });
    const getRes = createMockResponse();
    await profileHandler(getReq, getRes);

    expect(getRes.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tradingWallet: 'So11111111111111111111111111111111111111112' })
    }));
  });

  it('DELETE /api/profile/trading-wallet removes wallet', async () => {
    // Setup
    const putReq = createMockRequest({
      method: 'PUT',
      headers: { ...AUTH_HEADER },
      body: { walletAddress: 'So11111111111111111111111111111111111111112' },
    });
    await walletHandler(putReq, createMockResponse());

    // Delete
    const delReq = createMockRequest({
      method: 'DELETE',
      headers: { ...AUTH_HEADER },
    });
    const delRes = createMockResponse();
    await walletHandler(delReq, delRes);

    expect(delRes.status).toHaveBeenCalledWith(204);
    expect(heliusManager.updateHeliusWebhookSubscription).toHaveBeenCalledWith(
      TEST_USER_ID, 'remove', 'So11111111111111111111111111111111111111112'
    );
  });
});

