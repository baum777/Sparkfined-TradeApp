import type { ResolvedTier } from '../../config/tiers.js';

export type UserAiSettings = {
  grokEnabled: boolean;
};

export type UserSettings = {
  ai: UserAiSettings;
};

export type UserSettingsPatch = {
  ai?: {
    grokEnabled?: boolean;
  };
};

// Re-export ResolvedTier for backward compatibility
export type { ResolvedTier };

