import { kv, kvKeys } from '../../kv';
import { conflict } from '../../errors';
import { ErrorCodes } from '../../errors';
import type { ProfileV1, WalletIndexV1 } from './types';

// ─────────────────────────────────────────────────────────────
// PROFILE REPO
// ─────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<ProfileV1 | null> {
  return kv.get<ProfileV1>(kvKeys.profileV1(userId));
}

export async function setTradingWallet(userId: string, walletAddress: string): Promise<void> {
  const now = new Date().toISOString();
  
  // 1. Check Index: Is wallet used by another user?
  const indexKey = kvKeys.walletIndexV1(walletAddress);
  const existingIndex = await kv.get<WalletIndexV1>(indexKey);
  
  if (existingIndex && existingIndex.userId !== userId) {
    throw conflict(
      `Wallet ${walletAddress} is already registered by another user`, 
      ErrorCodes.PROFILE_WALLET_IN_USE
    );
  }
  
  // 2. Check current profile to handle wallet swap (remove old index)
  const profileKey = kvKeys.profileV1(userId);
  const currentProfile = await kv.get<ProfileV1>(profileKey);
  
  // If user had a DIFFERENT wallet before, remove its index
  if (currentProfile?.tradingWallet && currentProfile.tradingWallet !== walletAddress) {
    const oldIndexKey = kvKeys.walletIndexV1(currentProfile.tradingWallet);
    // Safety check: only delete if it still points to us
    const oldIndex = await kv.get<WalletIndexV1>(oldIndexKey);
    if (oldIndex && oldIndex.userId === userId) {
      await kv.delete(oldIndexKey);
    }
  }
  
  // 3. Upsert Profile
  const newProfile: ProfileV1 = {
    userId,
    tradingWallet: walletAddress,
    updatedAt: now,
  };
  await kv.set(profileKey, newProfile);
  
  // 4. Upsert Index
  const newIndex: WalletIndexV1 = {
    userId,
    updatedAt: now,
  };
  await kv.set(indexKey, newIndex);
}

export async function clearTradingWallet(userId: string): Promise<void> {
  const profileKey = kvKeys.profileV1(userId);
  const currentProfile = await kv.get<ProfileV1>(profileKey);
  
  if (!currentProfile?.tradingWallet) {
    return; // Nothing to clear
  }
  
  const walletAddress = currentProfile.tradingWallet;
  
  // 1. Remove Index
  const indexKey = kvKeys.walletIndexV1(walletAddress);
  const index = await kv.get<WalletIndexV1>(indexKey);
  
  // Only delete if it belongs to us (safety)
  if (index && index.userId === userId) {
    await kv.delete(indexKey);
  }
  
  // 2. Update Profile (remove wallet)
  const updatedProfile: ProfileV1 = {
    ...currentProfile,
    tradingWallet: undefined,
    updatedAt: new Date().toISOString(),
  };
  
  await kv.set(profileKey, updatedProfile);
}

export async function getUserIdByWallet(walletAddress: string): Promise<string | null> {
  const indexKey = kvKeys.walletIndexV1(walletAddress);
  const index = await kv.get<WalletIndexV1>(indexKey);
  return index ? index.userId : null;
}

