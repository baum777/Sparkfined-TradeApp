/**
 * Narrative Service (FROZEN SPEC)
 * Per BACKEND MAP section 1: insights/narrative/narrative.service.ts
 * Generates JournalNarrativeSnapshot for Pro/High tiers (opt-in)
 * 
 * Note: This is a stub implementation. Full implementation requires:
 * - X/TL API integration for fetching posts
 * - LLM-based analysis for evidence scoring
 * - Noise filtering and evidence labeling
 */

import type {
  JournalNarrativeSnapshot,
  AnchorMode,
} from '../../contextPack/types.js';
import { getKV } from '../../../lib/kv/store.js';
import { canIncludeNarrative } from '../../contextPack/gates.js';
import type { ResolvedTier } from '../../../config/tiers.js';
import type { UserSettings } from '../../settings/settings.types.js';

export interface FetchNarrativeSnapshotParams {
  mint: string;
  anchorMode: AnchorMode;
  anchorTimeISO: string;
}

/**
 * Fetch narrative snapshot
 * Per BACKEND MAP: narrative.service.ts must verify gates again before calling providers
 */
export async function fetchNarrativeSnapshot(
  params: FetchNarrativeSnapshotParams,
  tier: ResolvedTier,
  settings: UserSettings,
  includeGrokFlag: boolean
): Promise<JournalNarrativeSnapshot | null> {
  // Defense in depth: verify gates again
  if (!canIncludeNarrative(tier, settings, includeGrokFlag)) {
    return null;
  }
  
  const { mint, anchorMode, anchorTimeISO } = params;
  
  // Generate cache key for narrative
  const cacheKey = generateNarrativeCacheKey(mint, anchorMode, anchorTimeISO);
  
  // Check cache (30-120 min TTL per spec)
  const kv = getKV();
  const cached = await kv.get<JournalNarrativeSnapshot>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // TODO: Full implementation would:
  // 1. Fetch X/TL posts for the asset around anchorTimeISO
  // 2. Filter by time windows (preHours: 6, postHours: 6)
  // 3. Score posts for evidence quality
  // 4. Filter noise
  // 5. Generate headline, summary, sentiment, themes, risks
  // 6. Select top evidence posts
  
  // For now, return a stub that follows the schema
  const narrative: JournalNarrativeSnapshot = {
    cacheKey,
    mode: anchorMode === 'trade_centered' ? 'trade_centered' : 
          anchorMode === 'launch_centered' ? 'launch_centered' : 'latest_only',
    windows: { preHours: 6, postHours: 6 },
    counts: {
      strictPre: 0,
      strictPost: 0,
      symbolPre: 0,
      symbolPost: 0,
      latest: 0,
    },
    quality: {
      evidenceLevel: 'low', // Default to low until real data is available
      passedThresholdCount: 0,
    },
    flags: {
      lowEvidence: true,
      highNoise: false,
    },
    sources: {
      topAuthors: [],
      usedPresetQuants: [],
      usedUserQuants: [],
    },
    headline: 'Narrative analysis not yet available',
    summaryBullets: [
      'Narrative snapshot generation is in progress',
      'This feature requires X/TL API integration',
      'Evidence-based posts will be analyzed and scored',
    ],
    sentiment: {
      label: 'neutral',
      confidence: 0.0,
    },
    themes: [],
    risks: [],
    evidencePosts: [],
  };
  
  // Cache with 30-120 min TTL (using 60 min as default)
  await kv.set(cacheKey, narrative, 3600);
  
  return narrative;
}

/**
 * Generate cache key for narrative snapshot
 */
function generateNarrativeCacheKey(
  assetMint: string,
  anchorMode: AnchorMode,
  anchorTimeISO: string
): string {
  // Round to nearest hour for cache key
  const anchorTime = new Date(anchorTimeISO);
  const roundedHour = new Date(anchorTime);
  roundedHour.setMinutes(0, 0, 0);
  
  return `narrative:v1:${assetMint}:${anchorMode}:${roundedHour.toISOString()}`;
}

