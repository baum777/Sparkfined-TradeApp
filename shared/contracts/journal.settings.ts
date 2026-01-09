/**
 * Journal Settings + Grok Toggle Contract (v1)
 * ------------------------------------------
 * Contract-first types shared across backend + clients.
 *
 * Non-negotiables:
 * - Backend is source of truth (tier gating enforced server-side)
 * - Grok narrative usage must be explicitly requested AND enabled AND allowed by tier
 */
 
export type JournalTier = 'free' | 'standard' | 'pro' | 'high';
 
// ─────────────────────────────────────────────────────────────
// Settings: GET/PATCH /api/settings
// ─────────────────────────────────────────────────────────────
 
export interface UserAiSettingsV1 {
  /**
   * Gates Grok/X-Timeline narrative usage.
   * Default: false.
   *
   * Server enforcement:
   * - Only tiers {pro, high} may set this true.
   */
  grokEnabled: boolean;
}
 
export interface UserSettingsV1 {
  ai: UserAiSettingsV1;
}
 
export interface UserSettingsPatchV1 {
  ai?: {
    grokEnabled?: boolean;
  };
}
 
// Errors:
// - 401 UNAUTHENTICATED
// - 403 FORBIDDEN_TIER (attempt to enable when tier < pro)
// - 400 VALIDATION_ERROR
 
// ─────────────────────────────────────────────────────────────
// Journal Insights: POST /api/journal/:id/insights
// ─────────────────────────────────────────────────────────────
 
export type JournalInsightsKindV1 = 'teaser' | 'review' | 'playbook';
 
export interface JournalInsightsRequestV1 {
  kind: JournalInsightsKindV1;
  /**
   * If true, backend MAY include Grok narrative only when:
   * - tier ∈ {pro, high}
   * - settings.ai.grokEnabled === true
   * - includeGrok === true
   */
  includeGrok?: boolean;
}
 
// Errors:
// - 404 JOURNAL_NOT_FOUND
// - 403 FORBIDDEN_TIER (tier < pro)
// - 403 GROK_DISABLED (includeGrok requested but settings disable it)
 
