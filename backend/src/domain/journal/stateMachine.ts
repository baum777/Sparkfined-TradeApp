/**
 * Journal State Machine
 * AUTHORITATIVE transition rules for journal entries
 * Pure functions - no side effects
 */

import type { JournalEntryV1, JournalStatusV1 } from './types.js';
import type { AutoArchiveReason } from './autoArchive.js';

export type ArchiveReason = AutoArchiveReason | 'user_ignore';

/**
 * Check if entry can transition to confirmed
 * All tiers can confirm pending entries
 */
export function canConfirm(entry: JournalEntryV1): boolean {
  return entry.status === 'pending';
}

/**
 * Check if entry can be ignored (archived with user_ignore reason)
 * All tiers can ignore pending entries
 */
export function canIgnore(entry: JournalEntryV1): boolean {
  return entry.status === 'pending';
}

/**
 * Check if system can auto-archive entry
 * System can only archive pending entries with matched_sell reason
 */
export function canArchiveSystem(entry: JournalEntryV1, reason: AutoArchiveReason): boolean {
  if (entry.status !== 'pending') return false;
  return reason === 'matched_sell';
}

/**
 * Check if entry can be restored from archived state
 * Restore semantics depend on archive reason:
 * - matched_sell -> pending
 * - user_ignore -> pending
 * - user_action (if ever archived) -> confirmed
 */
export function canRestore(entry: JournalEntryV1, archiveReason: ArchiveReason): boolean {
  if (entry.status !== 'archived') return false;
  
  // All archive reasons allow restore
  return archiveReason === 'matched_sell' || 
         archiveReason === 'user_ignore' || 
         archiveReason === 'user_action' ||
         archiveReason === 'policy';
}

/**
 * Determine restore target status based on archive reason
 */
export function getRestoreTargetStatus(archiveReason: ArchiveReason): 'pending' | 'confirmed' {
  if (archiveReason === 'matched_sell' || archiveReason === 'user_ignore') {
    return 'pending';
  }
  // user_action, policy -> confirmed
  return 'confirmed';
}

