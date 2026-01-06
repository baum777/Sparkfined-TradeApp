import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateHeliusWebhookSubscription } from '../../_lib/domain/walletIngest/heliusWebhookManager';
import { kv } from '../../_lib/kv';
import * as client from '../../_lib/domain/walletIngest/heliusClient';
import { getEnv } from '../../_lib/env';

vi.mock('../../_lib/kv');
vi.mock('../../_lib/domain/walletIngest/heliusClient');
vi.mock('../../_lib/env', () => ({
  getEnv: vi.fn(),
}));

describe('Helius Webhook Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnv).mockReturnValue({ 
      HELIUS_API_KEY: 'key', 
      HELIUS_WEBHOOK_ID: 'id' 
    } as any);
  });

  it('acquires lock, gets config, patches, releases lock', async () => {
    // Lock succeeds
    vi.mocked(kv.incr).mockResolvedValue(1);
    
    // Get Config
    vi.mocked(client.getWebhookConfig).mockResolvedValue({
      accountAddresses: ['addr1'],
      webhookID: 'id',
      webhookURL: 'url',
      transactionTypes: [],
      authHeader: '',
      webhookType: 'enhanced'
    });

    await updateHeliusWebhookSubscription('user1', 'add', 'addr2');

    expect(kv.incr).toHaveBeenCalled();
    expect(client.getWebhookConfig).toHaveBeenCalled();
    expect(client.putWebhookConfig).toHaveBeenCalledWith(expect.objectContaining({
      accountAddresses: ['addr1', 'addr2']
    }));
    expect(kv.delete).toHaveBeenCalled();
  });

  it('throws CONFLICT if lock fails', async () => {
    // Lock fails (count 2)
    vi.mocked(kv.incr).mockResolvedValue(2);

    await expect(updateHeliusWebhookSubscription('user1', 'add', 'addr2'))
      .rejects
      .toThrow('System busy');
    
    expect(client.getWebhookConfig).not.toHaveBeenCalled();
  });

  it('skips update if address already present (add op)', async () => {
    vi.mocked(kv.incr).mockResolvedValue(1);
    vi.mocked(client.getWebhookConfig).mockResolvedValue({
      accountAddresses: ['addr1'],
    } as any);

    await updateHeliusWebhookSubscription('user1', 'add', 'addr1');

    expect(client.putWebhookConfig).not.toHaveBeenCalled();
    expect(kv.delete).toHaveBeenCalled();
  });
});

