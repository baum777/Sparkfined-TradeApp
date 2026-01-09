import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
import { resetEnvCache } from '../../src/config/env';
import { request as httpRequest } from 'http';

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
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: {
          'content-type': 'application/json',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') });
        });
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

describe('POST /api/llm/execute (router + provider)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = createServer((req, res) => app.handle(req, res));

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

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
                  decision: { provider: 'openai', reason: 'needs quality', maxTokens: 120 },
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

    const { status, text } = await postJson(`${baseUrl}/api/llm/execute`, {
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
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('text', 'FINAL_ANSWER');
    expect(body.data).toHaveProperty('provider', 'openai');

    // Ensure DeepSeek router was called first, then OpenAI.
    expect(calls[0]?.url).toContain('api.deepseek.test/chat/completions');
    expect(calls[1]?.url).toContain('api.openai.test/v1/chat/completions');
  });
});

