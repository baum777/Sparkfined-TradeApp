import { getEnv } from '../../../config/env.js';
import { fetchJson, FetchJsonError } from '../../http/fetchJson.js';
import { withRetry } from '../../http/retry.js';
import type { ProviderCallOptions, ProviderResult } from '../types.js';

type GrokChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export async function callGrok(options: ProviderCallOptions): Promise<ProviderResult> {
  const env = getEnv();
  if (!env.GROK_API_KEY) {
    const err = new FetchJsonError('Grok API key missing');
    (err as any).status = 500;
    throw err;
  }

  const baseUrl = (env.GROK_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  const started = Date.now();

  const result = await withRetry(
    async () => {
      const res = await fetchJson<GrokChatCompletionResponse>(url, {
        method: 'POST',
        timeoutMs: options.timeoutMs,
        headers: {
          Authorization: `Bearer ${env.GROK_API_KEY}`,
          'x-request-id': options.requestId,
        },
        body: {
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0,
          max_tokens: options.maxTokens,
          stream: false,
          ...(options.jsonOnly ? { response_format: { type: 'json_object' } } : {}),
        },
      });

      if (!res.ok) {
        const err = new FetchJsonError(`Grok upstream error (${res.status})`, {
          status: res.status,
          bodyText: res.text,
          responseHeaders: res.headers,
        });
        (err as any).status = res.status;
        (err as any).body = res.text;
        throw err;
      }

      const text = res.json?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim().length === 0) {
        const err = new FetchJsonError('Grok response missing message.content', {
          status: res.status,
          bodyText: res.text,
          responseHeaders: res.headers,
        });
        (err as any).status = 502;
        throw err;
      }

      return { res, text };
    },
    {
      maxRetries: env.LLM_MAX_RETRIES,
      baseDelayMs: 250,
      maxDelayMs: 2000,
    },
    {
      getRetryAfterHint: (err) => {
        const headers = (err as any)?.responseHeaders as Headers | undefined;
        const retryAfterHeader = headers?.get('retry-after') ?? null;
        return { retryAfterHeader };
      },
    }
  );

  const latencyMs = Date.now() - started;

  return {
    provider: 'grok',
    requestId: options.requestId,
    model: options.model,
    text: result.text,
    latencyMs,
    usage: result.res.json?.usage
      ? {
          promptTokens: result.res.json.usage.prompt_tokens,
          completionTokens: result.res.json.usage.completion_tokens,
          totalTokens: result.res.json.usage.total_tokens,
        }
      : undefined,
  };
}

