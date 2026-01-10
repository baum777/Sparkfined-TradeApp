import { getEnv } from '../../../config/env.js';
import { fetchJson, FetchJsonError } from '../../http/fetchJson.js';
import { withRetry } from '../../http/retry.js';
import type { ProviderCallOptions, ProviderResult } from '../types.js';

type DeepSeekChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export async function callDeepSeek(options: ProviderCallOptions): Promise<ProviderResult> {
  const env = getEnv();
  if (!env.DEEPSEEK_API_KEY) {
    const err = new FetchJsonError('DeepSeek API key missing');
    (err as any).status = 500;
    throw err;
  }

  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  const started = Date.now();

  const result = await withRetry(
    async () => {
      const res = await fetchJson<DeepSeekChatCompletionResponse>(url, {
        method: 'POST',
        timeoutMs: options.timeoutMs,
        headers: {
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
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
        const err = new FetchJsonError(`DeepSeek upstream error (${res.status})`, {
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
        const err = new FetchJsonError('DeepSeek response missing message.content', {
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
      maxRetries: options.maxRetries ?? env.LLM_MAX_RETRIES,
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
    provider: 'deepseek',
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

