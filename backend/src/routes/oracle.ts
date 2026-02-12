import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { validateBody, validateQuery } from '../validation/validate.js';
import {
  oracleDailyQuerySchema,
  oracleReadStateRequestSchema,
  oracleBulkReadStateRequestSchema,
} from '../validation/schemas.js';
import {
  oracleGetDaily,
  oracleSetReadState,
  oracleBulkSetReadState,
} from '../domain/oracle/repo.js';
import { resolveTierFromAuthUser } from '../domain/settings/tier.js';
import { getSettings } from '../domain/settings/settings.service.js';
import { buildContextPack } from '../domain/contextPack/build.js';
import { buildOracleContextExtension } from '../domain/contextPack/oracleExtension.js';

/**
 * Oracle Routes
 * Per API_SPEC.md section 3
 */

export interface OracleReadStateResponse {
  id: string;
  isRead: boolean;
  updatedAt: string;
}

export interface OracleBulkReadStateResponse {
  updated: OracleReadStateResponse[];
}

export async function handleOracleDaily(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const query = validateQuery(oracleDailyQuerySchema, req.query);
  
  // Parse date or use today
  let date: Date;
  if (query.date) {
    date = new Date(query.date + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) {
      date = new Date();
    }
  } else {
    date = new Date();
  }
  
  const feed = await oracleGetDaily(date, req.userId);
  
  // Per BACKEND MAP section 2C: Build context pack if asset provided
  // Uses at-trade snapshot + deltas if eligible/cached
  // narrative optional, use arbitration rules for narrative evidence
  const tier = resolveTierFromAuthUser(req.user);
  if (tier && query.asset) {
    const settings = await getSettings(req.userId);
    const contextPack = await buildContextPack({
      userId: req.userId,
      tier,
      asset: {
        mint: query.asset,
      },
      anchor: {
        mode: 'trade_centered',
        anchorTimeISO: date.toISOString(),
      },
      includeGrok: false, // Oracle does not request narrative by default
      settings,
    });
    
    const contextExtension = buildOracleContextExtension(contextPack);
    if (contextExtension) {
      (feed as any).context = contextExtension;
    }
  }
  
  // Cache headers per API_SPEC.md
  // User-specific read states mean we use private caching
  setCacheHeaders(res, { public: false, maxAge: 60 });
  
  sendJson(res, feed);
}

export async function handleOracleReadState(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = validateBody(oracleReadStateRequestSchema, req.body);

  const result = await oracleSetReadState(req.userId, body.id, body.isRead);
  
  const response: OracleReadStateResponse = {
    id: result.id,
    isRead: result.isRead,
    updatedAt: result.updatedAt,
  };
  
  sendJson(res, response);
}

export async function handleOracleBulkReadState(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = validateBody(oracleBulkReadStateRequestSchema, req.body);

  const results = await oracleBulkSetReadState(req.userId, body.ids, body.isRead);
  
  const response: OracleBulkReadStateResponse = {
    updated: results.map(r => ({
      id: r.id,
      isRead: r.isRead,
      updatedAt: r.updatedAt,
    })),
  };
  
  sendJson(res, response);
}
