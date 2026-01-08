/**
 * Journal API Client
 * 
 * Handles all journal API calls with proper error handling.
 * Auth headers are injected via the existing apiClient mechanism.
 */

import { apiClient, ApiHttpError } from '@/services/api/client';
import type {
  JournalEntryV1,
  JournalCreateRequest,
  JournalListResponse,
} from './types';

const BASE_PATH = '/journal';

// ─────────────────────────────────────────────────────────────
// Error helpers
// ─────────────────────────────────────────────────────────────

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (error instanceof ApiHttpError && (error.status === 408 || error.code === 'TIMEOUT')) {
    return true;
  }
  // 5xx errors are transient
  if (error instanceof ApiHttpError && error.status >= 500 && error.status < 600) {
    return true;
  }
  return false;
}

export function isOffline(): boolean {
  return !navigator.onLine;
}

// ─────────────────────────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────────────────────────

/**
 * List journal entries
 * P1.1: Do NOT use query params - fetch all and filter client-side
 */
export async function listJournalEntries(): Promise<JournalEntryV1[]> {
  const payload = await apiClient.get<JournalListResponse>(BASE_PATH);
  return payload.items;
}

/**
 * Get a single journal entry by ID
 */
export async function getJournalEntry(id: string): Promise<JournalEntryV1> {
  return apiClient.get<JournalEntryV1>(`${BASE_PATH}/${id}`);
}

/**
 * Create a new journal entry
 * Requires Idempotency-Key header for safe retries
 */
export async function createJournalEntry(
  data: JournalCreateRequest,
  idempotencyKey: string
): Promise<JournalEntryV1> {
  return apiClient.post<JournalEntryV1>(BASE_PATH, data, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
}

/**
 * Confirm a pending journal entry
 * P0.1: NO request body per CONTRACTS.md
 */
export async function confirmJournalEntry(id: string): Promise<JournalEntryV1> {
  return apiClient.post<JournalEntryV1>(
    `${BASE_PATH}/${id}/confirm`
  );
}

/**
 * Archive a journal entry
 * P0.1: NO request body per CONTRACTS.md
 */
export async function archiveJournalEntry(id: string): Promise<JournalEntryV1> {
  return apiClient.post<JournalEntryV1>(
    `${BASE_PATH}/${id}/archive`
  );
}

/**
 * Restore an archived entry to pending
 */
export async function restoreJournalEntry(id: string): Promise<JournalEntryV1> {
  return apiClient.post<JournalEntryV1>(
    `${BASE_PATH}/${id}/restore`
  );
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE_PATH}/${id}`);
}
