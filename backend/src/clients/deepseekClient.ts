import { getEnv } from '../config/env.js';
import type { LLMRequest, LLMResponse, LLMUseCase } from '../routes/reasoning/types.js';
import { usageTracker } from '../lib/usage/usageTracker.js';
import { chatCompletionResponseSchema } from './responseSchemas.js';

function parseFirstJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const slice = trimmed.slice(first, last + 1);
    return JSON.parse(slice);
  }

  throw new Error('No JSON object found in model output');
}

export async function callDeepSeek(request: LLMRequest, context?: { useCase: LLMUseCase }): Promise<LLMResponse> {
  const env = getEnv();
  const start = Date.now();

  if (!env.DEEPSEEK_API_KEY) {
    throw new Error('MISSING_DEEPSEEK_KEY');
  }

  const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const messages = [
      { role: 'system', content: request.system || 'You are a helpful assistant.' },
      { role: 'user', content: request.prompt },
    ];

    const body: any = {
      model: request.model,
      temperature: 0,
      messages,
    };

    if (request.jsonOnly) {
      body.response_format = { type: 'json_object' };
      if (!request.system?.includes('JSON')) {
        messages[0].content += ' You must return valid JSON.';
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      const error = new Error(`DeepSeek upstream error (${res.status})`);
      (error as any).status = res.status;
      (error as any).body = text;
      throw error;
    }

    const parsedResponse = chatCompletionResponseSchema.safeParse(JSON.parse(text));
    if (!parsedResponse.success) {
      throw new Error('Invalid DeepSeek response schema');
    }
    const json = parsedResponse.data;
    const rawText = json.choices[0]?.message?.content;

    let parsed: unknown;
    if (request.jsonOnly) {
      parsed = parseFirstJsonObject(rawText);
    }

    if (context) {
        const end = Date.now();
        await usageTracker.recordCall('deepseek', context.useCase, end);
        await usageTracker.recordLatency('deepseek', context.useCase, end - start, end);
        
        const usage = json.usage;
        if (usage) {
             await usageTracker.recordTokens(
               'deepseek',
               context.useCase,
               usage.prompt_tokens ?? null,
               usage.completion_tokens ?? null,
               end
             );
        } else {
             await usageTracker.recordTokens('deepseek', context.useCase, null, null, end);
        }
    }

    return {
      model: request.model,
      rawText,
      parsed,
    };
  } catch (error) {
    if (context) {
        await usageTracker.recordError('deepseek', context.useCase, Date.now());
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
