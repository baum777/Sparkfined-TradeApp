import { kv, kvKeys, kvTTL } from '../../kv';
import { getUserIdByWallet } from '../profile/repo';
import { journalCreateWithMeta, journalRepoKV } from '../journal/repo';
import { mergeOnchainContextMeta } from '../journal/onchain/merge';
import { enqueueEnrichJob } from '../journal/enrich';
import type { OnchainContextMetaV1 } from '../journal/onchain/types';
import type { TradeEventV1 } from './types';
import type { HeliusEnhancedTx } from './helius';
import { analyzeTrade } from './tradeIntelligence';
import { getEnv } from '../../env';
import { toApiJournalEntryV1 } from '../journal/mapper'; // for return type if needed
import { logger } from '../../logger';

// ─────────────────────────────────────────────────────────────
// PARSING / MAPPING HELPER
// ─────────────────────────────────────────────────────────────

function mapHeliusToTradeEvent(tx: HeliusEnhancedTx, walletAddress: string): TradeEventV1 {
  const isSwap = tx.type === 'SWAP';
  const timestampISO = new Date(tx.timestamp * 1000).toISOString();
  
  let tokenInMint: string | undefined;
  let tokenOutMint: string | undefined;
  let amountIn: string | undefined;
  let amountOut: string | undefined;

  // Heuristic for SWAP
  if (isSwap && tx.events?.swap) {
    const swap = tx.events.swap;
    // Simplification: take first input/output
    if (swap.tokenInputs && swap.tokenInputs.length > 0) {
      tokenInMint = swap.tokenInputs[0].mint;
      amountIn = swap.tokenInputs[0].rawTokenAmount.tokenAmount;
    } else if (swap.nativeInput) {
      tokenInMint = 'So11111111111111111111111111111111111111112'; // SOL
      amountIn = swap.nativeInput.amount;
    }

    if (swap.tokenOutputs && swap.tokenOutputs.length > 0) {
      tokenOutMint = swap.tokenOutputs[0].mint;
      amountOut = swap.tokenOutputs[0].rawTokenAmount.tokenAmount;
    } else if (swap.nativeOutput) {
      tokenOutMint = 'So11111111111111111111111111111111111111112'; // SOL
      amountOut = swap.nativeOutput.amount;
    }
  } 
  // Fallback: Check token transfers if specific type not SWAP but looks like transfer
  else if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
    // Determine direction relative to wallet
    for (const t of tx.tokenTransfers) {
      if (t.toUserAccount === walletAddress) {
        tokenOutMint = t.mint;
        amountOut = t.tokenAmount.toString();
      } else if (t.fromUserAccount === walletAddress) {
        tokenInMint = t.mint;
        amountIn = t.tokenAmount.toString();
      }
    }
  }

  return {
    id: `sig:${tx.signature}`,
    walletAddress,
    signature: tx.signature,
    blockTime: timestampISO,
    type: isSwap ? 'swap' : 'unknown', // we treat everything else as unknown/transfer
    tokenInMint,
    tokenOutMint,
    amountIn,
    amountOut,
    source: 'helius',
  };
}

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
  let processed = 0;
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
        
        // Map to Event
        const env = getEnv();
        const useIntelligence = env.AUTO_CAPTURE_INTELLIGENCE_ENABLED;

        let side: 'BUY' | 'SELL' = 'BUY'; // default
        let summary = `Auto-captured trade: `;
        let symbolOrAddress: string | undefined = undefined;
        let metaToAdd: Partial<OnchainContextMetaV1> | undefined;
        const timestamp = new Date(tx.timestamp * 1000).toISOString();

        if (useIntelligence) {
          const analysis = analyzeTrade(tx, walletAddress);
          side = analysis.side;
          summary = analysis.summary;
          symbolOrAddress = analysis.symbolOrAddress;
          
          metaToAdd = {
            capturedAt: analysis.meta.capture.parsedAt,
            errors: [], // Initial state
            capture: analysis.meta.capture,
            classification: analysis.meta.classification,
            display: analysis.meta.display,
          };
        } else {
          // Legacy Logic (Phase B)
          const event = mapHeliusToTradeEvent(tx, walletAddress);
          
          if (event.tokenOutMint) {
            side = 'BUY';
            symbolOrAddress = event.tokenOutMint;
            summary += `BUY ${event.tokenOutMint}`;
          } else if (event.tokenInMint) {
            side = 'SELL';
            symbolOrAddress = event.tokenInMint;
            summary += `SELL ${event.tokenInMint}`;
          } else {
            summary += `${tx.type} (sig=${tx.signature.slice(0, 8)}...)`;
          }
          
          // Add amounts if available
          if (event.amountIn && event.amountOut) {
            summary += ` (in=${event.amountIn} out=${event.amountOut})`;
          }
          
          summary += ` [sig=${tx.signature}]`;
        }
        
        // Create Journal Entry
        // Idempotency key: trade:<signature> (per user)
        const idempotencyKey = `trade:${tx.signature}`;
        
        const { event: createdEvent, isReplay } = await journalCreateWithMeta(userId, {
          side,
          summary,
          timestamp,
          symbolOrAddress,
        }, idempotencyKey);
        
        // Phase C: If intelligence enabled and new entry, attach meta
        if (useIntelligence && !isReplay && metaToAdd) {
          createdEvent.onchainContextMeta = mergeOnchainContextMeta(createdEvent.onchainContextMeta, metaToAdd);
          await journalRepoKV.putEvent(userId, createdEvent);
        }
        
        // Phase C: Enqueue for enrichment (non-blocking)
        if (useIntelligence && !isReplay && symbolOrAddress) {
          // Fire and forget - don't await to keep webhook fast? 
          // Ideally we await but catch errors so we don't fail the batch.
          // Since enqueue is just a KV push, it's fast.
          try {
            await enqueueEnrichJob({
              userId,
              entryId: createdEvent.id,
              symbolOrAddress,
              timestamp: createdEvent.createdAt,
            });
          } catch (e) {
            console.error('Failed to enqueue enrich job', { entryId: createdEvent.id, error: e });
            // Do not fail the ingest
          }
        }
        
        processed++;
        
        logger.info('Auto-captured trade', { 
          userId, 
          signature: tx.signature, 
          side,
          intelligence: useIntelligence,
          isReplay
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

