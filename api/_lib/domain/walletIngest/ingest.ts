import { kv, kvKeys, kvTTL } from '../../kv';
import { getUserIdByWallet } from '../profile/repo';
import type { HeliusEnhancedTx } from './helius';
import { logger } from '../../logger';

// ─────────────────────────────────────────────────────────────
// INGESTION LOGIC
// ─────────────────────────────────────────────────────────────

export interface IngestResult {
  processed: number;
  skipped: number;
}

export async function ingestHeliusWebhook(
  payload: HeliusEnhancedTx[]
): Promise<IngestResult> {
  const processed = 0;
  let skipped = 0;

  for (const tx of payload) {
    try {
      // 1. Identify which wallet this is for
      // The payload contains 'accountData' which lists all accounts. 
      // Helius sends this webhook because ONE of the accounts matched our address list.
      // We need to find WHICH one(s).
      // Optimization: We don't have the address list in memory. We must check which accounts in TX are in our system.
      // This is expensive if we iterate all accounts.
      // Better: Iterate known accounts in TX?
      // Actually, Helius Enhanced Tx doesn't explicitly say "this triggered because of wallet X".
      // But we can check `nativeTransfers` or `tokenTransfers` user accounts, or `accountData`.
      
      // Strategy: Extract all unique relevant addresses from TX and check `getUserIdByWallet`?
      // That's too many KV reads (one per account in tx).
      // Helius usually sends the webhook for the specific address we subscribed.
      // If we use "Enhanced Transactions", it includes `accountData`.
      
      // Simpler approach for Phase B:
      // We assume the registered trading wallets are the "main" signers or transfer participants.
      // Let's check `feePayer` (if available) or `tokenTransfers` participants.
      // Wait, we don't want to scan 20 addresses per TX against KV.
      
      // BUT: We subscribed to a specific list. 
      // Helius doesn't tell us *which* subscription matched in the payload usually?
      // Actually, `accountData` usually lists accounts.
      
      // Let's collect "candidate" addresses from the TX that "look like" they might be the user.
      // - tokenTransfers.from/to
      // - nativeTransfers.from/to
      // - feePayer (not in simplified schema, but usually first account)
      
      const candidates = new Set<string>();
      tx.tokenTransfers?.forEach(t => {
        if (t.fromUserAccount) candidates.add(t.fromUserAccount);
        if (t.toUserAccount) candidates.add(t.toUserAccount);
      });
      tx.nativeTransfers?.forEach(t => {
        if (t.fromUserAccount) candidates.add(t.fromUserAccount);
        if (t.toUserAccount) candidates.add(t.toUserAccount);
      });
      
      // If no transfers, check accountData?
      if (candidates.size === 0 && tx.accountData) {
        tx.accountData.forEach(a => candidates.add(a.account));
      }

      // 2. Resolve User(s)
      // We might have multiple users involved? Unlikely for personal trading wallet, but possible.
      // We process for EACH found user.
      
      const foundUsers = new Map<string, string>(); // wallet -> userId
      
      // Parallel lookup?
      await Promise.all(Array.from(candidates).map(async (addr) => {
        const userId = await getUserIdByWallet(addr);
        if (userId) {
          foundUsers.set(addr, userId);
        }
      }));
      
      if (foundUsers.size === 0) {
        skipped++;
        continue;
      }
      
      // 3. Process for each found user
      for (const [walletAddress, userId] of foundUsers.entries()) {
        const dedupeKey = kvKeys.walletSigDedupe(walletAddress, tx.signature);
        
        // Atomically increment dedupe counter
        // kv.incr returns the new value. If 1, it's new. > 1, it's seen.
        const count = await kv.incr(dedupeKey, 1, kvTTL.walletSigDedupe);
        
        if (count > 1) {
          skipped++;
          continue;
        }

        // Journal v1 is Diary/Reflection only.
        // Trading auto-capture MUST NOT create /api/journal entries.
        skipped++;
        logger.info('Trade ingest received (Journal v1 capture disabled)', {
          userId,
          walletAddress,
          signature: tx.signature,
        });
      }

    } catch (err) {
      console.error('Failed to ingest transaction', { signature: tx.signature, error: err });
      // We don't throw here to avoid failing the whole batch? 
      // Or should we? Helius might retry the whole batch.
      // Safe to log and continue for other TXs in batch.
      skipped++;
    }
  }

  return { processed, skipped };
}

