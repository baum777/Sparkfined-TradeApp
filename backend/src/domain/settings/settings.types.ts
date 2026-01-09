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

export type ResolvedTier = 'free' | 'standard' | 'pro' | 'high' | null;

