import { promises as fs } from 'fs';
import { join } from 'path';
import type { SparkfinedContext } from './contracts.js';

function sanitizeValue(v: string): string {
  // Ensure single-line append-only records.
  return v.replace(/\r?\n/g, '\\n').replace(/\s+/g, ' ').trim();
}

async function appendLine(filePath: string, line: string): Promise<void> {
  const final = line.endsWith('\n') ? line : line + '\n';
  await fs.appendFile(filePath, final, { encoding: 'utf8' });
}

function resolveMemoryPath(ctx: SparkfinedContext, key: keyof SparkfinedContext['memory']): string {
  const rel = ctx.memory[key];
  return join(ctx.repo.rootPath, rel);
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeValue(value);
  if (Array.isArray(value)) return value.map(v => sanitizeUnknown(v));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeUnknown(v);
    return out;
  }
  return value;
}

export async function appendTeamPlan(ctx: SparkfinedContext, input: {
  objective: string;
  workstreams: Array<{ id: string; name: string; scope: string; DoD: string; goldenSubset: string }>;
}): Promise<void> {
  const at = new Date().toISOString();
  const line =
    `[${at}] PLAN v1 | runId=${ctx.trace.ids.runId} | objective="${sanitizeValue(input.objective)}"` +
    ` | workstreams=${JSON.stringify(input.workstreams)}`;
  await appendLine(resolveMemoryPath(ctx, 'team_plan_md_path'), line);
}

export async function appendTeamProgress(ctx: SparkfinedContext, input: {
  workstreamId: string;
  state: 'started' | 'iterating' | 'green' | 'blocked';
  note: string;
}): Promise<void> {
  const at = new Date().toISOString();
  const line =
    `[${at}] PROGRESS v1 | runId=${ctx.trace.ids.runId} | workstreamId=${sanitizeValue(input.workstreamId)}` +
    ` | state=${input.state} | note="${sanitizeValue(input.note)}"`;
  await appendLine(resolveMemoryPath(ctx, 'team_progress_md_path'), line);
}

export async function appendTeamFinding(ctx: SparkfinedContext, input: {
  severity: 'info' | 'warn' | 'block';
  area: string;
  finding: string;
  evidence: string;
}): Promise<void> {
  const at = new Date().toISOString();
  const line =
    `[${at}] FINDING v1 | runId=${ctx.trace.ids.runId} | severity=${input.severity}` +
    ` | area="${sanitizeValue(input.area)}" | finding="${sanitizeValue(input.finding)}" | evidence="${sanitizeValue(input.evidence)}"`;
  await appendLine(resolveMemoryPath(ctx, 'team_findings_md_path'), line);
}

export async function appendTeamDecision(ctx: SparkfinedContext, input: {
  kind: 'workflow_phases' | 'escalation' | 'policy_decision';
  workstreamId?: string;
  phases?: Array<{ phase: string; content: string; artifacts?: string[] }>;
  reason?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const record = sanitizeUnknown({
    ts: new Date().toISOString(),
    runId: ctx.trace.ids.runId,
    kind: input.kind,
    workstreamId: input.workstreamId,
    phases: input.phases,
    reason: input.reason,
    meta: input.meta,
  });
  await appendLine(resolveMemoryPath(ctx, 'team_decisions_md_path'), JSON.stringify(record));
}

