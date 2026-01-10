export type Tier = 'free' | 'standard' | 'pro' | 'high';

export type LlmTaskKind =
  | 'general'
  // Chart (Solana)
  | 'chart_teaser_free'
  | 'chart_setups'
  | 'chart_patterns_validate'
  | 'chart_confluence_onchain'
  | 'chart_microstructure'
  // Journal
  | 'journal_teaser_free'
  | 'journal_review'
  | 'journal_playbook_update'
  | 'journal_risk'
  // Back-compat aliases (deprecated; normalized server-side)
  | 'journal_teaser'
  | 'chart_teaser'
  | 'chart_analysis'
  | 'sentiment_alpha';

export type RouterDecisionProvider = 'deepseek' | 'openai' | 'grok';

export interface TierSettings {
  tier: Tier;
  routerMaxTokens: number;
  finalMaxTokens: number;
  timeoutMs: number;
  retries: number;
}

export interface RouterDecision {
  provider: RouterDecisionProvider;
  templateId: string;
  maxTokens: number;
}

export interface EnforcedDecisionResult {
  tierApplied: Tier;
  taskKindApplied: LlmTaskKind;
  provider: RouterDecisionProvider;
  templateId: string;
  maxTokens: number;
  compressedPrompt: string;
  mustInclude: string[];
}

export function getTierSettings(tier: Tier): TierSettings {
  switch (tier) {
    case 'free':
      return { tier, routerMaxTokens: 900, finalMaxTokens: 600, timeoutMs: 15000, retries: 1 };
    case 'standard':
      return { tier, routerMaxTokens: 1500, finalMaxTokens: 1400, timeoutMs: 20000, retries: 2 };
    case 'pro':
      return { tier, routerMaxTokens: 2500, finalMaxTokens: 2500, timeoutMs: 25000, retries: 2 };
    case 'high':
      return { tier, routerMaxTokens: 4000, finalMaxTokens: 4000, timeoutMs: 30000, retries: 3 };
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

export function applyTokenClamps(input: {
  decidedMaxTokens: number;
  tierFinalMaxTokens: number;
  constraintsMaxFinalTokens?: number;
  extraHardCap?: number;
}): number {
  const hardCap = typeof input.extraHardCap === 'number' ? input.extraHardCap : 4096;
  const tierCap = clampInt(input.tierFinalMaxTokens, 16, hardCap, 800);
  const constraintCap =
    typeof input.constraintsMaxFinalTokens === 'number' && Number.isFinite(input.constraintsMaxFinalTokens)
      ? clampInt(input.constraintsMaxFinalTokens, 16, hardCap, tierCap)
      : tierCap;
  const decided = clampInt(input.decidedMaxTokens, 16, hardCap, 800);
  return Math.min(decided, tierCap, constraintCap);
}

export function teaserMustInclude(): string[] {
  return [
    // Kept for back-compat callers; newer templates use stricter, task-specific contracts.
    'Support(s)',
    'Resistance(s)',
    'Stop-loss',
    'Invalidation',
    'Risk',
  ];
}

function normalizeTaskKind(taskKind: LlmTaskKind): LlmTaskKind {
  if (taskKind === 'journal_teaser') return 'journal_teaser_free';
  if (taskKind === 'chart_teaser') return 'chart_teaser_free';
  if (taskKind === 'chart_analysis') return 'chart_setups';
  return taskKind;
}

function downgradeTaskKindForTier(tier: Tier, taskKind: LlmTaskKind): LlmTaskKind {
  if (tier !== 'free') return taskKind;
  if (taskKind === 'sentiment_alpha') return taskKind;
  if (taskKind.startsWith('chart_') && taskKind !== 'chart_teaser_free') return 'chart_teaser_free';
  if (taskKind.startsWith('journal_') && taskKind !== 'journal_teaser_free') return 'journal_teaser_free';
  return taskKind;
}

export function enforcePermissions(params: {
  tier: Tier;
  taskKind: LlmTaskKind;
  routerDecision: RouterDecision;
  compressedPrompt: string;
  mustInclude: string[];
  constraints?: { maxFinalTokens?: number };
}): EnforcedDecisionResult {
  const tierSettings = getTierSettings(params.tier);
  const tierApplied = params.tier;
  const taskKindApplied = downgradeTaskKindForTier(tierApplied, normalizeTaskKind(params.taskKind));

  const clampBase = (maxTokens: number) =>
    applyTokenClamps({
      decidedMaxTokens: maxTokens,
      tierFinalMaxTokens: tierSettings.finalMaxTokens,
      constraintsMaxFinalTokens: params.constraints?.maxFinalTokens,
      extraHardCap: 4096,
    });

  let provider: RouterDecisionProvider = params.routerDecision.provider;
  let templateId = params.routerDecision.templateId || 'GENERAL';
  let maxTokens = clampBase(params.routerDecision.maxTokens);
  let compressedPrompt = params.compressedPrompt;
  let mustInclude = [...(params.mustInclude ?? [])];

  const isFreeJournalTeaser = taskKindApplied === 'journal_teaser_free';
  const isFreeChartTeaser = taskKindApplied === 'chart_teaser_free';
  const isTeaser = isFreeJournalTeaser || isFreeChartTeaser;
  const isSentiment = taskKindApplied === 'sentiment_alpha';

  const allowOpenAi = (() => {
    // FROZEN: FREE tier may use OpenAI ONLY for *_teaser_free.
    if (tierApplied === 'free') return isTeaser;
    if (tierApplied === 'standard') return true;
    if (tierApplied === 'pro') return true;
    return true;
  })();

  const allowGrok = (() => {
    if (tierApplied === 'free') return isSentiment;
    if (tierApplied === 'standard') return isSentiment;
    if (tierApplied === 'pro') return isSentiment;
    return isSentiment;
  })();

  const allowProvider = (p: RouterDecisionProvider): boolean => {
    if (p === 'deepseek') return true;
    if (p === 'openai') return allowOpenAi;
    if (p === 'grok') return allowGrok;
    return false;
  };

  const pickFallback = (): RouterDecisionProvider => {
    if (tierApplied === 'free') return 'deepseek';
    // standard/pro/high: prefer OpenAI for chart tasks (unless router chooses otherwise).
    if (taskKindApplied.startsWith('chart_')) return 'openai';
    if (taskKindApplied === 'sentiment_alpha') return 'openai';
    return 'deepseek';
  };

  if (!allowProvider(provider)) {
    const fallback = pickFallback();
    provider = fallback;
    // Keep templateId, but ensure we don't claim an incompatible provider.
    templateId = params.routerDecision.templateId || templateId;
  }

  // FROZEN: Free-tier strict teaser output contracts.
  if (tierApplied === 'free' && isFreeChartTeaser) {
    templateId = 'CHART_TEASER_FREE';
    mustInclude = Array.from(
      new Set([
        'Support: ...',
        'Resistance: ...',
        'Stop-loss: ...',
        'Invalidation: ...',
        'Risk: ...',
        'No targets. No patterns. No long analysis.',
        ...mustInclude,
      ])
    );
    compressedPrompt = [
      'CHART_TEASER_FREE_CONSTRAINTS:',
      '- Output MUST include BOTH JSON and TEXT.',
      '- TEXT format MUST be exactly 5 lines:',
      '  Support: ...',
      '  Resistance: ...',
      '  Stop-loss: ...',
      '  Invalidation: ...',
      '  Risk: ...',
      '- No targets, no patterns, no long analysis.',
      '',
      compressedPrompt,
    ].join('\n');
  }

  if (tierApplied === 'free' && isFreeJournalTeaser) {
    templateId = 'JOURNAL_TEASER_FREE';
    mustInclude = Array.from(
      new Set([
        '3 bullets max.',
        'One thing to do next',
        'One thing to avoid',
        'One risk',
        'No long coaching.',
        ...mustInclude,
      ])
    );
    compressedPrompt = [
      'JOURNAL_TEASER_FREE_CONSTRAINTS:',
      '- Output MUST include BOTH JSON and TEXT.',
      '- TEXT: 3 bullets max:',
      '  - One thing to do next',
      '  - One thing to avoid',
      '  - One risk',
      '- No long coaching.',
      '',
      compressedPrompt,
    ].join('\n');
  }

  // Free-tier Grok: must stay short (<= 200 tokens).
  if (tierApplied === 'free' && provider === 'grok') {
    maxTokens = Math.min(maxTokens, 200);
    mustInclude = Array.from(new Set(['Keep it <= 200 tokens.', ...mustInclude]));
  }

  return {
    tierApplied,
    taskKindApplied,
    provider,
    templateId,
    maxTokens,
    compressedPrompt,
    mustInclude,
  };
}

