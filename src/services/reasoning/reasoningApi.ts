import { dbService } from '@/services/db/db';
import type {
  BoardScenariosInsight,
  InsightCriticOnlyResult,
  InsightCriticRequest,
  JsonObject,
  PlanningRequest,
  PlanningResult,
  PlanningType,
  PlanningContext,
  ReasoningBaseRequest,
  ReasoningResponse,
  ReasoningType,
  SessionReviewInsight,
  TradeReviewInsight,
} from '@/lib/reasoning/types';
import { REASONING_CONTRACT_VERSION } from '@/lib/reasoning/types';
import type { ReasoningCacheRow } from './cache';
import { buildReasoningCacheKey } from './cacheKey';
import { reasoningClient } from './client';

const STALE_AFTER_MS = 10 * 60 * 1000; // 10 minutes

function isStale(updatedAtIso: string): boolean {
  const ts = Date.parse(updatedAtIso);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > STALE_AFTER_MS;
}

function nowIso(): string {
  return new Date().toISOString();
}

function offlineError<T>(version: string): ReasoningResponse<T> {
  return {
    status: 'error',
    data: null,
    warnings: [],
    confidence: 0,
    meta: { latency_ms: 0, model: 'client', version },
    error: {
      code: 'UPSTREAM_ERROR',
      message: 'Offline and no cached insight available',
      retryable: true,
    },
  };
}

async function getCached<T>(type: ReasoningType, req: ReasoningBaseRequest): Promise<{
  row: ReasoningCacheRow | null;
  isStale: boolean;
  cacheKey: string;
}> {
  const { key, contextHash } = await buildReasoningCacheKey({
    type,
    referenceId: req.referenceId,
    version: req.version,
    context: req.context,
  });

  const row = await dbService.getReasoning(key);
  const stale = row ? isStale(row.updatedAt) : true;

  // Ensure stored contextHash matches computed (defensive)
  if (row && row.contextHash !== contextHash) {
    return { row: null, isStale: true, cacheKey: key };
  }

  return { row, isStale: stale, cacheKey: key };
}

async function saveCached(type: ReasoningType, req: ReasoningBaseRequest, response: ReasoningResponse<unknown>): Promise<void> {
  const { key, contextHash } = await buildReasoningCacheKey({
    type,
    referenceId: req.referenceId,
    version: req.version,
    context: req.context,
  });

  const row: ReasoningCacheRow = {
    key,
    type,
    referenceId: req.referenceId,
    version: req.version,
    contextHash,
    updatedAt: nowIso(),
    response,
  };

  await dbService.saveReasoning(row);
}

export interface ReasoningOfflineFirstResult<T> {
  response: ReasoningResponse<T>;
  isStale: boolean;
  cacheKey: string;
}

async function offlineFirstFetch<T>(
  type: ReasoningType,
  path: string,
  req: ReasoningBaseRequest,
  options?: { revalidate?: boolean }
): Promise<ReasoningOfflineFirstResult<T>> {
  const cached = await getCached<T>(type, req);

  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Offline: serve cached if present
  if (!online) {
    if (cached.row?.response) {
      return {
        response: cached.row.response as ReasoningResponse<T>,
        isStale: true,
        cacheKey: cached.cacheKey,
      };
    }
    return { response: offlineError<T>(req.version), isStale: true, cacheKey: cached.cacheKey };
  }

  // Online: if we have cache and caller doesn't want to revalidate, return cache
  if (cached.row?.response && options?.revalidate === false) {
    return {
      response: cached.row.response as ReasoningResponse<T>,
      isStale: cached.isStale,
      cacheKey: cached.cacheKey,
    };
  }

  // Online: fetch fresh, then cache
  const fresh = await reasoningClient.postReasoning<ReasoningBaseRequest, T>(path, req, { retries: 2 });

  await saveCached(type, req, fresh as unknown as ReasoningResponse<unknown>);

  return { response: fresh, isStale: false, cacheKey: cached.cacheKey };
}

export const reasoningApi = {
  version: REASONING_CONTRACT_VERSION,

  async tradeReview(input: { referenceId: string; context: JsonObject; version?: string }): Promise<ReasoningOfflineFirstResult<TradeReviewInsight>> {
    const req: ReasoningBaseRequest = {
      referenceId: input.referenceId,
      version: input.version ?? REASONING_CONTRACT_VERSION,
      context: input.context,
    };
    return offlineFirstFetch('trade-review', '/reasoning/trade-review', req, { revalidate: true });
  },

  async sessionReview(input: { referenceId: string; context: JsonObject; version?: string }): Promise<ReasoningOfflineFirstResult<SessionReviewInsight>> {
    const req: ReasoningBaseRequest = {
      referenceId: input.referenceId,
      version: input.version ?? REASONING_CONTRACT_VERSION,
      context: input.context,
    };
    return offlineFirstFetch('session-review', '/reasoning/session-review', req, { revalidate: true });
  },

  async boardScenarios(input: { referenceId: string; context: JsonObject; version?: string }): Promise<ReasoningOfflineFirstResult<BoardScenariosInsight>> {
    const req: ReasoningBaseRequest = {
      referenceId: input.referenceId,
      version: input.version ?? REASONING_CONTRACT_VERSION,
      context: input.context,
    };
    return offlineFirstFetch('board-scenarios', '/reasoning/board-scenarios', req, { revalidate: true });
  },

  async insightCritic(input: {
    referenceId: string;
    context: JsonObject;
    insight: JsonObject;
    version?: string;
  }): Promise<ReasoningOfflineFirstResult<InsightCriticOnlyResult>> {
    const req: InsightCriticRequest = {
      referenceId: input.referenceId,
      version: input.version ?? REASONING_CONTRACT_VERSION,
      context: input.context,
      insight: input.insight,
    };

    // Critic is cheap enough to always revalidate when online; offline returns last.
    const contextForKey: JsonObject = { ...req.context, __insight: req.insight };
    const cached = await getCached<InsightCriticOnlyResult>('insight-critic', { ...req, context: contextForKey });
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!online) {
      if (cached.row?.response) {
        return {
          response: cached.row.response as ReasoningResponse<InsightCriticOnlyResult>,
          isStale: true,
          cacheKey: cached.cacheKey,
        };
      }
      return { response: offlineError<InsightCriticOnlyResult>(req.version), isStale: true, cacheKey: cached.cacheKey };
    }

    const fresh = await reasoningClient.postReasoning<InsightCriticRequest, InsightCriticOnlyResult>(
      '/reasoning/insight-critic',
      req,
      { retries: 2 }
    );
    await saveCached('insight-critic', { ...req, context: contextForKey }, fresh as unknown as ReasoningResponse<unknown>);
    return { response: fresh, isStale: false, cacheKey: cached.cacheKey };
  },

  async planning(input: {
    type: PlanningType;
    scope: string;
    referenceId: string;
    context: PlanningContext;
    outputSchemaJson: string;
    version?: string;
  }): Promise<ReasoningResponse<PlanningResult>> {
    const req: PlanningRequest = {
      type: input.type,
      scope: input.scope,
      referenceId: input.referenceId,
      version: input.version ?? REASONING_CONTRACT_VERSION,
      context: input.context,
      outputSchemaJson: input.outputSchemaJson,
    };

    return reasoningClient.postReasoning<PlanningRequest, PlanningResult>('/reasoning/planning', req, { retries: 2 });
  },
};

