import { getEnv } from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';
import { callDeepSeek } from '../providers/deepseek.js';
import type { LlmMessage } from '../types.js';
import { routerOutputSchema, type RouterOutput } from './schema.js';
import {
  enforcePermissions,
  getTierSettings,
  type LlmTaskKind,
  type RouterDecisionProvider,
  type Tier,
} from '../tierPolicy.js';

export type RouterMode = 'route_compress' | 'postprocess';

export interface ReasoningRouteInput {
  mode: RouterMode;
  tier?: Tier;
  taskKind?: LlmTaskKind;
  userMessage: string;
  context?: {
    conversationId?: string;
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    metadata?: Record<string, unknown>;
  };
  constraints?: {
    maxFinalTokens?: number;
    latencyBudgetMs?: number;
    safety?: 'default' | 'strict';
  };
}

export interface ReasoningRouteResult {
  requestId: string;
  decision: {
    provider: RouterDecisionProvider;
    reason: string;
    maxTokens: number;
  };
  compressedPrompt: string;
  mustInclude: string[];
  redactions: string[];
  tierApplied: Tier;
  taskKindApplied: LlmTaskKind;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `…[+${s.length - max} chars]`;
}

function redactSecrets(text: string): string {
  // Best-effort deterministic redaction (avoid leaking headers/tokens into prompts)
  return text
    .replace(/(authorization\s*:\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(cookie\s*:\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(bearer\s+)[a-z0-9_.-]+/gi, '$1[REDACTED]')
    .replace(/(sk-[a-z0-9]{16,})/gi, '[REDACTED]')
    .replace(/(xai-[a-z0-9]{16,})/gi, '[REDACTED]')
    .replace(/(ds-[a-z0-9]{16,})/gi, '[REDACTED]');
}

function parseFirstJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return JSON.parse(trimmed);
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
  throw new Error('No JSON object found in router output');
}

function buildRouterSystemPrompt(): string {
  return [
    'You are a routing/compression engine.',
    'Output JSON only. No prose. No markdown.',
    '',
    'You MUST output a single JSON object with exactly this shape:',
    '{',
    '  "decision": { "provider": "none|deepseek|openai|grok", "reason": "…", "maxTokens": 800 },',
    '  "compressedPrompt": "…",',
    '  "mustInclude": ["…"],',
    '  "redactions": ["…"]',
    '}',
    '',
    'Rules:',
    '- Keep compressedPrompt short and executable (include only essential constraints and context).',
    '- Never include secrets: API keys, tokens, cookies, Authorization/Bearer headers. If present in input, add them to redactions and omit from compressedPrompt.',
    '- decision.provider:',
    '  - "none" if DeepSeek can cheaply produce the final answer from compressedPrompt.',
    '  - "deepseek" if DeepSeek Answer model should be used explicitly.',
    '  - "openai" for higher-quality long-form writing, complex structured outputs, or when accuracy matters most.',
    '  - "grok" for X/Twitter style, snappy "alpha" phrasing, or realtime/social-sentiment flavor.',
    '- decision.maxTokens should be appropriate for the final answer (not the router).',
    '- Be deterministic and conservative: prefer "none" when unsure.',
  ].join('\n');
}

function buildRouterUserPrompt(input: ReasoningRouteInput): string {
  const messages = (input.context?.messages ?? []).slice(-6).map(m => ({
    role: m.role,
    content: truncate(redactSecrets(m.content), 2000),
  }));

  const payload = {
    mode: input.mode,
    tier: input.tier,
    taskKind: input.taskKind,
    userMessage: truncate(redactSecrets(input.userMessage), 8000),
    context: {
      conversationId: input.context?.conversationId,
      messages,
      // Keep metadata shallow; do not dump arbitrary objects.
      metadataKeys: input.context?.metadata ? Object.keys(input.context.metadata).slice(0, 32) : [],
    },
    constraints: input.constraints ?? {},
  };

  return [
    'INPUT_JSON:',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

function fallbackCompressedPrompt(input: ReasoningRouteInput): string {
  const safety = input.constraints?.safety ?? 'default';
  const maxFinalTokens = input.constraints?.maxFinalTokens;
  return [
    'TASK:',
    redactSecrets(input.userMessage),
    '',
    'CONSTRAINTS:',
    `- safety: ${safety}`,
    ...(typeof maxFinalTokens === 'number' ? [`- maxFinalTokens: ${Math.floor(maxFinalTokens)}`] : []),
  ].join('\n');
}

export async function routeAndCompress(input: ReasoningRouteInput, requestId: string): Promise<ReasoningRouteResult> {
  const env = getEnv();
  const tier = (input.tier ?? env.LLM_TIER_DEFAULT) as Tier;
  const taskKind = (input.taskKind ?? 'general') as LlmTaskKind;
  const tierSettings = getTierSettings(tier);

  const routerModel = env.DEEPSEEK_MODEL_ROUTER || env.DEEPSEEK_MODEL_REASONING || 'deepseek-reasoner';
  const routerTimeoutMs = Math.min(
    tierSettings.timeoutMs,
    env.LLM_TIMEOUT_MS,
    typeof input.constraints?.latencyBudgetMs === 'number' && Number.isFinite(input.constraints.latencyBudgetMs)
      ? Math.max(1000, Math.floor(input.constraints.latencyBudgetMs))
      : tierSettings.timeoutMs
  );

  const started = Date.now();

  try {
    const messages: LlmMessage[] = [
      { role: 'system', content: buildRouterSystemPrompt() },
      { role: 'user', content: buildRouterUserPrompt({ ...input, tier, taskKind }) },
    ];

    const r = await callDeepSeek({
      requestId,
      timeoutMs: routerTimeoutMs,
      model: routerModel,
      messages,
      temperature: 0,
      maxTokens: tierSettings.routerMaxTokens,
      jsonOnly: true,
      maxRetries: Math.min(env.LLM_MAX_RETRIES, tierSettings.retries),
    });

    const raw = parseFirstJsonObject(r.text);
    const parsed: RouterOutput = routerOutputSchema.parse(raw);

    const enforced = enforcePermissions({
      tier,
      taskKind,
      routerDecision: {
        provider: parsed.decision.provider,
        reason: parsed.decision.reason,
        maxTokens: parsed.decision.maxTokens,
      },
      compressedPrompt: redactSecrets(parsed.compressedPrompt),
      mustInclude: parsed.mustInclude ?? [],
      constraints: { maxFinalTokens: input.constraints?.maxFinalTokens },
    });

    const out: ReasoningRouteResult = {
      requestId,
      decision: enforced.decision,
      compressedPrompt: enforced.compressedPrompt,
      mustInclude: enforced.mustInclude,
      redactions: parsed.redactions ?? [],
      tierApplied: enforced.tierApplied,
      taskKindApplied: enforced.taskKindApplied,
    };

    if (env.LLM_ROUTER_DEBUG) {
      logger.debug('Router decision', {
        requestId,
        tier: out.tierApplied,
        taskKind: out.taskKindApplied,
        provider: out.decision.provider,
        maxTokens: out.decision.maxTokens,
        routerLatencyMs: Date.now() - started,
        compressedPromptPreview: truncate(out.compressedPrompt, 200),
      });
    }

    return out;
  } catch (err) {
    const routerLatencyMs = Date.now() - started;

    // Do not log raw router model output; keep minimal.
    logger.warn('Router failed; using deterministic fallback', {
      requestId,
      tier,
      taskKind,
      routerLatencyMs,
      error: err instanceof Error ? err.message : String(err),
    });

    const enforced = enforcePermissions({
      tier,
      taskKind,
      routerDecision: { provider: 'deepseek', reason: 'router_fallback', maxTokens: tierSettings.finalMaxTokens },
      compressedPrompt: fallbackCompressedPrompt({ ...input, tier, taskKind }),
      mustInclude: [],
      constraints: { maxFinalTokens: input.constraints?.maxFinalTokens },
    });

    return {
      requestId,
      decision: enforced.decision,
      compressedPrompt: enforced.compressedPrompt,
      mustInclude: enforced.mustInclude,
      redactions: [],
      tierApplied: enforced.tierApplied,
      taskKindApplied: enforced.taskKindApplied,
    };
  }
}

