/**
 * Canonical Trading Routes: GET /api/quote, POST /api/swap
 * Production-ready handlers for Terminal Phase 1 (Jupiter v6)
 */

import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { badRequest, invalidQuery } from '../http/error.js';
import { jupiterProvider } from '../lib/trading/jupiterProvider.js';
import { getTokenInfo } from '../lib/trading/tokenRegistry.js';
import { parseUiAmountToBaseUnits, feeQuoteFromJupiter, type JupiterQuoteResponseLike } from '../lib/trading/feeHelpers.js';
import type { Side, AmountMode, TerminalQuoteData } from '../lib/trading/types.js';
import { z } from 'zod';

const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(value: string): boolean {
  return solanaAddressRegex.test(value);
}

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

function validateQuery<T>(schema: z.ZodSchema<T>, query: Record<string, string | string[] | undefined>): T {
  const flattened: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    flattened[key] = Array.isArray(value) ? value[0] : value;
  }
  const result = schema.safeParse(flattened);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw invalidQuery(messages);
  }
  return result.data;
}

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw badRequest(messages);
  }
  return result.data;
}

export async function handleQuote(req: ParsedRequest, res: ServerResponse): Promise<void> {
  setCacheHeaders(res, { noStore: true });

  const q = validateQuery(quoteQuerySchema, req.query);
  const { baseMint, quoteMint, side, amount, amountMode } = q;
  const slippageBps = q.slippageBps ?? 50;
  const feeBps = q.feeBps ?? 65;

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
    quote: quoteResult.providerQuote as JupiterQuoteResponseLike,
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
}

export async function handleSwap(req: ParsedRequest, res: ServerResponse): Promise<void> {
  setCacheHeaders(res, { noStore: true });

  const body = validateBody(swapBodySchema, req.body ?? {});
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
}
