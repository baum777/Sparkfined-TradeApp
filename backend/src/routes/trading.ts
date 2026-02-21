/**
 * Trading routes: quote, swap, discover/tokens
 * Canonical backend implementation (Phase 1)
 */

import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { requireAuth } from '../http/auth.js';
import { rateLimiters } from '../http/rateLimit.js';
import { getEnv } from '../config/env.js';
import { validateQuery, validateBody } from '../validation/validate.js';
import {
  quoteQuerySchema,
  swapBodySchema,
  discoverTokensQuerySchema,
  isValidSolanaAddress,
} from '../lib/trading/terminalSchemas.js';
import { badRequest } from '../http/error.js';
import { getTokenInfo } from '../lib/trading/tokenRegistry.js';
import { parseUiAmountToBaseUnits } from '../lib/trading/feeEngine.js';
import { feeQuoteFromJupiter } from '../lib/trading/feeQuote.js';
import type { JupiterQuoteResponseLike } from '../lib/trading/jupiterTypes.js';
import { jupiterProvider } from '../lib/trading/jupiterProvider.js';
import { getDiscoverTokensCached } from '../lib/discover/discoverService.js';

type Side = 'buy' | 'sell';
type AmountMode = 'quote' | 'base';

function resolveMints(params: {
  baseMint: string;
  quoteMint: string;
  side: Side;
  amountMode: AmountMode;
}): { inputMint: string; outputMint: string } {
  const { baseMint, quoteMint, side, amountMode } = params;
  if (side === 'buy') {
    if (amountMode !== 'quote') throw badRequest('For buy, amountMode must be "quote" (ExactIn)');
    return { inputMint: quoteMint, outputMint: baseMint };
  }
  if (amountMode !== 'base') throw badRequest('For sell, amountMode must be "base" (ExactIn)');
  return { inputMint: baseMint, outputMint: quoteMint };
}

function getRequesterIdentifier(req: ParsedRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (raw && typeof raw === 'string') {
    const ip = raw.split(',')[0]?.trim();
    if (ip) return ip;
  }
  return req.userId;
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

  const response = {
    ...preview,
    provider: {
      name: 'jupiter' as const,
      quoteResponse: quoteResult.providerQuote,
      feeMechanism: preview.provider.feeMechanism,
    },
  };

  sendJson(res, response);
}

export async function handleSwap(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const env = getEnv();
  if (env.TERMINAL_SWAP_REQUIRE_AUTH) {
    requireAuth(req);
  }

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
}

const DISCOVER_CACHE_TTL_MS = 45_000;

export async function handleDiscoverTokens(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const requester = getRequesterIdentifier(req);
  rateLimiters.discover('/discover/tokens', requester);

  setCacheHeaders(res, { public: true, maxAge: Math.floor(DISCOVER_CACHE_TTL_MS / 1000) });

  const query = validateQuery(discoverTokensQuerySchema, req.query);
  const allTokens = await getDiscoverTokensCached();
  const start = query.cursor ?? 0;
  const end = query.limit ? Math.min(start + query.limit, allTokens.length) : allTokens.length;
  const page = allTokens.slice(start, end);

  if (query.limit && end < allTokens.length) {
    res.setHeader('x-next-cursor', String(end));
  }

  sendJson(res, page);
}
