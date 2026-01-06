import type { HeliusEnhancedTx } from './helius';
import type { OnchainContextMetaV1 } from '../journal/onchain/types';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const MINTS = {
  wSOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

// Set of known quotes for base/quote determination
const QUOTE_MINTS = new Set([MINTS.wSOL, MINTS.USDC, MINTS.USDT]);

export interface TradeAnalysis {
  side: 'BUY' | 'SELL';
  summary: string;
  symbolOrAddress?: string; // The "Asset of Interest" (Base)
  meta: Required<Pick<OnchainContextMetaV1, 'capture' | 'classification' | 'display'>>;
}

// ─────────────────────────────────────────────────────────────
// CORE LOGIC
// ─────────────────────────────────────────────────────────────

export function analyzeTrade(tx: HeliusEnhancedTx, walletAddress: string): TradeAnalysis {
  const isSwap = tx.type === 'SWAP' && !!tx.events?.swap;
  const timestampISO = new Date(tx.timestamp * 1000).toISOString();
  
  // 1. Extract Raw Mints
  let tokenInMint: string | undefined;
  let tokenOutMint: string | undefined;
  
  if (isSwap && tx.events?.swap) {
    const swap = tx.events.swap;
    // Swap inputs/outputs logic
    if (swap.tokenInputs && swap.tokenInputs.length > 0) {
      tokenInMint = swap.tokenInputs[0].mint;
    } else if (swap.nativeInput) {
      tokenInMint = MINTS.wSOL;
    }

    if (swap.tokenOutputs && swap.tokenOutputs.length > 0) {
      tokenOutMint = swap.tokenOutputs[0].mint;
    } else if (swap.nativeOutput) {
      tokenOutMint = MINTS.wSOL;
    }
  } else {
    // Transfer logic
    // We try to determine "In" vs "Out" relative to wallet
    if (tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        if (t.toUserAccount === walletAddress) {
          tokenOutMint = t.mint; // Incoming
        } else if (t.fromUserAccount === walletAddress) {
          tokenInMint = t.mint; // Outgoing
        }
      }
    }
    if (tx.nativeTransfers) {
      for (const t of tx.nativeTransfers) {
        if (t.toUserAccount === walletAddress) {
          if (!tokenOutMint) tokenOutMint = MINTS.wSOL;
        } else if (t.fromUserAccount === walletAddress) {
          if (!tokenInMint) tokenInMint = MINTS.wSOL;
        }
      }
    }
  }

  // 2. Determine Base/Quote & Side
  let baseMint: string | undefined;
  let quoteMint: string | undefined;
  let side: 'BUY' | 'SELL' = 'BUY'; // Default
  let sideConfidence = 0.0;
  let assetConfidence = 0.0;
  const reasonCodes: string[] = [];

  // Logic:
  // If Swap:
  //   Check if one is Quote.
  //   If In=Quote, Out=Base => BUY
  //   If In=Base, Out=Quote => SELL
  // If Transfer:
  //   If In known => BUY (Transfer In), Base=In
  //   If Out known => SELL (Transfer Out), Base=Out
  
  if (tokenInMint && tokenOutMint) {
    // Both sides known (Swap-like)
    const inIsQuote = QUOTE_MINTS.has(tokenInMint);
    const outIsQuote = QUOTE_MINTS.has(tokenOutMint);

    if (inIsQuote && !outIsQuote) {
      // Quote -> Base => BUY
      baseMint = tokenOutMint;
      quoteMint = tokenInMint;
      side = 'BUY';
      sideConfidence = 0.95;
      assetConfidence = 0.95;
      reasonCodes.push('QUOTE_IN_BASE_OUT');
    } else if (!inIsQuote && outIsQuote) {
      // Base -> Quote => SELL
      baseMint = tokenInMint;
      quoteMint = tokenOutMint;
      side = 'SELL';
      sideConfidence = 0.95;
      assetConfidence = 0.95;
      reasonCodes.push('BASE_IN_QUOTE_OUT');
    } else if (inIsQuote && outIsQuote) {
      // Quote -> Quote (Stable swap?)
      baseMint = tokenOutMint; // Treat out as "base" arbitrarily
      quoteMint = tokenInMint;
      side = 'BUY'; // Effectively swapping one stable for another
      sideConfidence = 0.5;
      assetConfidence = 0.8;
      reasonCodes.push('QUOTE_TO_QUOTE');
    } else {
      // Base -> Base (or unknown quotes)
      // Fallback: Treat Out as Base (Buying new asset with old asset)
      baseMint = tokenOutMint;
      quoteMint = tokenInMint; // Treat input as "quote" (spending it)
      side = 'BUY';
      sideConfidence = 0.4;
      assetConfidence = 0.4;
      reasonCodes.push('NO_QUOTE_MATCH');
    }
  } else if (tokenOutMint) {
    // Only Incoming (Transfer In or Deposit)
    baseMint = tokenOutMint;
    side = 'BUY'; // Receiving asset
    sideConfidence = 0.8;
    assetConfidence = 0.9;
    reasonCodes.push('TRANSFER_IN');
  } else if (tokenInMint) {
    // Only Outgoing (Transfer Out or Withdrawal)
    baseMint = tokenInMint;
    side = 'SELL'; // Sending asset
    sideConfidence = 0.8;
    assetConfidence = 0.9;
    reasonCodes.push('TRANSFER_OUT');
  } else {
    // No mints found
    sideConfidence = 0.0;
    reasonCodes.push('DECODE_MISSING');
  }

  // 3. Generate Summary
  const type = isSwap ? 'swap' : (tx.type === 'TRANSFER' || tx.type === 'UNKNOWN' ? 'transfer' : 'unknown');
  const summary = generateSummary(type, side, baseMint, quoteMint, tx.source);

  // 4. Construct Meta
  const meta: TradeAnalysis['meta'] = {
    capture: {
      source: tx.source || 'helius',
      type: type as any,
      signature: tx.signature,
      // We don't store full wallet address in meta by default to keep it clean, 
      // but plan said "wallet: string (optional)". Let's skip it or use redacted.
      parsedAt: timestampISO,
    },
    classification: {
      sideConfidence,
      assetConfidence,
      reasonCodes,
    },
    display: {
      baseMint,
      quoteMint,
      // symbols not resolved here (deterministic only)
    }
  };

  return {
    side,
    summary,
    symbolOrAddress: baseMint,
    meta,
  };
}

// ─────────────────────────────────────────────────────────────
// HELPER: Summary Generation
// ─────────────────────────────────────────────────────────────

function generateSummary(
  type: string,
  side: 'BUY' | 'SELL',
  baseMint: string | undefined,
  quoteMint: string | undefined,
  source: string = 'helius'
): string {
  const baseShort = baseMint ? shortenMint(baseMint) : '???';
  const quoteShort = quoteMint ? shortenMint(quoteMint) : '???';
  const src = source === 'helius' ? 'Auto' : source;

  if (type === 'swap') {
    if (side === 'BUY') {
      return `Auto-captured: BUY ${baseShort} with ${quoteShort} (${src})`;
    } else {
      return `Auto-captured: SELL ${baseShort} for ${quoteShort} (${src})`;
    }
  }
  
  if (type === 'transfer') {
    const direction = side === 'BUY' ? 'IN' : 'OUT';
    return `Auto-captured: TRANSFER ${baseShort} (${direction}) (${src})`;
  }

  return `Auto-captured: On-chain activity detected (${src})`;
}

function shortenMint(mint: string): string {
  // Map known mints to symbols for readability
  if (mint === MINTS.wSOL) return 'SOL';
  if (mint === MINTS.USDC) return 'USDC';
  if (mint === MINTS.USDT) return 'USDT';
  
  // Otherwise shorthand
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

