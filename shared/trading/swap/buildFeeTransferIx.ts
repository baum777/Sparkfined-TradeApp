/**
 * Phase 1 note:
 * Sparkfined fee injection uses the provider platform-fee mechanism (Jupiter).
 *
 * A fallback path (separate token transfer instruction appended to the swap tx)
 * is intentionally architected but not shipped in Phase 1.
 */
export function buildFeeTransferIx() {
  // BACKEND_TODO(phase-2): implement fallback fee transfer ix injection
  return null;
}

