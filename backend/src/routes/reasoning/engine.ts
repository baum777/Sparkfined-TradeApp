import type { ParsedRequest } from '../../http/router.js';
import { getRequestId } from '../../http/requestId.js';
import { kvGet, kvSet, kvKeys, kvTTL } from '../../db/kv.js';
import { getEnv } from '../../config/env.js';
import { buildReasoningContext } from '../../context/contextBuilder.js';
import type {
  BoardScenariosInsight,
  InsightCriticOnlyResult,
  InsightCriticReport,
  InsightCriticRequest,
  JsonObject,
  ReasoningBaseRequest,
  ReasoningErrorCode,
  ReasoningResponse,
  ReasoningType,
  SessionReviewInsight,
  TradeReviewInsight,
} from './types.js';
import { REASONING_CONTRACT_VERSION } from './types.js';
import { buildReasoningCacheKey } from './cacheKey.js';
import { withRetry } from './retry.js';
import { routeLLMRequest } from '../../clients/llmRouter.js';
import {
  boardScenariosInsightSchema,
  insightCriticOnlyResultSchema,
  insightCriticReportSchema,
  sessionReviewInsightSchema,
  tradeReviewInsightSchema,
} from './schemas.js';
import { buildCriticPrompt, buildGeneratorPrompt } from './prompts.js';

type AnyInsight = TradeReviewInsight | SessionReviewInsight | BoardScenariosInsight;

function ok<T>(data: T, input: {
  model: string;
  latencyMs: number;
  version: string;
  cache?: ReasoningResponse<T>['meta']['cache'];
  warnings?: string[];
  confidence?: number;
}): ReasoningResponse<T> {
  return {
    status: 'ok',
    data,
    warnings: input.warnings ?? [],
    confidence: input.confidence ?? 0.7,
    meta: {
      latency_ms: input.latencyMs,
      model: input.model,
      version: input.version,
      requestId: getRequestId(),
      cache: input.cache,
    },
  };
}

function err<T>(input: {
  code: ReasoningErrorCode;
  message: string;
  retryable: boolean;
  latencyMs: number;
  model: string;
  version: string;
  warnings?: string[];
}): ReasoningResponse<T> {
  return {
    status: 'error',
    data: null,
    warnings: input.warnings ?? [],
    confidence: 0,
    meta: {
      latency_ms: input.latencyMs,
      model: input.model,
      version: input.version,
      requestId: getRequestId(),
    },
    error: {
      code: input.code,
      message: input.message,
      retryable: input.retryable,
    },
  };
}

function isRetryableUpstream(error: unknown): boolean {
  const status = (error as any)?.status;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('fetch failed') || msg.includes('ECONN') || msg.includes('ENOTFOUND');
}

function criticOutputSchemaJson(): string {
  return JSON.stringify(
    {
      issues: [{ kind: 'missing_data', message: '...', fields: ['context.someField'] }],
      adjustedConfidence: 0.7,
      notes: ['...'],
    },
    null,
    2
  );
}

function tradeReviewOutputSchemaJson(): string {
  return JSON.stringify(
    {
      type: 'trade-review',
      referenceId: 'string',
      verdict: 'GOOD_PROCESS | MIXED | BAD_PROCESS',
      decision: { shouldRepeat: true, reason: 'string' },
      highlights: ['string'],
      risks: [{ label: 'string', severity: 'low|medium|high', evidence: ['string'] }],
      fixes: [{ action: 'string', why: 'string' }],
      questions: ['string'],
      critic: {
        issues: [{ kind: 'missing_data|overreach|contradiction', message: 'string', fields: ['string?'] }],
        adjustedConfidence: 0.7,
        notes: ['string'],
      },
    },
    null,
    2
  );
}

function sessionReviewOutputSchemaJson(): string {
  return JSON.stringify(
    {
      type: 'session-review',
      referenceId: 'string',
      summary: 'string',
      decisions: [{ decision: 'string', rationale: 'string' }],
      patterns: [{ pattern: 'string', evidence: ['string'] }],
      nextSessionPlan: [{ action: 'string', trigger: 'string' }],
      critic: {
        issues: [{ kind: 'missing_data|overreach|contradiction', message: 'string', fields: ['string?'] }],
        adjustedConfidence: 0.7,
        notes: ['string'],
      },
    },
    null,
    2
  );
}

function boardScenariosOutputSchemaJson(): string {
  return JSON.stringify(
    {
      type: 'board-scenarios',
      referenceId: 'string',
      scenarios: [
        {
          name: 'string',
          probability: 0.5,
          triggers: ['string'],
          plan: { actions: ['string'], invalidation: 'string', riskRule: 'string' },
        },
      ],
      critic: {
        issues: [{ kind: 'missing_data|overreach|contradiction', message: 'string', fields: ['string?'] }],
        adjustedConfidence: 0.7,
        notes: ['string'],
      },
    },
    null,
    2
  );
}

async function runCritic(input: {
  referenceId: string;
  version: string;
  context: JsonObject;
  insight: JsonObject;
  timeoutMs: number;
  model: string;
  userId?: string;
}): Promise<{ report: InsightCriticReport; modelUsed: string }> {
  const schemaJson = criticOutputSchemaJson();

  try {
    const prompt = buildCriticPrompt({
      referenceId: input.referenceId,
      version: input.version,
      context: input.context,
      insight: input.insight,
      outputSchemaJson: schemaJson,
    });

    const result = await routeLLMRequest('reasoning_critic', {
      prompt,
      model: input.model,
      timeoutMs: input.timeoutMs,
      jsonOnly: true,
      system: 'You are a critical insight reviewer. Return strictly valid JSON.',
    }, { userId: input.userId });

    const report = insightCriticReportSchema.parse(result.parsed);
    return { report, modelUsed: result.model };
  } catch (e: any) {
    if (e.message === 'MISSING_DEEPSEEK_KEY') {
       throw e; 
    }
    throw e;
  }
}

export async function runReasoning(
  req: ParsedRequest,
  type: Exclude<ReasoningType, 'insight-critic'>,
  body: ReasoningBaseRequest
): Promise<ReasoningResponse<AnyInsight>> {
  const started = Date.now();
  const env = getEnv();
  const version = body.version || REASONING_CONTRACT_VERSION;
  const model = env.DEEPSEEK_MODEL_REASONING || env.OPUS_MODEL || 'deepseek-reasoner';

  const builtContext = buildReasoningContext({
    userId: req.userId,
    type,
    referenceId: body.referenceId,
    context: body.context,
  });

  const { key: cacheKey } = buildReasoningCacheKey({
    type,
    referenceId: body.referenceId,
    version,
    context: builtContext,
  });

  const kvKey = kvKeys.reasoningCache(type, body.referenceId, version, cacheKey);
  const cached = kvGet<ReasoningResponse<AnyInsight>>(kvKey);
  if (cached) {
    return {
      ...cached,
      meta: {
        ...cached.meta,
        requestId: getRequestId(),
        cache: { key: cacheKey, hit: true, isStale: true, source: 'backend' },
      },
    };
  }

  const timeoutMs = 25000;

  try {
    const insight = await withRetry(
      async () => {
        const outputSchemaJson =
          type === 'trade-review'
            ? tradeReviewOutputSchemaJson()
            : type === 'session-review'
              ? sessionReviewOutputSchemaJson()
              : boardScenariosOutputSchemaJson();

        const prompt = buildGeneratorPrompt({
          type,
          referenceId: body.referenceId,
          version,
          context: builtContext,
          outputSchemaJson,
        });

        const result = await routeLLMRequest('reasoning', {
            prompt,
            model,
            timeoutMs,
            jsonOnly: true,
            system: 'You are a deep reasoning engine. Output valid JSON only.',
        }, { userId: req.userId });
        
        const parsed = result.parsed;

        if (type === 'trade-review') return tradeReviewInsightSchema.parse(parsed);
        if (type === 'session-review') return sessionReviewInsightSchema.parse(parsed);
        return boardScenariosInsightSchema.parse(parsed);
      },
      { maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 2000 },
      isRetryableUpstream
    );

    const critic = await runCritic({
      referenceId: body.referenceId,
      version,
      context: builtContext,
      insight: insight as unknown as JsonObject,
      timeoutMs: 15000,
      model,
      userId: req.userId,
    });

    const finalInsight = {
      ...insight,
      critic: critic.report,
    } as AnyInsight;

    const latencyMs = Date.now() - started;
    const response = ok(finalInsight, {
      model: critic.modelUsed,
      latencyMs,
      version,
      confidence: critic.report.adjustedConfidence,
      warnings: critic.report.issues.length ? critic.report.notes : [],
      cache: { key: cacheKey, hit: false, isStale: false, source: 'llm' },
    });

    kvSet(kvKey, response, kvTTL.reasoningCache);

    return response;
  } catch (e) {
    const latencyMs = Date.now() - started;
    const mapped = mapEngineError(e);
    return err({
      code: mapped.code,
      message: mapped.message,
      retryable: mapped.retryable,
      latencyMs,
      model: env.DEEPSEEK_MODEL_REASONING || 'unknown',
      version,
    });
  }
}

export async function runInsightCritic(
  req: ParsedRequest,
  body: InsightCriticRequest
): Promise<ReasoningResponse<InsightCriticOnlyResult>> {
  const started = Date.now();
  const env = getEnv();
  const version = body.version || REASONING_CONTRACT_VERSION;
  const model = env.DEEPSEEK_MODEL_REASONING || env.OPUS_MODEL || 'deepseek-reasoner';

  const builtContext = buildReasoningContext({
    userId: req.userId,
    type: 'insight-critic',
    referenceId: body.referenceId,
    context: body.context,
  });

  const contextForKey: JsonObject = { ...builtContext, __insight: body.insight };
  const { key: cacheKey } = buildReasoningCacheKey({
    type: 'insight-critic',
    referenceId: body.referenceId,
    version,
    context: contextForKey,
  });

  const kvKey = kvKeys.reasoningCache('insight-critic', body.referenceId, version, cacheKey);
  const cached = kvGet<ReasoningResponse<InsightCriticOnlyResult>>(kvKey);
  if (cached) {
    return {
      ...cached,
      meta: {
        ...cached.meta,
        requestId: getRequestId(),
        cache: { key: cacheKey, hit: true, isStale: true, source: 'backend' },
      },
    };
  }

  try {
    const report = await runCritic({
      referenceId: body.referenceId,
      version,
      context: builtContext,
      insight: body.insight,
      timeoutMs: 15000,
      model,
      userId: req.userId,
    });

    const payload = insightCriticOnlyResultSchema.parse({
      type: 'insight-critic',
      referenceId: body.referenceId,
      report: report.report,
    });

    const latencyMs = Date.now() - started;
    const response = ok(payload, {
      model: report.modelUsed,
      latencyMs,
      version,
      confidence: report.report.adjustedConfidence,
      warnings: report.report.issues.length ? report.report.notes : [],
      cache: { key: cacheKey, hit: false, isStale: false, source: 'llm' },
    });

    kvSet(kvKey, response, kvTTL.reasoningCache);

    return response;
  } catch (e) {
    const latencyMs = Date.now() - started;
    const mapped = mapEngineError(e);
    return err({
      code: mapped.code,
      message: mapped.message,
      retryable: mapped.retryable,
      latencyMs,
      model: env.DEEPSEEK_MODEL_REASONING || 'unknown',
      version,
    });
  }
}

function mapEngineError(error: unknown): { code: ReasoningErrorCode; message: string; retryable: boolean } {
  const status = (error as any)?.status;
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('MISSING_DEEPSEEK_KEY')) {
    return { code: 'INTERNAL_ERROR', message: 'DeepSeek configuration missing', retryable: false };
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return { code: 'TIMEOUT', message: 'Reasoning request timed out', retryable: true };
  }
  if (status === 429) {
    return { code: 'RATE_LIMITED', message: 'Upstream rate limited', retryable: true };
  }
  if (status && typeof status === 'number' && status >= 500) {
    return { code: 'UPSTREAM_ERROR', message: 'Upstream service error', retryable: true };
  }
  if (msg.includes('No JSON object') || msg.includes('JSON')) {
    return { code: 'PARSING_FAILED', message: 'Failed to parse reasoning output', retryable: false };
  }
  return { code: 'INTERNAL_ERROR', message: 'Internal reasoning error', retryable: false };
}
