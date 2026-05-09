import type { LLMRequest, LLMResponse, LLMUseCase } from '../routes/reasoning/types.js';
import { getEnv } from '../config/env.js';
import { usageTracker } from '../lib/usage/usageTracker.js';
import { chatCompletionResponseSchema } from './responseSchemas.js';

function parseFirstJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Simple check for full object
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // heuristic scan
    }
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const slice = trimmed.slice(first, last + 1);
    return JSON.parse(slice);
  }

  throw new Error('No JSON object found in Grok output');
}

export async function callGrok(request: LLMRequest, context?: { useCase: LLMUseCase }): Promise<LLMResponse> {
  const env = getEnv();
  const apiKey = env.GROK_API_KEY;
  const start = Date.now();
  
  if (!apiKey) {
    throw new Error('MISSING_GROK_KEY');
  }

  const baseUrl = env.GROK_BASE_URL || 'https://api.x.ai/v1';
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const messages = [
      { role: 'system', content: request.system || 'You are a helpful assistant.' },
      { role: 'user', content: request.prompt },
    ];

    // Force strict JSON in system prompt if requested
    if (request.jsonOnly && !messages[0].content.includes('JSON')) {
       messages[0].content += ' You must return valid JSON.';
    }

    const body: any = {
      model: request.model || 'grok-beta',
      temperature: 0,
      messages,
      stream: false
    };

    if (request.jsonOnly) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      const error = new Error(`Grok upstream error (${res.status})`);
      (error as any).status = res.status;
      (error as any).body = text;
      throw error;
    }

    const parsedResponse = chatCompletionResponseSchema.safeParse(JSON.parse(text));
    if (!parsedResponse.success) {
      throw new Error('Invalid Grok response schema');
    }
    const json = parsedResponse.data;
    const rawText = json.choices[0]?.message?.content;

    let parsed: unknown;
    if (request.jsonOnly) {
      parsed = parseFirstJsonObject(rawText);
    }

    if (context) {
        const end = Date.now();
        await usageTracker.recordCall('grok', context.useCase, end);
        await usageTracker.recordLatency('grok', context.useCase, end - start, end);
        
        const usage = json.usage;
        if (usage) {
             await usageTracker.recordTokens(
               'grok',
               context.useCase,
               usage.prompt_tokens ?? null,
               usage.completion_tokens ?? null,
               end
             );
        } else {
             await usageTracker.recordTokens('grok', context.useCase, null, null, end);
        }
    }

    return {
      model: body.model,
      rawText,
      parsed,
    };
  } catch (error) {
    if (context) {
        await usageTracker.recordError('grok', context.useCase, Date.now());
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
