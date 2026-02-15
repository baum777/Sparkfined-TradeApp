import { spawn } from 'child_process';
import type { SparkfinedContext } from './contracts.js';
import { traceSpan } from './trace.js';

export type GoldenRunStatus = 'green' | 'red';

export interface GoldenRunResult {
  status: GoldenRunStatus;
  failures: Array<{ task: string; summary: string; logRef?: string }>;
}

function looksFlaky(output: string): boolean {
  return /(ECONNRESET|ETIMEDOUT|timeout|timed out|socket hang up|EAI_AGAIN)/i.test(output);
}

async function runOneCommand(cmd: string, opts: { cwd: string; timeoutMs: number }): Promise<{ ok: boolean; output: string }> {
  return await new Promise((resolve) => {
    const child = spawn('bash', ['-lc', cmd], {
      cwd: opts.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const onData = (b: Buffer) => {
      out += b.toString('utf8');
      if (out.length > 200_000) out = out.slice(-200_000);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const to = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, output: out + '\n[timeout]' });
    }, opts.timeoutMs);

    child.on('close', (code) => {
      clearTimeout(to);
      resolve({ ok: code === 0, output: out });
    });
  });
}

/**
 * Deterministic Golden Task runner (bounded retries).
 * - When `ctx.enabled=false`: returns green without executing tasks.
 * - Flaky suspicion: max 2 reruns per failing task.
 */
export async function runGoldenTasks(
  ctx: SparkfinedContext,
  tasks: string[],
  options?: { cwd?: string; timeoutMs?: number }
): Promise<GoldenRunResult> {
  if (!ctx.enabled) {
    return { status: 'green', failures: [] };
  }

  const cwd = options?.cwd ?? ctx.repo.rootPath;
  const timeoutMs = options?.timeoutMs ?? 10 * 60_000;

  const failures: GoldenRunResult['failures'] = [];

  for (const task of tasks) {
    let c = traceSpan(ctx, { step: `golden:run:${task}`, component: 'quality_gates' });
    let attempt = 0;
    let lastOutput = '';
    let ok = false;

    while (attempt < 3 && !ok) {
      attempt++;
      const r = await runOneCommand(task, { cwd, timeoutMs });
      ok = r.ok;
      lastOutput = r.output;
      c = traceSpan(c, {
        step: `golden:result:${task}`,
        component: 'quality_gates',
        attrs: { attempt, ok },
      });
      if (!ok && attempt < 3 && looksFlaky(lastOutput)) {
        // Retry on flaky signature only.
        continue;
      }
      break;
    }

    if (!ok) {
      failures.push({
        task,
        summary: `failed after ${attempt} attempt(s)`,
        logRef: lastOutput.slice(-4000),
      });
    }
  }

  return { status: failures.length ? 'red' : 'green', failures };
}

