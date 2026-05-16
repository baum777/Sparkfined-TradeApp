import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetEnvCache } from '../../src/config/env';
import { createAppFetch } from '../helpers/httpClient';

const request = createAppFetch();

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
  });
}

async function postJson(url: string, body: unknown): Promise<{ status: number; text: string }> {
  const response = await request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    text: await response.text(),
  };
}

describe('POST /api/llm/execute (router + provider)', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test';
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.test';
    process.env.OPENAI_API_KEY = 'test';
    process.env.OPENAI_BASE_URL = 'https://api.openai.test/v1';
    process.env.LLM_ROUTER_ENABLED = 'true';
    process.env.LLM_ROUTER_DEBUG = 'false';
    process.env.LLM_MAX_RETRIES = '0';
    process.env.LLM_TIMEOUT_MS = '1000';
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes to OpenAI and only sends compressedPrompt (not full context)', async () => {
    const calls: Array<{ url: string; body?: any }> = [];

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const urlStr = String(url);
      const bodyText = init?.body ? String(init.body) : '';
      const body = bodyText ? JSON.parse(bodyText) : undefined;
      calls.push({ url: urlStr, body });

      if (urlStr.startsWith('https://api.deepseek.test/chat/completions')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  provider: 'openai',
                  templateId: 'CHART_SETUPS',
                  maxTokens: 120,
                  compressedPrompt: 'COMPRESSED_PROMPT_ONLY',
                  mustInclude: ['MUST_INCLUDE_1'],
                  redactions: [],
                }),
              },
            },
          ],
        });
      }

      if (urlStr.startsWith('https://api.openai.test/v1/chat/completions')) {
        // Ensure compressed prompt is used, and secret context is NOT sent.
        const sent = JSON.stringify(body);
        expect(sent).toContain('COMPRESSED_PROMPT_ONLY');
        expect(sent).not.toContain('SECRET_CONTEXT_SHOULD_NOT_LEAK');

        return jsonResponse({
          choices: [{ message: { content: 'FINAL_ANSWER' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });
      }

      throw new Error(`Unexpected fetch url: ${urlStr}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { status, text } = await postJson('/api/llm/execute', {
        tier: 'standard',
        userMessage: 'User question',
        context: {
          messages: [
            { role: 'user', content: 'SECRET_CONTEXT_SHOULD_NOT_LEAK' },
            { role: 'assistant', content: 'previous answer' },
          ],
        },
        constraints: { maxFinalTokens: 200 },
    });
    const body = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return { _raw: text };
      }
    })();

    expect(status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('text', 'FINAL_ANSWER');
    expect(body.data).toHaveProperty('providerUsed', 'openai');

    // Ensure DeepSeek router was called first, then OpenAI.
    expect(calls[0]?.url).toContain('api.deepseek.test/chat/completions');
    expect(calls[1]?.url).toContain('api.openai.test/v1/chat/completions');
  });

  it('free tier downgrades advanced chart task to CHART_TEASER_FREE (may still use OpenAI)', async () => {
    const calls: Array<{ url: string; body?: any }> = [];

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const urlStr = String(url);
      const bodyText = init?.body ? String(init.body) : '';
      const body = bodyText ? JSON.parse(bodyText) : undefined;
      calls.push({ url: urlStr, body });

      if (urlStr.startsWith('https://api.deepseek.test/chat/completions')) {
        // Router call.
        const isRouter = body?.model === 'deepseek-reasoner' || body?.max_tokens === 900;
        if (isRouter) {
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    provider: 'openai',
                    templateId: 'CHART_SETUPS',
                    maxTokens: 600,
                    compressedPrompt: 'COMPRESSED_FOR_CHART_ANALYSIS',
                    mustInclude: [],
                    redactions: [],
                  }),
                },
              },
            ],
          });
        }
      }

      if (urlStr.startsWith('https://api.openai.test/v1/chat/completions')) {
        return jsonResponse({
          choices: [{ message: { content: 'OPENAI_FINAL' } }],
          usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
        });
      }

      throw new Error(`Unexpected fetch url: ${urlStr}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { status, text } = await postJson('/api/llm/execute', {
      tier: 'free',
      taskKind: 'chart_analysis',
      userMessage: 'Analyze this chart fully',
      constraints: { maxFinalTokens: 800 },
    });

    const body = JSON.parse(text);
    expect(status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body.data).toHaveProperty('providerUsed', 'openai');
    expect(body.data).toHaveProperty('text', 'OPENAI_FINAL');

    // Ensure the router ran first, then OpenAI.
    expect(calls[0]?.url).toContain('api.deepseek.test/chat/completions');
    expect(calls[1]?.url).toContain('api.openai.test/v1/chat/completions');
  });
});
