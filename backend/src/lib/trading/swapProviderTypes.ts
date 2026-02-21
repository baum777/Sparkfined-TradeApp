/**
 * Swap provider types (backend-local mirror of shared/trading/swap/SwapProvider)
 * Keeps backend self-contained for runtime (shared is not a compiled package).
 */

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
  providerQuote: unknown;
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

export interface GetQuoteParams {
  baseMint: string;
  quoteMint: string;
  side: 'buy' | 'sell';
  amount: string;
  amountMode: 'quote' | 'base';
  slippageBps: number;
  feeBps: number;
  priorityFeeEnabled?: boolean;
  priorityFeeMicroLamports?: number;
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
