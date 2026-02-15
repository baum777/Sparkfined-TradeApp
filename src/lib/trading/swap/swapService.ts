import { apiClient } from '@/services/api/client';
import type { AmountMode, Side, PriorityFeeConfig } from '../../../../shared/trading/types';

export interface GetSwapTxParams {
  publicKey: string;
  baseMint: string;
  quoteMint: string;
  side: Side;
  amount: string;
  amountMode: AmountMode;
  slippageBps: number;
  feeBps: number;
  priorityFee?: PriorityFeeConfig;
  providerQuote?: unknown;
}

export interface SwapTxResponse {
  swapTransactionBase64: string;
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
}

export const swapService = {
  async getSwapTx(params: GetSwapTxParams): Promise<SwapTxResponse> {
    return apiClient.post<SwapTxResponse>(`/swap`, {
      publicKey: params.publicKey,
      baseMint: params.baseMint,
      quoteMint: params.quoteMint,
      side: params.side,
      amount: params.amount,
      amountMode: params.amountMode,
      slippageBps: params.slippageBps,
      feeBps: params.feeBps,
      priorityFee: params.priorityFee,
      providerQuote: params.providerQuote,
    });
  },
};

