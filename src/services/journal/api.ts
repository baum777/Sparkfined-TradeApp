/**
 * Journal API Client
 * 
 * Handles all journal API calls with proper error handling.
 * Auth headers are injected via the existing apiClient mechanism.
 */

import { apiClient, type ApiError } from '@/services/api/client';
import type {
  JournalEntryV1,
  JournalCreateRequest,
  JournalConfirmPayload,
  JournalArchiveRequest,
  JournalListResponse,
  JournalEntryStatus,
} from './types';

const BASE_PATH = '/journal';

// ─────────────────────────────────────────────────────────────
// Error helpers
// ─────────────────────────────────────────────────────────────

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  const apiError = error as ApiError;
  if (apiError?.status === 408 || apiError?.code === 'TIMEOUT') {
    return true;
  }
  // 5xx errors are transient
  if (apiError?.status >= 500 && apiError?.status < 600) {
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
 */
export async function listJournalEntries(
  status?: JournalEntryStatus
): Promise<JournalEntryV1[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<JournalListResponse | JournalEntryV1[]>(
    `${BASE_PATH}${query}`
  );
  
  // Handle both array response and envelope response
  if (Array.isArray(response.data)) {
    return response.data;
  }
  return response.data.items;
}

/**
 * Get a single journal entry by ID
 */
export async function getJournalEntry(id: string): Promise<JournalEntryV1> {
  const response = await apiClient.get<JournalEntryV1>(`${BASE_PATH}/${id}`);
  return response.data;
}

/**
 * Create a new journal entry
 * Requires Idempotency-Key header for safe retries
 */
export async function createJournalEntry(
  data: JournalCreateRequest,
  idempotencyKey: string
): Promise<JournalEntryV1> {
  const response = await apiClient.post<JournalEntryV1>(BASE_PATH, data, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
}

/**
 * Confirm a pending journal entry
 */
export async function confirmJournalEntry(
  id: string,
  payload: JournalConfirmPayload
): Promise<JournalEntryV1> {
  const response = await apiClient.post<JournalEntryV1>(
    `${BASE_PATH}/${id}/confirm`,
    payload
  );
  return response.data;
}

/**
 * Archive a journal entry
 */
export async function archiveJournalEntry(
  id: string,
  payload: JournalArchiveRequest
): Promise<JournalEntryV1> {
  const response = await apiClient.post<JournalEntryV1>(
    `${BASE_PATH}/${id}/archive`,
    payload
  );
  return response.data;
}

/**
 * Restore an archived entry to pending
 */
export async function restoreJournalEntry(id: string): Promise<JournalEntryV1> {
  const response = await apiClient.post<JournalEntryV1>(
    `${BASE_PATH}/${id}/restore`
  );
  return response.data;
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(id: string): Promise<void> {
  await apiClient.delete<void>(`${BASE_PATH}/${id}`);
}
