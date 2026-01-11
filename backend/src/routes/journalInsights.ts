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
import { buildContextPackForJournalEntry } from '../domain/contextPack/contextPack.js';

type JournalInsightsResponse = {
  facts: {
    entry: unknown;
  };
  context?: unknown;
  insight?: InsightSnapshot;
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

  const entry = journalGetById(req.userId, id);
  if (!entry) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }

  const includeGrok = body.includeGrok === true;
  const tier = resolveTierFromAuthUser(req.user);
  const settings = await getSettings(req.userId);

  // Server-side gating: include Grok narrative ONLY if explicitly requested and enabled.
  if (includeGrok) {
    if (!tierAllowsGrok(tier)) {
      throw new AppError('Tier does not allow Grok narrative', 403, ErrorCodes.FORBIDDEN_TIER);
    }

    if (settings.ai.grokEnabled !== true) {
      throw new AppError('Grok is disabled in user settings', 403, ErrorCodes.GROK_DISABLED);
    }
  }

  // Build insight context (tier-gated data assembly)
  const context = await buildInsightContext(req.userId, entry, tier);

  // Generate insights:
  // - If kind is provided, select that module only (lower latency, stable contract).
  // - Else: keep prior behavior of generating tier-allowed set.
  const requestedKind = typeof body.kind === 'string' ? body.kind : undefined;
  const insights =
    requestedKind ? (await generateInsights(tier, context)).filter((i) => i.module === requestedKind) : await generateInsights(tier, context);
  const insight = insights[0] ?? undefined;

  const response: JournalInsightsResponse = { facts: { entry }, insights, ...(insight ? { insight } : {}) };

  // Add Grok narrative if requested and allowed
  let pulseSnapshot: unknown | null = null;
  if (includeGrok) {
    const asset = entry.capture?.assetMint || entry.symbolOrAddress;
    const classified = typeof asset === 'string' ? classifyPulseAsset(asset) : null;
    const resolved = typeof asset === 'string' && classified ? resolvePulseAsset(asset) : null;
    response.narrative = {
      source: 'grok_pulse_snapshot',
      pulse: resolved ? await grokPulseAdapter.getPulseFeedSnapshot(resolved) : null,
    };
    pulseSnapshot = (response.narrative.pulse as any)?.snapshot ?? null;
  }

  // ContextPack (tier-gated + opt-in narrative)
  try {
    const mint = (entry.capture?.assetMint || entry.symbolOrAddress) as string | undefined;
    if (typeof mint === 'string' && mint.trim()) {
      const generatedAtISO = new Date().toISOString();
      const pack = buildContextPackForJournalEntry({
        userId: req.userId,
        tier: (tier ?? 'free') as any,
        settings,
        asset: { mint },
        anchor: { mode: 'trade_centered', anchorTimeISO: entry.timestamp ?? entry.createdAt ?? new Date().toISOString() },
        generatedAtISO,
        atTradeSnapshot: context.atTradeSnapshot,
        orderPressure: context.orderPressure,
        deltaSnapshots: context.deltaSnapshots,
        includeGrok,
        pulseNarrativeSnapshot: (pulseSnapshot as any) ?? null,
      });
      response.context = pack;
    }
  } catch {
    // Fail open: context is optional.
  }

  setCacheHeaders(res, { noStore: true });
  sendJson(res, response);
}

