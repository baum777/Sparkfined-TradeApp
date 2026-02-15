import { apiClient } from '@/services/api/client';
import type { TerminalQuoteData, TerminalQuoteParams } from '../../../../shared/trading/types';

export type GetQuoteParams = Pick<
  TerminalQuoteParams,
  | 'baseMint'
  | 'quoteMint'
  | 'side'
  | 'amount'
  | 'amountMode'
  | 'slippageBps'
  | 'feeBps'
  | 'priorityFeeEnabled'
  | 'priorityFeeMicroLamports'
>;

export const quoteService = {
  async getQuote(params: GetQuoteParams): Promise<TerminalQuoteData> {
    const sp = new URLSearchParams();
    sp.set('baseMint', params.baseMint);
    sp.set('quoteMint', params.quoteMint);
    sp.set('side', params.side);
    sp.set('amount', params.amount);
    sp.set('amountMode', params.amountMode);
    sp.set('slippageBps', String(params.slippageBps));
    sp.set('feeBps', String(params.feeBps));
    if (params.priorityFeeEnabled !== undefined) sp.set('priorityFeeEnabled', params.priorityFeeEnabled ? 'true' : 'false');
    if (params.priorityFeeMicroLamports !== undefined) sp.set('priorityFeeMicroLamports', String(params.priorityFeeMicroLamports));

    return apiClient.get<TerminalQuoteData>(`/quote?${sp.toString()}`);
  },
};

