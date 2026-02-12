import { getDatabase } from '../../db/index.js';
import { AppError, ErrorCodes } from '../../http/error.js';
import type { ResolvedTier, UserSettings, UserSettingsPatch } from './settings.types.js';

function defaultSettings(): UserSettings {
  return { ai: { grokEnabled: false } };
}

function normalizeRow(row: { ai_grok_enabled: number } | undefined): UserSettings {
  if (!row) return defaultSettings();
  return { ai: { grokEnabled: row.ai_grok_enabled === 1 } };
}

function tierAllowsGrokEnable(tier: ResolvedTier): boolean {
  return tier === 'pro' || tier === 'high';
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const db = getDatabase();
  const row = await db
    .prepare(`SELECT ai_grok_enabled FROM user_settings_v1 WHERE user_id = ?`)
    .get<{ ai_grok_enabled: number }>(userId);
  return normalizeRow(row);
}

export async function patchSettings(userId: string, patch: UserSettingsPatch, ctx?: { tier: ResolvedTier }): Promise<UserSettings> {
  const db = getDatabase();
  const current = await getSettings(userId);

  const requested = patch.ai?.grokEnabled;
  const next: UserSettings = {
    ai: {
      grokEnabled: typeof requested === 'boolean' ? requested : current.ai.grokEnabled,
    },
  };

  // Server-side tier gating (safe default: unknown tier cannot enable).
  if (requested === true && !tierAllowsGrokEnable(ctx?.tier ?? null)) {
    throw new AppError('Tier does not allow enabling Grok', 403, ErrorCodes.FORBIDDEN_TIER);
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `
        INSERT OR REPLACE INTO user_settings_v1 (user_id, ai_grok_enabled, updated_at)
        VALUES (?, ?, ?)
      `
    )
    .run(userId, next.ai.grokEnabled ? 1 : 0, now);

  return next;
}

