import type { TerminalQuoteParams } from '../types';

export interface TokenInfo {
  mint: string;
  symbol?: string;
  decimals: number;
}

export interface QuoteResult {
  inputMint: string;
  outputMint: string;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  /**
   * Provider-native quote (opaque to clients).
   * For Jupiter v6, this is the quote response JSON object.
   */
  providerQuote: unknown;
  /**
   * UI preview data derived from the quote.
   */
  preview: {
    expectedOutBaseUnits: string;
    minOutBaseUnits: string;
    priceImpactPct?: number;
    platformFeeAmountBaseUnits?: string;
  };
}

export interface SwapTxResult {
  swapTransactionBase64: string;
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
}

export interface GetQuoteParams extends TerminalQuoteParams {
  inputMint: string;
  outputMint: string;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  amountBaseUnits: string;
}

export interface GetSwapTxParams extends GetQuoteParams {
  publicKey: string;
  providerQuote?: unknown;
  priorityFeeMicroLamports?: number;
}

export interface SwapProvider {
  readonly name: 'jupiter';
  getQuote(params: GetQuoteParams): Promise<QuoteResult>;
  getSwapTx(params: GetSwapTxParams): Promise<SwapTxResult>;
}

