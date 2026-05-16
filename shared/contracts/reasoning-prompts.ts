/**
 * Reasoning Prompts — Single Source of Truth
 * Owner: Reasoning Team
 * Status: active
 * Version: 1.0
 * LastUpdated: 2026-02-27
 * Canonical: true
 *
 * RCTC-Compliant Prompts for the Reasoning Layer
 * - Task: GENERATE_* or INSIGHT_CRITIC
 * - Rules: Output must be strict JSON only
 * - Context: INPUT_JSON with reference data
 * - Constraints: Schema-validated outputs
 *
 * This file is the canonical source. Both backend/ and api/
 * should import from here, not duplicate content.
 */

export type JsonObject = Record<string, unknown>;
export type ReasoningType = 'trade-review' | 'session-review' | 'board-scenarios' | 'insight-critic';
export type PlanningType =
  | 'feature-planning'
  | 'refactor-planning'
  | 'risk-assessment'
  | 'dependency-mapping';

export interface PlanningPromptInput {
  type: PlanningType;
  scope: string;
  referenceId: string;
  version: string;
  context: {
    current_state: string;
    constraints: string[];
    success_criteria: string[];
    risk_gates: string[];
  };
  outputSchemaJson: string;
}

function rulesBlock(): string {
  return [
    'RULES:',
    '- Output MUST be a single JSON object and nothing else (no markdown, no prose).',
    '- Use ONLY the fields defined by OUTPUT_SCHEMA_JSON.',
    '- If data is missing, state it via critic issues and reduce confidence; do NOT invent numbers.',
    '- Keep strings short and decision-oriented.',
  ].join('\n');
}

export function buildGeneratorPrompt(input: {
  type: Exclude<ReasoningType, 'insight-critic'>;
  referenceId: string;
  version: string;
  context: JsonObject;
  outputSchemaJson: string;
}): string {
  return [
    `TASK: GENERATE_${input.type.toUpperCase().replace(/-/g, '_')}`,
    '',
    'INPUT_JSON:',
    JSON.stringify(
      {
        type: input.type,
        referenceId: input.referenceId,
        version: input.version,
        context: input.context,
      },
      null,
      2
    ),
    '',
    'OUTPUT_SCHEMA_JSON:',
    input.outputSchemaJson,
    '',
    rulesBlock(),
  ].join('\n');
}

export function buildCriticPrompt(input: {
  referenceId: string;
  version: string;
  context: JsonObject;
  insight: JsonObject;
  outputSchemaJson: string;
}): string {
  return [
    'TASK: INSIGHT_CRITIC',
    '',
    'INPUT_JSON:',
    JSON.stringify(
      {
        referenceId: input.referenceId,
        version: input.version,
        context: input.context,
        insight: input.insight,
      },
      null,
      2
    ),
    '',
    'OUTPUT_SCHEMA_JSON:',
    input.outputSchemaJson,
    '',
    'CRITIC_RULES:',
    '- Identify contradictions between insight parts and input context.',
    '- Identify missing input data required to justify claims.',
    '- Mark overreach (claims not supported by input).',
    '- Adjust confidence DOWN when issues exist; NEVER increase above 1.',
    '- Output must be strict JSON only.',
  ].join('\n');
}

export function buildPlanningPrompt(input: PlanningPromptInput): string {
  const riskGates = input.context.risk_gates.length > 0 ? input.context.risk_gates.join(', ') : 'none';

  return [
    `TASK: PLAN_${input.type.toUpperCase().replace(/-/g, '_')}`,
    '',
    'INPUT_JSON:',
    JSON.stringify(
      {
        scope: input.scope,
        referenceId: input.referenceId,
        version: input.version,
        context: input.context,
      },
      null,
      2
    ),
    '',
    'OUTPUT_SCHEMA_JSON:',
    input.outputSchemaJson,
    '',
    'PLANNING_RULES:',
    '- Output MUST be strict JSON only (no markdown, no prose).',
    '- Structure: { plan_steps: [], risks: [], gates: [], next_action: string }',
    '- Each step: { id, action, owner_tier, estimated_effort, validation_gate }',
    '- Risks: classify as [p0_blocking, p1_review, p2_optional].',
    '- Never invent data; mark unknowns via "requires_human_review" flag.',
    '- Respect canonical boundaries: backend/ > shared/contracts/ > api/.',
    '',
    'DOMINANCE_LAYER_CONSTRAINTS:',
    `- Autonomy Tier: ${input.context.risk_gates.length > 0 ? '2' : '1'} (default)`,
    '- Golden Tasks required before merge: lint, tsc, build, test:backend',
    `- Risk gates trigger approval workflow: ${riskGates}`,
    '',
    'SPARKFINED_SPECIFIC:',
    '- Contracts in shared/contracts/ are additive-only',
    '- HTTP boundary is JSON, not TS imports',
    '- No prompt duplication: import from canonical source only',
  ].join('\n');
}
