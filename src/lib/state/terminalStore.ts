import { create } from 'zustand';
import type { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Transaction as LegacyTransaction, VersionedTransaction as V0Transaction } from '@solana/web3.js';
import type { AmountMode, FeeTier, TerminalPair, TerminalQuoteData, TxStatus, QuoteStatus, Side } from '../../../shared/trading/types';
import { FEE_TIERS } from '../../../shared/trading/fee/feeTiers';
import { quoteService } from '@/lib/trading/quote/quoteService';
import { swapService } from '@/lib/trading/swap/swapService';
import { confirmSignature, extractTxError, sendSignedTransaction, simulateSignedTransaction } from '@/lib/solana/tx';

type WalletLike = {
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
};

export interface TerminalAmountState {
  mode: AmountMode;
  value: string; // UI decimal string
}

export interface TerminalQuoteState {
  status: QuoteStatus;
  data?: TerminalQuoteData;
  error?: string;
  updatedAt?: number;
}

export interface TerminalTxState {
  status: TxStatus;
  signature?: string;
  error?: string;
}

export interface TerminalStoreState {
  // Inputs
  pair: TerminalPair | null;
  side: Side;
  amount: TerminalAmountState;
  slippageBps: number;
  priorityFee: { enabled: boolean; microLamports?: number };
  feeTier: FeeTier;

  // Outputs
  quote: TerminalQuoteState;
  tx: TerminalTxState;

  // Actions
  setPair: (pair: TerminalPair | null) => void;
  setSide: (side: Side) => void;
  setAmountValue: (value: string) => void;
  setSlippageBps: (slippageBps: number) => void;
  setPriorityFeeEnabled: (enabled: boolean) => void;
  setPriorityFeeMicroLamports: (microLamports?: number) => void;
  setFeeTier: (tier: FeeTier['tier']) => void;

  clearQuote: () => void;
  clearTx: () => void;

  fetchQuote: (opts?: { force?: boolean }) => Promise<TerminalQuoteData | null>;
  scheduleQuoteFetch: () => void;
  executeSwap: (opts: { wallet: WalletLike; connection: Connection }) => Promise<string>;
}

let quoteDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let quoteRequestSeq = 0;

function normalizeAmount(value: string): string {
  const v = value.trim();
  if (!v) return '';
  // Allow "0." while typing. Basic guard for non-numeric.
  if (!/^\d*\.?\d*$/.test(v)) return '';
  return v;
}

function requiredParams(state: TerminalStoreState): {
  baseMint: string;
  quoteMint: string;
  side: Side;
  amount: string;
  amountMode: AmountMode;
  slippageBps: number;
  feeBps: number;
  priorityFeeEnabled: boolean;
  priorityFeeMicroLamports?: number;
} | null {
  if (!state.pair) return null;
  const amount = state.amount.value.trim();
  if (!amount || Number(amount) <= 0) return null;

  // Enforce ExactIn mode per side (Phase 1 server contract)
  const amountMode: AmountMode = state.side === 'buy' ? 'quote' : 'base';

  return {
    baseMint: state.pair.baseMint,
    quoteMint: state.pair.quoteMint,
    side: state.side,
    amount,
    amountMode,
    slippageBps: state.slippageBps,
    feeBps: state.feeTier.feeBps,
    priorityFeeEnabled: state.priorityFee.enabled,
    priorityFeeMicroLamports: state.priorityFee.microLamports,
  };
}

function isQuoteStale(quote: TerminalQuoteState): boolean {
  const updatedAt = quote.updatedAt ?? 0;
  return !updatedAt || Date.now() - updatedAt > 25_000;
}

function decodeSwapTx(base64: string): Transaction | VersionedTransaction {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  // Prefer v0 deserialization (Jupiter default).
  try {
    return V0Transaction.deserialize(bytes);
  } catch {
    return LegacyTransaction.from(bytes);
  }
}

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  pair: null,
  side: 'buy',
  amount: { mode: 'quote', value: '' },
  slippageBps: 50,
  priorityFee: { enabled: false, microLamports: 5_000 },
  feeTier: FEE_TIERS.free,

  quote: { status: 'idle' },
  tx: { status: 'idle' },

  setPair: (pair) => {
    set({ pair });
    get().scheduleQuoteFetch();
  },

  setSide: (side) => {
    set((s) => ({
      side,
      amount: { ...s.amount, mode: side === 'buy' ? 'quote' : 'base' },
      quote: { status: 'idle' },
    }));
    get().scheduleQuoteFetch();
  },

  setAmountValue: (value) => {
    set((s) => ({ amount: { ...s.amount, value: normalizeAmount(value) } }));
    get().scheduleQuoteFetch();
  },

  setSlippageBps: (slippageBps) => {
    set({ slippageBps });
    get().scheduleQuoteFetch();
  },

  setPriorityFeeEnabled: (enabled) => {
    set((s) => ({ priorityFee: { ...s.priorityFee, enabled } }));
    get().scheduleQuoteFetch();
  },

  setPriorityFeeMicroLamports: (microLamports) => {
    set((s) => ({ priorityFee: { ...s.priorityFee, microLamports } }));
    get().scheduleQuoteFetch();
  },

  setFeeTier: (tier) => {
    set({ feeTier: FEE_TIERS[tier] });
    get().scheduleQuoteFetch();
  },

  clearQuote: () => set({ quote: { status: 'idle' } }),
  clearTx: () => set({ tx: { status: 'idle' } }),

  scheduleQuoteFetch: () => {
    if (quoteDebounceTimer) clearTimeout(quoteDebounceTimer);
    quoteDebounceTimer = setTimeout(() => {
      get().fetchQuote().catch(() => {
        // errors are stored in state
      });
    }, 400);
  },

  fetchQuote: async (opts) => {
    const state = get();
    const params = requiredParams(state);
    if (!params) {
      set({ quote: { status: 'idle' } });
      return null;
    }

    if (!opts?.force && state.quote.status === 'success' && !isQuoteStale(state.quote)) {
      return state.quote.data ?? null;
    }

    const requestId = ++quoteRequestSeq;
    set({ quote: { status: 'loading' } });

    try {
      const data = await quoteService.getQuote({
        baseMint: params.baseMint,
        quoteMint: params.quoteMint,
        side: params.side,
        amount: params.amount,
        amountMode: params.amountMode,
        slippageBps: params.slippageBps,
        feeBps: params.feeBps,
        priorityFeeEnabled: params.priorityFeeEnabled,
        priorityFeeMicroLamports: params.priorityFeeMicroLamports,
      });

      // Drop out-of-order responses
      if (requestId !== quoteRequestSeq) return data;

      set({ quote: { status: 'success', data, updatedAt: Date.now() } });
      return data;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (requestId !== quoteRequestSeq) return null;
      set({ quote: { status: 'error', error } });
      return null;
    }
  },

  executeSwap: async ({ wallet, connection }) => {
    const state = get();
    const params = requiredParams(state);
    if (!params) throw new Error('Ungültige Eingaben (Pair/Amount)');
    if (!wallet.publicKey) throw new Error('Wallet nicht verbunden');

    set({ tx: { status: 'signing' } });

    // Stale check: ensure fresh quote
    let quote = state.quote;
    if (quote.status !== 'success' || !quote.data || isQuoteStale(quote)) {
      const refreshed = await get().fetchQuote({ force: true });
      if (!refreshed) {
        const err = get().quote.error || 'Quote konnte nicht geladen werden';
        set({ tx: { status: 'failed', error: err } });
        throw new Error(err);
      }
      quote = get().quote;
    }

    const providerQuote = quote.data?.provider?.quoteResponse;
    if (!providerQuote) {
      const err = 'Interner Fehler: Quote fehlt (providerQuote)';
      set({ tx: { status: 'failed', error: err } });
      throw new Error(err);
    }

    try {
      const swapTx = await swapService.getSwapTx({
        publicKey: wallet.publicKey.toBase58(),
        baseMint: params.baseMint,
        quoteMint: params.quoteMint,
        side: params.side,
        amount: params.amount,
        amountMode: params.amountMode,
        slippageBps: params.slippageBps,
        feeBps: params.feeBps,
        priorityFee: state.priorityFee,
        providerQuote,
      });

      const tx = decodeSwapTx(swapTx.swapTransactionBase64);

      // Optional simulation (best-effort) before asking user to sign again
      try {
        const sim = await simulateSignedTransaction(connection, tx);
        if (sim.err) {
          throw new Error(`Simulation fehlgeschlagen: ${JSON.stringify(sim.err)}\n${(sim.logs ?? []).slice(-10).join('\n')}`);
        }
      } catch {
        // ignore simulation failures (RPC may not support / rate-limited)
      }

      const signed = await wallet.signTransaction(tx as any);
      set({ tx: { status: 'sending' } });

      const { signature } = await sendSignedTransaction({ connection, signedTx: signed, maxRetries: 3 });

      await confirmSignature({
        connection,
        signature,
        commitment: 'confirmed',
        blockhash: (signed as any).message?.recentBlockhash || (signed as any).recentBlockhash,
        lastValidBlockHeight: swapTx.lastValidBlockHeight,
      });

      set({ tx: { status: 'confirmed', signature } });
      return signature;
    } catch (e) {
      const msg = extractTxError(e);
      set({ tx: { status: 'failed', error: msg } });
      throw new Error(msg);
    }
  },
}));

