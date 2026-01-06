import type { OnchainContextMetaV1 } from './types';

/**
 * Merges existing OnchainContextMeta with an update.
 * Strategy:
 * - capturedAt: keep existing unless update provides one (usually we keep initial capture time)
 * - errors: append/concat
 * - capture: shallow merge
 * - classification: shallow merge
 * - display: shallow merge
 */
export function mergeOnchainContextMeta(
  existing: OnchainContextMetaV1 | undefined,
  update: Partial<OnchainContextMetaV1>
): OnchainContextMetaV1 {
  const now = new Date().toISOString();

  if (!existing) {
    // If no existing, create new from update with defaults
    return {
      capturedAt: update.capturedAt || now,
      errors: update.errors || [],
      capture: update.capture,
      classification: update.classification,
      display: update.display,
    };
  }

  return {
    ...existing,
    // Keep existing timestamp unless explicitly overwritten (which is rare for enrichment)
    capturedAt: update.capturedAt || existing.capturedAt,
    
    // Concat errors
    errors: [
      ...existing.errors,
      ...(update.errors || [])
    ],
    
    // Merge nested objects if provided in update, otherwise keep existing
    capture: update.capture 
      ? { ...(existing.capture || {}), ...update.capture } as OnchainContextMetaV1['capture']
      : existing.capture,
      
    classification: update.classification
      ? { ...(existing.classification || {}), ...update.classification } as OnchainContextMetaV1['classification']
      : existing.classification,
      
    display: update.display
      ? { ...(existing.display || {}), ...update.display }
      : existing.display,
  };
}

