/**
 * GET /api/quote
 * Terminal Phase 1 Quote (Market, Jupiter v6)
 */

import { z } from 'zod';
import { createHandler } from './_lib/handler';
import { sendJson, setCacheHeaders } from './_lib/response';
import { validateQuery, isValidSolanaAddress } from './_lib/validation';
import { badRequest } from './_lib/errors';
import { getTokenInfo } from './_lib/trading/tokenRegistry';
import { parseUiAmountToBaseUnits } from '../shared/trading/fee/feeEngine';
import { feeQuoteFromJupiter } from '../shared/trading/fee/feeQuote';
import type { Side, AmountMode, TerminalQuoteData } from '../shared/trading/types';
import { jupiterProvider } from './_lib/trading/swap/jupiterProvider';

const quoteQuerySchema = z.object({
  baseMint: z.string().min(32),
  quoteMint: z.string().min(32),
  side: z.enum(['buy', 'sell']),
  amount: z.string().min(1),
  amountMode: z.enum(['quote', 'base']),
  slippageBps: z.coerce.number().int().min(0).max(5000).default(50),
  feeBps: z.coerce.number().int().min(0).max(5000).default(65),
  priorityFeeEnabled: z.string().optional(),
  priorityFeeMicroLamports: z.coerce.number().int().min(0).max(500_000).optional(),
});

function resolveMints(params: { baseMint: string; quoteMint: string; side: Side; amountMode: AmountMode }) {
  const { baseMint, quoteMint, side, amountMode } = params;
  if (side === 'buy') {
    if (amountMode !== 'quote') throw badRequest('For buy, amountMode must be "quote" (ExactIn)');
    return { inputMint: quoteMint, outputMint: baseMint };
  }
  if (amountMode !== 'base') throw badRequest('For sell, amountMode must be "base" (ExactIn)');
  return { inputMint: baseMint, outputMint: quoteMint };
}

export default createHandler({
  auth: 'none',
  GET: async ({ req, res }) => {
    setCacheHeaders(res, { noStore: true });

    const q = validateQuery(quoteQuerySchema, req.query);
    const { baseMint, quoteMint, side, amount, amountMode } = q;
    const slippageBps = q.slippageBps ?? 50;
    const feeBps = q.feeBps ?? 0;

    if (!isValidSolanaAddress(baseMint)) throw badRequest('Invalid baseMint');
    if (!isValidSolanaAddress(quoteMint)) throw badRequest('Invalid quoteMint');

    const { inputMint, outputMint } = resolveMints({ baseMint, quoteMint, side, amountMode });

    const inputToken = await getTokenInfo(inputMint);
    const outputToken = await getTokenInfo(outputMint);

    const amountBaseUnits = parseUiAmountToBaseUnits(amount, inputToken.decimals);
    if (amountBaseUnits <= 0n) throw badRequest('Amount must be > 0');

    const quoteResult = await jupiterProvider.getQuote({
      baseMint,
      quoteMint,
      side,
      amount,
      amountMode,
      slippageBps,
      feeBps,
      priorityFeeEnabled: q.priorityFeeEnabled === 'true',
      priorityFeeMicroLamports: q.priorityFeeMicroLamports,
      inputMint,
      outputMint,
      inputToken: { mint: inputToken.address, symbol: inputToken.symbol, decimals: inputToken.decimals },
      outputToken: { mint: outputToken.address, symbol: outputToken.symbol, decimals: outputToken.decimals },
      amountBaseUnits: amountBaseUnits.toString(),
    });

    const preview = feeQuoteFromJupiter({
      feeBps,
      outputMint,
      outputSymbol: outputToken.symbol,
      outputDecimals: outputToken.decimals,
      quote: quoteResult.providerQuote as any,
    });

    const response: TerminalQuoteData = {
      ...preview,
      provider: {
        name: 'jupiter',
        quoteResponse: quoteResult.providerQuote,
        feeMechanism: preview.provider.feeMechanism,
      },
    };

    sendJson(res, response);
  },
});

