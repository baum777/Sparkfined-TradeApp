import type {
  BoardScenariosInsight,
  InsightCriticOnlyResult,
  JsonObject,
  ReasoningType,
  SessionReviewInsight,
  TradeReviewInsight,
} from './types.js';
import { sha256Hex } from './hash.js';

function hashSeed(parts: string[]): number {
  const hex = sha256Hex(parts.join('|'));
  return parseInt(hex.slice(0, 8), 16) >>> 0;
}

function pick<T>(arr: T[], seed: number, idx: number): T {
  return arr[(seed + idx) % arr.length] as T;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function baseCritic(seed: number) {
  const issueKinds = ['missing_data', 'overreach', 'contradiction'] as const;
  const hasIssues = seed % 3 !== 0;
  const issues = hasIssues
    ? [
        {
          kind: pick([...issueKinds], seed, 0),
          message: 'Input lacks at least one concrete datapoint to fully justify the claim.',
          fields: ['context'],
        },
      ]
    : [];

  const adjustedConfidence = hasIssues ? clamp01(0.55 + ((seed % 20) / 100)) : clamp01(0.75 + ((seed % 20) / 100));
  const notes = hasIssues ? ['Confidence reduced due to insufficient evidence.'] : [];

  return { issues, adjustedConfidence, notes };
}

export function deterministicGenerate(
  type: Exclude<ReasoningType, 'insight-critic' | 'planning'>,
  input: {
    referenceId: string;
    version: string;
    context: JsonObject;
  }
): TradeReviewInsight | SessionReviewInsight | BoardScenariosInsight {
  const seed = hashSeed([type, input.referenceId, input.version, JSON.stringify(Object.keys(input.context).sort())]);

  if (type === 'trade-review') {
    const verdicts = ['GOOD_PROCESS', 'MIXED', 'BAD_PROCESS'] as const;
    const verdict = pick([...verdicts], seed, 0);
    const critic = baseCritic(seed);
    return {
      type: 'trade-review',
      referenceId: input.referenceId,
      verdict,
      decision: {
        shouldRepeat: verdict !== 'BAD_PROCESS',
        reason: verdict === 'GOOD_PROCESS' ? 'Process looks repeatable with current evidence.' : 'Repeat only after addressing the top risk below.',
      },
      highlights: ['Clear entry trigger stated.', 'Risk rule mentioned.'],
      risks: [
        {
          label: 'Risk definition unclear',
          severity: verdict === 'GOOD_PROCESS' ? 'low' : 'medium',
          evidence: ['Stop / invalidation not explicit in input context.'],
        },
      ],
      fixes: [
        { action: 'Write a single-sentence invalidation rule before entry.', why: 'Prevents hindsight bias and reduces impulsive exits.' },
      ],
      questions: ['What was the invalidation level and why?'],
      critic,
    };
  }

  if (type === 'session-review') {
    const critic = baseCritic(seed);
    return {
      type: 'session-review',
      referenceId: input.referenceId,
      summary: 'Session summary is based on limited input; treat as provisional.',
      decisions: [
        { decision: 'Reduce trade frequency next session', rationale: 'Evidence suggests execution quality degrades when switching contexts.' },
      ],
      patterns: [
        { pattern: 'Late entries after initial move', evidence: ['Repeated chasing behavior implied by notes/time stamps.'] },
      ],
      nextSessionPlan: [
        { action: 'Only take setups from a pre-defined checklist', trigger: 'Before placing any order' },
      ],
      critic,
    };
  }

  const critic = baseCritic(seed);
  return {
    type: 'board-scenarios',
    referenceId: input.referenceId,
    scenarios: [
      {
        name: 'Base case continuation',
        probability: clamp01(0.45 + ((seed % 10) / 100)),
        triggers: ['Price holds above last support', 'No major news shock'],
        plan: {
          actions: ['Wait for pullback confirmation', 'Size to max risk rule'],
          invalidation: 'Close below defined support',
          riskRule: 'Max loss per attempt capped; stop on invalidation.',
        },
      },
      {
        name: 'Reversal against position',
        probability: clamp01(0.25 + (((seed >> 3) % 10) / 100)),
        triggers: ['Break of support with volume', 'Failed reclaim'],
        plan: {
          actions: ['Exit on invalidation', 'Avoid immediate re-entry'],
          invalidation: 'Reclaim and hold above broken level',
          riskRule: 'No revenge trades; wait 1 setup cycle.',
        },
      },
    ],
    critic,
  };
}

export function deterministicCritic(input: {
  referenceId: string;
  version: string;
  context: JsonObject;
  insight: JsonObject;
}): InsightCriticOnlyResult {
  const seed = hashSeed(['insight-critic', input.referenceId, input.version, JSON.stringify(Object.keys(input.context).sort())]);
  const report = baseCritic(seed);
  void input.insight;
  return {
    type: 'insight-critic',
    referenceId: input.referenceId,
    report,
  };
}

