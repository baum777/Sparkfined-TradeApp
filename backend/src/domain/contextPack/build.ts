/**
 * ContextPack Builder (FROZEN SPEC)
 * Per BACKEND MAP section 1: build.ts assembles only allowed components
 */

import { createHash } from 'crypto';
import type { JournalEntryV1 } from '../journal/types.js';
import type { ResolvedTier, AnchorMode, ContextPack, MarketSnapshotAtTime, DeltaSnapshots } from './types.js';
import { canIncludeMarket, canIncludeDeltas, canIncludeNarrative } from './gates.js';
import { buildContextCacheKey, getCachedContextPack, setCachedContextPack } from './cache.js';
import { buildMarketSnapshot } from '../market/snapshot.service.js';
import { computeDeltaSnapshots } from '../market/delta.service.js';
import { fetchNarrativeSnapshot } from '../insights/narrative/narrative.service.js';
import type { UserSettings } from '../settings/settings.types.js';
import { canIncludeDeltas } from './gates.js';

export interface BuildContextPackParams {
  userId: string;
  tier: ResolvedTier;
  asset: {
    mint: string;
    symbol?: string;
    name?: string;
  };
  anchor: {
    mode: AnchorMode;
    anchorTimeISO: string;
  };
  includeGrok: boolean;
  settings: UserSettings;
  entry?: JournalEntryV1; // Optional, for entry-specific context
}

/**
 * Build ContextPack with tier-gated components
 * Per FROZEN SPEC: assembles only allowed components based on gates.ts
 */
export async function buildContextPack(params: BuildContextPackParams): Promise<ContextPack> {
  const { userId, tier, asset, anchor, includeGrok, settings, entry } = params;
  
  // Build cache key
  const cacheKey = buildContextCacheKey(
    userId,
    asset.mint,
    anchor.mode,
    anchor.anchorTimeISO,
    tier,
    includeGrok,
    canIncludeDeltas(tier),
    undefined // settingsHash - TODO: implement
  );
  
  // Check cache
  const cached = await getCachedContextPack(cacheKey);
  if (cached) {
    const ageSec = Math.floor((Date.now() - new Date(cached.generatedAtISO).getTime()) / 1000);
    if (ageSec < cached.freshnessSec) {
      return cached;
    }
  }
  
  // Build base ContextPack
  const contextPack: ContextPack = {
    id: generateContextPackId(userId, asset.mint, anchor.anchorTimeISO),
    userId,
    asset,
    anchor,
    tier,
    generatedAtISO: new Date().toISOString(),
    freshnessSec: calculateFreshnessSec(anchor.mode),
    reliability: {
      evidenceLevel: 'low',
      noiseLevel: 'low',
      dataCompleteness: 0,
    },
  };
  
  // Build market snapshot (if allowed)
  if (canIncludeMarket(tier)) {
    const market = await buildMarketSnapshot({
      mint: asset.mint,
      asOfISO: anchor.anchorTimeISO,
      tier,
    });
    if (market) {
      contextPack.market = market;
      contextPack.reliability.dataCompleteness = 1;
    }
  }
  
  // Build delta snapshots (if allowed and entry provided)
  if (canIncludeDeltas(tier) && entry) {
    const deltas = await computeDeltaSnapshots({
      mint: asset.mint,
      entryTimeISO: entry.timestamp || entry.createdAt,
      tier,
    });
    if (deltas && deltas.windows.length > 0) {
      contextPack.deltas = deltas;
      if (contextPack.reliability.dataCompleteness >= 1) {
        contextPack.reliability.dataCompleteness = 2;
      }
    }
  }
  
  // Build narrative snapshot (if allowed)
  if (canIncludeNarrative(tier, settings, includeGrok)) {
    const narrative = await fetchNarrativeSnapshot(
      {
        mint: asset.mint,
        anchorMode: anchor.mode,
        anchorTimeISO: anchor.anchorTimeISO,
      },
      tier,
      settings,
      includeGrok
    );
    if (narrative) {
      contextPack.narrative = narrative;
      if (contextPack.reliability.dataCompleteness >= 2) {
        contextPack.reliability.dataCompleteness = 3;
      }
      
      // Update reliability from narrative
      contextPack.reliability.evidenceLevel = narrative.quality.evidenceLevel;
      contextPack.reliability.noiseLevel = narrative.flags.highNoise ? 'high' : 
                                         narrative.flags.lowEvidence ? 'medium' : 'low';
    }
  }
  
  // Cache the result
  await setCachedContextPack(cacheKey, contextPack, anchor.mode);
  
  return contextPack;
}

/**
 * Generate ContextPack ID
 */
function generateContextPackId(userId: string, mint: string, anchorTimeISO: string): string {
  const hash = createHash('sha256')
    .update(`${userId}:${mint}:${anchorTimeISO}`)
    .digest('hex')
    .substring(0, 16);
  return `cp_${hash}`;
}

/**
 * Calculate freshness in seconds based on anchor mode
 */
function calculateFreshnessSec(mode: AnchorMode): number {
  switch (mode) {
    case 'now_centered':
      return 300; // 5 minutes
    case 'trade_centered':
      return 86400; // 24 hours (immutable)
    case 'launch_centered':
      return 86400; // 24 hours
    case 'latest_only':
      return 300; // 5 minutes
    default:
      return 300;
  }
}

