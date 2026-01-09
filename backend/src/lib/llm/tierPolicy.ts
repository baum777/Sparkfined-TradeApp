export type Tier = 'free' | 'standard' | 'pro' | 'high';

export type LlmTaskKind =
  | 'general'
  | 'journal_teaser'
  | 'chart_teaser'
  | 'chart_analysis'
  | 'sentiment_alpha';

export type RouterDecisionProvider = 'none' | 'deepseek' | 'openai' | 'grok';

export interface TierSettings {
  tier: Tier;
  routerMaxTokens: number;
  finalMaxTokens: number;
  timeoutMs: number;
  retries: number;
}

export interface RouterDecision {
  provider: RouterDecisionProvider;
  reason: string;
  maxTokens: number;
}

export interface EnforcedDecisionResult {
  tierApplied: Tier;
  taskKindApplied: LlmTaskKind;
  decision: RouterDecision;
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
    'Bullet list only.',
    'Support(s)',
    'Resistance(s)',
    'Suggested stop-loss level',
    'One-line risk note',
    'Do NOT provide a full analysis.',
  ];
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
  const taskKindApplied = params.taskKind;

  const clampBase = (maxTokens: number) =>
    applyTokenClamps({
      decidedMaxTokens: maxTokens,
      tierFinalMaxTokens: tierSettings.finalMaxTokens,
      constraintsMaxFinalTokens: params.constraints?.maxFinalTokens,
      extraHardCap: 4096,
    });

  let provider: RouterDecisionProvider = params.routerDecision.provider;
  let reason = params.routerDecision.reason;
  let maxTokens = clampBase(params.routerDecision.maxTokens);
  let compressedPrompt = params.compressedPrompt;
  let mustInclude = [...(params.mustInclude ?? [])];

  const isTeaser = taskKindApplied === 'journal_teaser' || taskKindApplied === 'chart_teaser';
  const isSentiment = taskKindApplied === 'sentiment_alpha';

  const allowOpenAi = (() => {
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
    if (p === 'none' || p === 'deepseek') return true;
    if (p === 'openai') return allowOpenAi;
    if (p === 'grok') return allowGrok;
    return false;
  };

  const pickFallback = (): RouterDecisionProvider => {
    if (tierApplied === 'free') return 'deepseek';
    // standard/pro/high: prefer OpenAI for chart_analysis, otherwise DeepSeek.
    if (taskKindApplied === 'chart_analysis') return 'openai';
    if (taskKindApplied === 'sentiment_alpha') return 'openai';
    return 'deepseek';
  };

  if (!allowProvider(provider)) {
    const fallback = pickFallback();
    provider = fallback;
    reason = `permission_override:${params.routerDecision.provider}->${fallback}`;
  }

  // Free-tier teaser guardrails: always enforce the teaser output contract.
  if (tierApplied === 'free' && isTeaser) {
    mustInclude = Array.from(new Set([...teaserMustInclude(), ...mustInclude]));
    compressedPrompt = [
      'TEASER_OUTPUT_CONSTRAINTS:',
      '- Bullet list only.',
      '- Support(s)',
      '- Resistance(s)',
      '- Suggested stop-loss level',
      '- One-line risk note',
      '- No full analysis.',
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
    decision: { provider, reason, maxTokens },
    compressedPrompt,
    mustInclude,
  };
}

