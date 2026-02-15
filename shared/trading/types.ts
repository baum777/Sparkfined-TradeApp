export type Side = 'buy' | 'sell';
export type AmountMode = 'quote' | 'base';

export type FeeTierId = 'free' | 'soft' | 'hardI' | 'hardII' | 'genesis';

export interface FeeTier {
  tier: FeeTierId;
  feeBps: number;
}

export interface TerminalPair {
  baseMint: string;
  quoteMint: string;
  baseSymbol?: string;
  quoteSymbol?: string;
}

export interface PriorityFeeConfig {
  enabled: boolean;
  microLamports?: number;
}

export interface UiTokenAmount {
  mint: string;
  symbol?: string;
  decimals: number;
  amountBaseUnits: string; // integer string
  amountUi: string; // formatted decimal string
}

export interface TerminalQuoteParams {
  baseMint: string;
  quoteMint: string;
  side: Side;
  amount: string; // UI decimal string
  amountMode: AmountMode;
  slippageBps: number;
  feeBps: number;
  priorityFeeEnabled?: boolean;
  priorityFeeMicroLamports?: number;
}

export interface TerminalQuoteMeta {
  priceImpactPct?: number;
  routeLabel?: string;
}

export interface TerminalQuoteData {
  expectedOut: UiTokenAmount;
  minOut: UiTokenAmount;
  feeBps: number;
  feeAmountEstimate: UiTokenAmount;
  meta?: TerminalQuoteMeta;
  /**
   * Provider-specific quote object required to build the swap transaction.
   * For Phase 1 this is the Jupiter v6 quote response.
   */
  provider: {
    name: 'jupiter';
    quoteResponse: unknown;
    feeMechanism: 'jupiter-platform-fee' | 'unknown';
  };
}

export type QuoteStatus = 'idle' | 'loading' | 'success' | 'error';
export type TxStatus = 'idle' | 'signing' | 'sending' | 'confirmed' | 'failed';

