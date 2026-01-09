import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routeAndCompress } from '../../src/lib/llm/router/router';
import { resetEnvCache } from '../../src/config/env';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('LLM Reasoning Router (DeepSeek) - unit', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test';
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.test';
    process.env.LLM_MAX_RETRIES = '0';
    process.env.LLM_TIMEOUT_MS = '1000';
    process.env.LLM_TIER_DEFAULT = 'standard';
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates and clamps maxTokens to constraints.maxFinalTokens', async () => {
    const fetchMock = vi.fn(async () => {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: { provider: 'openai', reason: 'needs quality', maxTokens: 5000 },
                compressedPrompt: 'Do the thing.',
                mustInclude: ['A'],
                redactions: [],
              }),
            },
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await routeAndCompress(
      {
        mode: 'route_compress',
        tier: 'standard',
        taskKind: 'general',
        userMessage: 'Hello',
        constraints: { maxFinalTokens: 900 },
      },
      'req-1'
    );

    expect(out.requestId).toBe('req-1');
    expect(out.decision.provider).toBe('openai');
    expect(out.decision.maxTokens).toBe(900);
    expect(out.compressedPrompt).toBe('Do the thing.');
  });

  it('falls back deterministically when DeepSeek output is invalid', async () => {
    const fetchMock = vi.fn(async () => {
      return jsonResponse({
        choices: [{ message: { content: 'not json' } }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await routeAndCompress(
      {
        mode: 'route_compress',
        tier: 'standard',
        taskKind: 'general',
        userMessage: 'Write a plan',
      },
      'req-2'
    );

    expect(out.requestId).toBe('req-2');
    expect(out.decision.provider).toBe('deepseek');
    expect(out.decision.reason).toBe('router_fallback');
    expect(typeof out.compressedPrompt).toBe('string');
  });

  it('redacts obvious secrets from router-returned compressedPrompt', async () => {
    const fetchMock = vi.fn(async () => {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: { provider: 'none', reason: 'cheap', maxTokens: 200 },
                compressedPrompt: 'Authorization: Bearer sk-THIS_SHOULD_NOT_LEAK',
                mustInclude: [],
                redactions: ['Authorization header'],
              }),
            },
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await routeAndCompress(
      {
        mode: 'route_compress',
        userMessage: 'test',
      },
      'req-3'
    );

    expect(out.compressedPrompt).not.toContain('sk-THIS_SHOULD_NOT_LEAK');
    expect(out.compressedPrompt).toContain('[REDACTED]');
  });
});

