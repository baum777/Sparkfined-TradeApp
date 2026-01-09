import { z } from 'zod';

export const routerDecisionProviderSchema = z.enum(['none', 'deepseek', 'openai', 'grok']);

export const routerOutputSchema = z
  .object({
    decision: z.object({
      provider: routerDecisionProviderSchema,
      reason: z.string().min(1).max(2000),
      // Allow router to overshoot; clamp later deterministically.
      maxTokens: z.number().int().min(16).max(32768),
    }),
    compressedPrompt: z.string().min(1).max(20000),
    mustInclude: z.array(z.string().min(1).max(2000)).default([]),
    redactions: z.array(z.string().min(1).max(2000)).default([]),
  })
  .strict();

export type RouterOutput = z.infer<typeof routerOutputSchema>;

