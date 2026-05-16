import { describe, expect, it } from 'vitest';
import * as backendPrompts from '../../src/routes/reasoning/prompts';
import * as sharedPrompts from '../../../shared/contracts/reasoning-prompts';

const outputSchemaJson = JSON.stringify({
  type: 'object',
  required: ['plan_steps', 'next_action', 'confidence'],
});

describe('buildPlanningPrompt', () => {
  it('builds an RCTC planning prompt with dominance constraints', () => {
    const prompt = sharedPrompts.buildPlanningPrompt({
      type: 'refactor-planning',
      scope: 'backend/src/lib/dominance',
      referenceId: 'PLAN-2026-REF-001',
      version: '2.0',
      context: {
        current_state: 'Dominance Layer uses mixed autonomy tiers',
        constraints: ['canonical-only', 'additive-contracts'],
        success_criteria: ['deterministic output', 'backward compatible'],
        risk_gates: ['core_engine', 'ci_deploy'],
      },
      outputSchemaJson,
    });

    expect(prompt).toContain('TASK: PLAN_REFACTOR_PLANNING');
    expect(prompt).toContain('INPUT_JSON:');
    expect(prompt).toContain('OUTPUT_SCHEMA_JSON:');
    expect(prompt).toContain('PLANNING_RULES:');
    expect(prompt).toContain('DOMINANCE_LAYER_CONSTRAINTS:');
    expect(prompt).toContain('SPARKFINED_SPECIFIC:');
    expect(prompt).toContain('- Autonomy Tier: 2 (default)');
    expect(prompt).toContain('- Contracts in shared/contracts/ are additive-only');
    expect(prompt).toContain('"scope": "backend/src/lib/dominance"');
  });

  it('uses autonomy tier 1 when no risk gates are present', () => {
    const prompt = sharedPrompts.buildPlanningPrompt({
      type: 'feature-planning',
      scope: 'src/components/research',
      referenceId: 'PLAN-2026-FEAT-001',
      version: '2.0',
      context: {
        current_state: 'No implementation exists',
        constraints: ['canonical-only'],
        success_criteria: ['typed client contract'],
        risk_gates: [],
      },
      outputSchemaJson,
    });

    expect(prompt).toContain('TASK: PLAN_FEATURE_PLANNING');
    expect(prompt).toContain('- Autonomy Tier: 1 (default)');
    expect(prompt).toContain('- Risk gates trigger approval workflow: none');
  });

  it('keeps the backend mirror aligned with the canonical shared prompt builders', () => {
    const generatorInput = {
      type: 'trade-review' as const,
      referenceId: 'TRADE-1',
      version: '1.0',
      context: { symbol: 'SOL', bias: 'long' },
      outputSchemaJson,
    };
    const criticInput = {
      referenceId: 'INSIGHT-1',
      version: '1.0',
      context: { symbol: 'SOL' },
      insight: { claim: 'Momentum is improving' },
      outputSchemaJson,
    };
    const planningInput = {
      type: 'dependency-mapping' as const,
      scope: 'backend/src/routes/reasoning',
      referenceId: 'PLAN-2026-DEP-001',
      version: '2.0',
      context: {
        current_state: 'Planning route mirrors shared prompt contracts',
        constraints: ['backend-rootDir', 'canonical-shared-contract'],
        success_criteria: ['backend build passes', 'mirror drift detected by tests'],
        risk_gates: ['core_engine'],
      },
      outputSchemaJson,
    };

    expect(backendPrompts.buildGeneratorPrompt(generatorInput)).toBe(sharedPrompts.buildGeneratorPrompt(generatorInput));
    expect(backendPrompts.buildCriticPrompt(criticInput)).toBe(sharedPrompts.buildCriticPrompt(criticInput));
    expect(backendPrompts.buildPlanningPrompt(planningInput)).toBe(sharedPrompts.buildPlanningPrompt(planningInput));
  });
});
