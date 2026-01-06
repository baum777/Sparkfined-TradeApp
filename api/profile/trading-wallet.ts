import { createHandler } from '../_lib/handler';
import { sendJson, sendNoContent } from '../_lib/response';
import { validateBody, isValidSolanaAddress } from '../_lib/validation';
import { setTradingWallet, clearTradingWallet, getProfile } from '../_lib/domain/profile/repo';
import { updateHeliusWebhookSubscription } from '../_lib/domain/walletIngest/heliusWebhookManager';
import { z } from 'zod';

const updateWalletSchema = z.object({
  walletAddress: z.string().refine(isValidSolanaAddress, { message: 'Invalid Solana address' }),
});

export default createHandler({
  auth: 'required',
  
  PUT: async ({ req, res, userId }) => {
    const body = validateBody(updateWalletSchema, req.body);
    
    // 1. Update KV (Profile + Index)
    await setTradingWallet(userId, body.walletAddress);
    
    // 2. Sync Helius Webhook (Best effort or blocking? Plan implies side effect)
    // If this fails, we might want to revert? For Phase B, we accept partial failure state 
    // but the Helius Manager should throw to signal error to client.
    await updateHeliusWebhookSubscription(userId, 'add', body.walletAddress);
    
    sendJson(res, { tradingWallet: body.walletAddress });
  },
  
  DELETE: async ({ req: _req, res, userId }) => {
    // Get current wallet to remove from Helius
    const profile = await getProfile(userId);
    const walletToRemove = profile?.tradingWallet;
    
    // 1. Clear KV
    await clearTradingWallet(userId);
    
    // 2. Sync Helius (remove wallet)
    if (walletToRemove) {
      await updateHeliusWebhookSubscription(userId, 'remove', walletToRemove);
    }
    
    sendNoContent(res);
  }
});

