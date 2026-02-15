import { getEnv } from '../../env';
import { badRequest, internalError } from '../../errors';
import type { SwapProvider, GetQuoteParams, QuoteResult, GetSwapTxParams, SwapTxResult } from '../../../../shared/trading/swap/SwapProvider';
import type { JupiterQuoteResponseLike } from '../../../../shared/trading/fee/feeQuote';

function assertBps(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 5000) {
    throw badRequest(`${name} must be between 0 and 5000 bps`);
  }
}

export const jupiterProvider: SwapProvider = {
  name: 'jupiter',

  async getQuote(params: GetQuoteParams): Promise<QuoteResult> {
    assertBps('slippageBps', params.slippageBps);
    assertBps('feeBps', params.feeBps);

    const baseUrl = getEnv().JUPITER_BASE_URL.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/quote`);
    url.searchParams.set('inputMint', params.inputMint);
    url.searchParams.set('outputMint', params.outputMint);
    url.searchParams.set('amount', params.amountBaseUnits);
    url.searchParams.set('slippageBps', String(params.slippageBps));
    url.searchParams.set('swapMode', 'ExactIn');
    url.searchParams.set('platformFeeBps', String(params.feeBps));

    const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw internalError(`Jupiter quote failed: HTTP ${res.status} ${text}`.trim());
    }

    const json = (await res.json()) as JupiterQuoteResponseLike;
    if (!json || typeof json !== 'object' || typeof (json as any).outAmount !== 'string') {
      throw internalError('Invalid Jupiter quote response');
    }

    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputToken: params.inputToken,
      outputToken: params.outputToken,
      providerQuote: json as unknown,
      preview: {
        expectedOutBaseUnits: json.outAmount,
        minOutBaseUnits: json.otherAmountThreshold,
        priceImpactPct:
          typeof json.priceImpactPct === 'string'
            ? Number(json.priceImpactPct)
            : typeof json.priceImpactPct === 'number'
              ? json.priceImpactPct
              : undefined,
        platformFeeAmountBaseUnits: json.platformFee?.amount,
      },
    };
  },

  async getSwapTx(params: GetSwapTxParams): Promise<SwapTxResult> {
    assertBps('slippageBps', params.slippageBps);
    assertBps('feeBps', params.feeBps);

    const baseUrl = getEnv().JUPITER_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/swap`;

    const quoteResponse = params.providerQuote;
    if (!quoteResponse) {
      throw badRequest('providerQuote is required for swap (Phase 1)');
    }

    const body: Record<string, unknown> = {
      quoteResponse,
      userPublicKey: params.publicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      asLegacyTransaction: false,
    };

    if (params.priorityFeeMicroLamports && params.priorityFeeMicroLamports > 0) {
      body.computeUnitPriceMicroLamports = params.priorityFeeMicroLamports;
    }

    const { JUPITER_PLATFORM_FEE_ACCOUNT } = getEnv();
    if (JUPITER_PLATFORM_FEE_ACCOUNT) {
      body.platformFeeAccount = JUPITER_PLATFORM_FEE_ACCOUNT;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw internalError(`Jupiter swap failed: HTTP ${res.status} ${text}`.trim());
    }

    const json = (await res.json()) as any;
    const swapTransactionBase64 = json?.swapTransaction;
    if (typeof swapTransactionBase64 !== 'string' || !swapTransactionBase64.length) {
      throw internalError('Invalid Jupiter swap response: missing swapTransaction');
    }

    return {
      swapTransactionBase64,
      lastValidBlockHeight: typeof json?.lastValidBlockHeight === 'number' ? json.lastValidBlockHeight : undefined,
      prioritizationFeeLamports:
        typeof json?.prioritizationFeeLamports === 'number' ? json.prioritizationFeeLamports : undefined,
    };
  },
};

