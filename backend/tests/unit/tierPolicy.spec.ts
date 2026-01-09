import { describe, it, expect } from 'vitest';
import { enforcePermissions, getTierSettings } from '../../src/lib/llm/tierPolicy';

describe('LLM Tier Policy', () => {
  it('clamps maxTokens to tier final_max_tokens (and to constraints.maxFinalTokens)', () => {
    const std = getTierSettings('standard');
    expect(std.finalMaxTokens).toBe(1400);

    const r1 = enforcePermissions({
      tier: 'standard',
      taskKind: 'general',
      routerDecision: { provider: 'openai', reason: 'test', maxTokens: 99999 },
      compressedPrompt: 'X',
      mustInclude: [],
      constraints: { maxFinalTokens: undefined },
    });
    expect(r1.decision.maxTokens).toBe(1400);

    const r2 = enforcePermissions({
      tier: 'standard',
      taskKind: 'general',
      routerDecision: { provider: 'openai', reason: 'test', maxTokens: 99999 },
      compressedPrompt: 'X',
      mustInclude: [],
      constraints: { maxFinalTokens: 300 },
    });
    expect(r2.decision.maxTokens).toBe(300);
  });

  it('free tier overrides OpenAI to DeepSeek for non-teaser tasks', () => {
    const r = enforcePermissions({
      tier: 'free',
      taskKind: 'chart_analysis',
      routerDecision: { provider: 'openai', reason: 'router_wants_openai', maxTokens: 600 },
      compressedPrompt: 'analyze chart deeply',
      mustInclude: [],
      constraints: {},
    });
    expect(r.decision.provider).toBe('deepseek');
    expect(r.decision.reason).toContain('permission_override');
  });

  it('free tier teaser enforces S/R + stoploss-only constraints', () => {
    const r = enforcePermissions({
      tier: 'free',
      taskKind: 'chart_teaser',
      routerDecision: { provider: 'openai', reason: 'ok', maxTokens: 600 },
      compressedPrompt: 'user asked for chart levels',
      mustInclude: [],
      constraints: {},
    });

    expect(r.decision.provider).toBe('openai');
    expect(r.compressedPrompt).toContain('TEASER_OUTPUT_CONSTRAINTS');
    expect(r.mustInclude.join('\n')).toContain('Support(s)');
    expect(r.mustInclude.join('\n')).toContain('Resistance(s)');
    expect(r.mustInclude.join('\n')).toContain('Suggested stop-loss level');
    expect(r.mustInclude.join('\n')).toContain('One-line risk note');
  });

  it('free tier only allows Grok for sentiment_alpha and keeps it short', () => {
    const bad = enforcePermissions({
      tier: 'free',
      taskKind: 'general',
      routerDecision: { provider: 'grok', reason: 'router_wants_grok', maxTokens: 600 },
      compressedPrompt: 'general question',
      mustInclude: [],
      constraints: {},
    });
    expect(bad.decision.provider).toBe('deepseek');

    const ok = enforcePermissions({
      tier: 'free',
      taskKind: 'sentiment_alpha',
      routerDecision: { provider: 'grok', reason: 'router_wants_grok', maxTokens: 600 },
      compressedPrompt: 'X sentiment',
      mustInclude: [],
      constraints: {},
    });
    expect(ok.decision.provider).toBe('grok');
    expect(ok.decision.maxTokens).toBeLessThanOrEqual(200);
  });
});

