/**
 * POST /api/oracle/read-state/bulk - Bulk set read states
 */

import { createHandler } from '../../_lib/handler';
import { sendJson } from '../../_lib/response';
import { validateBody, oracleBulkReadStateRequestSchema } from '../../_lib/validation';
import { oracleBulkSetReadState } from '../../_lib/domain/oracle/repo';
import { checkRateLimit } from '../../_lib/rate-limit';

interface OracleBulkReadStateResponse {
  updated: Array<{
    id: string;
    isRead: boolean;
    updatedAt: string;
  }>;
}

export default createHandler({
  POST: async ({ req, res, userId }) => {
    await checkRateLimit('oracle', userId);
    
    const body = validateBody(oracleBulkReadStateRequestSchema, req.body);
    
    const results = await oracleBulkSetReadState(userId, body.ids, body.isRead);
    
    const response: OracleBulkReadStateResponse = {
      updated: results.map(r => ({
        id: r.id,
        isRead: r.isRead,
        updatedAt: r.updatedAt,
      })),
    };
    
    sendJson(res, response);
  },
  // Alias: allow PUT as well as POST (contract allows POST/PUT).
  PUT: async ({ req, res, userId }) => {
    await checkRateLimit('oracle', userId);
    
    const body = validateBody(oracleBulkReadStateRequestSchema, req.body);
    
    const results = await oracleBulkSetReadState(userId, body.ids, body.isRead);
    
    const response: OracleBulkReadStateResponse = {
      updated: results.map(r => ({
        id: r.id,
        isRead: r.isRead,
        updatedAt: r.updatedAt,
      })),
    };
    
    sendJson(res, response);
  },
});
