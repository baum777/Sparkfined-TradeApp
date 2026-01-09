import { getEnv } from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';
import { callDeepSeek } from '../providers/deepseek.js';
import type { LlmMessage } from '../types.js';
import { routerOutputSchema, type RouterOutput } from './schema.js';

export type RouterMode = 'route_compress' | 'postprocess';
export type RouterDecisionProvider = 'none' | 'openai' | 'grok';

export interface ReasoningRouteInput {
  taskId?: string;
  mode: RouterMode;
  userMessage: string;
  context?: {
    conversationId?: string;
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    metadata?: Record<string, unknown>;
  };
  constraints?: {
    maxFinalTokens?: number;
    latencyBudgetMs?: number;
    costBudget?: 'low' | 'medium' | 'high';
    safety?: 'default' | 'strict';
  };
}

export interface ReasoningRouteResult {
  requestId: string;
  decision: {
    provider: RouterDecisionProvider;
    reason: string;
    maxTokens: number;
    temperature?: number;
  };
  compressedPrompt: string;
  mustInclude: string[];
  redactions: string[];
  debug?: { routerModel: string; routerLatencyMs: number };
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
    .replace(/(bearer\s+)[a-z0-9_\-\.]+/gi, '$1[REDACTED]')
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
    '  "decision": { "provider": "none|openai|grok", "reason": "…", "maxTokens": 800, "temperature": 0 },',
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
    taskId: input.taskId,
    mode: input.mode,
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

function clampMaxTokens(value: number, maxFinalTokens?: number): number {
  const base = Number.isFinite(value) ? Math.floor(value) : 800;
  const clamped = Math.min(Math.max(base, 16), 4096);
  if (typeof maxFinalTokens === 'number' && Number.isFinite(maxFinalTokens)) {
    return Math.min(clamped, Math.max(16, Math.floor(maxFinalTokens)));
  }
  return clamped;
}

function pickFallbackProvider(input: ReasoningRouteInput): RouterDecisionProvider {
  const env = getEnv();
  const msg = input.userMessage.toLowerCase();
  if (msg.includes('twitter') || msg.includes('x.com') || /\b(x|tweet|tweets)\b/.test(msg) || msg.includes('alpha')) {
    return 'grok';
  }
  if (msg.includes('grok')) return 'grok';
  if (msg.includes('creative') || msg.includes('poem') || msg.includes('tone') || msg.includes('story')) return 'openai';

  // Deterministic default based on configured budget tier.
  if (env.LLM_BUDGET_DEFAULT === 'high') return 'openai';
  if (env.LLM_BUDGET_DEFAULT === 'medium') return 'openai';
  return 'openai';
}

function fallbackCompressedPrompt(input: ReasoningRouteInput): string {
  const budget = input.constraints?.costBudget ?? getEnv().LLM_BUDGET_DEFAULT;
  const safety = input.constraints?.safety ?? 'default';
  const maxFinalTokens = input.constraints?.maxFinalTokens;
  return [
    'TASK:',
    redactSecrets(input.userMessage),
    '',
    'CONSTRAINTS:',
    `- costBudget: ${budget}`,
    `- safety: ${safety}`,
    ...(typeof maxFinalTokens === 'number' ? [`- maxFinalTokens: ${Math.floor(maxFinalTokens)}`] : []),
  ].join('\n');
}

export async function routeAndCompress(input: ReasoningRouteInput, requestId: string): Promise<ReasoningRouteResult> {
  const env = getEnv();

  const routerModel = env.DEEPSEEK_MODEL_ROUTER || env.DEEPSEEK_MODEL_REASONING || 'deepseek-reasoner';
  const routerTimeoutMs = Math.min(
    env.LLM_TIMEOUT_MS,
    typeof input.constraints?.latencyBudgetMs === 'number' && Number.isFinite(input.constraints.latencyBudgetMs)
      ? Math.max(1000, Math.floor(input.constraints.latencyBudgetMs))
      : env.LLM_TIMEOUT_MS
  );

  const started = Date.now();

  try {
    const messages: LlmMessage[] = [
      { role: 'system', content: buildRouterSystemPrompt() },
      { role: 'user', content: buildRouterUserPrompt(input) },
    ];

    const r = await callDeepSeek({
      requestId,
      timeoutMs: routerTimeoutMs,
      model: routerModel,
      messages,
      temperature: 0,
      maxTokens: 1200,
      jsonOnly: true,
    });

    const raw = parseFirstJsonObject(r.text);
    const parsed: RouterOutput = routerOutputSchema.parse(raw);

    const maxTokens = clampMaxTokens(parsed.decision.maxTokens, input.constraints?.maxFinalTokens);

    const out: ReasoningRouteResult = {
      requestId,
      decision: {
        provider: parsed.decision.provider,
        reason: parsed.decision.reason,
        maxTokens,
        temperature: parsed.decision.temperature,
      },
      compressedPrompt: redactSecrets(parsed.compressedPrompt),
      mustInclude: parsed.mustInclude ?? [],
      redactions: parsed.redactions ?? [],
      ...(env.LLM_ROUTER_DEBUG
        ? { debug: { routerModel, routerLatencyMs: Date.now() - started } }
        : {}),
    };

    if (env.LLM_ROUTER_DEBUG) {
      logger.debug('Router decision', {
        provider: out.decision.provider,
        maxTokens: out.decision.maxTokens,
        routerLatencyMs: out.debug?.routerLatencyMs,
      });
    }

    return out;
  } catch (err) {
    const provider = pickFallbackProvider(input);
    const maxTokens = clampMaxTokens(800, input.constraints?.maxFinalTokens);
    const routerLatencyMs = Date.now() - started;

    // Do not log raw router model output; keep minimal.
    logger.warn('Router failed; using deterministic fallback', {
      provider,
      routerLatencyMs,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      requestId,
      decision: {
        provider,
        reason: 'router_fallback',
        maxTokens,
        temperature: 0,
      },
      compressedPrompt: fallbackCompressedPrompt(input),
      mustInclude: [],
      redactions: [],
      ...(env.LLM_ROUTER_DEBUG ? { debug: { routerModel, routerLatencyMs } } : {}),
    };
  }
}

