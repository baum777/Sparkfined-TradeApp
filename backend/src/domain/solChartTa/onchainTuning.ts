import { getEnv } from '../../config/env.js';
import type { OnchainGatingTuning } from '../solOnchain/gates/applyOnchainGates.js';

export type OnchainTuningProfile = 'default' | 'conservative' | 'aggressive';

export function getOnchainTuningFromEnv(): Partial<OnchainGatingTuning> {
  const env = getEnv();
  const profile = (env.ONCHAIN_TUNING_PROFILE ?? 'default') as OnchainTuningProfile;

  // Frozen-ish defaults; profiles allow coarse tuning without prompt changes.
  if (profile === 'conservative') {
    return { liquidityDropHardThreshold: -0.4 };
  }
  if (profile === 'aggressive') {
    return { liquidityDropHardThreshold: -0.25 };
  }
  return {};
}

