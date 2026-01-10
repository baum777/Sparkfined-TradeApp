import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { validateQuery } from '../validation/validate.js';
import { signalsUnifiedQuerySchema } from '../validation/schemas.js';
import { oracleGetDaily } from '../domain/oracle/repo.js';
import { getPulseSnapshot } from '../domain/grokPulse/kv.js';
import { oracleDailyToSignalCards, pulseSnapshotToSignalCard } from '../domain/signals/unified.js';
import type { SignalCard, UnifiedSignalsResponse } from '../domain/signals/types.js';
 
/**
 * Canonical Unified Signals Aggregator
 * - GET /api/signals/unified?asset=<id>&filter=&sort=
 */
 
function applyFilter(items: SignalCard[], filter?: string): SignalCard[] {
  if (!filter) return items;
  const f = filter.trim().toLowerCase();
  if (!f) return items;
 
  // Minimal semantics: allow filtering by source, e.g. filter=oracle or filter=pulse
  return items.filter((c) => c.source.toLowerCase() === f);
}
 
function applySort(items: SignalCard[], sort?: string): SignalCard[] {
  const s = (sort || '').trim().toLowerCase();
  if (!s || s === 'ts_desc') {
    return [...items].sort((a, b) => b.ts - a.ts);
  }
  if (s === 'ts_asc') {
    return [...items].sort((a, b) => a.ts - b.ts);
  }
  // Unknown sort: keep stable order.
  return items;
}
 
export async function handleSignalsUnified(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const query = validateQuery(signalsUnifiedQuerySchema, req.query);
  const asset = query.asset;
 
  const daily = oracleGetDaily(new Date(), req.userId);
  const oracleCards = oracleDailyToSignalCards(asset, daily);
 
  const pulse = await getPulseSnapshot(asset);
  const pulseCards: SignalCard[] = pulse ? [pulseSnapshotToSignalCard(asset, pulse)] : [];
 
  let items = [...pulseCards, ...oracleCards];
  items = applyFilter(items, query.filter);
  items = applySort(items, query.sort);
 
  const payload: UnifiedSignalsResponse = { items };
 
  // User-specific read states are embedded in oracle-derived cards -> private caching only.
  setCacheHeaders(res, { public: false, maxAge: 15 });
  sendJson(res, payload);
}

