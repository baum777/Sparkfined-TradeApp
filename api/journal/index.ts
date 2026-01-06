/**
 * GET /api/journal - List journal entries
 * POST /api/journal - Create journal entry
 */

import { createHandler, getQueryParams, getIdempotencyKey } from '../_lib/handler';
import { sendJson, sendCreated, setCacheHeaders } from '../_lib/response';
import { validateBody, validateQuery, journalListQuerySchema, journalCreateRequestSchema } from '../_lib/validation';
import { journalList, journalCreateWithMeta, journalRepoKV } from '../_lib/domain/journal/repo';
import { JournalCreateRequest } from '../_lib/domain/journal/types';
import { toApiJournalEntryV1, JournalEntryV1 } from '../_lib/domain/journal/mapper';
import { checkRateLimit } from '../_lib/rate-limit';
import { buildOnchainContextSnapshot } from '../_lib/domain/journal/onchain/snapshot';

interface JournalListResponse {
  items: JournalEntryV1[];
  nextCursor?: string;
}

export default createHandler({
  GET: async ({ req, res, userId }) => {
    await checkRateLimit('journal', userId);
    
    const query = validateQuery(journalListQuerySchema, getQueryParams(req));
    
    // Support both 'view' and 'status' query params
    const status = query.view || query.status;
    
    // userId is now REQUIRED for all journal operations (multitenancy)
    const result = await journalList(userId, status, query.limit, query.cursor);
    
    setCacheHeaders(res, { noStore: true });
    
    const response: JournalListResponse = {
      items: result.items.map(toApiJournalEntryV1),
      nextCursor: result.nextCursor,
    };
    
    sendJson(res, response);
  },
  
  POST: async ({ req, res, userId, requestId }) => {
    await checkRateLimit('journal', userId);
    
    const body = validateBody(journalCreateRequestSchema, req.body) as JournalCreateRequest;
    const idempotencyKey = getIdempotencyKey(req);
    
    // userId is now REQUIRED for all journal operations (multitenancy)
    const { event: entry, isReplay } = await journalCreateWithMeta(userId, body, idempotencyKey);
    
    // P1.2 Frozen Onchain Snapshot (best-effort, non-blocking)
    // Only capture if user provided a symbol/address AND we don't have one yet (idempotency replay)
    if (body.symbolOrAddress && !entry.onchainContext) {
      try {
        const { context, meta } = await buildOnchainContextSnapshot({
          symbolOrAddress: body.symbolOrAddress,
          requestId,
          now: entry.createdAt, // align with entry creation
        });
        
        // Update entry in memory
        entry.onchainContext = context;
        entry.onchainContextMeta = meta;
        
        // Persist update (safe because we are the creator/owner)
        await journalRepoKV.putEvent(userId, entry);
      } catch (_err) {
        // Safeguard: logic in builder should catch all provider errors, 
        // but if something unexpected throws, we log and proceed (do not fail the write).
        console.error('Snapshot capture failed fatally', { requestId, error: _err });
      }
    }

    setCacheHeaders(res, { noStore: true });
    if (isReplay) {
      sendJson(res, toApiJournalEntryV1(entry), 200);
    } else {
      sendCreated(res, toApiJournalEntryV1(entry));
    }
  },
});
