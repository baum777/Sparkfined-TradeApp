/**
 * POST /api/swap
 * Terminal Phase 1 Swap Tx builder (Market, Jupiter v6)
 */

import { z } from 'zod';
import { createHandler } from './_lib/handler';
import { sendJson, setCacheHeaders } from './_lib/response';
import { validateBody, isValidSolanaAddress } from './_lib/validation';
import { badRequest } from './_lib/errors';
import { getTokenInfo } from './_lib/trading/tokenRegistry';
import { parseUiAmountToBaseUnits } from '../shared/trading/fee/feeEngine';
import type { Side, AmountMode } from '../shared/trading/types';
import { jupiterProvider } from './_lib/trading/swap/jupiterProvider';

const swapBodySchema = z.object({
  publicKey: z.string().min(32),
  baseMint: z.string().min(32),
  quoteMint: z.string().min(32),
  side: z.enum(['buy', 'sell']),
  amount: z.string().min(1),
  amountMode: z.enum(['quote', 'base']),
  slippageBps: z.number().int().min(0).max(5000),
  feeBps: z.number().int().min(0).max(5000),
  priorityFee: z
    .object({
      enabled: z.boolean(),
      microLamports: z.number().int().min(0).max(500_000).optional(),
    })
    .optional(),
  providerQuote: z.unknown().optional(),
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
  POST: async ({ req, res }) => {
    setCacheHeaders(res, { noStore: true });

    const body = validateBody(swapBodySchema, req.body);
    const { publicKey, baseMint, quoteMint, side, amount, amountMode, slippageBps, feeBps, providerQuote } = body;

    if (!isValidSolanaAddress(publicKey)) throw badRequest('Invalid publicKey');
    if (!isValidSolanaAddress(baseMint)) throw badRequest('Invalid baseMint');
    if (!isValidSolanaAddress(quoteMint)) throw badRequest('Invalid quoteMint');

    const { inputMint, outputMint } = resolveMints({ baseMint, quoteMint, side, amountMode });
    const inputToken = await getTokenInfo(inputMint);
    const outputToken = await getTokenInfo(outputMint);

    const amountBaseUnits = parseUiAmountToBaseUnits(amount, inputToken.decimals);
    if (amountBaseUnits <= 0n) throw badRequest('Amount must be > 0');

    const microLamports =
      body.priorityFee?.enabled === true ? (body.priorityFee.microLamports ?? 5_000) : undefined;

    const swap = await jupiterProvider.getSwapTx({
      baseMint,
      quoteMint,
      side,
      amount,
      amountMode,
      slippageBps,
      feeBps,
      priorityFeeEnabled: body.priorityFee?.enabled,
      priorityFeeMicroLamports: microLamports,
      inputMint,
      outputMint,
      inputToken: { mint: inputToken.address, symbol: inputToken.symbol, decimals: inputToken.decimals },
      outputToken: { mint: outputToken.address, symbol: outputToken.symbol, decimals: outputToken.decimals },
      amountBaseUnits: amountBaseUnits.toString(),
      publicKey,
      providerQuote,
    });

    sendJson(res, swap);
  },
});

