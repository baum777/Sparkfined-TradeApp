import { getEnv } from '../config/env.js';
import type { LLMUseCase, LLMRequest, LLMResponse } from '../routes/reasoning/types.js';
import { callOpenAI } from './openaiClient.js';
import { callDeepSeek } from './deepseekClient.js';
import { callGrok } from './grokClient.js';
import { checkRateLimit } from '../lib/rateLimit/limiter.js';
import { checkAndConsumeBudget, releaseConcurrency } from '../lib/budget/budgetGate.js';
import { getUserSettings } from '../lib/budget/settings.js';
import { sanitizePromptText } from '../lib/llm/promptSecurity.js';
import { AppError, ErrorCodes } from '../http/error.js';

export async function routeLLMRequest(
  useCase: LLMUseCase,
  request: Omit<LLMRequest, 'model'> & { model?: string },
  context?: { userId?: string, ip?: string }
): Promise<LLMResponse> {
  const env = getEnv();
  const userId = context?.userId || 'anon';
  
  // 1. Rate Limit
  const rlResult = await checkRateLimit(context?.ip, userId);
  if (!rlResult.allowed) {
      throw new AppError(rlResult.reason || 'Rate limit exceeded', 429, ErrorCodes.RATE_LIMITED);
  }

  // 2. Budget Gate
  const settings = await getUserSettings(userId);
  
  let provider: 'openai' | 'deepseek' | 'grok';
  switch (useCase) {
    case 'journal':
    case 'insights':
    case 'charts':
      provider = 'openai';
      break;
    case 'reasoning':
    case 'reasoning_critic':
      provider = 'deepseek';
      break;
    case 'grok_pulse':
      provider = 'grok';
      break;
    default:
       throw new AppError(`Unknown use-case: ${useCase}`, 400, ErrorCodes.VALIDATION_FAILED);
  }

  const budgetResult = await checkAndConsumeBudget({
      provider,
      useCase,
      userId,
      ip: context?.ip,
      now: Date.now(),
      settings
  });

  if (!budgetResult.allowed) {
      // Using 429 for budget exceeded as it's a form of rate limiting/quota
      throw new AppError(budgetResult.reason || 'Budget exceeded', 429, ErrorCodes.BUDGET_EXCEEDED);
  }
  
  const baseRequest: LLMRequest = {
    ...request,
    prompt: sanitizePromptText(request.prompt, { maxChars: 60_000 }),
    system: request.system ? sanitizePromptText(request.system, { maxChars: 20_000 }) : undefined,
    model: request.model || 'gpt-4o-mini', 
  };

  try {
    switch (useCase) {
      case 'journal':
        baseRequest.model = request.model || env.OPENAI_MODEL_JOURNAL || 'gpt-4o-mini';
        return await callOpenAI(baseRequest, { useCase });
        
      case 'insights':
        baseRequest.model = request.model || env.OPENAI_MODEL_INSIGHTS || 'gpt-4o-mini';
        return await callOpenAI(baseRequest, { useCase });
        
      case 'charts':
        baseRequest.model = request.model || env.OPENAI_MODEL_CHARTS || 'gpt-4o-mini';
        return await callOpenAI(baseRequest, { useCase });
        
      case 'reasoning':
      case 'reasoning_critic':
        if (!env.DEEPSEEK_API_KEY) {
           throw new AppError('DeepSeek API key missing', 500, ErrorCodes.INTERNAL_ERROR);
        }
        baseRequest.model = request.model || env.DEEPSEEK_MODEL_REASONING || env.OPUS_MODEL || 'deepseek-reasoner';
        return await callDeepSeek(baseRequest, { useCase });
        
      case 'grok_pulse':
        return await callGrok(baseRequest, { useCase });
        
      default:
        throw new AppError(`Unknown use-case: ${useCase}`, 400, ErrorCodes.VALIDATION_FAILED);
    }
  } finally {
      // 6. Release Concurrency
      await releaseConcurrency(userId);
  }
}
