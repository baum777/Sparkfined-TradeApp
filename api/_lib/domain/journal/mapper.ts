import { JournalEvent, JournalStatus } from './types';
import type { OnchainContextV1, OnchainContextMetaV1 } from './onchain/types';

export type JournalEntryStatus = 'pending' | 'confirmed' | 'archived';
export type JournalEntrySide = 'BUY' | 'SELL';

export interface JournalEntryV1 {
  id: string;
  side: JournalEntrySide;
  status: JournalEntryStatus;

  timestamp: string;  // ISO: Trade-Zeitpunkt
  summary: string;

  createdAt: string;  // ISO
  updatedAt: string;  // ISO

  confirmedAt?: string; // ISO, nur wenn bestätigt
  archivedAt?: string;  // ISO, nur wenn archiviert
  
  onchainContext?: OnchainContextV1;
  onchainContextMeta?: OnchainContextMetaV1;
}

export function toApiJournalStatus(status: JournalStatus): JournalEntryStatus {
  switch (status) {
    case 'PENDING': return 'pending';
    case 'CONFIRMED': return 'confirmed';
    case 'ARCHIVED': return 'archived';
    default: return status.toLowerCase() as JournalEntryStatus;
  }
}

export function toApiJournalEntryV1(event: JournalEvent): JournalEntryV1 {
  const entry: JournalEntryV1 = {
    id: event.id,
    side: event.side,
    status: toApiJournalStatus(event.status),
    timestamp: event.timestamp,
    summary: event.summary,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    onchainContext: event.onchainContext,
    onchainContextMeta: event.onchainContextMeta,
  };

  if (event.status === 'CONFIRMED' && event.confirmData?.confirmedAt) {
    entry.confirmedAt = event.confirmData.confirmedAt;
  }

  if (event.status === 'ARCHIVED' && event.archiveData?.archivedAt) {
    entry.archivedAt = event.archiveData.archivedAt;
  }

  return entry;
}

