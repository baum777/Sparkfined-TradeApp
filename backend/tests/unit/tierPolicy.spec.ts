import { describe, it, expect } from 'vitest';
import { enforcePermissions, getTierSettings } from '../../src/lib/llm/tierPolicy';

describe('LLM Tier Policy', () => {
  it('clamps maxTokens to tier final_max_tokens (and to constraints.maxFinalTokens)', () => {
    const std = getTierSettings('standard');
    expect(std.finalMaxTokens).toBe(1400);

    const r1 = enforcePermissions({
      tier: 'standard',
      taskKind: 'general',
      routerDecision: { provider: 'openai', templateId: 'GENERAL', maxTokens: 99999 },
      compressedPrompt: 'X',
      mustInclude: [],
      constraints: { maxFinalTokens: undefined },
    });
    expect(r1.maxTokens).toBe(1400);

    const r2 = enforcePermissions({
      tier: 'standard',
      taskKind: 'general',
      routerDecision: { provider: 'openai', templateId: 'GENERAL', maxTokens: 99999 },
      compressedPrompt: 'X',
      mustInclude: [],
      constraints: { maxFinalTokens: 300 },
    });
    expect(r2.maxTokens).toBe(300);
  });

  it('free tier downgrades advanced chart tasks to chart_teaser_free', () => {
    const r = enforcePermissions({
      tier: 'free',
      taskKind: 'chart_analysis',
      routerDecision: { provider: 'openai', templateId: 'CHART_SETUPS', maxTokens: 600 },
      compressedPrompt: 'analyze chart deeply',
      mustInclude: [],
      constraints: {},
    });
    expect(r.taskKindApplied).toBe('chart_teaser_free');
    expect(r.templateId).toBe('CHART_TEASER_FREE');
    expect(r.provider).toBe('openai');
  });

  it('free tier teaser enforces S/R + stoploss-only constraints', () => {
    const r = enforcePermissions({
      tier: 'free',
      taskKind: 'chart_teaser',
      routerDecision: { provider: 'openai', templateId: 'CHART_TEASER_FREE', maxTokens: 600 },
      compressedPrompt: 'user asked for chart levels',
      mustInclude: [],
      constraints: {},
    });

    expect(r.provider).toBe('openai');
    expect(r.templateId).toBe('CHART_TEASER_FREE');
    expect(r.compressedPrompt).toContain('CHART_TEASER_FREE_CONSTRAINTS');
    expect(r.mustInclude.join('\n')).toContain('Support: ...');
    expect(r.mustInclude.join('\n')).toContain('Resistance: ...');
    expect(r.mustInclude.join('\n')).toContain('Stop-loss: ...');
    expect(r.mustInclude.join('\n')).toContain('Invalidation: ...');
    expect(r.mustInclude.join('\n')).toContain('Risk: ...');
  });

  it('free tier only allows Grok for sentiment_alpha and keeps it short', () => {
    const bad = enforcePermissions({
      tier: 'free',
      taskKind: 'general',
      routerDecision: { provider: 'grok', templateId: 'GENERAL', maxTokens: 600 },
      compressedPrompt: 'general question',
      mustInclude: [],
      constraints: {},
    });
    expect(bad.provider).toBe('deepseek');

    const ok = enforcePermissions({
      tier: 'free',
      taskKind: 'sentiment_alpha',
      routerDecision: { provider: 'grok', templateId: 'GENERAL', maxTokens: 600 },
      compressedPrompt: 'X sentiment',
      mustInclude: [],
      constraints: {},
    });
    expect(ok.provider).toBe('grok');
    expect(ok.maxTokens).toBeLessThanOrEqual(200);
  });
});

