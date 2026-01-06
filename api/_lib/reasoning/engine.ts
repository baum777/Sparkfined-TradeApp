import type { HandlerContext } from '../handler';
import { kv, kvTTL, kvKeys, getStoreType } from '../kv';
import { getEnv } from '../env';
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
} from './types';
import { REASONING_CONTRACT_VERSION } from './types';
import { buildReasoningCacheKey } from './cacheKey';
import { withRetry } from './retry';
import { routeLLMRequest } from './llmRouter';
import {
  boardScenariosInsightSchema,
  insightCriticOnlyResultSchema,
  insightCriticReportSchema,
  sessionReviewInsightSchema,
  tradeReviewInsightSchema,
} from './schemas';
import { buildCriticPrompt, buildGeneratorPrompt } from './prompts';

type AnyInsight = TradeReviewInsight | SessionReviewInsight | BoardScenariosInsight;

function ok<T>(ctx: HandlerContext, data: T, input: {
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
      requestId: ctx.requestId,
      cache: input.cache,
    },
  };
}

function err<T>(ctx: HandlerContext, input: {
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
      requestId: ctx.requestId,
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

async function maybeGetCached<T>(key: string): Promise<T | null> {
  return kv.get<T>(key);
}

async function maybeSetCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await kv.set(key, value, ttlSeconds);
}

function isApiEnvelope(value: unknown): value is { data: unknown } {
  return Boolean(value && typeof value === 'object' && 'data' in value);
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
}): Promise<{ report: InsightCriticReport; modelUsed: string }> {
  const schemaJson = criticOutputSchemaJson();

  // If DeepSeek keys are missing, the router throws MISSING_DEEPSEEK_KEY.
  // We can catch that and fallback to deterministic if we want, OR we can let it fail as per requirements.
  // "if DeepSeek keys missing: return a normalized recoverable error"
  // But wait, "reasoning cannot fall back to OpenAI".
  // The user requirement says: "if DeepSeek keys missing: return a normalized recoverable error".
  // It does NOT say fallback to deterministic. However, deterministic is a valid stub.
  // Let's try to use the router. If it fails due to missing keys, we might fallback to deterministic if appropriate,
  // or return error. The router is enforcing DeepSeek.
  
  // The previous code had `if (env.OPENAI_API_KEY)`. Now we check if we can run LLM via router.
  // The router handles the check. If it throws, we catch it in the main flow.
  // But here we need to know if we should even TRY calling the LLM.
  // We can just try calling it.
  
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
    });
    
    const report = insightCriticReportSchema.parse(result.parsed);
    return { report, modelUsed: result.model };

  } catch (e: any) {
    // If keys missing or other error, fallback to deterministic stub?
    // Requirement: "if DeepSeek keys missing: return a normalized recoverable error"
    // It implies returning an error response to the client, NOT falling back to deterministic silently,
    // unless "recoverable error" means "it's okay, here is a stub".
    // "do NOT fallback to OpenAI"
    
    // Actually, looking at the previous code: `if (env.OPENAI_API_KEY) { ... } else { fallback }`.
    // So if keys are missing, we used to fallback to deterministic.
    // I will preserve this behavior but check for DEEPSEEK_API_KEY implicitly via the catch.
    // If the error is specifically MISSING_DEEPSEEK_KEY, maybe we can fallback to deterministic
    // IF we want to allow running without keys (dev mode).
    // BUT the requirement says: "reasoning endpoints must be locked to DeepSeek"
    // "if DeepSeek keys missing: return a normalized recoverable error"
    // This sounds like an API error response.
    
    if (e.message === 'MISSING_DEEPSEEK_KEY') {
       throw e; // Let the top level handler convert this to a specific error code
    }
    
    // If it's another error (timeout, etc), we might want to let it bubble up too.
    throw e;
  }
}

export async function runReasoning(
  ctx: HandlerContext,
  type: Exclude<ReasoningType, 'insight-critic'>,
  body: ReasoningBaseRequest
): Promise<ReasoningResponse<AnyInsight>> {
  const started = Date.now();
  const env = getEnv();
  const version = body.version || REASONING_CONTRACT_VERSION;
  const model = env.DEEPSEEK_MODEL_REASONING || env.OPUS_MODEL || 'deepseek-reasoner';

  const { key: cacheKey } = buildReasoningCacheKey({
    type,
    referenceId: body.referenceId,
    version,
    context: body.context,
  });

  const kvKey = kvKeys.reasoningCache(type, body.referenceId, version, cacheKey);
  const cached = await maybeGetCached<ReasoningResponse<AnyInsight>>(kvKey);

  if (cached) {
    return {
      ...cached,
      meta: {
        ...cached.meta,
        requestId: ctx.requestId,
        cache: {
          key: cacheKey,
          hit: true,
          isStale: true,
          source: getStoreType() === 'vercel' ? 'kv' : 'kv',
        },
      },
    };
  }

  const timeoutMs = 25000; // Increased for reasoning models

  try {
    const insight = await withRetry(
      async () => {
        // Prefer remote backend (Railway) if configured.
        if (env.REASONING_BACKEND_URL) {
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const res = await fetch(`${env.REASONING_BACKEND_URL}/api/reasoning/${type}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': reqAuthHeader(ctx),
                'x-request-id': ctx.requestId,
              },
              body: JSON.stringify(body),
              signal: controller.signal,
            });
            const json = (await res.json()) as unknown;
            const payload = (isApiEnvelope(json) ? json.data : null) as ReasoningResponse<AnyInsight> | null;
            if (!payload || typeof payload !== 'object') {
              const error = new Error('Invalid backend response shape');
              (error as any).status = res.status;
              throw error;
            }
            if (payload.status !== 'ok' || !payload.data) {
              const error = new Error(payload.error?.message || 'Backend reasoning failed');
              (error as any).status = res.status;
              throw error;
            }
            return payload.data;
          } finally {
            clearTimeout(to);
          }
        }

        // Direct LLM call
        // We catch MISSING_DEEPSEEK_KEY here if we want to fallback to deterministic, 
        // OR we let it bubble up to return an error.
        // Given the requirement "if DeepSeek keys missing: return a normalized recoverable error",
        // I will let it bubble up so the client gets an explicit error.
        
        // HOWEVER, for dev environment without keys, maybe we still want deterministic stub?
        // The prompt says "if DeepSeek keys missing: return a normalized recoverable error".
        // This implies no fallback to deterministic? 
        // "Compatibility rule: If existing code uses OPUS_MODEL, keep it for backward compatibility but prefer DEEPSEEK_MODEL_REASONING".
        // Existing code fell back to deterministic if no keys.
        // I will implement a check: if NO keys are present (dev), maybe use deterministic?
        // But the router throws error.
        // I will stick to the requirement: return error.
        
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
          context: body.context,
          outputSchemaJson,
        });

        // Use router
        const result = await routeLLMRequest('reasoning', {
            prompt,
            model,
            timeoutMs,
            jsonOnly: true,
            system: 'You are a deep reasoning engine. Output valid JSON only.',
        });
        
        const parsed = result.parsed;

        if (type === 'trade-review') return tradeReviewInsightSchema.parse(parsed);
        if (type === 'session-review') return sessionReviewInsightSchema.parse(parsed);
        return boardScenariosInsightSchema.parse(parsed);
      },
      { maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 2000 },
      isRetryableUpstream
    );

    // Insight Critic (final step)
    const critic = await runCritic({
      referenceId: body.referenceId,
      version,
      context: body.context,
      insight: insight as unknown as JsonObject,
      timeoutMs: 15000,
      model,
    });

    const finalInsight = {
      ...insight,
      critic: critic.report,
    } as AnyInsight;

    const latencyMs = Date.now() - started;
    const response = ok(ctx, finalInsight, {
      model: critic.modelUsed, // Use the model from the critic or the main call (approx)
      latencyMs,
      version,
      confidence: critic.report.adjustedConfidence,
      warnings: critic.report.issues.length ? critic.report.notes : [],
      cache: { key: cacheKey, hit: false, isStale: false, source: env.REASONING_BACKEND_URL ? 'backend' : 'llm' },
    });

    await maybeSetCached(kvKey, response, kvTTL.reasoningCache);

    return response;
  } catch (e) {
    const latencyMs = Date.now() - started;
    const mapped = mapEngineError(e);
    return err(ctx, {
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
  ctx: HandlerContext,
  body: InsightCriticRequest
): Promise<ReasoningResponse<InsightCriticOnlyResult>> {
  const started = Date.now();
  const env = getEnv();
  const version = body.version || REASONING_CONTRACT_VERSION;
  const model = env.DEEPSEEK_MODEL_REASONING || env.OPUS_MODEL || 'deepseek-reasoner';

  // Critic depends on both context + insight; include insight in the hashed context to avoid collisions.
  const contextForKey: JsonObject = { ...body.context, __insight: body.insight };
  const { key: cacheKey } = buildReasoningCacheKey({
    type: 'insight-critic',
    referenceId: body.referenceId,
    version,
    context: contextForKey,
  });

  const kvKey = kvKeys.reasoningCache('insight-critic', body.referenceId, version, cacheKey);
  const cached = await maybeGetCached<ReasoningResponse<InsightCriticOnlyResult>>(kvKey);

  if (cached) {
    return {
      ...cached,
      meta: {
        ...cached.meta,
        requestId: ctx.requestId,
        cache: { key: cacheKey, hit: true, isStale: true, source: 'kv' },
      },
    };
  }

  try {
    const report = await runCritic({
      referenceId: body.referenceId,
      version,
      context: body.context,
      insight: body.insight,
      timeoutMs: 15000,
      model,
    });

    const payload = insightCriticOnlyResultSchema.parse({
      type: 'insight-critic',
      referenceId: body.referenceId,
      report: report.report,
    });

    const latencyMs = Date.now() - started;
    const response = ok(ctx, payload, {
      model: report.modelUsed,
      latencyMs,
      version,
      confidence: report.report.adjustedConfidence,
      warnings: report.report.issues.length ? report.report.notes : [],
      cache: { key: cacheKey, hit: false, isStale: false, source: 'llm' },
    });

    await maybeSetCached(kvKey, response, kvTTL.reasoningCache);

    return response;
  } catch (e) {
    const latencyMs = Date.now() - started;
    const mapped = mapEngineError(e);
    return err(ctx, {
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

function reqAuthHeader(ctx: HandlerContext): string {
  const header = ctx.req.headers['authorization'];
  if (Array.isArray(header)) return header[0] || '';
  return header || '';
}
