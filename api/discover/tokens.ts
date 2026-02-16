import { z } from 'zod';
import { createHandler, suppressDefaultRequestLog } from '../_lib/handler';
import { sendJson, setCacheHeaders } from '../_lib/response';
import { validateQuery } from '../_lib/validation';
import { checkRateLimit } from '../_lib/rate-limit';
import { getEnv } from '../_lib/env';
import { logger } from '../_lib/logger';
import type { DiscoverToken } from '../_lib/discover/types';

const DISCOVER_CACHE_TTL_MS = 45_000;
const DISCOVER_MAX_TOKENS = 600;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(DISCOVER_MAX_TOKENS).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
});

type DiscoverCache = {
  expiresAt: number;
  tokens: DiscoverToken[];
};

let discoverCache: DiscoverCache | null = null;

type JupiterTokenLite = {
  address: string;
  symbol: string;
  name: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number): number {
  const p = Math.pow(10, decimals);
  return Math.round(value * p) / p;
}

function seededUnit(base: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Normalize uint32 to 0..1
  return (hash >>> 0) / 4294967295;
}

function seededBetween(base: string, salt: number, min: number, max: number): number {
  return min + seededUnit(base, salt) * (max - min);
}

function maybeNullNumber(base: string, salt: number, min: number, max: number, nullRate = 0.25): number | null {
  if (seededUnit(base, salt) < nullRate) return null;
  return roundTo(seededBetween(base, salt + 1, min, max), 2);
}

function maybeNullBoolean(base: string, salt: number, nullRate = 0.2): boolean | null {
  const unit = seededUnit(base, salt);
  if (unit < nullRate) return null;
  return unit > (nullRate + (1 - nullRate) * 0.5);
}

function pickShieldLevel(base: string, salt: number): DiscoverToken['safety']['jupiter_shield_level'] {
  const unit = seededUnit(base, salt);
  if (unit < 0.08) return 'critical';
  if (unit < 0.22) return 'high';
  if (unit < 0.42) return 'medium';
  if (unit < 0.62) return 'low';
  if (unit < 0.9) return 'none';
  return null;
}

function createFallbackMint(index: number): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = '';
  for (let i = 0; i < 44; i++) {
    const unit = seededUnit(`fallback-${index}`, i + 1);
    const charIndex = Math.floor(unit * alphabet.length) % alphabet.length;
    value += alphabet[charIndex];
  }
  return value;
}

function buildToken(base: JupiterTokenLite, index: number): DiscoverToken {
  const seedKey = `${base.address}:${index}`;
  const liqSol = roundTo(seededBetween(seedKey, 10, 15, 1_200), 2);
  const liqUsd = roundTo(liqSol * seededBetween(seedKey, 11, 95, 260), 2);
  const txPerMin = roundTo(seededBetween(seedKey, 12, 0.4, 45), 2);
  const buys5m = Math.floor(seededBetween(seedKey, 13, 0, 360));
  const sells5m = Math.floor(seededBetween(seedKey, 14, 0, 320));
  const volume5m = roundTo(seededBetween(seedKey, 15, 300, 350_000), 2);
  const volume15m = roundTo(volume5m * seededBetween(seedKey, 16, 1.4, 5), 2);
  const volume60m = roundTo(volume15m * seededBetween(seedKey, 17, 1.6, 6), 2);
  const holderCount = Math.floor(seededBetween(seedKey, 18, 45, 15_000));
  const top1 = roundTo(seededBetween(seedKey, 19, 0.6, 22), 2);
  const top10 = roundTo(clamp(top1 + seededBetween(seedKey, 20, 8, 48), 6, 95), 2);
  const isBonded = seededUnit(seedKey, 21) > 0.45;
  const lpLockedPct = maybeNullNumber(seedKey, 22, 60, 100, 0.2);
  const lpLockDays = lpLockedPct === null ? null : Math.round(seededBetween(seedKey, 23, 14, 365));
  const lpBurned = maybeNullBoolean(seedKey, 24, 0.35);

  return {
    mint: base.address,
    symbol: base.symbol,
    name: base.name,
    launchpad: seededUnit(seedKey, 25) > 0.5 ? 'pumpfun' : 'moonshot',
    market: {
      age_minutes: Math.floor(seededBetween(seedKey, 26, 2, 12_000)),
      is_bonded: isBonded,
      bonding_progress_pct: isBonded ? null : roundTo(seededBetween(seedKey, 27, 1, 99), 2),
    },
    authorities: {
      mint_authority_revoked: seededUnit(seedKey, 28) > 0.05,
      freeze_authority_revoked: seededUnit(seedKey, 29) > 0.08,
    },
    liquidity: {
      liq_usd: liqUsd,
      liq_sol: liqSol,
      lp_locked_pct: lpLockedPct,
      lp_lock_days: lpLockDays,
      lp_burned: lpBurned,
    },
    holders: {
      holder_count: holderCount,
      top1_pct: top1,
      top10_pct: top10,
      deployer_pct: maybeNullNumber(seedKey, 30, 0.4, 14, 0.15),
    },
    trading: {
      tx_per_min_5m: txPerMin,
      buys_5m: buys5m,
      sells_5m: sells5m,
      volume_usd_5m: volume5m,
      volume_usd_15m: volume15m,
      volume_usd_60m: volume60m,
      price_change_5m: roundTo(seededBetween(seedKey, 31, -35, 45), 2),
      price_change_60m: roundTo(seededBetween(seedKey, 32, -70, 110), 2),
    },
    manipulation: {
      bundle_score: maybeNullNumber(seedKey, 33, 0, 100, 0.15),
      identical_buy_cluster_score: maybeNullNumber(seedKey, 34, 0, 100, 0.2),
      same_funder_cluster_score: maybeNullNumber(seedKey, 35, 0, 100, 0.2),
      wash_trade_score: maybeNullNumber(seedKey, 36, 0, 100, 0.2),
    },
    safety: {
      jupiter_shield_level: pickShieldLevel(seedKey, 37),
    },
    social: {
      x_mentions_15m: maybeNullNumber(seedKey, 38, 0, 3_000, 0.3),
      x_velocity_15m: maybeNullNumber(seedKey, 39, 0, 100, 0.35),
      x_account_quality_score: maybeNullNumber(seedKey, 40, 0, 100, 0.3),
    },
    oracle: {
      sentiment: maybeNullNumber(seedKey, 41, -1, 1, 0.2),
      confidence: maybeNullNumber(seedKey, 42, 0, 1, 0.2),
      trend_score: maybeNullNumber(seedKey, 43, 0, 100, 0.2),
    },
  };
}

function normalizeJupiterToken(raw: unknown): JupiterTokenLite | null {
  if (!isObject(raw)) return null;
  const address = asString(raw.address);
  if (!address) return null;

  const symbol = asString(raw.symbol, 'UNKNOWN');
  const name = asString(raw.name, symbol);
  return { address, symbol, name };
}

async function fetchJupiterTokens(): Promise<JupiterTokenLite[]> {
  const { JUPITER_BASE_URL } = getEnv();
  const endpoint = `${JUPITER_BASE_URL.replace(/\/$/, '')}/tokens`;
  const response = await fetch(endpoint, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Jupiter token list (${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error('Invalid Jupiter token list payload');
  }

  const deduped = new Map<string, JupiterTokenLite>();
  for (const item of payload) {
    const token = normalizeJupiterToken(item);
    if (!token) continue;
    if (!deduped.has(token.address)) {
      deduped.set(token.address, token);
    }
    if (deduped.size >= DISCOVER_MAX_TOKENS) break;
  }
  return Array.from(deduped.values());
}

function buildFallbackCatalog(): JupiterTokenLite[] {
  const fallbackCount = 400;
  const fallback: JupiterTokenLite[] = [];
  for (let i = 0; i < fallbackCount; i++) {
    fallback.push({
      address: createFallbackMint(i),
      symbol: `TOK${String(i + 1).padStart(3, '0')}`,
      name: `Fallback Token ${i + 1}`,
    });
  }
  return fallback;
}

async function loadDiscoverTokens(): Promise<DiscoverToken[]> {
  const catalog = await fetchJupiterTokens().catch(() => buildFallbackCatalog());
  return catalog.slice(0, DISCOVER_MAX_TOKENS).map((token, index) => buildToken(token, index));
}

async function getDiscoverTokensCached(): Promise<DiscoverToken[]> {
  const now = Date.now();
  if (discoverCache && now < discoverCache.expiresAt) {
    return discoverCache.tokens;
  }

  const tokens = await loadDiscoverTokens();
  discoverCache = {
    tokens,
    expiresAt: now + DISCOVER_CACHE_TTL_MS,
  };
  return tokens;
}

function getRequesterIdentifier(reqHeaders: Record<string, string | string[] | undefined>): string | null {
  const xff = reqHeaders['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (!raw) return null;
  const ip = raw.split(',')[0]?.trim();
  return ip || null;
}

export default createHandler({
  auth: 'none',
  GET: async ({ req, res }) => {
    const startedAt = Date.now();
    let payloadBytes = 0;
    let tokenCount = 0;
    let cursor: number | null = null;
    let limit: number | null = null;

    try {
      setCacheHeaders(res, { public: true, maxAge: Math.floor(DISCOVER_CACHE_TTL_MS / 1000) });

      const query = validateQuery(querySchema, req.query);
      const requester = getRequesterIdentifier(req.headers);
      if (requester) {
        await checkRateLimit('discover', requester, { limit: 120, windowSeconds: 60 });
      }

      const allTokens = await getDiscoverTokensCached();
      const start = query.cursor ?? 0;
      const end = query.limit ? Math.min(start + query.limit, allTokens.length) : allTokens.length;
      const page = allTokens.slice(start, end);

      if (query.limit && end < allTokens.length) {
        res.setHeader('x-next-cursor', String(end));
      }

      cursor = start;
      limit = query.limit ?? null;
      tokenCount = page.length;
      payloadBytes = Buffer.byteLength(JSON.stringify({ status: 'ok', data: page }), 'utf8');

      sendJson(res, page);
    } finally {
      suppressDefaultRequestLog(req);
      logger.info('Discover tokens request completed', {
        route: '/api/discover/tokens',
        durationMs: Date.now() - startedAt,
        payloadBytes,
        tokenCount,
        cursor,
        limit,
      });
    }
  },
});
