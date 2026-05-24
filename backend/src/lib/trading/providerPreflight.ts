import type { Env } from '../../config/env.js';

export type UpstreamCheckStatus = 'ok' | 'error' | 'timeout';
export type UpstreamFailureReason = 'http_error' | 'network_error' | 'timeout';
export type PlatformFeeAccountStatus = 'ok' | 'missing' | 'not_required';

export interface JupiterPreflightResult {
  jupiter: UpstreamCheckStatus;
  jupiterReason?: UpstreamFailureReason;
  jupiterPlatformFeeAccount: PlatformFeeAccountStatus;
}

// Backend-local mirror of shared/trading/fee/feeTiers.ts free tier.
// Keep local because backend tsconfig rootDir excludes shared/.
const DEFAULT_TERMINAL_FEE_BPS = 65;

export function getDefaultTerminalFeeBps(): number {
  return DEFAULT_TERMINAL_FEE_BPS;
}

export function checkJupiterPlatformFeeAccount(env: Env, feeBps = getDefaultTerminalFeeBps()): PlatformFeeAccountStatus {
  if (feeBps <= 0) return 'not_required';
  return env.JUPITER_PLATFORM_FEE_ACCOUNT?.trim() ? 'ok' : 'missing';
}

export function classifyFetchFailure(error: unknown): UpstreamFailureReason {
  if (error instanceof Error && error.name === 'AbortError') return 'timeout';
  return 'network_error';
}

export function buildJupiterPreflight(input: {
  env: Env;
  status: UpstreamCheckStatus;
  reason?: UpstreamFailureReason;
  feeBps?: number;
}): JupiterPreflightResult {
  return {
    jupiter: input.status,
    ...(input.reason ? { jupiterReason: input.reason } : {}),
    jupiterPlatformFeeAccount: checkJupiterPlatformFeeAccount(input.env, input.feeBps),
  };
}
