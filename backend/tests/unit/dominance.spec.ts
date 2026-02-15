import { describe, it, expect, beforeEach } from 'vitest';
import { requiresApproval, deriveRiskLevel, planGoldenTasks } from '../../src/lib/dominance/policyEngine';
import { estimateCostUsd, computeCostRegression, getSparkfinedPricingTable } from '../../src/lib/dominance/costModel';
import { buildSparkfinedContext, parseSparkfinedDominanceFlag } from '../../src/lib/dominance/context';
import { appendTeamPlan, appendTeamProgress, appendTeamFinding, appendTeamDecision } from '../../src/lib/dominance/memoryArtifacts';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Sparkfined Dominance Layer - unit', () => {
  beforeEach(() => {
    delete process.env.ENABLE_SPARKFINED_DOMINANCE;
    delete process.env.SPARKFINED_PRICING_TABLE_JSON;
    delete process.env.SPARKFINED_COST_BASELINE_USD;
    delete process.env.SPARKFINED_COST_WARN_PCT;
    delete process.env.SPARKFINED_COST_BLOCK_PCT;
  });

  it('parses ENABLE_SPARKFINED_DOMINANCE flag', () => {
    expect(parseSparkfinedDominanceFlag({ ENABLE_SPARKFINED_DOMINANCE: 'false' })).toBe(false);
    expect(parseSparkfinedDominanceFlag({ ENABLE_SPARKFINED_DOMINANCE: 'true' })).toBe(true);
    expect(parseSparkfinedDominanceFlag({ ENABLE_SPARKFINED_DOMINANCE: undefined })).toBe(false);
  });

  it('requiresApproval matches the 4 categories exactly', () => {
    const base = {
      filesChanged: 1,
      linesAdded: 1,
      linesDeleted: 0,
      largestFileDeltaLines: 1,
      touchedPaths: [] as string[],
    };

    const core = requiresApproval({ ...base, touchedPaths: ['backend/src/lib/llm/router/router.ts'] });
    expect(core.required).toBe(true);
    expect(core.reasons).toContain('core_engine');

    const adapters = requiresApproval({ ...base, touchedPaths: ['backend/src/clients/openaiClient.ts'] });
    expect(adapters.required).toBe(true);
    expect(adapters.reasons).toContain('adapters');

    const ci = requiresApproval({ ...base, touchedPaths: ['.github/workflows/ci.yml'] });
    expect(ci.required).toBe(true);
    expect(ci.reasons).toContain('ci_deploy');

    const large = requiresApproval({ ...base, filesChanged: 16, touchedPaths: ['src/x.tsx'] });
    expect(large.required).toBe(true);
    expect(large.reasons).toContain('large_diff');
  });

  it('deriveRiskLevel is conservative (critical when core_engine + ci_deploy)', () => {
    const diff = {
      filesChanged: 2,
      linesAdded: 10,
      linesDeleted: 2,
      largestFileDeltaLines: 10,
      touchedPaths: ['backend/src/lib/llm/types.ts', '.github/workflows/ci.yml'],
    };
    expect(deriveRiskLevel(diff)).toBe('critical');
  });

  it('deriveRiskLevel is medium for cross-module non-approval diffs', () => {
    const diff = {
      filesChanged: 2,
      linesAdded: 5,
      linesDeleted: 1,
      largestFileDeltaLines: 5,
      touchedPaths: ['src/a.ts', 'backend/src/domain/x.ts'],
    };
    expect(deriveRiskLevel(diff)).toBe('medium');
  });

  it('planGoldenTasks maps to subsets deterministically', () => {
    const backendOnly = planGoldenTasks({
      filesChanged: 1,
      linesAdded: 1,
      linesDeleted: 0,
      touchedPaths: ['backend/src/domain/x.ts'],
    });
    expect(backendOnly.workstreamSubsets.backend_only).toEqual(['npm run lint', 'npx tsc --noEmit', 'npm run test:backend']);

    const frontendOnly = planGoldenTasks({
      filesChanged: 1,
      linesAdded: 1,
      linesDeleted: 0,
      touchedPaths: ['src/components/x.tsx'],
    });
    expect(frontendOnly.workstreamSubsets.frontend_only).toEqual(['npm run lint', 'npx tsc --noEmit', 'npm run build']);
  });

  it('estimateCostUsd works with env-provided pricing table', () => {
    const env = {
      SPARKFINED_PRICING_TABLE_JSON: JSON.stringify({
        'test-model': { inputPer1kUsd: 1, outputPer1kUsd: 2 },
      }),
    };
    const pricing = getSparkfinedPricingTable(env);
    const usd = estimateCostUsd({ tokensIn: 1000, tokensOut: 500, modelUsed: 'test-model', pricing });
    expect(usd).toBe(1 * 1 + 0.5 * 2);
  });

  it('computeCostRegression respects baseline + thresholds', () => {
    const reg = computeCostRegression({
      costEstimateUsd: 2,
      env: { SPARKFINED_COST_BASELINE_USD: '1', SPARKFINED_COST_WARN_PCT: '0.2', SPARKFINED_COST_BLOCK_PCT: '0.5' },
    });
    expect(reg?.status).toBe('block');
    expect(reg?.deltaUsd).toBe(1);
  });

  it('buildSparkfinedContext is backwards-compatible by default (disabled unless flag true)', () => {
    process.env.OPENAI_API_KEY = 'should-not-be-captured';
    const ctx = buildSparkfinedContext({ request: { objective: 'x' }, env: process.env });
    expect(ctx.enabled).toBe(false);
    expect(ctx.risk.policy.enabled).toBe(false);
    expect(ctx.risk.policy.goldenTaskPlan.global).toEqual([]);
    expect(ctx.runtime.env.OPENAI_API_KEY).toBeUndefined();
  });

  it('memory artifact writers append single-line v1 records', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sparkfined-mem-'));
    const ctx = buildSparkfinedContext({
      request: { objective: 'mem-test' },
      enabled: true,
      env: { ENABLE_SPARKFINED_DOMINANCE: 'true', SPARKFINED_REPO_ROOT: root },
    });

    await appendTeamPlan(ctx, {
      objective: 'obj',
      workstreams: [{ id: 'ws1', name: 'n', scope: 's', DoD: 'd', goldenSubset: 'backend_only' }],
    });
    await appendTeamProgress(ctx, { workstreamId: 'ws1', state: 'started', note: 'hello\nworld' });
    await appendTeamFinding(ctx, { severity: 'info', area: 'a', finding: 'f', evidence: 'e' });
    await appendTeamDecision(ctx, { decision: 'd', alternatives: 'a', rationale: 'r', risks: 'x', rollback: 'rb' });

    const plan = readFileSync(join(root, 'team_plan.md'), 'utf8');
    expect(plan).toContain('PLAN v1');
    const prog = readFileSync(join(root, 'team_progress.md'), 'utf8');
    expect(prog).toContain('PROGRESS v1');
    expect(prog).not.toContain('\nworld');
  });
});

