import { z } from 'zod';

// FROZEN: Router decision output (DeepSeek R1) must match the Prompt Logic Spec.
export const routerDecisionProviderSchema = z.enum(['deepseek', 'openai', 'grok']);

export const routerOutputSchema = z
  .object({
    provider: routerDecisionProviderSchema,
    templateId: z.string().min(1).max(200),
    // Allow router to overshoot; clamp later deterministically.
    maxTokens: z.number().int().min(16).max(32768),
    compressedPrompt: z.string().min(1).max(20000),
    mustInclude: z.array(z.string().min(1).max(2000)).default([]),
    redactions: z.array(z.string().min(1).max(2000)).default([]),
  })
  .strict();

export type RouterOutput = z.infer<typeof routerOutputSchema>;

