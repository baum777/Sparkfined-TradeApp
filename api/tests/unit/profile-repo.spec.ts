import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setTradingWallet, getProfile, clearTradingWallet } from '../../_lib/domain/profile/repo';
import { kv, kvKeys } from '../../_lib/kv';
import { ErrorCodes } from '../../_lib/errors';

// Mock KV
vi.mock('../../_lib/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    incr: vi.fn(),
  },
  kvKeys: {
    profileV1: (uid: string) => `profile:${uid}`,
    walletIndexV1: (w: string) => `index:${w}`,
  }
}));

describe('Profile Repo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets trading wallet if unused', async () => {
    // Mock index check: null (unused)
    vi.mocked(kv.get).mockResolvedValueOnce(null); 
    // Mock profile check: null (new profile)
    vi.mocked(kv.get).mockResolvedValueOnce(null);

    await setTradingWallet('user1', 'addr1');

    expect(kv.set).toHaveBeenCalledTimes(2); // profile + index
    expect(kv.set).toHaveBeenCalledWith('index:addr1', expect.objectContaining({ userId: 'user1' }));
  });

  it('throws CONFLICT if wallet used by another user', async () => {
    // Mock index check: used by user2
    vi.mocked(kv.get).mockResolvedValueOnce({ userId: 'user2' });

    await expect(setTradingWallet('user1', 'addr1'))
      .rejects
      .toThrow(ErrorCodes.PROFILE_WALLET_IN_USE);
  });

  it('removes old index when switching wallet', async () => {
    // Mock index check (new wallet): unused
    vi.mocked(kv.get).mockResolvedValueOnce(null);
    // Mock profile check: has old wallet
    vi.mocked(kv.get).mockResolvedValueOnce({ tradingWallet: 'oldAddr' });
    // Mock old index check: belongs to us
    vi.mocked(kv.get).mockResolvedValueOnce({ userId: 'user1' });

    await setTradingWallet('user1', 'newAddr');

    expect(kv.delete).toHaveBeenCalledWith('index:oldAddr');
    expect(kv.set).toHaveBeenCalledWith('index:newAddr', expect.objectContaining({ userId: 'user1' }));
  });
});

