import { describe, expect, it } from 'vitest';
import { chatCompletionResponseSchema } from '../../src/clients/responseSchemas.js';

describe('chatCompletionResponseSchema', () => {
  it('accepts valid chat completion payload', () => {
    const payload = {
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 8,
        total_tokens: 20,
      },
    };

    const parsed = chatCompletionResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects payload without choices', () => {
    const payload = { usage: { prompt_tokens: 1 } };
    const parsed = chatCompletionResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('rejects payload with empty message content', () => {
    const payload = {
      choices: [{ message: { content: '' } }],
    };
    const parsed = chatCompletionResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});
