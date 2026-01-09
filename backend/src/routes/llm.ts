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

const executeRequestSchema = z.object({
  taskId: z.string().min(1).optional(),
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
      costBudget: z.enum(['low', 'medium', 'high']).optional(),
      safety: z.enum(['default', 'strict']).optional(),
    })
    .optional(),
});

function finalSystemPrompt(input: {
  safety: 'default' | 'strict';
  mustInclude: string[];
}): string {
  return [
    'You are a helpful assistant.',
    'Follow the user request in the prompt.',
    input.safety === 'strict'
      ? 'Be cautious: do not provide instructions for wrongdoing. Prefer safe alternatives.'
      : 'Safety: default.',
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
}): LlmMessage[] {
  return [
    {
      role: 'system',
      content: finalSystemPrompt({ safety: input.safety, mustInclude: input.mustInclude }),
    },
    { role: 'user', content: input.compressedPrompt },
  ];
}

export const handleLlmExecute: RouteHandler = async (req, res) => {
  const env = getEnv();
  const parsed = executeRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new AppError('Validation failed', 400, ErrorCodes.VALIDATION_ERROR, {
      requestId: [getRequestId()],
    });
  }

  const requestId = getRequestId();
  const safety = parsed.data.constraints?.safety ?? 'default';

  const routing = env.LLM_ROUTER_ENABLED
    ? await routeAndCompress(
        {
          taskId: parsed.data.taskId,
          mode: 'route_compress',
          userMessage: parsed.data.userMessage,
          context: parsed.data.context,
          constraints: parsed.data.constraints,
        },
        requestId
      )
    : {
        requestId,
        decision: {
          provider: 'openai' as const,
          reason: 'router_disabled',
          maxTokens: Math.min(1200, parsed.data.constraints?.maxFinalTokens ?? 1200),
          temperature: 0,
        },
        compressedPrompt: parsed.data.userMessage,
        mustInclude: [],
        redactions: [],
      };

  const maxTokens = routing.decision.maxTokens;
  const temperature = routing.decision.temperature ?? 0;

  const messages = buildFinalMessages({
    compressedPrompt: routing.compressedPrompt,
    safety,
    mustInclude: routing.mustInclude,
  });

  type DecisionProvider = 'none' | 'openai' | 'grok';

  async function callProvider(provider: DecisionProvider) {
    // Execute chosen provider, but never send the full context to OpenAI/Grok.
    if (provider === 'none') {
      return await callDeepSeek({
        requestId,
        timeoutMs: env.LLM_TIMEOUT_MS,
        model: env.DEEPSEEK_MODEL_ANSWER || 'deepseek-chat',
        messages,
        temperature,
        maxTokens,
        jsonOnly: false,
      });
    }

    if (provider === 'openai') {
      return await callOpenAI({
        requestId,
        timeoutMs: env.LLM_TIMEOUT_MS,
        model: env.OPENAI_MODEL_INSIGHTS || 'gpt-4o-mini',
        messages,
        temperature,
        maxTokens,
        jsonOnly: false,
      });
    }

    // grok
    return await callGrok({
      requestId,
      timeoutMs: env.LLM_TIMEOUT_MS,
      model: 'grok-beta',
      messages,
      temperature,
      maxTokens,
      jsonOnly: false,
    });
  }

  function pickExecuteFallback(primary: DecisionProvider): DecisionProvider | null {
    const forced = env.LLM_FALLBACK_PROVIDER;
    if (forced && forced !== primary) return forced;
    // Deterministic single-hop fallback.
    if (primary === 'openai') return 'none';
    if (primary === 'grok') return 'openai';
    return 'openai';
  }

  const primary = routing.decision.provider;
  let usedProvider: DecisionProvider = primary;
  let result: Awaited<ReturnType<typeof callProvider>>;
  try {
    result = await callProvider(primary);
  } catch (err) {
    const fallback = pickExecuteFallback(primary);
    if (!fallback || fallback === primary) throw err;
    usedProvider = fallback;
    result = await callProvider(fallback);
  }

  return sendJson(
    res,
    {
      requestId,
      provider: result.provider,
      text: result.text,
      ...(env.LLM_ROUTER_DEBUG
        ? {
            debug: {
              routerProviderDecision: primary,
              executedProviderDecision: usedProvider,
              routerLatencyMs: routing.debug?.routerLatencyMs,
            },
          }
        : {}),
    },
    200
  );
};

