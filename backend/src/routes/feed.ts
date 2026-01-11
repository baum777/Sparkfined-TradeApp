import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { validateQuery } from '../validation/validate.js';
import { feedOracleQuerySchema, feedPulseQuerySchema } from '../validation/schemas.js';
import { oracleGetDaily } from '../domain/oracle/repo.js';
import { notFound, validationError } from '../http/error.js';
import { classifyPulseAsset, resolvePulseAsset } from '../domain/grokPulse/assetResolver.js';
import { getPulseFeedSnapshot } from '../domain/grokPulse/grokPulseAdapter.js';
import type { OracleFeedItem, PulseFeed } from '../domain/feed/types.js';
import { resolveTierFromAuthUser } from '../domain/settings/tier.js';
import { getSettings } from '../domain/settings/settings.service.js';
import { buildContextPack } from '../domain/contextPack/build.js';
import { buildPulseContextExtension } from '../domain/contextPack/pulseExtension.js';
import { buildOracleContextExtension } from '../domain/contextPack/oracleExtension.js';
 
/**
 * Canonical Feed Endpoints
 * - GET /api/feed/oracle?asset=<id>
 * - GET /api/feed/pulse?asset=<id>
 */
 
export async function handleFeedOracle(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const query = validateQuery(feedOracleQuerySchema, req.query);
  const asset = query.asset;
 
  // Minimal, deterministic "oracle feed" derived from the daily oracle feed.
  const daily = oracleGetDaily(new Date(), req.userId);
 
  const items: OracleFeedItem[] = [
    {
      id: `oracle:${asset}:${daily.pinned.id}`,
      asset,
      source: 'oracle',
      title: daily.pinned.title,
      summary: daily.pinned.summary,
      createdAt: daily.pinned.createdAt,
      tags: ['daily', 'takeaway'],
    },
    ...daily.insights.slice(0, 10).map<OracleFeedItem>((i) => ({
      id: `oracle:${asset}:${i.id}`,
      asset,
      source: 'oracle',
      title: i.title,
      summary: i.summary,
      createdAt: i.createdAt,
      tags: ['insight', i.theme],
    })),
  ];
 
  setCacheHeaders(res, { public: false, maxAge: 30 });
  sendJson(res, items);
}
 
export async function handleFeedPulse(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const query = validateQuery(feedPulseQuerySchema, req.query);
  const asset = query.asset;

  const classified = classifyPulseAsset(asset);
  if (!classified) {
    throw validationError('Invalid asset input. Expected ticker-like symbol or Solana-like address.');
  }

  const resolved = resolvePulseAsset(asset);
  if (!resolved) {
    // Well-formed but not resolvable (ticker)
    throw notFound('Asset symbol could not be resolved');
  }

  const payload: PulseFeed = await getPulseFeedSnapshot(resolved);
  
  // Per BACKEND MAP section 2B: Add optional context summary
  // Prefer now_centered market snapshot; do not compute deltas on Pulse path unless cached
  const tier = resolveTierFromAuthUser(req.user);
  if (tier) {
    const settings = await getSettings(req.userId);
    const contextPack = await buildContextPack({
      userId: req.userId,
      tier,
      asset: {
        mint: resolved.address,
        symbol: resolved.symbol,
      },
      anchor: {
        mode: 'now_centered',
        anchorTimeISO: new Date().toISOString(),
      },
      includeGrok: false, // Pulse does not request narrative by default
      settings,
    });
    
    const contextExtension = buildPulseContextExtension(contextPack);
    if (contextExtension) {
      (payload as any).context = contextExtension;
    }
  }
 
  // Pulse is near-real-time; avoid caching.
  setCacheHeaders(res, { noStore: true });
  sendJson(res, payload);
}

