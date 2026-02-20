/**
 * Trading types for canonical backend
 * Mirrors shared/trading types to avoid rootDir constraints.
 */

export type Side = 'buy' | 'sell';
export type AmountMode = 'quote' | 'base';

export interface UiTokenAmount {
  mint: string;
  symbol?: string;
  decimals: number;
  amountBaseUnits: string;
  amountUi: string;
}

export interface TerminalQuoteData {
  expectedOut: UiTokenAmount;
  minOut: UiTokenAmount;
  feeBps: number;
  feeAmountEstimate: UiTokenAmount;
  meta?: { priceImpactPct?: number; routeLabel?: string };
  provider: {
    name: 'jupiter';
    quoteResponse: unknown;
    feeMechanism: 'jupiter-platform-fee' | 'unknown';
  };
}

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
  side: Side;
  amount: string;
  amountMode: AmountMode;
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
