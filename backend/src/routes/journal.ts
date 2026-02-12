import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, sendCreated, sendNoContent, setCacheHeaders } from '../http/response.js';
import { notFound, conflict, validationError, ErrorCodes, unauthorized } from '../http/error.js';
import { validateBody, validateQuery } from '../validation/validate.js';
import {
  journalCreateRequestSchema,
  journalListQuerySchema,
} from '../validation/schemas.js';
import {
  journalCreate,
  journalGetById,
  journalList,
  journalConfirm,
  journalArchive,
  journalRestore,
  journalDelete,
} from '../domain/journal/repo.js';
import type { JournalListResponse } from '../domain/journal/types.js';

/**
 * Journal Routes
 * Per API_SPEC.md section 1
 */

function requireJournalAuth(req: ParsedRequest): void {
  if (!req.userId || req.userId === 'anon') {
    throw unauthorized('Authentication required', ErrorCodes.UNAUTHENTICATED);
  }
}

export async function handleJournalList(req: ParsedRequest, res: ServerResponse): Promise<void> {
  requireJournalAuth(req);
  const query = validateQuery(journalListQuerySchema, req.query);
  
  // Support both 'view' and 'status' query params
  const status = query.view || query.status;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const result = await journalList(req.userId, status, query.limit, query.cursor);
  
  setCacheHeaders(res, { noStore: true });
  
  const response: JournalListResponse = {
    items: result.items,
    nextCursor: result.nextCursor,
  };
  
  sendJson(res, response);
}

export async function handleJournalGetById(req: ParsedRequest, res: ServerResponse): Promise<void> {
  requireJournalAuth(req);
  const { id } = req.params;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const entry = await journalGetById(req.userId, id);
  
  if (!entry) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, entry);
}

export async function handleJournalCreate(req: ParsedRequest, res: ServerResponse): Promise<void> {
  requireJournalAuth(req);
  const body = validateBody(journalCreateRequestSchema, req.body);
  
  // Check for idempotency key (header is canonical)
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  if (!idempotencyKey || idempotencyKey.trim() === '') {
    throw validationError('Idempotency-Key header is required', {
      'Idempotency-Key': ['Required'],
    });
  }
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const entry = await journalCreate(req.userId, body, idempotencyKey);
  
  setCacheHeaders(res, { noStore: true });
  sendCreated(res, entry);
}

export async function handleJournalConfirm(req: ParsedRequest, res: ServerResponse): Promise<void> {
  requireJournalAuth(req);
  const { id } = req.params;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  // First check if entry exists
  const existing = await journalGetById(req.userId, id);
  if (!existing) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  // Check for invalid transition
  if (existing.status === 'archived') {
    throw conflict(
      'Cannot confirm an archived entry',
      ErrorCodes.INVALID_TRANSITION
    );
  }
  
  const entry = await journalConfirm(req.userId, id);
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, entry);
}

export async function handleJournalArchive(req: ParsedRequest, res: ServerResponse): Promise<void> {
  requireJournalAuth(req);
  const { id } = req.params;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const entry = await journalGetById(req.userId, id);
  if (!entry) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }

  // P0: user must NOT archive pending
  if (entry.status === 'pending') {
    throw conflict('Cannot archive a pending entry', ErrorCodes.INVALID_TRANSITION);
  }

  const archived = await journalArchive(req.userId, id);
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, archived);
}

export async function handleJournalRestore(req: ParsedRequest, res: ServerResponse): Promise<void> {
  requireJournalAuth(req);
  const { id } = req.params;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const existing = await journalGetById(req.userId, id);
  if (!existing) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  const entry = await journalRestore(req.userId, id);
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, entry);
}

export async function handleJournalDelete(req: ParsedRequest, res: ServerResponse): Promise<void> {
  requireJournalAuth(req);
  const { id } = req.params;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const deleted = await journalDelete(req.userId, id);
  
  if (!deleted) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  sendNoContent(res);
}
