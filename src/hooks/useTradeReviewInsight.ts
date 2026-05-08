import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOffline } from '@/components/offline';
import type { JsonObject, ReasoningResponse, TradeReviewInsight } from '@/lib/reasoning/types';
import { REASONING_CONTRACT_VERSION } from '@/lib/reasoning/types';
import { dbService } from '@/services/db/db';
import { buildReasoningCacheKey } from '@/services/reasoning/cacheKey';
import { reasoningApi, type ReasoningOfflineFirstResult } from '@/services/reasoning/reasoningApi';
import { stableStringify } from '@/services/reasoning/stableJson';

function offlineError(version: string): ReasoningResponse<TradeReviewInsight> {
  return {
    status: 'error',
    data: null,
    warnings: [],
    confidence: 0,
    meta: { latency_ms: 0, model: 'client', version },
    error: { code: 'UPSTREAM_ERROR', message: 'Offline and no cached insight available', retryable: true },
  };
}

export function useTradeReviewInsight(input: {
  referenceId: string;
  context: JsonObject;
  version?: string;
}) {
  const { isOnline } = useOffline();
  const queryClient = useQueryClient();
  const version = input.version ?? REASONING_CONTRACT_VERSION;
  const contextKey = stableStringify(input.context);
  const context = useMemo<JsonObject>(() => JSON.parse(contextKey) as JsonObject, [contextKey]);

  const queryKey = useMemo(
    () => ['reasoning', 'trade-review', input.referenceId, version, contextKey] as const,
    [input.referenceId, version, contextKey]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadCached() {
      const { key } = await buildReasoningCacheKey({
        type: 'trade-review',
        referenceId: input.referenceId,
        version,
        context,
      });

      const cached = await dbService.getReasoning(key);
      if (cancelled) return;

      const existing = queryClient.getQueryData<ReasoningOfflineFirstResult<TradeReviewInsight>>(queryKey);
      if (existing) return;

      if (cached?.response) {
        queryClient.setQueryData(queryKey, {
          response: cached.response as ReasoningResponse<TradeReviewInsight>,
          isStale: true,
          cacheKey: key,
        });
      } else if (!isOnline) {
        queryClient.setQueryData(queryKey, {
          response: offlineError(version),
          isStale: true,
          cacheKey: key,
        });
      }
    }
    if (input.referenceId) {
      loadCached().catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [context, input.referenceId, isOnline, queryClient, queryKey, version]);

  const query = useQuery({
    queryKey,
    queryFn: () => reasoningApi.tradeReview({ referenceId: input.referenceId, context, version }),
    enabled: Boolean(input.referenceId) && isOnline,
  });

  const result = query.data;

  return {
    ...query,
    response: result?.response,
    insight: result?.response.data ?? null,
    confidence: result?.response.confidence ?? 0,
    isStale: result?.isStale ?? true,
  };
}
