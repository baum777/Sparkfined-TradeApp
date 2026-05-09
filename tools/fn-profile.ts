#!/usr/bin/env tsx
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildGeneratorPrompt } from '../shared/contracts/reasoning-prompts.ts';

const SUPPORTED_TARGET = 'buildGeneratorPrompt';
const UPDATED_DATE = '2026-05-09';

export interface ProfileSample {
  latencyMs: number;
  tokensEst: number;
  heapDeltaBytes: number;
}

export interface ProfileAverage {
  avgLatencyMs: number;
  avgTokensEst: number;
  heapDeltaAvg: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function averageMetrics(samples: ProfileSample[]): ProfileAverage {
  if (samples.length === 0) {
    throw new Error('Cannot average zero profiling samples');
  }

  const sum = samples.reduce(
    (acc, sample) => ({
      latencyMs: acc.latencyMs + sample.latencyMs,
      tokensEst: acc.tokensEst + sample.tokensEst,
      heapDeltaBytes: acc.heapDeltaBytes + sample.heapDeltaBytes,
    }),
    { latencyMs: 0, tokensEst: 0, heapDeltaBytes: 0 }
  );

  return {
    avgLatencyMs: Math.round(sum.latencyMs / samples.length),
    avgTokensEst: Math.round(sum.tokensEst / samples.length),
    heapDeltaAvg: Math.round(sum.heapDeltaBytes / samples.length),
  };
}

export function updateFunctionWikiFrontmatter(
  markdown: string,
  metrics: { avgLatencyMs: number; avgTokensEst: number; updated: string }
): string {
  return markdown
    .replace(/^updated: .+$/m, `updated: ${metrics.updated}`)
    .replace(/^  avg_latency_ms: .+$/m, `  avg_latency_ms: ${metrics.avgLatencyMs}`)
    .replace(/^  avg_tokens_est: .+$/m, `  avg_tokens_est: ${metrics.avgTokensEst}`);
}

function parseArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function parseRuns(): number {
  const raw = parseArg('--runs', '3');
  const runs = Number.parseInt(raw, 10);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs must be a positive integer. Received: ${raw}`);
  }
  return runs;
}

function buildSamplePrompt(): string {
  return buildGeneratorPrompt({
    type: 'trade-review',
    referenceId: 'mock-reference',
    version: 'v1-profile',
    context: {
      referenceId: 'mock-reference',
      tier: 1,
      risk: 'low',
      symbol: 'SOL',
      chainId: 'solana',
      timeframe: '15m',
    },
    outputSchemaJson: JSON.stringify({
      type: 'object',
      required: ['summary'],
      properties: {
        summary: { type: 'string' },
      },
    }),
  });
}

export function profileBuildGeneratorPrompt(runs: number): ProfileAverage {
  const samples: ProfileSample[] = [];

  for (let i = 0; i < runs; i += 1) {
    const heapBefore = process.memoryUsage().heapUsed;
    const started = performance.now();
    const prompt = buildSamplePrompt();
    const latencyMs = performance.now() - started;
    const heapAfter = process.memoryUsage().heapUsed;

    samples.push({
      latencyMs,
      tokensEst: estimateTokens(prompt),
      heapDeltaBytes: heapAfter - heapBefore,
    });
  }

  return averageMetrics(samples);
}

function updateWikiMetrics(metrics: ProfileAverage): boolean {
  const toolDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(toolDir, '..');
  const wikiPath = join(repoRoot, '02-wiki/functions/buildGeneratorPrompt.md');

  if (!existsSync(wikiPath)) return false;

  const original = readFileSync(wikiPath, 'utf8');
  const updated = updateFunctionWikiFrontmatter(original, {
    avgLatencyMs: metrics.avgLatencyMs,
    avgTokensEst: metrics.avgTokensEst,
    updated: UPDATED_DATE,
  });
  writeFileSync(wikiPath, updated);
  return true;
}

async function main(): Promise<void> {
  const target = parseArg('--target', SUPPORTED_TARGET);
  if (target !== SUPPORTED_TARGET) {
    throw new Error(`V1 only supports ${SUPPORTED_TARGET}. Received: ${target}`);
  }

  const runs = parseRuns();
  const metrics = profileBuildGeneratorPrompt(runs);
  const wikiUpdated = updateWikiMetrics(metrics);

  const output = {
    target,
    runs,
    avg_latency_ms: metrics.avgLatencyMs,
    avg_tokens_est: metrics.avgTokensEst,
    heap_delta_avg: metrics.heapDeltaAvg,
    token_authority: 'v1_estimate_chars_div_4',
    wiki_updated: wikiUpdated,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));
}

const isCli = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isCli) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
