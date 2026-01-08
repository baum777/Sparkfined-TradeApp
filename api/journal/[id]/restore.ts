/**
 * POST /api/journal/:id/restore - Restore journal entry to pending
 */

import { createHandler } from '../../_lib/handler';
import { sendJson, setCacheHeaders } from '../../_lib/response';
import { notFound, conflict, ErrorCodes } from '../../_lib/errors';
import { journalGetById, journalRestore } from '../../_lib/domain/journal/repo';
import { toApiJournalEntryV1 } from '../../_lib/domain/journal/mapper';
import { checkRateLimit } from '../../_lib/rate-limit';

export default createHandler({
  POST: async ({ req, res, userId }) => {
    await checkRateLimit('journal', userId);
    
    const id = req.query.id as string;
    
    // userId is now REQUIRED for all journal operations (multitenancy)
    const existing = await journalGetById(userId, id);
    if (!existing) {
      throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
    }

    // Canonical transitions: archived -> pending only
    if (existing.status !== 'ARCHIVED') {
      throw conflict(
        'Cannot restore an entry unless it is archived',
        ErrorCodes.JOURNAL_INVALID_STATE
      );
    }
    
    const entry = await journalRestore(userId, id);
    
    if (!entry) {
      throw conflict('Invalid state transition', ErrorCodes.JOURNAL_INVALID_STATE);
    }
    
    setCacheHeaders(res, { noStore: true });
    sendJson(res, toApiJournalEntryV1(entry));
  },
});
