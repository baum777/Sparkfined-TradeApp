import { create } from 'zustand';
import type { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Transaction as LegacyTransaction, VersionedTransaction as V0Transaction } from '@solana/web3.js';
import type { AmountMode, FeeTier, TerminalPair, TerminalQuoteData, TxStatus, QuoteStatus, Side } from '../../../shared/trading/types';
import { FEE_TIERS } from '../../../shared/trading/fee/feeTiers';
import { quoteService } from '@/lib/trading/quote/quoteService';
import { swapService } from '@/lib/trading/swap/swapService';
import { confirmSignature, extractTxError, sendSignedTransaction, simulateSignedTransaction } from '@/lib/solana/tx';
import { isDev } from '@/lib/env';

type SignableTransaction = Transaction | VersionedTransaction;

type WalletLike = {
  publicKey: PublicKey | null;
  signTransaction: <T extends SignableTransaction>(tx: T) => Promise<T>;
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
  paramsKey?: string;
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
let scheduledSeq = 0;

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

function buildParamsKey(p: NonNullable<ReturnType<typeof requiredParams>>): string {
  return [
    p.baseMint,
    p.quoteMint,
    p.side,
    p.amountMode,
    p.amount,
    String(p.slippageBps),
    String(p.feeBps),
    p.priorityFeeEnabled ? 'pf1' : 'pf0',
    String(p.priorityFeeMicroLamports ?? 0),
  ].join('|');
}

function isQuoteStale(quote: TerminalQuoteState): boolean {
  const updatedAt = quote.updatedAt ?? 0;
  return !updatedAt || Date.now() - updatedAt > 25_000;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // Node/test fallback
  const nodeBuffer = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
  if (nodeBuffer) {
    return new Uint8Array(nodeBuffer.from(base64, 'base64'));
  }

  throw new Error('Base64 decoding not supported in this environment');
}

function decodeSwapTx(base64: string): SignableTransaction {
  const bytes = decodeBase64ToBytes(base64);
  // Prefer v0 deserialization (Jupiter default).
  try {
    return V0Transaction.deserialize(bytes);
  } catch {
    return LegacyTransaction.from(bytes);
  }
}

function isSimulationFailureError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith('Simulation fehlgeschlagen');
}

function getRecentBlockhashFromSignedTx(tx: SignableTransaction): string | undefined {
  if (tx instanceof V0Transaction) {
    return tx.message.recentBlockhash;
  }
  return tx.recentBlockhash;
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
    // Mark any in-flight response as obsolete even before the next fetch starts
    // (prevents older in-flight from "winning" if the user changes inputs quickly).
    scheduledSeq++;
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
    const paramsKey = buildParamsKey(params);
    if (isDev()) {
      console.debug('[Terminal] fetchQuote', params);
    }
    set({ quote: { status: 'loading', paramsKey } });

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

      set({ quote: { status: 'success', data, updatedAt: Date.now(), paramsKey } });
      return data;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (requestId !== quoteRequestSeq) return null;
      set({ quote: { status: 'error', error } });
      return null;
    }
  },

  executeSwap: async ({ wallet, connection }) => {
    // Snapshot inputs at the moment execute starts (prevents drift during signing/sending)
    const stateAtStart = get();
    const params = requiredParams(stateAtStart);
    if (!params) throw new Error('Ungültige Eingaben (Pair/Amount)');
    if (isDev()) {
      console.debug('[Terminal] executeSwap', params);
    }
    if (!wallet.publicKey) throw new Error('Wallet nicht verbunden');
    const paramsKey = buildParamsKey(params);
    const priorityFeeSnapshot = { ...stateAtStart.priorityFee };

    set({ tx: { status: 'signing' } });

    // Stale check: ensure fresh quote for the SNAPSHOT params (do not depend on live UI state)
    let quoteData: TerminalQuoteData | null = null;
    const currentQuote = get().quote;
    if (
      currentQuote.status === 'success' &&
      currentQuote.data &&
      currentQuote.paramsKey === paramsKey &&
      !isQuoteStale(currentQuote)
    ) {
      quoteData = currentQuote.data;
    } else {
      // Fetch directly for snapshot params; avoid overwriting store quote if UI has moved on.
      quoteData = await quoteService.getQuote({
        baseMint: params.baseMint,
        quoteMint: params.quoteMint,
        side: params.side,
        amount: params.amount,
        amountMode: params.amountMode,
        slippageBps: params.slippageBps,
        feeBps: params.feeBps,
        priorityFeeEnabled: params.priorityFeeEnabled,
        priorityFeeMicroLamports: params.priorityFeeMicroLamports,
      }).catch(() => null);
    }

    if (!quoteData) {
      const err = get().quote.error || 'Quote konnte nicht geladen werden';
      set({ tx: { status: 'failed', error: err } });
      throw new Error(err);
    }

    const providerQuote = quoteData?.provider?.quoteResponse;
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
        priorityFee: priorityFeeSnapshot,
        providerQuote,
      });

      const tx = decodeSwapTx(swapTx.swapTransactionBase64);

      // Optional simulation (best-effort) before asking user to sign again
      try {
        const sim = await simulateSignedTransaction(connection, tx);
        if (sim.err) {
          throw new Error(`Simulation fehlgeschlagen: ${JSON.stringify(sim.err)}\n${(sim.logs ?? []).slice(-10).join('\n')}`);
        }
      } catch (e: unknown) {
        // If it was our logic error above, rethrow it so the user sees it.
        if (isSimulationFailureError(e)) {
          throw e;
        }
        // Otherwise ignore underlying RPC errors (rate limits, simulation not supported)
        console.warn('Simulation skipped due to RPC error', e);
      }

      const signed = await wallet.signTransaction(tx);
      set({ tx: { status: 'sending' } });

      const { signature } = await sendSignedTransaction({ connection, signedTx: signed, maxRetries: 3 });

      await confirmSignature({
        connection,
        signature,
        commitment: 'confirmed',
        blockhash: getRecentBlockhashFromSignedTx(signed),
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

