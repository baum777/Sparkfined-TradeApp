import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routeLLMRequest } from '../../_lib/reasoning/llmRouter';
import { resetEnvCache } from '../../_lib/env';

// Mock fetch globally
global.fetch = vi.fn();

describe('LLM Router Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    resetEnvCache();
    process.env = { ...originalEnv };
    (global.fetch as any).mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should route "journal" to OpenAI', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    // Mock successful OpenAI response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ note: 'test' }) } }]
      }),
    });

    const result = await routeLLMRequest('journal', {
      prompt: 'test prompt',
      timeoutMs: 1000,
      jsonOnly: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.openai.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openai-key',
        }),
      })
    );
    expect(result.rawText).toContain('test');
  });

  it('should route "reasoning" to DeepSeek', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    
    // Mock successful DeepSeek response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ insight: 'deep' }) } }]
      }),
    });

    await routeLLMRequest('reasoning', {
      prompt: 'think hard',
      timeoutMs: 1000,
      jsonOnly: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.deepseek.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-deepseek-key',
        }),
      })
    );
  });

  it('should throw MISSING_DEEPSEEK_KEY if reasoning called without key', async () => {
    process.env.DEEPSEEK_API_KEY = ''; // ensure empty
    
    await expect(routeLLMRequest('reasoning', {
      prompt: 'think',
      timeoutMs: 1000,
    })).rejects.toThrow('DeepSeek API key missing');
  });

  it('should throw for Grok Pulse (not implemented)', async () => {
    await expect(routeLLMRequest('grok_pulse', {
      prompt: 'pulse',
      timeoutMs: 1000,
    })).rejects.toThrow('MISSING_GROK_KEY');
  });
});

