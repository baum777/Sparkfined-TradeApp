// Journal Service Exports
export * from './types';
export * from './api';
export * from './queueStore';
export { useJournalApi, type UseJournalApiReturn, type ConfirmPayload } from './useJournalApi';

// Re-export legacy queue functions for backward compatibility
export {
  getQueue,
  addToQueue,
  removeFromQueue,
  clearQueue,
  getSyncErrors,
  addSyncError,
  removeSyncError,
  clearSyncErrors,
  processQueue as processLegacyQueue,
} from './journalQueue';
