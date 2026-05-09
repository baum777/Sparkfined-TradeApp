import { describe, expect, it } from 'vitest';
import {
  averageMetrics,
  estimateTokens,
  updateFunctionWikiFrontmatter,
} from '../../tools/fn-profile';

describe('fn-profile helpers', () => {
  it('estimates tokens from prompt characters using the documented chars/4 heuristic', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('averages latency, estimated tokens, and heap deltas with integer rounding', () => {
    const result = averageMetrics([
      { latencyMs: 1.2, tokensEst: 101, heapDeltaBytes: 10 },
      { latencyMs: 2.8, tokensEst: 103, heapDeltaBytes: 20 },
    ]);

    expect(result).toEqual({
      avgLatencyMs: 2,
      avgTokensEst: 102,
      heapDeltaAvg: 15,
    });
  });

  it('updates only the expected buildGeneratorPrompt frontmatter metrics', () => {
    const original = [
      '---',
      'id: buildGeneratorPrompt',
      'updated: 2026-05-01',
      'perf:',
      '  avg_latency_ms: null',
      '  avg_tokens_est: null',
      '  cache_hit_rate: 0.0',
      '---',
      '',
      '# buildGeneratorPrompt',
    ].join('\n');

    const updated = updateFunctionWikiFrontmatter(original, {
      avgLatencyMs: 3,
      avgTokensEst: 456,
      updated: '2026-05-09',
    });

    expect(updated).toContain('updated: 2026-05-09');
    expect(updated).toContain('  avg_latency_ms: 3');
    expect(updated).toContain('  avg_tokens_est: 456');
    expect(updated).toContain('  cache_hit_rate: 0.0');
  });
});
