import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { badRequestCode, notFound, unauthorized, internalError, ErrorCodes } from '../http/error.js';
import { getEnv } from '../config/env.js';
import { getPulseSnapshot, getPulseHistory, getLastRun } from '../domain/grokPulse/kv.js';
import { runGrokPulseEngine } from '../domain/grokPulse/engine.js';
import { logger } from '../observability/logger.js';

export async function handleGrokPulseSnapshot(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const address = req.params.address;
  if (!address) {
    throw badRequestCode('Missing token address', ErrorCodes.BAD_REQUEST);
  }

  const snapshot = await getPulseSnapshot(address);
  
  if (!snapshot) {
    throw notFound('No pulse data found for this token', ErrorCodes.NOT_FOUND);
  }

  setCacheHeaders(res, { noStore: true });
  sendJson(res, { snapshot });
}

export async function handleGrokPulseHistory(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const address = req.params.address;
  if (!address) {
    throw badRequestCode('Missing token address', ErrorCodes.BAD_REQUEST);
  }

  const history = await getPulseHistory(address);
  setCacheHeaders(res, { noStore: true });
  sendJson(res, { history });
}

export async function handleGrokPulseMeta(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  const lastRun = await getLastRun();
  setCacheHeaders(res, { noStore: true });
  sendJson(res, { lastRun });
}

export async function handleGrokPulseRun(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const env = getEnv();
  const secret = req.headers['x-cron-secret'];

  if (!env.GROK_PULSE_CRON_SECRET || secret !== env.GROK_PULSE_CRON_SECRET) {
    throw unauthorized('Invalid or missing cron secret');
  }

  try {
    const result = await runGrokPulseEngine();
    setCacheHeaders(res, { noStore: true });
    sendJson(res, { 
      ok: true, 
      meta: {
        processed: result.processed,
        quotaUsed: result.quota,
        ts: Date.now()
      } 
    });
  } catch (error) {
    logger.error('Manual Grok Pulse run failed', { error: String(error) });
    throw internalError('Pulse engine run failed');
  }
}


