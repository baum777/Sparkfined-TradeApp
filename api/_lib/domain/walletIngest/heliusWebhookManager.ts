import { kv, kvKeys, kvTTL } from '../../kv';
import { getEnv } from '../../env';
import { getWebhookConfig, putWebhookConfig } from './heliusClient';
import { conflict, internalError } from '../../errors';
import { ErrorCodes } from '../../errors';

/**
 * Updates the global Helius webhook subscription by adding or removing a wallet.
 * Uses a KV lock to prevent race conditions during the GET-MODIFY-PUT cycle.
 */
export async function updateHeliusWebhookSubscription(
  userId: string, // purely for logging/audit context
  operation: 'add' | 'remove',
  walletAddress: string
): Promise<void> {
  const env = getEnv();
  
  // Skip if Helius is not configured (e.g. dev mode without secrets)
  // But strictly, if called, we expect it to work if configured. 
  // If keys missing, client throws.
  if (!env.HELIUS_API_KEY || !env.HELIUS_WEBHOOK_ID) {
    console.warn('Skipping Helius webhook update (missing keys)');
    return;
  }

  const lockKey = kvKeys.heliusWebhookLock();
  
  // 1. Acquire Lock
  // Simple spin-lock or fail-fast? Plan said "if count !== 1 then 409/skip".
  // Let's do fail-fast for now. If locked, user can retry.
  const lock = await kv.incr(lockKey, 1, kvTTL.heliusWebhookLock);
  
  if (lock !== 1) {
    throw conflict('System busy updating webhook subscription, please try again', ErrorCodes.HELIUS_WEBHOOK_UPDATE_FAILED);
  }

  try {
    // 2. GET current config
    const config = await getWebhookConfig();
    const currentAddresses = new Set(config.accountAddresses);
    
    let changed = false;
    
    if (operation === 'add') {
      if (!currentAddresses.has(walletAddress)) {
        currentAddresses.add(walletAddress);
        changed = true;
      }
    } else {
      if (currentAddresses.has(walletAddress)) {
        currentAddresses.delete(walletAddress);
        changed = true;
      }
    }
    
    // 3. PUT if changed
    if (changed) {
      // Helius limit check? (100k addresses allowed usually)
      await putWebhookConfig({
        ...config,
        accountAddresses: Array.from(currentAddresses),
      });
      console.log(`Helius webhook updated: ${operation} ${walletAddress}`);
    }
    
  } catch (error) {
    console.error('Failed to update Helius webhook', error);
    // Re-throw so the API returns error (partial failure state is acceptable but client should know)
    throw internalError('Failed to sync with Helius provider');
  } finally {
    // 4. Release Lock
    await kv.delete(lockKey);
  }
}

