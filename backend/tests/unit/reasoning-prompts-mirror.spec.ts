import { describe, expect, it } from 'vitest';
import {
  buildCriticPrompt as buildBackendCriticPrompt,
  buildGeneratorPrompt as buildBackendGeneratorPrompt,
} from '../../src/routes/reasoning/prompts';
import {
  buildCriticPrompt as buildSharedCriticPrompt,
  buildGeneratorPrompt as buildSharedGeneratorPrompt,
} from '../../../shared/contracts/reasoning-prompts';

describe('reasoning prompts backend mirror', () => {
  it('matches shared buildGeneratorPrompt output', () => {
    const input = {
      type: 'trade-review' as const,
      referenceId: 'ref-1',
      version: 'v1',
      context: { symbol: 'SOL', risk: 'low' },
      outputSchemaJson: '{"type":"object"}',
    };

    expect(buildBackendGeneratorPrompt(input)).toBe(buildSharedGeneratorPrompt(input));
  });

  it('matches shared buildCriticPrompt output', () => {
    const input = {
      referenceId: 'ref-1',
      version: 'v1',
      context: { symbol: 'SOL', risk: 'low' },
      insight: { summary: 'ok' },
      outputSchemaJson: '{"type":"object"}',
    };

    expect(buildBackendCriticPrompt(input)).toBe(buildSharedCriticPrompt(input));
  });
});
