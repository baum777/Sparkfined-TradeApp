import { z } from 'zod';
import type { RouteHandler } from '../http/router.js';
import { sendJson } from '../http/response.js';
import { getRequestId } from '../http/requestId.js';
import { AppError, ErrorCodes } from '../http/error.js';
import { getEnv } from '../config/env.js';
import { routeAndCompress } from '../lib/llm/router/router.js';
import { callDeepSeek } from '../lib/llm/providers/deepseek.js';
import { callOpenAI } from '../lib/llm/providers/openai.js';
import { callGrok } from '../lib/llm/providers/grok.js';
import type { LlmMessage } from '../lib/llm/types.js';
import { getTierSettings, type LlmTaskKind, type Tier } from '../lib/llm/tierPolicy.js';
import { getTemplateSystemPrompt } from '../lib/llm/templates/solChartJournal.js';

const executeRequestSchema = z.object({
  tier: z.enum(['free', 'standard', 'pro', 'high']).optional(),
  taskKind: z
    .enum([
      'general',
      // Chart
      'chart_teaser_free',
      'chart_setups',
      'chart_patterns_validate',
      'chart_confluence_onchain',
      'chart_microstructure',
      // Journal
      'journal_teaser_free',
      'journal_review',
      'journal_playbook_update',
      'journal_risk',
      // Back-compat aliases
      'journal_teaser',
      'chart_teaser',
      'chart_analysis',
      // Other
      'sentiment_alpha',
    ])
    .optional(),
  userMessage: z.string().min(1).max(20000),
  context: z
    .object({
      conversationId: z.string().min(1).optional(),
      messages: z
        .array(
          z.object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string().min(1).max(20000),
          })
        )
        .optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
  constraints: z
    .object({
      maxFinalTokens: z.number().int().min(16).max(4096).optional(),
      latencyBudgetMs: z.number().int().min(250).max(120000).optional(),
      safety: z.enum(['default', 'strict']).optional(),
    })
    .optional(),
});

function finalSystemPrompt(input: {
  safety: 'default' | 'strict';
  mustInclude: string[];
  templateId?: string;
}): string {
  return [
    'You are a helpful assistant.',
    getTemplateSystemPrompt(input.templateId),
    'Follow the user request in the prompt.',
    input.safety === 'strict'
      ? 'Be cautious: do not provide instructions for wrongdoing. Prefer safe alternatives.'
      : 'Safety: default.',
    input.templateId ? `TEMPLATE_ID: ${input.templateId}` : '',
    input.mustInclude.length ? '' : '',
    input.mustInclude.length ? 'MUST_INCLUDE:' : '',
    ...(input.mustInclude.length ? input.mustInclude.map(x => `- ${x}`) : []),
    '',
    'Do not reveal hidden chain-of-thought or internal reasoning. Provide only the final answer.',
  ].join('\n');
}

function buildFinalMessages(input: {
  compressedPrompt: string;
  safety: 'default' | 'strict';
  mustInclude: string[];
  templateId?: string;
}): LlmMessage[] {
  return [
    {
      role: 'system',
      content: finalSystemPrompt({ safety: input.safety, mustInclude: input.mustInclude, templateId: input.templateId }),
    },
    { role: 'user', content: input.compressedPrompt },
  ];
}

export const handleLlmExecute: RouteHandler = async (req, res) => {
  const env = getEnv();
  const parsed = executeRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new AppError('Validation failed', 400, ErrorCodes.VALIDATION_ERROR, {
      requestId: getRequestId(),
    });
  }

  const requestId = getRequestId();
  const safety = parsed.data.constraints?.safety ?? 'default';
  const tier = (parsed.data.tier ?? env.LLM_TIER_DEFAULT) as Tier;
  const taskKind = (parsed.data.taskKind ?? 'general') as LlmTaskKind;
  const tierSettings = getTierSettings(tier);

  const routing = env.LLM_ROUTER_ENABLED
    ? await routeAndCompress(
        {
          mode: 'route_compress',
          tier,
          taskKind,
          userMessage: parsed.data.userMessage,
          context: parsed.data.context,
          constraints: parsed.data.constraints,
        },
        requestId
      )
    : {
        requestId,
        provider: 'deepseek' as const,
        templateId: 'GENERAL',
        maxTokens: Math.min(
          tierSettings.finalMaxTokens,
          parsed.data.constraints?.maxFinalTokens ?? tierSettings.finalMaxTokens
        ),
        compressedPrompt: parsed.data.userMessage,
        mustInclude: [],
        redactions: [],
        tierApplied: tier,
        taskKindApplied: taskKind,
      };

  const maxTokens = routing.maxTokens;
  const temperature = 0;

  const messages = buildFinalMessages({
    compressedPrompt: routing.compressedPrompt,
    safety,
    mustInclude: routing.mustInclude,
    templateId: routing.templateId,
  });

  type DecisionProvider = 'deepseek' | 'openai' | 'grok';

  const timeoutMs = Math.min(
    tierSettings.timeoutMs,
    env.LLM_TIMEOUT_MS,
    typeof parsed.data.constraints?.latencyBudgetMs === 'number' && Number.isFinite(parsed.data.constraints.latencyBudgetMs)
      ? Math.max(250, Math.floor(parsed.data.constraints.latencyBudgetMs))
      : tierSettings.timeoutMs
  );
  const maxRetries = Math.min(env.LLM_MAX_RETRIES, tierSettings.retries);

  async function callProvider(provider: DecisionProvider) {
    // Execute chosen provider, but never send the full context to OpenAI/Grok.
    if (provider === 'deepseek') {
      return await callDeepSeek({
        requestId,
        timeoutMs,
        model: env.DEEPSEEK_MODEL_ANSWER || 'deepseek-chat',
        messages,
        temperature,
        maxTokens,
        jsonOnly: false,
        maxRetries,
      });
    }

    if (provider === 'openai') {
      return await callOpenAI({
        requestId,
        timeoutMs,
        model: env.OPENAI_MODEL_INSIGHTS || 'gpt-4o-mini',
        messages,
        temperature,
        maxTokens,
        jsonOnly: false,
        maxRetries,
      });
    }

    // grok
    return await callGrok({
      requestId,
      timeoutMs,
      model: 'grok-beta',
      messages,
      temperature,
      maxTokens,
      jsonOnly: false,
      maxRetries,
    });
  }

  function pickExecuteFallback(primary: DecisionProvider): DecisionProvider | null {
    const forced = env.LLM_FALLBACK_PROVIDER;
    if (forced && forced !== primary) {
      if (forced === 'deepseek' || forced === 'openai' || forced === 'grok') return forced;
    }
    // Deterministic single-hop fallback.
    if (primary === 'openai') return 'deepseek';
    if (primary === 'grok') return 'openai';
    return 'openai';
  }

  const primary = routing.provider;
  let result: Awaited<ReturnType<typeof callProvider>>;
  try {
    result = await callProvider(primary);
  } catch (err) {
    const fallback = pickExecuteFallback(primary);
    if (!fallback || fallback === primary) throw err;
    result = await callProvider(fallback);
  }

  return sendJson(res, {
    requestId,
    providerUsed: result.provider,
    text: result.text,
    meta: {
      latencyMs: result.latencyMs,
      tokensIn: result.usage?.promptTokens,
      tokensOut: result.usage?.completionTokens,
    },
  }, 200);
};

