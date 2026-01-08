import { JournalEvent, JournalStatus } from './types';

export type JournalEntryStatus = 'pending' | 'confirmed' | 'archived';

export interface JournalEntryV1 {
  id: string;
  status: JournalEntryStatus;

  timestamp: string; // ISO
  summary: string;

  createdAt: string; // ISO
  updatedAt: string; // ISO

  confirmedAt?: string; // ISO, nur wenn bestätigt
  archivedAt?: string;  // ISO, nur wenn archiviert
}

export function toApiJournalStatus(status: JournalStatus): JournalEntryStatus {
  switch (status) {
    case 'PENDING': return 'pending';
    case 'CONFIRMED': return 'confirmed';
    case 'ARCHIVED': return 'archived';
    default: return (status as string).toLowerCase() as JournalEntryStatus;
  }
}

export function toApiJournalEntryV1(event: JournalEvent): JournalEntryV1 {
  const entry: JournalEntryV1 = {
    id: event.id,
    status: toApiJournalStatus(event.status),
    timestamp: event.timestamp,
    summary: event.summary,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };

  if (event.status === 'CONFIRMED' && event.confirmedAt) {
    entry.confirmedAt = event.confirmedAt;
  }

  if (event.status === 'ARCHIVED' && event.archivedAt) {
    entry.archivedAt = event.archivedAt;
  }

  return entry;
}

