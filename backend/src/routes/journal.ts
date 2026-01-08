import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, sendCreated, sendNoContent, setCacheHeaders } from '../http/response.js';
import { notFound, conflict, ErrorCodes } from '../http/error.js';
import { validateBody, validateQuery } from '../validation/validate.js';
import {
  journalCreateRequestSchema,
  journalConfirmPayloadSchema,
  journalArchiveRequestSchema,
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

export function handleJournalList(req: ParsedRequest, res: ServerResponse): void {
  const query = validateQuery(journalListQuerySchema, req.query);
  
  // Support both 'view' and 'status' query params
  const status = query.view || query.status;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const result = journalList(req.userId, status, query.limit, query.cursor);
  
  setCacheHeaders(res, { noStore: true });
  
  const response: JournalListResponse = {
    items: result.items,
    nextCursor: result.nextCursor,
  };
  
  sendJson(res, response);
}

export function handleJournalGetById(req: ParsedRequest, res: ServerResponse): void {
  const { id } = req.params;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const entry = journalGetById(req.userId, id);
  
  if (!entry) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, entry);
}

export function handleJournalCreate(req: ParsedRequest, res: ServerResponse): void {
  const body = validateBody(journalCreateRequestSchema, req.body);
  
  // Check for idempotency key (header is canonical)
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const entry = journalCreate(req.userId, body, idempotencyKey);
  
  setCacheHeaders(res, { noStore: true });
  sendCreated(res, entry);
}

export function handleJournalConfirm(req: ParsedRequest, res: ServerResponse): void {
  const { id } = req.params;
  const payload = validateBody(journalConfirmPayloadSchema, req.body);
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  // First check if entry exists
  const existing = journalGetById(req.userId, id);
  if (!existing) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  // Check for invalid state (can't confirm archived)
  if (existing.status === 'ARCHIVED') {
    throw conflict(
      'Cannot confirm an archived entry',
      ErrorCodes.JOURNAL_INVALID_STATE
    );
  }
  
  const entry = journalConfirm(req.userId, id, payload);
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, entry);
}

export function handleJournalArchive(req: ParsedRequest, res: ServerResponse): void {
  const { id } = req.params;
  const body = validateBody(journalArchiveRequestSchema, req.body);
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const existing = journalGetById(req.userId, id);
  if (!existing) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  const entry = journalArchive(req.userId, id, body.reason);
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, entry);
}

export function handleJournalRestore(req: ParsedRequest, res: ServerResponse): void {
  const { id } = req.params;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const existing = journalGetById(req.userId, id);
  if (!existing) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  const entry = journalRestore(req.userId, id);
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, entry);
}

export function handleJournalDelete(req: ParsedRequest, res: ServerResponse): void {
  const { id } = req.params;
  
  // userId is now REQUIRED for all journal operations (multitenancy)
  const deleted = journalDelete(req.userId, id);
  
  if (!deleted) {
    throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  }
  
  sendNoContent(res);
}
