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

type JournalInsightsResponse = {
  kind: 'teaser' | 'review' | 'playbook';
  facts: {
    entry: unknown;
  };
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

  const response: JournalInsightsResponse = {
    kind: body.kind,
    facts: { entry },
  };

  if (includeGrok) {
    const asset = (entry as any)?.capture?.assetMint || (entry as any)?.symbolOrAddress;
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

