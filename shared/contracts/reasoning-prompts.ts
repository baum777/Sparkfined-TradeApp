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
