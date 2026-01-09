export type PromptTemplateId =
  | 'GENERAL'
  | 'CHART_TEASER_FREE'
  | 'CHART_SETUPS'
  | 'CHART_PATTERNS_VALIDATE'
  | 'CHART_CONFLUENCE_ONCHAIN'
  | 'CHART_MICROSTRUCTURE'
  | 'JOURNAL_TEASER_FREE'
  | 'JOURNAL_REVIEW'
  | 'JOURNAL_PLAYBOOK_UPDATE'
  | 'JOURNAL_RISK';

export function getTemplateSystemPrompt(templateId: string | undefined): string {
  const id = (templateId ?? 'GENERAL') as PromptTemplateId;

  // FROZEN: Template system prompts should be deterministic and constraint-heavy.
  switch (id) {
    case 'CHART_TEASER_FREE':
      return [
        'TEMPLATE: CHART_TEASER_FREE (strict).',
        'You output BOTH JSON and TEXT.',
        'Do NOT invent data. You must use only the provided FeaturePack fields.',
        'TEXT output MUST be exactly 5 lines, in this exact order/labels:',
        'Support: ...',
        'Resistance: ...',
        'Stop-loss: ...',
        'Invalidation: ...',
        'Risk: ...',
        'No targets. No patterns. No long analysis.',
      ].join('\n');

    case 'CHART_SETUPS':
      return [
        'TEMPLATE: CHART_SETUPS.',
        'You output BOTH JSON and TEXT.',
        'Validate regime, propose up to 3 setups. Each setup must include entry/stop/invalidation/targets (zones ok).',
        'Evidence MUST cite FeaturePack fields only.',
        'Confidence requires >= 3 evidence points; else cap confidence <= 0.6.',
        'Always start from regime and S/R.',
        'If liquidity sweeps present and reclaim confirmed, prefer failed breakdown/breakout setup.',
      ].join('\n');

    case 'CHART_PATTERNS_VALIDATE':
      return [
        'TEMPLATE: CHART_PATTERNS_VALIDATE.',
        'You output BOTH JSON and TEXT.',
        'You DO NOT invent patterns. You only validate provided patternCandidates.',
        'For each candidate: verdict valid/weak/reject and why.',
        'Recompute confidence using checks + context (regime, volatility, volume).',
        'Wolfe: require clear 5 pivot structure; if missing/unclear -> reject.',
        'H&S: require neckline coherence + shoulder symmetry; else weak/reject.',
        'Targets are zones + probabilistic (no certainty).',
      ].join('\n');

    case 'CHART_CONFLUENCE_ONCHAIN':
      return [
        'TEMPLATE: CHART_CONFLUENCE_ONCHAIN.',
        'You output BOTH JSON and TEXT.',
        'Onchain signals are ONLY a filter and risk amplifier/reducer, not a standalone predictor.',
        'If riskFlags indicate high risk (mint/freeze authority, sudden supply): downgrade confidence, tighten stops, reduce targets.',
        'If activity zScore high + liquidity up + holders growth: allow higher follow-through probability.',
        'Always report onchainGate pass/fail per setup.',
      ].join('\n');

    case 'CHART_MICROSTRUCTURE':
      return [
        'TEMPLATE: CHART_MICROSTRUCTURE.',
        'You output BOTH JSON and TEXT.',
        'Focus on 15s/30s/1m microstructure: sweeps, reclaims, volatility bursts, imbalances.',
        'No long predictions. Use short-horizon invalidation and tight risk framing.',
      ].join('\n');

    case 'JOURNAL_TEASER_FREE':
      return [
        'TEMPLATE: JOURNAL_TEASER_FREE (strict).',
        'You output BOTH JSON and TEXT.',
        'TEXT: 3 bullets max, exactly:',
        '- One thing to do next',
        '- One thing to avoid',
        '- One risk',
        'No long coaching.',
      ].join('\n');

    case 'JOURNAL_REVIEW':
      return [
        'TEMPLATE: JOURNAL_REVIEW.',
        'You output BOTH JSON and TEXT.',
        'Identify 1–2 behavioral patterns from the last N entries (provided by backend).',
        'Provide 2 concrete rules + 1 checklist item.',
      ].join('\n');

    case 'JOURNAL_PLAYBOOK_UPDATE':
      return [
        'TEMPLATE: JOURNAL_PLAYBOOK_UPDATE.',
        'You output BOTH JSON and TEXT.',
        'Add/update playbook rules, anti-bias safeguards, and a review rubric.',
      ].join('\n');

    case 'JOURNAL_RISK':
      return [
        'TEMPLATE: JOURNAL_RISK.',
        'You output BOTH JSON and TEXT.',
        'Provide risk posture and guardrails derived from recent sessions; be concrete and non-generic.',
      ].join('\n');

    case 'GENERAL':
    default:
      return [
        'TEMPLATE: GENERAL.',
        'Be concise and accurate.',
      ].join('\n');
  }
}

