/**
 * POST /api/journal/:id/confirm - Confirm journal entry
 */

import { createHandler } from '../../_lib/handler';
import { sendJson, setCacheHeaders } from '../../_lib/response';
import { notFound, conflict, ErrorCodes } from '../../_lib/errors';
import { journalGetById, journalConfirm } from '../../_lib/domain/journal/repo';
import { toApiJournalEntryV1 } from '../../_lib/domain/journal/mapper';
import { checkRateLimit } from '../../_lib/rate-limit';

export default createHandler({
  POST: async ({ req, res, userId }) => {
    await checkRateLimit('journal', userId);
    
    const id = req.query.id as string;
    
    // userId is now REQUIRED for all journal operations (multitenancy)
    // First check if entry exists
    const existing = await journalGetById(userId, id);
    if (!existing) {
      throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
    }
    
    // Canonical transitions: pending -> confirmed only (idempotent if already confirmed)
    if (existing.status === 'ARCHIVED') {
      throw conflict(
        'Cannot confirm an archived entry',
        ErrorCodes.JOURNAL_INVALID_STATE
      );
    }
    
    const entry = await journalConfirm(userId, id);
    
    if (!entry) {
      throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
    }
    
    setCacheHeaders(res, { noStore: true });
    sendJson(res, toApiJournalEntryV1(entry));
  },
});
