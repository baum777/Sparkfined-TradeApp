import type { ChartFeaturePack } from '../solChart/types.js';
import type { AnalysisTier, SolAnalysisTaskKind } from './schema.js';

export function templateIdForTaskKind(taskKind: SolAnalysisTaskKind): string {
  switch (taskKind) {
    case 'chart_teaser_free':
      return 'CHART_TEASER_FREE';
    case 'chart_setups':
      return 'CHART_SETUPS';
    case 'chart_patterns_validate':
      return 'CHART_PATTERNS_VALIDATE';
    case 'chart_confluence_onchain':
      return 'CHART_CONFLUENCE_ONCHAIN';
    case 'chart_microstructure':
      return 'CHART_MICROSTRUCTURE';
    case 'journal_teaser_free':
      return 'JOURNAL_TEASER_FREE';
    case 'journal_review':
      return 'JOURNAL_REVIEW';
    case 'journal_playbook_update':
      return 'JOURNAL_PLAYBOOK_UPDATE';
    case 'journal_risk':
      return 'JOURNAL_RISK';
  }
}

function outputSchemaJson(): string {
  // Stable "shape schema" (not JSON Schema) used in prompts to keep output contract strict.
  return JSON.stringify(
    {
      requestId: 'string',
      tier: 'free|standard|pro|high',
      taskKind: 'chart_*|journal_*',
      asset: { mint: 'string', symbol: 'string?' },
      timeframesAnalyzed: ['15s|30s|1m|5m|15m|30m|1h|4h'],
      headline: 'string',
      summaryBullets: ['string'],
      plan: [
        {
          name: 'string',
          bias: 'long|short|neutral',
          timeframe: '15s|30s|1m|5m|15m|30m|1h|4h',
          entry: { type: 'market|limit|trigger', level: 0, rule: 'string' },
          stop: { level: 0, rule: 'string', invalidation: 'string' },
          targets: [{ level: 0, rationale: 'string' }],
          confidence: 0.7,
          evidence: ['string'],
          onchainGate: { pass: true, notes: ['string'] },
          notes: ['string'],
        },
      ],
      risk: { posture: 'low|medium|high', keyRisks: ['string'], guardrails: ['string'] },
      details: {
        regimeExplain: 'string',
        srTable: { supports: [0], resistances: [0] },
        patternReview: [{ type: 'string', tf: '1h', verdict: 'valid|weak|reject', why: 'string', confidence: 0.7 }],
        onchainExplain: 'string',
        assumptions: ['string'],
        invalidationRules: ['string'],
      },
    },
    null,
    2
  );
}

export function buildChartAnalysisPrompt(input: {
  requestId: string;
  tier: AnalysisTier;
  taskKind: SolAnalysisTaskKind;
  chart: ChartFeaturePack;
}): string {
  return [
    `TASK: SOL_CHART_${String(input.taskKind).toUpperCase()}`,
    '',
    'INPUT_JSON:',
    JSON.stringify(
      {
        requestId: input.requestId,
        tier: input.tier,
        taskKind: input.taskKind,
        chart: input.chart,
      },
      null,
      2
    ),
    '',
    'OUTPUT_SCHEMA_JSON:',
    outputSchemaJson(),
    '',
    'RULES:',
    '- Output MUST be a single JSON object and nothing else (no markdown, no prose).',
    '- Use ONLY the fields defined by OUTPUT_SCHEMA_JSON.',
    '- Evidence MUST cite FeaturePack fields only.',
    '- If data is missing, list it in details.assumptions and reduce confidence; do NOT invent numbers.',
    '',
  ].join('\n');
}

