import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { AppError, ErrorCodes, notFound } from '../http/error.js';
import { requireAuth } from '../http/auth.js';
import { validateBody } from '../validation/validate.js';
import { journalInsightsRequestSchema } from '../validation/schemas.js';
import { journalGetById } from '../domain/journal/repo.js';
import { resolveTierFromAuthUser } from '../domain/settings/tier.js';
import { getSettings } from '../domain/settings/settings.service.js';
import { classifyPulseAsset, resolvePulseAsset } from '../domain/grokPulse/assetResolver.js';
import * as grokPulseAdapter from '../domain/grokPulse/grokPulseAdapter.js';
import { buildInsightContext } from '../domain/insights/context.js';
import { generateInsights } from '../domain/insights/index.js';
import type { InsightSnapshot } from '../domain/insights/types.js';
import { buildContextPack } from '../domain/contextPack/build.js';
import type { ContextPack } from '../domain/contextPack/types.js';

type JournalInsightsResponse = {
  facts: {
    entry: unknown; // JournalEntryV1
  };
  context?: ContextPack;
  insights: InsightSnapshot[];
  narrative?: {
    source: 'grok_pulse_snapshot';
    pulse: unknown | null;
  };
};

function tierAllowsGrok(tier: ReturnType<typeof resolveTierFromAuthUser>): boolean {
  return tier === 'pro' || tier === 'high';
}

export async function handleJournalInsights(req: ParsedRequest, res: ServerResponse): Promise<void> {
  requireAuth(req);

  const { id } = req.params;
  const body = validateBody(journalInsightsRequestSchema, req.body);

  const entry = await journalGetById(req.userId, id);
  if (!entry) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }

  const includeGrok = body.includeGrok === true;
  const includeContextPack = body.includeContextPack === true;
  const contextPackAnchorMode = body.contextPackAnchorMode || 'trade_centered';
  const tier = resolveTierFromAuthUser(req.user);
  const contextPackTier = tier ?? 'free';

  // Server-side gating: include Grok narrative ONLY if explicitly requested and enabled.
  if (includeGrok) {
    if (!tierAllowsGrok(tier)) {
      throw new AppError('Tier does not allow Grok narrative', 403, ErrorCodes.FORBIDDEN_TIER);
    }

    const settings = await getSettings(req.userId);
    if (settings.ai.grokEnabled !== true) {
      throw new AppError('Grok is disabled in user settings', 403, ErrorCodes.GROK_DISABLED);
    }
  }

  // Build insight context (tier-gated data assembly)
  const context = await buildInsightContext(req.userId, entry, tier);

  // Generate insights using selected modules for tier
  const insights = await generateInsights(tier, context);

  const response: JournalInsightsResponse = {
    facts: {
      entry, // JournalEntryV1
    },
    insights,
  };

  // Build ContextPack if requested (per FROZEN SPEC section 5A)
  if (includeContextPack) {
    const assetMint = entry.capture?.assetMint || entry.symbolOrAddress || '';
    const settings = await getSettings(req.userId);
    
    const contextPack = await buildContextPack({
      userId: req.userId,
      tier: contextPackTier,
      asset: {
        mint: assetMint,
        symbol: entry.symbolOrAddress || undefined,
      },
      anchor: {
        mode: contextPackAnchorMode as 'trade_centered' | 'now_centered' | 'launch_centered' | 'latest_only',
        anchorTimeISO: entry.timestamp || entry.createdAt,
      },
      includeGrok,
      settings,
      entry,
    });
    response.context = contextPack;
  }

  // Add Grok narrative if requested and allowed (legacy support)
  if (includeGrok && !includeContextPack) {
    const asset = entry.capture?.assetMint || entry.symbolOrAddress;
    const classified = typeof asset === 'string' ? classifyPulseAsset(asset) : null;
    const resolved = typeof asset === 'string' && classified ? resolvePulseAsset(asset) : null;
    response.narrative = {
      source: 'grok_pulse_snapshot',
      pulse: resolved ? await grokPulseAdapter.getPulseFeedSnapshot(resolved) : null,
    };
  }

  setCacheHeaders(res, { noStore: true });
  sendJson(res, response);
}

